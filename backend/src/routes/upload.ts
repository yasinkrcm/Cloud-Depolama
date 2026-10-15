/**
 * @file upload.ts
 * @role Chunked file upload routes with SHA-256 verification
 * @depends Elysia, File model, node:crypto, node:fs (streams)
 * @dataflow Client → init upload → chunk uploads → verify SHA-256 → complete
 */

import { Elysia, t } from 'elysia'
import { File } from '../models/File.js'
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { finished, pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import mongoose from 'mongoose'

/**
 * Storage directory (absolute, so path-containment checks are reliable)
 */
const STORAGE_DIR = resolve(process.env.STORAGE_DIR || './storage')

/**
 * Maximum upload file size (default 50GB)
 */
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 53687091200 // 50GB

/**
 * Maximum number of chunks per upload (disk-exhaustion guard)
 */
const MAX_TOTAL_CHUNKS = 100000

/**
 * Matches a hex-encoded SHA-256 digest
 */
const HEX256_RE = /^[a-f0-9]{64}$/i

/**
 * Restricts mimeType to a safe "type/subtype" token shape (prevents header injection)
 */
export const MIME_TYPE_RE = /^[\w.+-]+\/[\w.+-]+$/

/**
 * Mimetypes that may be served inline; everything else is forced to attachment
 */
export const SAFE_INLINE_MIME_RE = /^(image\/|video\/|audio\/|application\/pdf)/

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir() {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true })
  }
}

/**
 * Returns true when a target path is strictly contained within a base directory
 * (relative paths are resolved, traversal must never escape the base)
 */
function isWithinDir(base: string, target: string): boolean {
  const rel = relative(resolve(base), resolve(target))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * Verify a stored/derived path is strictly contained within STORAGE_DIR.
 * Defense-in-depth against tampered database records.
 */
export function isStoragePathSafe(storagePath: string, fileName?: string): boolean {
  if (!isWithinDir(STORAGE_DIR, storagePath)) return false
  if (fileName === undefined) return true
  return isWithinDir(storagePath, join(storagePath, fileName))
}

/**
 * Sanitize a client-supplied file name into a safe on-disk name.
 * Strips directory components and every character that could enable
 * path traversal or filesystem special files.
 */
function getSafeFileName(fileName: string): string {
  const safe = basename(fileName)
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\p{C}+/gu, '_')
    .trim()

  if (!safe || safe === '.' || safe === '..') return 'file'
  return safe.slice(0, 255)
}

/**
 * Validate fileId is a valid MongoDB ObjectId
 * Returns error message if invalid, null if valid
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
 * Verify SHA-256 hash of data. Never leaks the actual digests to the client.
 * @throws Error if hash doesn't match
 */
async function verifySha256(data: ArrayBuffer, expectedHash: string): Promise<void> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Buffer.from(hashBuffer).toString('hex')

  if (hashHex !== expectedHash) {
    console.error(`Chunk SHA-256 verification failed: expected ${expectedHash}, got ${hashHex}`)
    throw new Error('Chunk hash verification failed')
  }
}

const InitUploadSchema = t.Object({
  fileName: t.String(),
  fileSize: t.Number(),
  mimeType: t.String(),
  chunkSize: t.Number(),
  totalChunks: t.Number(),
  fileHash: t.String()
})

const CompleteUploadSchema = t.Object({
  fileId: t.String(),
  finalHash: t.String()
})

/**
 * Upload routes plugin
 */
export const uploadRoutes = new Elysia({ prefix: '/upload' })
  /**
   * POST /upload/init
   * Initialize a new chunked upload
   */
  .post(
    '/init',
    async ({ body, set }) => {
      await ensureStorageDir()

      const { fileName, fileSize, mimeType, chunkSize, totalChunks, fileHash } = body

      // Validate max file size
      if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        set.status = 400
        return {
          success: false,
          error: `fileSize must be positive and not exceed ${MAX_FILE_SIZE} bytes`
        }
      }

      // Validate chunk size
      if (chunkSize < 1024 || chunkSize > 100 * 1024 * 1024) {
        set.status = 400
        return {
          success: false,
          error: 'chunkSize must be between 1KB and 100MB'
        }
      }

      // Validate chunk geometry consistency (prevents unbounded per-chunk writes)
      if (
        !Number.isInteger(totalChunks) ||
        totalChunks < 1 ||
        totalChunks > MAX_TOTAL_CHUNKS ||
        totalChunks * chunkSize < fileSize ||
        (totalChunks - 1) * chunkSize >= fileSize
      ) {
        set.status = 400
        return {
          success: false,
          error: 'fileSize/chunkSize/totalChunks are inconsistent'
        }
      }

      // Reject traversal vectors: fileHash must be a hex SHA-256 digest
      if (!HEX256_RE.test(fileHash)) {
        set.status = 400
        return {
          success: false,
          error: 'fileHash must be a hex-encoded SHA-256 hash'
        }
      }

      // Reject header injection via mimeType
      if (!MIME_TYPE_RE.test(mimeType)) {
        set.status = 400
        return {
          success: false,
          error: 'mimeType must be a valid type/subtype string'
        }
      }

      // Sanitize fileName: strip directory components and traversal characters
      const safeFileName = getSafeFileName(fileName)

      // Calculate storage path for new file
      // Use timestamp + hash suffix to avoid collisions for same content uploaded multiple times
      const timestamp = Date.now()
      const storagePath = join(STORAGE_DIR, `${fileHash}-${timestamp}`)

      // Create pending file record with the sanitized name
      const file = await File.createPending(
        safeFileName,
        fileSize,
        mimeType,
        fileHash,
        chunkSize,
        totalChunks,
        storagePath
      )

      return {
        success: true,
        fileId: file._id.toString(),
        uploadStatus: 'pending'
      }
    },
    { body: InitUploadSchema }
  )

  /**
   * POST /upload/chunk
   * Upload a single chunk with SHA-256 verification
   * Uses multipart/form-data: fileId, chunkIndex, chunkHash as form fields, chunk as file
   */
  .post(
    '/chunk',
    async ({ request, set }) => {
      await ensureStorageDir()

      // Parse multipart form data
      const formData = await request.formData()

      const fileId = formData.get('fileId') as string
      const chunkIndexStr = formData.get('chunkIndex') as string
      const chunkHash = formData.get('chunkHash') as string
      const chunkData = formData.get('chunk') as unknown

      // Validate fileId
      const fileIdError = validateFileId(fileId)
      if (fileIdError) {
        set.status = 400
        return {
          success: false,
          error: fileIdError
        }
      }

      // Validate chunkIndex
      const chunkIndex = parseInt(chunkIndexStr, 10)
      if (isNaN(chunkIndex) || chunkIndex < 0) {
        set.status = 400
        return {
          success: false,
          error: 'chunkIndex must be a valid non-negative number'
        }
      }

      // Validate chunkHash format
      if (!chunkHash || typeof chunkHash !== 'string' || !HEX256_RE.test(chunkHash)) {
        set.status = 400
        return {
          success: false,
          error: 'chunkHash must be a hex-encoded SHA-256 hash'
        }
      }

      // Validate required fields
      if (!chunkData) {
        set.status = 400
        return {
          success: false,
          error: 'No chunk data provided'
        }
      }

      // Find file record
      const file = await File.findById(fileId)
      if (!file) {
        set.status = 404
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Reject uploads to completed records and out-of-range indexes
      // (prevents unbounded distinct chunk files → disk exhaustion)
      if (file.uploadStatus === 'completed') {
        set.status = 400
        return {
          success: false,
          error: 'Upload already completed'
        }
      }
      if (chunkIndex >= file.totalChunks) {
        set.status = 400
        return {
          success: false,
          error: 'chunkIndex exceeds totalChunks'
        }
      }

      // Check if chunk already uploaded
      if (file.uploadedChunks.includes(chunkIndex)) {
        return {
          success: true,
          chunkIndex,
          alreadyUploaded: true,
          uploadedChunks: file.uploadedChunks,
          uploadStatus: file.uploadStatus
        }
      }

      // Convert chunk data to ArrayBuffer
      let chunkArrayBuffer: ArrayBuffer
      if (chunkData instanceof Blob) {
        chunkArrayBuffer = await chunkData.arrayBuffer()
      } else if (chunkData instanceof ArrayBuffer) {
        chunkArrayBuffer = chunkData
      } else if (Buffer.isBuffer(chunkData)) {
        chunkArrayBuffer = chunkData.buffer.slice(chunkData.byteOffset, chunkData.byteOffset + chunkData.byteLength) as ArrayBuffer
      } else {
        // Try to convert to string then to buffer (for file uploads)
        const str = String(chunkData)
        chunkArrayBuffer = new TextEncoder().encode(str).buffer
      }

      // Enforce exact per-chunk size derived from fileSize (last chunk may be smaller,
      // so an oversized body can never slip through as the "final chunk")
      const expectedSize =
        chunkIndex === file.totalChunks - 1
          ? file.fileSize - (file.totalChunks - 1) * file.chunkSize
          : file.chunkSize
      if (chunkArrayBuffer.byteLength !== expectedSize) {
        set.status = 400
        return {
          success: false,
          error: `Chunk size mismatch: expected ${expectedSize} bytes for this chunk`
        }
      }

      // Verify SHA-256 hash of chunk
      try {
        await verifySha256(chunkArrayBuffer, chunkHash)
      } catch (err) {
        set.status = 400
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Chunk hash verification failed'
        }
      }

      // Path containment: chunk files must land inside the validated storage directory
      if (!isStoragePathSafe(file.storagePath)) {
        set.status = 500
        return {
          success: false,
          error: 'Invalid storage path'
        }
      }

      // Write chunk to disk (stream-like approach)
      const chunkPath = join(file.storagePath, `chunk-${chunkIndex}`)
      if (!isWithinDir(file.storagePath, chunkPath)) {
        set.status = 500
        return {
          success: false,
          error: 'Invalid chunk path'
        }
      }
      await mkdir(file.storagePath, { recursive: true })
      await writeFile(chunkPath, Buffer.from(chunkArrayBuffer))

      // Mark chunk as uploaded in database
      await file.markChunkUploaded(chunkIndex, chunkHash)

      return {
        success: true,
        chunkIndex,
        uploadedChunks: file.uploadedChunks,
        uploadStatus: file.uploadStatus,
        progress: Math.round((file.uploadedChunks.length / file.totalChunks) * 100)
      }
    }
  )

  /**
   * POST /upload/complete
   * Verify final file hash and complete upload.
   * Assembles the final file by streaming chunks through SHA-256 —
   * the whole file is never buffered in memory.
   */
  .post(
    '/complete',
    async ({ body, set }) => {
      const { fileId, finalHash } = body

      // Validate fileId
      const fileIdError = validateFileId(fileId)
      if (fileIdError) {
        set.status = 400
        return {
          success: false,
          error: fileIdError
        }
      }

      // Validate finalHash format
      if (!finalHash || !HEX256_RE.test(finalHash)) {
        set.status = 400
        return {
          success: false,
          error: 'finalHash must be a hex-encoded SHA-256 hash'
        }
      }

      // Find file record
      const file = await File.findById(fileId)
      if (!file) {
        set.status = 404
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Check if all chunks are uploaded
      if (file.uploadedChunks.length !== file.totalChunks) {
        set.status = 400
        return {
          success: false,
          error: 'Not all chunks uploaded',
          uploadedChunks: file.uploadedChunks.length,
          totalChunks: file.totalChunks
        }
      }

      // Path containment for the assembled final file
      if (!isStoragePathSafe(file.storagePath, file.fileName)) {
        set.status = 500
        return {
          success: false,
          error: 'Invalid storage path'
        }
      }

      const finalFilePath = join(file.storagePath, file.fileName)

      // Idempotency guard: reject re-completing an already assembled upload
      if (existsSync(finalFilePath)) {
        set.status = 400
        return {
          success: false,
          error: 'Upload already completed'
        }
      }

      // Stream every chunk through SHA-256 while assembling the final file
      const hasher = createHash('sha256')
      const output = createWriteStream(finalFilePath)
      let currentChunkIndex = 0

      try {
        for (let i = 0; i < file.totalChunks; i++) {
          currentChunkIndex = i
          const chunkPath = join(file.storagePath, `chunk-${i}`)
          if (!isWithinDir(file.storagePath, chunkPath)) {
            throw new Error(`Invalid chunk path ${i}`)
          }

          const passThrough = new Transform({
            transform(chunk, _encoding, callback) {
              hasher.update(chunk)
              callback(null, chunk)
            }
          })

          await pipeline(createReadStream(chunkPath), passThrough, output, { end: false })
        }

        // Flush the writable and wait for it to fully drain
        output.end()
        await finished(output)
      } catch (err) {
        output.destroy()
        console.error(`Failed to assemble final file ${fileId}:`, err)
        await unlink(finalFilePath).catch(() => {})

        set.status = 500
        return {
          success: false,
          error: `Failed to read chunk ${currentChunkIndex}`
        }
      }

      // Verify final hash against both the client-submitted hash and the init hash
      const calculatedHash = hasher.digest('hex')

      if (calculatedHash !== finalHash || calculatedHash !== file.sha256) {
        await unlink(finalFilePath).catch(() => {})

        file.uploadStatus = 'failed'
        await file.save()

        set.status = 400
        return {
          success: false,
          error: 'Final hash verification failed'
        }
      }

      // Update file status to completed
      file.uploadStatus = 'completed'
      file.completedAt = new Date()
      await file.save()

      return {
        success: true,
        fileId: file._id.toString(),
        fileName: file.fileName,
        fileSize: file.fileSize,
        sha256: file.sha256,
        uploadStatus: 'completed'
      }
    },
    { body: CompleteUploadSchema }
  )

  /**
   * GET /upload/:fileId
   * Get upload status
   */
  .get(
    '/:fileId',
    async ({ params, set }) => {
      const { fileId } = params

      // Validate fileId
      const fileIdError = validateFileId(fileId)
      if (fileIdError) {
        set.status = 400
        return {
          success: false,
          error: fileIdError
        }
      }

      const file = await File.findById(fileId)
      if (!file) {
        set.status = 404
        return {
          success: false,
          error: 'File not found'
        }
      }

      return {
        success: true,
        fileId: file._id.toString(),
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        sha256: file.sha256,
        uploadedChunks: file.uploadedChunks,
        totalChunks: file.totalChunks,
        uploadStatus: file.uploadStatus,
        progress: Math.round((file.uploadedChunks.length / file.totalChunks) * 100),
        uploadedAt: file.uploadedAt,
        completedAt: file.completedAt
      }
    }
  )

  /**
   * DELETE /upload/:fileId
   * Cancel/delete an upload (database record + disk cleanup)
   */
  .delete(
    '/:fileId',
    async ({ params, set }) => {
      const { fileId } = params

      // Validate fileId
      const fileIdError = validateFileId(fileId)
      if (fileIdError) {
        set.status = 400
        return {
          success: false,
          error: fileIdError
        }
      }

      const file = await File.findById(fileId)
      if (!file) {
        set.status = 404
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Delete the record first
      await File.findByIdAndDelete(fileId)

      // Clean up stored chunks and artifacts from disk
      try {
        if (isStoragePathSafe(file.storagePath)) {
          await rm(file.storagePath, { recursive: true, force: true })
        }
      } catch (err) {
        console.error(`Failed to clean up cancelled upload ${fileId}:`, err)
      }

      return {
        success: true,
        message: 'Upload cancelled'
      }
    }
  )
