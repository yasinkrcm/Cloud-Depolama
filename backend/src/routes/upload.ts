/**
 * @file upload.ts
 * @role Chunked file upload routes with SHA-256 verification
 * @depends Elysia, File model, crypto.subtle, fs
 * @dataflow Client → init upload → chunk uploads → verify SHA-256 → complete
 */

import { Elysia, t } from 'elysia'
import { File } from '../models/File.js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import mongoose from 'mongoose'

/**
 * Storage directory configuration
 */
const STORAGE_DIR = process.env.STORAGE_DIR || './storage'
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 10737418240


/**
 * Ensure storage directory exists
 */
async function ensureStorageDir() {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true })
  }
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
 * Verify SHA-256 hash of data
 * @throws Error if hash doesn't match
 */
async function verifySha256(data: ArrayBuffer, expectedHash: string): Promise<void> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Buffer.from(hashBuffer).toString('hex')

  if (hashHex !== expectedHash) {
    throw new Error(`SHA-256 verification failed: expected ${expectedHash}, got ${hashHex}`)
  }
}

/**
 * Calculate SHA-256 hash of data
 */
async function calculateSha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(hashBuffer).toString('hex')
}

/**
 * Schema definitions using TypeBox
 */
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
      if (fileSize > MAX_FILE_SIZE) {
        set.status = 400
        return {
          success: false,
          error: `fileSize exceeds the maximum limit of ${MAX_FILE_SIZE} bytes`
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

      // Check if file with same hash already exists
      const existingFile = await File.findByHash(fileHash)

      // If file is already completed, return deduplication response
      if (existingFile && existingFile.uploadStatus === 'completed') {
        // Restore if it was soft-deleted
        if (existingFile.isDeleted) {
          existingFile.isDeleted = false
          existingFile.set('deletedAt', undefined)
          await existingFile.save()
        }

        return {
          success: true,
          fileId: existingFile._id.toString(),
          uploadStatus: 'completed',
          alreadyExists: true,
          message: 'File already exists'
        }
      }

      // If file exists but not completed (e.g., failed, pending), reuse it
      if (existingFile) {
        // Reset the existing file for retry
        existingFile.uploadStatus = 'pending'
        existingFile.uploadedChunks = []
        existingFile.fileName = fileName
        existingFile.fileSize = fileSize
        existingFile.mimeType = mimeType
        existingFile.chunkSize = chunkSize
        existingFile.totalChunks = totalChunks
        existingFile.isDeleted = false
        existingFile.set('deletedAt', undefined)
        await existingFile.save()

        return {
          success: true,
          fileId: existingFile._id.toString(),
          uploadStatus: 'pending',
          reused: true
        }
      }

      // Calculate storage path for new file
      const storagePath = join(STORAGE_DIR, fileHash)

      // Create pending file record
      const file = await File.createPending(
        fileName,
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

      // Validate chunkHash
      if (!chunkHash || typeof chunkHash !== 'string' || chunkHash.trim() === '') {
        set.status = 400
        return {
          success: false,
          error: 'chunkHash is required'
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

      // Verify chunk size matches expected
      if (file.chunkSize !== chunkArrayBuffer.byteLength) {
        // Last chunk may be smaller
        if (chunkIndex !== file.totalChunks - 1) {
          set.status = 400
          return {
            success: false,
            error: `Chunk size mismatch: expected ${file.chunkSize}, got ${chunkArrayBuffer.byteLength}`
          }
        }
      }

      // Verify SHA-256 hash of chunk
      try {
        await verifySha256(chunkArrayBuffer, chunkHash)
      } catch (err) {
        set.status = 400
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Hash verification failed'
        }
      }

      // Write chunk to disk (stream-like approach)
      const chunkPath = join(file.storagePath, `chunk-${chunkIndex}`)
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
   * Verify final file hash and complete upload
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

      // Validate finalHash
      if (!finalHash || typeof finalHash !== 'string' || finalHash.trim() === '') {
        set.status = 400
        return {
          success: false,
          error: 'finalHash is required'
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

      // Read all chunks and verify final hash
      const chunks: Buffer[] = []
      for (let i = 0; i < file.totalChunks; i++) {
        const chunkPath = join(file.storagePath, `chunk-${i}`)
        try {
          const chunkData = await readFile(chunkPath)
          chunks.push(chunkData)
        } catch {
          set.status = 500
          return {
            success: false,
            error: `Failed to read chunk ${i}`
          }
        }
      }

      // Combine chunks and verify hash
      const combinedData = Buffer.concat(chunks)
      const calculatedHash = await calculateSha256(combinedData.buffer)

      if (calculatedHash !== finalHash) {
        file.uploadStatus = 'failed'
        await file.save()

        set.status = 400
        return {
          success: false,
          error: `Final hash mismatch: expected ${finalHash}, got ${calculatedHash}`
        }
      }

      // Also verify against original file hash
      if (calculatedHash !== file.sha256) {
        file.uploadStatus = 'failed'
        await file.save()

        set.status = 400
        return {
          success: false,
          error: `File hash mismatch with init hash: expected ${file.sha256}, got ${calculatedHash}`
        }
      }

      // Write final file to storage
      const finalFilePath = join(file.storagePath, file.fileName)
      await writeFile(finalFilePath, combinedData)

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
   * Cancel/delete an upload
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

      // Delete file from database
      await File.findByIdAndDelete(fileId)

      // Note: Cleanup of physical files could be added here
      // For now, we keep the files for recovery purposes

      return {
        success: true,
        message: 'Upload cancelled'
      }
    }
  )
