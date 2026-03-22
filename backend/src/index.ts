/**
 * @file index.ts
 * @role Main entry point for Cloud Storage API server
 * @depends ElysiaJS, MongoDB/Mongoose, File model, upload routes
 * @dataflow HTTP Request → Elysia routes → Handlers → Response
 */

import { Elysia, t } from 'elysia'
import { edenTreaty } from '@elysiajs/eden'
import { cors } from '@elysiajs/cors'
import mongoose from 'mongoose'
import { connectDatabase } from './config/database.js'
import { File } from './models/File.js'
import { uploadRoutes } from './routes/upload.js'

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
 * Error response schema (TypeBox)
 */
const ErrorResponseSchema = t.Object({
  error: t.String(),
  code: t.Optional(t.String())
})

/**
 * Type guard for Error objects
 */
function isError(obj: unknown): obj is Error {
  return obj instanceof Error
}

/**
 * Allowed CORS origins configuration
 */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']

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

    // 2. Set appropriate status code
    switch (code) {
      case 'NOT_FOUND':
        set.status = 404
        break
      case 'VALIDATION':
        set.status = 400
        break
      case 'INTERNAL_SERVER_ERROR':
      default:
        set.status = 500
        break
    }

    // 3. Return formatted error response
    return {
      error: errorMessage,
      code
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
import { authRoutes, requireAuth } from './routes/auth.js'

/**
 * Register Public Routes
 */
app.use(authRoutes)

/**
 * Authentication Barrier 🛑
 * All routes registered below this block will require a valid JWT cookie
 */
app.use(requireAuth)

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
    const message = isError(err) ? err.message : String(err)
    throw new Error(`Failed to fetch files: ${message}`)
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
    const message = isError(err) ? err.message : String(err)
    throw new Error(`Failed to fetch stats: ${message}`)
  }
})

/**
 * Register upload routes
 */
app.use(uploadRoutes)

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

    // Set headers
    set.headers['Content-Type'] = file.mimeType || 'application/octet-stream'
    
    // Feature: Support inline preview rendering for Google Drive UI
    if (query && query.inline === 'true') {
      set.headers['Content-Disposition'] = `inline; filename="${file.fileName}"`
    } else {
      set.headers['Content-Disposition'] = `attachment; filename="${file.fileName}"`
    }
    
    set.headers['X-SHA256'] = file.sha256

    return bunFile
  } catch (err) {
    const message = isError(err) ? err.message : String(err)
    throw new Error(`Failed to download file: ${message}`)
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
    const message = isError(err) ? err.message : String(err)
    throw new Error(`Failed to delete file: ${message}`)
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

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

/**
 * Start server
 */
const PORT = process.env.PORT || 3001

async function start() {
  try {
    // Connect to database before starting server
    await connectDatabase()

    app.listen(PORT, () => {
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

start()

/**
 * Export Eden Treaty for type-safe client
 */
export type App = typeof app
export const api = edenTreaty<App>('http://localhost:3001')
