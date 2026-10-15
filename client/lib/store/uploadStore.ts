/**
 * @file uploadStore.ts
 * @role Zustand store for managing upload queue and state
 * @depends zustand
 * @dataflow Upload actions → state update → UI reactivity
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Upload status enum
 * 'needs_file' means upload was interrupted and needs user to re-select the file
 */
export type UploadStatus = 'idle' | 'hashing' | 'initializing' | 'uploading' | 'completing' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'needs_file'

/**
 * Upload queue item
 */
export interface UploadItem {
  id: string
  file?: File
  fileName: string
  fileSize: number
  fileType: string // Store MIME type for file matching
  fileLastModified?: number // Store for file matching
  status: UploadStatus
  progress: number
  uploadedChunks: number[]
  totalChunks: number
  fileId?: string
  sha256?: string
  error?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Upload store state and actions
 */
interface UploadStore {
  // State
  queue: Map<string, UploadItem>
  activeUploadId: string | null

  // Actions
  addUpload: (file: File) => string
  removeUpload: (id: string) => void
  getUpload: (id: string) => UploadItem | undefined
  updateUpload: (id: string, updates: Partial<Omit<UploadItem, 'id' | 'file' | 'createdAt'>>) => void
  setActiveUpload: (id: string | null) => void
  clearCompleted: () => void
  clearAll: () => void

  /**
   * Find uploads that need a file (for resume after page refresh)
   */
  getUploadsNeedingFile: () => UploadItem[]

  /**
   * Attach a file to an upload that needs it (for resume)
   * Returns true if file matches (by name, size, type, lastModified)
   */
  attachFileToUpload: (id: string, file: File) => boolean

  // Derived state getters
  getQueueLength: () => number
  getActiveUpload: () => UploadItem | undefined
  getCompletedUploads: () => UploadItem[]
  getFailedUploads: () => UploadItem[]
}

/**
 * Create upload store
 */
export const useUploadStore = create<UploadStore>()(
  persist(
    (set, get) => ({
      // Initial state
      queue: new Map(),
      activeUploadId: null,

  /**
   * Add a new file to upload queue
   */
  addUpload: (file: File) => {
    const id = crypto.randomUUID()
    const uploadItem: UploadItem = {
      id,
      file,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      fileLastModified: file.lastModified,
      status: 'idle',
      progress: 0,
      uploadedChunks: [],
      totalChunks: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    set((state) => {
      const newQueue = new Map(state.queue)
      newQueue.set(id, uploadItem)
      return { queue: newQueue }
    })

    return id
  },

  /**
   * Remove upload from queue
   */
  removeUpload: (id: string) => {
    set((state) => {
      const newQueue = new Map(state.queue)
      newQueue.delete(id)
      return {
        queue: newQueue,
        activeUploadId: state.activeUploadId === id ? null : state.activeUploadId
      }
    })
  },

  /**
   * Get upload by ID
   */
  getUpload: (id: string) => {
    return get().queue.get(id)
  },

  /**
   * Update upload item
   */
  updateUpload: (id: string, updates) => {
    set((state) => {
      const newQueue = new Map(state.queue)
      const existing = newQueue.get(id)

      if (existing) {
        newQueue.set(id, {
          ...existing,
          ...updates,
          updatedAt: new Date()
        })
      }

      return { queue: newQueue }
    })
  },

  /**
   * Set active upload
   */
  setActiveUpload: (id: string | null) => {
    set({ activeUploadId: id })
  },

  /**
   * Clear completed uploads
   */
  clearCompleted: () => {
    set((state) => {
      const newQueue = new Map<string, UploadItem>()

      for (const [id, item] of state.queue) {
        if (item.status !== 'completed') {
          newQueue.set(id, item)
        }
      }

      return { queue: newQueue }
    })
  },

  /**
   * Clear all uploads
   */
  clearAll: () => {
    set({ queue: new Map(), activeUploadId: null })
  },

  /**
   * Get queue length
   */
  getQueueLength: () => {
    return get().queue.size
  },

  /**
   * Get active upload
   */
  getActiveUpload: () => {
    const { activeUploadId, queue } = get()
    return activeUploadId ? queue.get(activeUploadId) : undefined
  },

  /**
   * Get completed uploads
   */
  getCompletedUploads: () => {
    return Array.from(get().queue.values()).filter((item) => item.status === 'completed')
  },

  /**
   * Get failed uploads
   */
      getFailedUploads: () => {
        return Array.from(get().queue.values()).filter((item) => item.status === 'failed')
      },

  /**
   * Get uploads that need a file (paused without file after page refresh)
   */
      getUploadsNeedingFile: () => {
        return Array.from(get().queue.values()).filter((item) =>
          item.status === 'paused' || item.status === 'needs_file'
        ).filter((item) => !item.file)
      },

  /**
   * Attach a file to an upload that needs it
   * Returns true if file matches (by name, size, type, lastModified)
   */
      attachFileToUpload: (id: string, file: File) => {
        const upload = get().queue.get(id)
        if (!upload) return false

        // Verify file matches by name, size, type
        const matches =
          file.name === upload.fileName &&
          file.size === upload.fileSize &&
          file.type === upload.fileType

        if (!matches) return false

        // Attach file and update status
        set((state) => {
          const newQueue = new Map(state.queue)
          newQueue.set(id, {
            ...upload,
            file,
            status: 'paused' as UploadStatus, // Ready to resume
            updatedAt: new Date()
          })
          return { queue: newQueue }
        })

        return true
      }
    }),
    {
      name: 'cloud-storage-upload-queue',
      // Since map can't easily jump through JSON directly without replacer, we must handle it
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          try {
            const parsed = JSON.parse(str)
            // Reconstruct Map and Dates
            const stateFiles = parsed.state.queue
            const queueMap = new Map<string, UploadItem>()
            if (Array.isArray(stateFiles)) {
              for (const [key, val] of stateFiles) {
                const item = val as UploadItem
                // If upload was paused/in-progress and has fileId but no file, mark as needs_file
                const status = item.fileId && !item.file && (item.status === 'paused' || item.status === 'uploading' || item.status === 'hashing')
                  ? 'needs_file'
                  : item.status

                queueMap.set(key, {
                  ...val,
                  file: undefined, // Drop file object (can't be persisted)
                  fileType: val.fileType || 'application/octet-stream',
                  status: status as UploadStatus,
                  createdAt: new Date(val.createdAt),
                  updatedAt: new Date(val.updatedAt)
                })
              }
            }
            return {
              state: { ...parsed.state, queue: queueMap },
              version: parsed.version
            }
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          // Serialize Map
          const stateToSave = {
            ...value,
            state: {
              ...value.state,
              queue: Array.from<[string, UploadItem]>(value.state.queue.entries()).map(([k, v]) => [
                k,
                {
                  ...v,
                  file: undefined // Drop file object (can't be serialized)
                }
              ])
            }
          }
          localStorage.setItem(name, JSON.stringify(stateToSave))
        },
        removeItem: (name) => localStorage.removeItem(name)
      }
    }
  )
)
