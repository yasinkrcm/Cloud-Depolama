/**
 * @file index.ts
 * @role Main entry point for Cloud Storage API server
 * @depends ElysiaJS, MongoDB/Mongoose, File model, upload routes
 * @dataflow HTTP Request → Elysia routes → Handlers → Response
 */

import { Elysia } from 'elysia'
import { edenTreaty } from '@elysiajs/eden'
import { cors } from '@elysiajs/cors'
import mongoose from 'mongoose'
import { connectDatabase } from './config/database.js'
import { File } from './models/File.js'
import { uploadRoutes, isStoragePathSafe, MIME_TYPE_RE, SAFE_INLINE_MIME_RE } from './routes/upload.js'

/**
 * Health check response type
 */
interface HealthResponse {
  status: 'ok' | 'error'
  timestamp: string
  mongo: {
    connected: boolean
    host?: string
    name?: string
  }
}

/**
 * Type guard for Error objects
 */
function isError(obj: unknown): obj is Error {
  return obj instanceof Error
}

/**
 * Global error handler setup
 * Logs all errors and returns formatted response
 */
const app = new Elysia()
  .use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  }))
  .onError(({ code, error, set }) => {
    // 1. Log the error (silent failure is forbidden)
    const errorMessage = isError(error) ? error.message : String(error)
    const errorStack = isError(error) ? error.stack : undefined

    console.error(`[${code}]`, errorMessage)
    if (errorStack) {
      console.error(errorStack)
    }

    // 2. Set appropriate status code and return a generic message —
    //    internal details (stacks, paths, driver errors) are logged but never leaked
    switch (code) {
      case 'NOT_FOUND':
        set.status = 404
        return { error: 'Not found', code }
      case 'VALIDATION':
        set.status = 400
        return { error: 'Invalid request', code }
      case 'PARSE':
        set.status = 400
        return { error: 'Invalid request body', code }
      case 'INTERNAL_SERVER_ERROR':
      default:
        set.status = 500
        return { error: 'Internal server error', code }
    }
  })

/**
 * Root endpoint - API information
 */
app.get('/', () => ({
  message: 'Cloud Storage API',
  version: '0.0.1',
  status: 'healthy',
  endpoints: {
    health: '/health',
    stats: '/stats',
    upload: {
      init: 'POST /upload/init',
      chunk: 'POST /upload/chunk',
      complete: 'POST /upload/complete',
      status: 'GET /upload/:fileId',
      cancel: 'DELETE /upload/:fileId'
    }
  }
}))

/**
 * Health check endpoint with MongoDB status
 */
app.get('/health', (): HealthResponse => {
  const mongoState = mongoose.connection.readyState

  const mongoStatus = {
    connected: mongoState === 1,
    host: mongoose.connection.host,
    name: mongoose.connection.name
  }

  return {
    status: mongoState === 1 ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    mongo: mongoStatus
  }
})

/**
 * Favicon handler to prevent 404 errors
 */
import { authRoutes, type SessionCookie } from './routes/auth.js'
import { jwt } from '@elysiajs/jwt'
import { ALLOWED_ORIGINS, JWT_SECRET } from './config/env.js'

/**
 * Register Public Routes
 */
app.use(authRoutes)

/**
 * Authentication Barrier 🛑
 * Inline onBeforeHandle on the main instance: in Elysia, hooks added inside
 * a `.use()`d plugin do NOT propagate to routes on the parent instance, so the
 * guard must be registered here for every route added after this point
 * (upload, files, stats, download, delete).
 */
app.use(jwt({ name: 'jwt', secret: JWT_SECRET, exp: '7d' }))

/**
 * Guard context contract (jwt cookie handle is provided by @elysiajs/jwt)
 */
interface GuardContext {
  request: Request
  jwt: { verify: (token: string) => Promise<unknown> }
  cookie: Record<string, SessionCookie | undefined>
  set: { status: number }
}

app.onBeforeHandle(async (context) => {
  const { request, jwt, cookie, set } = context as unknown as GuardContext

  // CSRF defense: cookie-authenticated state-changing requests must originate
  // from the allowlist (cross-site requests always carry an Origin header)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin')
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      set.status = 403
      return { success: false, error: 'Forbidden origin' }
    }
  }

  const auth_token = cookie['auth_token']
  if (!auth_token?.value) {
    set.status = 401
    return { success: false, error: 'Unauthorized route access' }
  }

  const payload = (await jwt.verify(auth_token.value)) as { id?: string } | null
  if (!payload || !payload.id) {
    set.status = 401
    return { success: false, error: 'Invalid Session' }
  }
})

/**
 * Register upload routes (JWT cookie session via credentials: 'include')
 */
app.use(uploadRoutes)

/**
 * List all files endpoint
 */
app.get('/files', async () => {
  try {
    const files = await File.find({ isDeleted: { $ne: true } }).sort({ uploadedAt: -1 }).limit(50)
    return {
      success: true,
      data: files.map(f => ({
        id: f._id.toString(),
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        sha256: f.sha256,
        uploadStatus: f.uploadStatus,
        uploadedChunks: f.uploadedChunks,
        totalChunks: f.totalChunks,
        progress: Math.round((f.uploadedChunks.length / f.totalChunks) * 100),
        uploadedAt: f.uploadedAt,
        completedAt: f.completedAt
      }))
    }
  } catch (err) {
    throw new Error('Failed to fetch files', { cause: err })
  }
})

/**
 * Upload statistics endpoint (for monitoring)
 */
app.get('/stats', async () => {
  try {
    const stats = await File.getStats()
    return {
      success: true,
      data: stats
    }
  } catch (err) {
    throw new Error('Failed to fetch stats', { cause: err })
  }
})

/**
 * GET /files/:id/download
 * Download a file by ID (stream)
 */
app.get('/files/:id/download', async ({ params, query, set }) => {
  const { id } = params

  // Validate ID
  const fileIdError = validateFileId(id)
  if (fileIdError) {
    set.status = 400
    return { success: false, error: fileIdError }
  }

  try {
    const file = await File.findById(id)
    if (!file || file.isDeleted) {
      set.status = 404
      return { success: false, error: 'File not found' }
    }

    if (file.uploadStatus !== 'completed') {
      set.status = 400
      return { success: false, error: 'File upload not completed' }
    }

    // Path containment: the stored record must resolve inside STORAGE_DIR
    if (!isStoragePathSafe(file.storagePath, file.fileName)) {
      set.status = 500
      return { success: false, error: 'Invalid storage path' }
    }

    // Read file location
    const { join } = await import('node:path')

    const filePath = join(file.storagePath, file.fileName)

    // Use Bun.file to enable automatic HTTP Range request support for media streaming (audio/video scrubbing)
    const bunFile = Bun.file(filePath)
    
    // We don't want to throw an error if the file is missing from disk but exists in DB
    if (!(await bunFile.exists())) {
      set.status = 404
      return { success: false, error: 'File not found on disk' }
    }

    // Set headers — mimeType was validated at init, but re-check before
    // using it so a tampered record can never inject a header value
    const safeMimeType = MIME_TYPE_RE.test(file.mimeType)
      ? file.mimeType
      : 'application/octet-stream'
    set.headers['Content-Type'] = safeMimeType

    // Inline serving only for a safe allowlist; force attachment otherwise
    const canInline = SAFE_INLINE_MIME_RE.test(safeMimeType)
    const disposition = (query && query.inline === 'true' && canInline) ? 'inline' : 'attachment'

    // RFC 5987 compliant encoding for non-ASCII filenames (Turkish characters: ş, ı, ğ, ö, ç, ü)
    // This prevents "Header has invalid value" errors in Bun/Elysia
    const asciiFallback = file.fileName.replace(/[^ -~]/g, '_')
    const encodedFileName = encodeURIComponent(file.fileName)
    set.headers['Content-Disposition'] = `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFileName}`

    // Sandboxed context: block XSS via uploaded content on the API origin
    set.headers['X-Content-Type-Options'] = 'nosniff'
    set.headers['Content-Security-Policy'] = 'sandbox'

    set.headers['X-SHA256'] = file.sha256

    return bunFile
  } catch (err) {
    throw new Error('Failed to download file', { cause: err })
  }
})

/**
 * DELETE /files/:id
 * Delete a file by ID (disk + DB)
 */
app.delete('/files/:id', async ({ params, set }) => {
  const { id } = params

  // Validate ID
  const fileIdError = validateFileId(id)
  if (fileIdError) {
    set.status = 400
    return { success: false, error: fileIdError }
  }

  try {
    const file = await File.findById(id)
    if (!file || file.isDeleted) {
      set.status = 404
      return { success: false, error: 'File not found' }
    }

    // Soft delete: flag the database record, leave files on disk
    file.isDeleted = true
    file.deletedAt = new Date()
    await file.save()

    return {
      success: true,
      message: 'File flagged as deleted successfully'
    }
  } catch (err) {
    throw new Error('Failed to delete file', { cause: err })
  }
})

/**
 * Validate fileId is a valid MongoDB ObjectId
 */
function validateFileId(fileId: unknown): string | null {
  if (!fileId || typeof fileId !== 'string') {
    return 'fileId is required and must be a string'
  }
  if (fileId.trim() === '') {
    return 'fileId cannot be empty'
  }
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return 'fileId is not a valid ObjectId'
  }
  return null
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`)

  try {
    await mongoose.disconnect()
    console.log('✅ MongoDB disconnected')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })

/**
 * Start server
 */
const PORT = Number(process.env.PORT) || 3001
// Bind to loopback by default — never expose the API to the network unintentionally
const HOST = process.env.HOST || '127.0.0.1'

async function start() {
  try {
    // Connect to database before starting server
    await connectDatabase()

    app.listen({ hostname: HOST, port: PORT }, () => {
      console.log(`🦊 Cloud Storage API running at http://localhost:${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`📈 Stats: http://localhost:${PORT}/stats`)
      console.log(`📤 Upload API: http://localhost:${PORT}/upload/*`)
    })
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
}

void start()

/**
 * Export Eden Treaty for type-safe client
 */
export type App = typeof app
export const api = edenTreaty<App>('http://localhost:3001')
