/**
 * @file index.ts
 * @role Shared TypeScript interfaces between backend and client
 * @depends None (base types)
 * @dataflow Exported types → imported by backend and client
 */

/**
 * File metadata stored in MongoDB
 */
export interface FileMetadata {
  _id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadedAt: Date;
  completedAt?: Date;
  storagePath: string;
}

/**
 * Chunk upload request payload
 */
export interface ChunkUploadRequest {
  fileId: string;
  chunkIndex: number;
  chunkData: Blob;
  chunkHash: string;
}

/**
 * Chunk upload response
 */
export interface ChunkUploadResponse {
  success: boolean;
  chunkIndex: number;
  uploadedChunks: number[];
  uploadStatus: FileMetadata['uploadStatus'];
}

/**
 * File upload initialization request
 */
export interface InitUploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkSize: number;
  totalChunks: number;
  fileHash: string;
}

/**
 * File upload initialization response
 */
export interface InitUploadResponse {
  fileId: string;
  uploadStatus: FileMetadata['uploadStatus'];
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  statusCode?: number;
}
