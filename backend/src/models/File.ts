/**
 * @file File.ts
 * @role Mongoose schema for file metadata storage
 * @depends Mongoose, shared types from packages/types
 * @dataflow Upload request → File document creation → Chunk updates → Completion
 */

import mongoose, { Schema } from 'mongoose'
import type { Model, Document } from 'mongoose'

/**
 * Upload status enum
 */
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed'

/**
 * Chunk metadata interface
 */
interface ChunkMetadata {
  index: number
  size: number
  hash: string
  uploadedAt: Date
}

/**
 * File document interface (Mongoose Document + typed fields)
 */
export interface IFileDocument extends Document {
  fileName: string
  fileSize: number
  mimeType: string
  sha256: string
  chunkSize: number
  totalChunks: number
  uploadedChunks: number[]
  uploadStatus: UploadStatus
  uploadedAt: Date
  completedAt?: Date
  storagePath: string
  isDeleted: boolean
  deletedAt?: Date
  markChunkUploaded(chunkIndex: number, chunkHash: string): Promise<void>
}

/**
 * Static methods interface for File model
 */
interface IFileStatics {
  findByHash(hash: string): Promise<IFileDocument | null>
  createPending(
    fileName: string,
    fileSize: number,
    mimeType: string,
    sha256: string,
    chunkSize: number,
    totalChunks: number,
    storagePath: string
  ): Promise<IFileDocument>
  getStats(): Promise<{
    total: number
    pending: number
    uploading: number
    completed: number
    failed: number
  }>
}

/**
 * Chunk schema definition (reserved for future chunk metadata storage)
 */
const _chunkSchema = new Schema<ChunkMetadata>(
  {
    index: { type: Number, required: true },
    size: { type: Number, required: true },
    hash: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
)

/**
 * File schema definition
 */
const fileSchema = new Schema<IFileDocument>(
  {
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0
    },
    mimeType: {
      type: String,
      required: true
    },
    sha256: {
      type: String,
      required: true
    },
    chunkSize: {
      type: Number,
      required: true,
      min: 1
    },
    totalChunks: {
      type: Number,
      required: true,
      min: 1
    },
    uploadedChunks: {
      type: [Number],
      default: []
    },
    uploadStatus: {
      type: String,
      enum: ['pending', 'uploading', 'completed', 'failed'] as UploadStatus[],
      default: 'pending'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    },
    storagePath: {
      type: String,
      required: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: 'files'
  }
)

/**
 * Index definitions
 * - sha256: unique index (defined in schema field with unique: true)
 * - uploadStatus: for filtering active uploads
 * - uploadedAt: for sorting by upload time
 */
fileSchema.index({ uploadStatus: 1 })
fileSchema.index({ uploadedAt: -1 })
fileSchema.index({ isDeleted: 1 })

/**
 * Static method: Find file by SHA-256 hash
 */
fileSchema.statics.findByHash = async function (hash: string): Promise<IFileDocument | null> {
  return this.findOne({ sha256: hash })
}

/**
 * Static method: Create a new pending file upload record
 */
fileSchema.statics.createPending = async function (
  fileName: string,
  fileSize: number,
  mimeType: string,
  sha256: string,
  chunkSize: number,
  totalChunks: number,
  storagePath: string
): Promise<IFileDocument> {
  return this.create({
    fileName,
    fileSize,
    mimeType,
    sha256,
    chunkSize,
    totalChunks,
    uploadedChunks: [],
    uploadStatus: 'pending' as UploadStatus,
    storagePath
  })
}

/**
 * Instance method: Mark a chunk as uploaded
 */
fileSchema.methods.markChunkUploaded = async function (
  chunkIndex: number,
  _chunkHash: string
): Promise<void> {
  const doc = this as IFileDocument

  if (!doc.uploadedChunks.includes(chunkIndex)) {
    doc.uploadedChunks.push(chunkIndex)
    doc.uploadedChunks.sort((a: number, b: number) => a - b)
  }

  // Update status if at least one chunk uploaded
  if (doc.uploadStatus === 'pending' && doc.uploadedChunks.length > 0) {
    doc.uploadStatus = 'uploading'
  }

  // Mark as completed if all chunks uploaded
  if (doc.uploadedChunks.length >= doc.totalChunks) {
    doc.uploadStatus = 'completed'
    doc.completedAt = new Date()
  }

  await doc.save()
}

/**
 * Static method: Get upload statistics
 */
fileSchema.statics.getStats = async function (): Promise<{
  total: number
  pending: number
  uploading: number
  completed: number
  failed: number
}> {
  const stats = await this.aggregate([
    {
      $match: { isDeleted: { $ne: true } }
    },
    {
      $group: {
        _id: '$uploadStatus',
        count: { $sum: 1 }
      }
    }
  ])

  const result = {
    total: 0,
    pending: 0,
    uploading: 0,
    completed: 0,
    failed: 0
  }

  for (const stat of stats) {
    result[stat._id as UploadStatus] = stat.count
    result.total += stat.count
  }

  return result
}

/**
 * File model export with proper typing
 */
type FileModel = Model<IFileDocument> & IFileStatics

const FileModel =
  (mongoose.models.File as FileModel) ||
  mongoose.model<IFileDocument, FileModel>('File', fileSchema)

export const File = FileModel as FileModel

/**
 * Ensure model is only created once (hot reload safety)
 */
export default File
