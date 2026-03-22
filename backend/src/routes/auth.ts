import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { User } from '../models/User.js'

const JWT_SECRET = process.env.JWT_SECRET || 'very-secure-development-secret-key'

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
  .post('/login', async ({ body, jwt, cookie, set }) => {
    const user = await User.findOne({ email: body.email } as any)
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
    const auth_token = cookie.auth_token as any
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
    // Single-user lock
    const count = await User.countDocuments()
    if (count > 0) {
      set.status = 403
      return { success: false, error: 'Registration is locked. Admin is already registered.' }
    }

    // Hash password with Bun native bcrypt
    const passwordHash = await Bun.password.hash(body.password)
    
    // Create new user
    const user = new User({
      email: body.email,
      passwordHash
    })
    await user.save()

    // Sign JWT and set session cookie
    const token = await jwt.sign({ id: user._id.toString() })
    
    const auth_token = cookie.auth_token as any
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
      password: t.String({ minLength: 6 })
    })
  })
  .post('/logout', ({ cookie }) => {
    const auth_token = cookie.auth_token as any
    if (auth_token) auth_token.remove()
    return { success: true }
  })
  .get('/setup-status', async () => {
    const count = await User.countDocuments()
    return { hasUser: count > 0 }
  })
  .get('/me', async ({ jwt, cookie, set }) => {
    const auth_token = cookie.auth_token as any
    if (!auth_token || !auth_token.value) {
      set.status = 401
      return { success: false, error: 'Unauthorized' }
    }

    const payload = await jwt.verify(auth_token.value)
    if (!payload || !payload.id) {
      set.status = 401
      return { success: false, error: 'Unauthorized' }
    }

    const user = await User.findOne({ _id: payload.id as string } as any)
    if (!user) {
      set.status = 401
      return { success: false, error: 'User not found' }
    }

    return { success: true, user: { email: user.email } }
  })

/**
 * Authentication Guard Middleware
 * Automatically rejects requests missing a valid JWT cookie
 */
export const requireAuth = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: JWT_SECRET
    })
  )
  .onBeforeHandle(async ({ jwt, cookie, set }) => {
    const auth_token = cookie.auth_token as any
    if (!auth_token || !auth_token.value) {
      set.status = 401
      return { success: false, error: 'Unauthorized route access' }
    }

    const payload = await jwt.verify(auth_token.value)
    if (!payload || !payload.id) {
      set.status = 401
      return { success: false, error: 'Invalid Session' }
    }
  })
