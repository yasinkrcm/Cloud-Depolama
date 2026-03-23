/**
 * @file useUpload.ts
 * @role React hook for chunked file upload with SHA-256 verification
 * @depends @tanstack/react-query, zustand upload store, API client
 * @dataflow File selection → hash calculation → chunk upload → completion
 */

import { useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/api'
import { useUploadStore } from '@/lib/store/uploadStore'
import { useShallow } from 'zustand/react/shallow'
import { reportError, withRetry, ErrorSeverity } from '@/lib/error-handler'

/**
 * Default chunk size (5MB)
 */
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024

/**
 * Calculate SHA-256 hash of a file
 */
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Calculate SHA-256 hash of a chunk
 */
async function calculateChunkHash(chunk: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', chunk)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Split file into chunks
 */
function splitFileIntoChunks(file: File, chunkSize: number): Blob[] {
  const chunks: Blob[] = []
  const fileSize = file.size

  for (let offset = 0; offset < fileSize; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, fileSize)
    chunks.push(file.slice(offset, end))
  }

  return chunks
}

/**
 * Upload a single chunk with retry logic
 * @param formData - FormData containing chunk data
 * @param maxRetries - Maximum number of retry attempts
 * @param signal - AbortSignal for cancelling/pausing the upload
 */
async function uploadChunkWithRetry(
  formData: FormData,
  maxRetries: number = 3,
  signal?: AbortSignal
): Promise<Response> {
  return withRetry(
    async () => {
      // Check abort before each retry attempt
      if (signal?.aborted) {
        throw new Error('Upload paused')
      }

      const fetchOptions: RequestInit = {
        method: 'POST',
        body: formData
      }

      // Only add signal if it's defined (strict TypeScript compatibility)
      if (signal) {
        fetchOptions.signal = signal
      }

      const response = await fetch(`${API_BASE_URL}/upload/chunk`, fetchOptions)

      if (!response.ok) {
        throw new Error(`Chunk upload failed: ${response.statusText}`)
      }

      return response
    },
    { maxRetries, delayMs: 1000, backoff: true }
  )()
}

/**
 * Upload hook return type
 */
export interface UseUploadReturn {
  uploadFile: (file: File, chunkSize?: number, onUploadSuccess?: () => void) => Promise<void>
  cancelUpload: (id: string) => Promise<void>
  retryUpload: (id: string) => Promise<void>
  pauseUpload: (id: string) => void
  resumeUpload: (id: string) => Promise<void>
  attachFileAndResume: (id: string, file: File) => Promise<void>
  isUploading: boolean
  getUploadStatus: (id: string) => import('@/lib/store/uploadStore').UploadItem | undefined
}

/**
 * Chunked file upload hook
 */
export function useUpload(): UseUploadReturn {
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const { addUpload, removeUpload, updateUpload, getUpload, attachFileToUpload } = useUploadStore(
    useShallow((state) => ({
      addUpload: state.addUpload,
      removeUpload: state.removeUpload,
      updateUpload: state.updateUpload,
      getUpload: state.getUpload,
      attachFileToUpload: state.attachFileToUpload
    }))
  )

  /**
   * Upload a file with chunking
   */
  const uploadFile = useCallback(async (file: File, chunkSize: number = DEFAULT_CHUNK_SIZE, onUploadSuccess?: () => void) => {
    const uploadId = addUpload(file)
    const abortController = new AbortController()
    abortControllersRef.current.set(uploadId, abortController)

    try {
      // Step 1: Calculate file hash
      updateUpload(uploadId, { status: 'hashing', progress: 0 })
      const fileHash = await calculateFileHash(file)
      updateUpload(uploadId, { sha256: fileHash })

      // Step 2: Split into chunks
      const totalChunks = Math.ceil(file.size / chunkSize)
      updateUpload(uploadId, { totalChunks })

      // Step 3: Initialize upload
      updateUpload(uploadId, { status: 'initializing' })

      const initResponse = await fetch(`${API_BASE_URL}/upload/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          chunkSize,
          totalChunks,
          fileHash
        }),
        signal: abortController.signal
      })

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize upload: ${initResponse.statusText}`)
      }

      const initResult = await initResponse.json() as {
        success: boolean
        fileId: string
        uploadStatus: string
        alreadyExists?: boolean
      }

      // Handle deduplication
      if (initResult.alreadyExists) {
        updateUpload(uploadId, {
          status: 'completed',
          progress: 100,
          uploadedChunks: Array.from({ length: totalChunks }, (_, i) => i)
        })
        return
      }

      const fileId = initResult.fileId
      updateUpload(uploadId, { fileId })

      // Step 4: Upload chunks
      updateUpload(uploadId, { status: 'uploading' })

      const chunks = splitFileIntoChunks(file, chunkSize)

      for (let i = 0; i < chunks.length; i++) {
        // Check both abort signal AND paused state
        const currentUpload = getUpload(uploadId)
        if (abortController.signal.aborted || currentUpload?.status === 'paused') {
          throw new Error('Upload cancelled or paused')
        }

        const chunk = chunks[i]
        if (!chunk) {
          throw new Error(`Chunk ${i} is undefined`)
        }

        const chunkArrayBuffer = await chunk.arrayBuffer()
        const chunkHash = await calculateChunkHash(chunkArrayBuffer)

        const formData = new FormData()
        formData.append('chunk', new Blob([chunkArrayBuffer], { type: file.type }))
        formData.append('fileId', fileId)
        formData.append('chunkIndex', String(i))
        formData.append('chunkHash', chunkHash)

        const chunkResponse = await uploadChunkWithRetry(formData, 3, abortController.signal)

        // Check again after chunk upload
        const currentUploadAfterChunk = getUpload(uploadId)
        if (abortController.signal.aborted || currentUploadAfterChunk?.status === 'paused') {
          throw new Error('Upload cancelled or paused')
        }

        if (!chunkResponse.ok) {
          throw new Error(`Failed to upload chunk ${i}: ${chunkResponse.statusText}`)
        }

        const chunkResult = await chunkResponse.json() as {
          success: boolean
          chunkIndex: number
          uploadedChunks: number[]
          progress: number
        }

        if (chunkResult.success) {
          updateUpload(uploadId, {
            uploadedChunks: chunkResult.uploadedChunks,
            progress: chunkResult.progress || Math.round(((i + 1) / totalChunks) * 100)
          })
        }
      }

      // Step 5: Complete upload
      updateUpload(uploadId, { status: 'completing' })

      const completeResponse = await fetch(`${API_BASE_URL}/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          finalHash: fileHash
        }),
        signal: abortController.signal
      })

      if (!completeResponse.ok) {
        throw new Error(`Failed to complete upload: ${completeResponse.statusText}`)
      }

      updateUpload(uploadId, { status: 'completed', progress: 100 })

      // Trigger callback for successful upload
      if (onUploadSuccess) {
        onUploadSuccess()
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Don't report user-initiated actions (pause/cancel) as errors
      const isUserAction = errorMessage.includes('cancelled') || errorMessage.includes('paused')

      if (!isUserAction) {
        reportError(error, ErrorSeverity.HIGH, { fileName: file.name, fileSize: file.size })
      }

      // Only update status to failed if it's not a user action
      // For pause/cancel, the status is already set by those functions
      if (!isUserAction) {
        updateUpload(uploadId, {
          status: 'failed',
          error: errorMessage
        })
      }
    } finally {
      abortControllersRef.current.delete(uploadId)
    }
  }, [addUpload, updateUpload])

  /**
   * Cancel upload
   */
  const cancelUpload = useCallback(async (id: string) => {
    const abortController = abortControllersRef.current.get(id)
    if (abortController) {
      abortController.abort()
    }

    const upload = getUpload(id)
    if (upload?.fileId) {
      await fetch(`${API_BASE_URL}/upload/${upload.fileId}`, { method: 'DELETE' })
    }

    updateUpload(id, { status: 'cancelled' })
    removeUpload(id)
  }, [getUpload, updateUpload, removeUpload])

  /**
   * Retry failed upload
   */
  const retryUpload = useCallback(async (id: string) => {
    const upload = getUpload(id)
    if (!upload) return
    const file = upload.file
    if (!file) {
      updateUpload(id, { status: 'failed', error: 'File data lost. Please select the file again.' })
      return
    }

    // Remove and re-add to reset state
    removeUpload(id)
    await uploadFile(file)
  }, [getUpload, removeUpload, uploadFile, updateUpload])

  /**
   * Pause upload (abort current chunk, keep state for resume)
   */
  const pauseUpload = useCallback((id: string) => {
    const abortController = abortControllersRef.current.get(id)
    if (abortController) {
      abortController.abort()
      abortControllersRef.current.delete(id)
    }
    updateUpload(id, { status: 'paused' })
  }, [updateUpload])

  /**
   * Resume paused upload (continue from last uploaded chunk)
   */
  const resumeUpload = useCallback(async (id: string) => {
    const upload = getUpload(id)
    if (!upload || upload.status !== 'paused') return

    const file = upload.file
    if (!file) {
      updateUpload(id, { status: 'failed', error: 'File data lost after page refresh. Please re-upload.' })
      return
    }

    const abortController = new AbortController()
    abortControllersRef.current.set(id, abortController)

    try {
      const chunkSize = file.size / (upload.totalChunks || 1)
      const totalChunks = upload.totalChunks || Math.ceil(file.size / DEFAULT_CHUNK_SIZE)

      // Get current upload status from server
      const fileId = upload.fileId
      if (!fileId) {
        throw new Error('No fileId found for resume')
      }

      const statusResponse = await fetch(`${API_BASE_URL}/upload/${fileId}`)
      if (!statusResponse.ok) {
        throw new Error('Failed to get upload status')
      }

      const statusData = await statusResponse.json() as {
        fileId: string
        uploadedChunks: number[]
        progress: number
      }

      const uploadedChunks = statusData.uploadedChunks ?? upload.uploadedChunks
      const chunks = splitFileIntoChunks(file, DEFAULT_CHUNK_SIZE)

      // Resume uploading from first missing chunk
      updateUpload(id, { status: 'uploading' })

      for (let i = 0; i < chunks.length; i++) {
        if (uploadedChunks.includes(i)) continue // Skip already uploaded

        // Check both abort signal AND paused state
        const currentUpload = getUpload(id)
        if (abortController.signal.aborted || currentUpload?.status === 'paused') {
          throw new Error('Upload cancelled or paused')
        }

        const chunk = chunks[i]
        if (!chunk) {
          throw new Error(`Chunk ${i} is undefined`)
        }

        const chunkArrayBuffer = await chunk.arrayBuffer()
        const chunkHash = await calculateChunkHash(chunkArrayBuffer)

        const formData = new FormData()
        formData.append('chunk', new Blob([chunkArrayBuffer], { type: file.type }))
        formData.append('fileId', fileId)
        formData.append('chunkIndex', String(i))
        formData.append('chunkHash', chunkHash)

        const chunkResponse = await uploadChunkWithRetry(formData, 3, abortController.signal)

        // Check again after chunk upload
        const currentUploadAfterChunk = getUpload(id)
        if (abortController.signal.aborted || currentUploadAfterChunk?.status === 'paused') {
          throw new Error('Upload cancelled or paused')
        }

        const chunkResult = await chunkResponse.json() as {
          success: boolean
          chunkIndex: number
          uploadedChunks: number[]
          progress: number
        }

        if (chunkResult.success) {
          updateUpload(id, {
            uploadedChunks: chunkResult.uploadedChunks,
            progress: chunkResult.progress || Math.round(((i + 1) / totalChunks) * 100)
          })
        }
      }

      // Complete upload
      updateUpload(id, { status: 'completing' })

      const fileHash = upload.sha256 || await calculateFileHash(file)

      const completeResponse = await fetch(`${API_BASE_URL}/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          finalHash: fileHash
        }),
        signal: abortController.signal
      })

      if (!completeResponse.ok) {
        throw new Error(`Failed to complete upload: ${completeResponse.statusText}`)
      }

      updateUpload(id, { status: 'completed', progress: 100, sha256: fileHash })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const upload = getUpload(id)

      // Don't report user-initiated actions (pause/cancel) as errors
      const isUserAction = errorMessage.includes('cancelled') || errorMessage.includes('paused')

      if (!isUserAction) {
        reportError(error, ErrorSeverity.HIGH, { fileName: upload?.fileName, action: 'resume' })
      }

      // Only update status to failed if it's not a user action
      if (!isUserAction) {
        updateUpload(id, {
          status: 'failed',
          error: errorMessage
        })
      }
    } finally {
      abortControllersRef.current.delete(id)
    }
  }, [getUpload, updateUpload, attachFileToUpload])

  /**
   * Attach a re-selected file and resume upload (for after page refresh)
   */
  const attachFileAndResume = useCallback(async (id: string, file: File) => {
    const upload = getUpload(id)
    if (!upload) return

    // Verify and attach file to store
    const attached = attachFileToUpload(id, file)
    if (!attached) {
      updateUpload(id, {
        status: 'failed',
        error: 'File does not match. Please select the same file.'
      })
      return
    }

    // Now resume the upload
    await resumeUpload(id)
  }, [getUpload, attachFileToUpload, updateUpload, resumeUpload])

  return {
    uploadFile,
    cancelUpload,
    retryUpload,
    pauseUpload,
    resumeUpload,
    attachFileAndResume,
    isUploading: abortControllersRef.current.size > 0,
    getUploadStatus: getUpload
  }
}

/**
 * Hook to get upload statistics from server
 */
export function useUploadStats() {
  return useQuery({
    queryKey: ['upload-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/stats`)
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      return response.json()
    },
    refetchInterval: 5000 // Poll every 5 seconds
  })
}
