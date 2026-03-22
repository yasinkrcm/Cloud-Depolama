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
 */
export type UploadStatus = 'idle' | 'hashing' | 'initializing' | 'uploading' | 'completing' | 'completed' | 'failed' | 'cancelled' | 'paused'

/**
 * Upload queue item
 */
export interface UploadItem {
  id: string
  file?: File
  fileName: string
  fileSize: number
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
                queueMap.set(key, {
                  ...val,
                  file: undefined, // Drop file object
                  createdAt: new Date(val.createdAt),
                  updatedAt: new Date(val.updatedAt)
                })
              }
            }
            return {
              state: { ...parsed.state, queue: queueMap },
              version: parsed.version
            }
          } catch (e) {
            return null
          }
        },
        setItem: (name, value) => {
          // Serialize Map
          const stateToSave = {
            ...value,
            state: {
              ...value.state,
              queue: Array.from<[string, UploadItem]>(value.state.queue.entries()).map(([k, v]) => [k, { ...v, file: undefined }])
            }
          }
          localStorage.setItem(name, JSON.stringify(stateToSave))
        },
        removeItem: (name) => localStorage.removeItem(name)
      }
    }
  )
)
