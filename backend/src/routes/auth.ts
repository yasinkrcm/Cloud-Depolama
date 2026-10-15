import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { User } from '../models/User.js'
import { JWT_SECRET } from '../config/env.js'
import mongoose from 'mongoose'

/**
 * Fixed-window per-IP rate limiter (brute-force guard for credential endpoints)
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10

/**
 * Consume one rate-limit token for the client IP.
 * Returns true when the request is allowed.
 */
function consumeRateLimit(request: Request): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()

  // Opportunistic cleanup to keep the map bounded
  if (loginAttempts.size > 1000) {
    for (const [key, entry] of loginAttempts) {
      if (entry.resetAt < now) loginAttempts.delete(key)
    }
  }

  const entry = loginAttempts.get(ip)
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  entry.count += 1
  return entry.count <= RATE_LIMIT_MAX
}

/**
 * Admin-slot claim marker document (atomically locks first-user registration)
 */
type ClaimDocument = { _id: string }

const Claim =
  (mongoose.models.AdminClaim as unknown as mongoose.Model<ClaimDocument> | undefined) ||
  mongoose.model<ClaimDocument>(
    'AdminClaim',
    new mongoose.Schema({ _id: String }, { strict: false })
  )

/**
 * Session cookie handle contract exposed by the @elysiajs/jwt plugin
 */
export interface SessionCookie {
  value: string
  set(options: {
    value: string
    httpOnly?: boolean
    path?: string
    secure?: boolean
    sameSite?: 'lax' | 'none' | 'strict'
  }): void
  remove(): void
}

/**
 * Public Authentication Routes
 */
export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: JWT_SECRET,
      exp: '7d'
    })
  )
  .post('/login', async ({ request, body, jwt, cookie, set }) => {
    // Brute-force guard
    if (!consumeRateLimit(request)) {
      set.status = 429
      return { success: false, error: 'Too many attempts. Please try again later.' }
    }

    const user = await User.findOne({ email: body.email })
    if (!user) {
      set.status = 401
      return { success: false, error: 'Invalid credentials' }
    }

    const isValid = await Bun.password.verify(body.password, user.passwordHash)
    if (!isValid) {
      set.status = 401
      return { success: false, error: 'Invalid credentials' }
    }

    // Sign JWT
    const token = await jwt.sign({ id: user._id.toString() })
    
    // Set HTTP-Only Session Cookie (no maxAge = deleted when browser closes)
    const auth_token = cookie.auth_token as unknown as SessionCookie
    auth_token.set({
      value: token,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    })

    return { success: true, user: { email: user.email } }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    })
  })
  .post('/register', async ({ body, jwt, cookie, set }) => {
    // Single-user lock: claim the admin slot atomically
    // (prevents concurrent registrations passing a count check)
    try {
      await Claim.create({ _id: 'admin-claimed' })
    } catch {
      set.status = 403
      return { success: false, error: 'Registration is locked. Admin is already registered.' }
    }

    // Hash password with Bun native bcrypt
    const passwordHash = await Bun.password.hash(body.password)

    // Create new user
    try {
      const user = new User({
        email: body.email,
        passwordHash
      })
      await user.save()

      // Sign JWT and set session cookie
      const token = await jwt.sign({ id: user._id.toString() })

      const auth_token = cookie.auth_token as unknown as SessionCookie
      auth_token.set({
        value: token,
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      })

      return { success: true, user: { email: user.email } }
    } catch (err) {
      // Release the admin slot if user creation failed
      await Claim.deleteOne({ _id: 'admin-claimed' })
      throw err
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String({ minLength: 6 })
    })
  })
  .post('/logout', ({ cookie }) => {
    const auth_token = cookie.auth_token as unknown as SessionCookie
    if (auth_token) auth_token.remove()
    return { success: true }
  })
  .get('/setup-status', async () => {
    const count = await User.countDocuments()
    return { hasUser: count > 0 }
  })
  .get('/me', async ({ jwt, cookie, set }) => {
    const auth_token = cookie.auth_token as unknown as SessionCookie
    if (!auth_token || !auth_token.value) {
      set.status = 401
      return { success: false, error: 'Unauthorized' }
    }

    const payload = await jwt.verify(auth_token.value)
    if (!payload || !payload.id) {
      set.status = 401
      return { success: false, error: 'Unauthorized' }
    }

    const user = await User.findOne({ _id: payload.id as string })
    if (!user) {
      set.status = 401
      return { success: false, error: 'User not found' }
    }

    return { success: true, user: { email: user.email } }
  })
