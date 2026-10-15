/**
 * @file UploadList.tsx
 * @role Display upload queue with progress bars, status indicators, and action buttons
 * @depends useUpload hook, uploadStore, shadcn/ui components
 * @dataflow Store state → renders list of uploads with progress and actions
 */

'use client'

import React, { useCallback, useMemo, useRef } from 'react'
import { useUpload } from '@/hooks/useUpload'
import { useUploadStore, type UploadStatus } from '@/lib/store/uploadStore'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'

/**
 * Status icon component
 */
function StatusIcon({ status }: { status: UploadStatus }) {
  const icons = {
    idle: null,
    hashing: (
      <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ),
    initializing: (
      <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ),
    uploading: (
      <svg className="animate-pulse h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    completing: (
      <svg className="animate-pulse h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    completed: (
      <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    failed: (
      <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    cancelled: (
      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    paused: (
      <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    needs_file: (
      <svg className="h-5 w-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  return icons[status] ?? null
}

/**
 * Status label component
 */
function StatusLabel({ status }: { status: UploadStatus }) {
  const labels = {
    idle: 'Bekleniyor',
    hashing: 'Hash hesaplanıyor...',
    initializing: 'Başlatılıyor...',
    uploading: 'Yükleniyor...',
    completing: 'Tamamlanıyor...',
    completed: 'Tamamlandı',
    failed: 'Başarısız',
    cancelled: 'İptal Edildi',
    paused: 'Duraklatıldı',
    needs_file: 'Dosya Seçilmeli'
  }

  const colors = {
    idle: 'text-gray-500',
    hashing: 'text-blue-500',
    initializing: 'text-blue-500',
    uploading: 'text-blue-500',
    completing: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
    cancelled: 'text-gray-400',
    paused: 'text-yellow-500',
    needs_file: 'text-orange-500'
  }

  return (
    <span className={cn('text-sm font-medium', colors[status])}>
      {labels[status]}
    </span>
  )
}

/**
 * File size formatter
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bayt'
  const k = 1024
  const sizes = ['Bayt', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Single upload item component
 */
interface UploadItemProps {
  id: string
  fileName: string
  fileSize: number
  status: UploadStatus
  progress: number
  uploadedChunks: number[]
  totalChunks: number
  error?: string | undefined
  sha256?: string | undefined
}

function UploadItemComponent({
  id,
  fileName,
  fileSize,
  status,
  progress,
  uploadedChunks,
  totalChunks,
  error,
  sha256
}: UploadItemProps) {
  const { cancelUpload, retryUpload, pauseUpload, resumeUpload, attachFileAndResume } = useUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Handle retry button click
   */
  const handleRetry = useCallback(() => {
    void retryUpload(id)
  }, [id, retryUpload])

  /**
   * Handle cancel button click
   */
  const handleCancel = useCallback(() => {
    void cancelUpload(id)
  }, [id, cancelUpload])

  /**
   * Handle pause button click
   */
  const handlePause = useCallback(() => {
    pauseUpload(id)
  }, [id, pauseUpload])

  /**
   * Handle resume button click
   */
  const handleResume = useCallback(() => {
    void resumeUpload(id)
  }, [id, resumeUpload])

  /**
   * Handle file selection for resume
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void attachFileAndResume(id, file)
    }
  }, [id, attachFileAndResume])

  /**
   * Trigger file input
   */
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const isActive = ['idle', 'hashing', 'initializing', 'uploading', 'completing'].includes(status)
  const isPaused = status === 'paused'
  const needsFile = status === 'needs_file'
  const canRetry = status === 'failed'
  const canCancel = isActive
  const canResume = isPaused

  return (
    <div className="glass-panel rounded-2xl p-5 hover:bg-white/5 transition-colors">
      {/* File info row */}
      <div className="flex items-start justify-between gap-2 sm:gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <StatusIcon status={status} />
            <p className="text-sm sm:text-base font-semibold text-gray-200 truncate tracking-wide">
              {fileName}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">{formatFileSize(fileSize)}</span>
            <StatusLabel status={status} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {needsFile && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={triggerFileSelect}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-400 border border-orange-400/50 shadow-[0_0_15px_rgba(249,115,22,0.3)] rounded-lg transition-all"
              >
                Dosya Seç
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-semibold text-gray-300 bg-gray-600/20 hover:bg-gray-600/40 border border-gray-600/30 rounded-lg transition-colors"
              >
                İptal
              </button>
            </>
          )}
          {canCancel && (
            <>
              <button
                type="button"
                onClick={handlePause}
                className="px-3 py-1.5 text-xs font-semibold text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-lg transition-colors"
              >
                Beklet
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-semibold text-gray-300 bg-gray-600/20 hover:bg-gray-600/40 border border-gray-600/30 rounded-lg transition-colors"
              >
                İptal
              </button>
            </>
          )}
          {canResume && (
            <button
              type="button"
              onClick={handleResume}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-400 border border-green-400/50 shadow-[0_0_15px_rgba(34,197,94,0.3)] rounded-lg transition-all"
            >
              Devam Et
            </button>
          )}
          {canRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Yeniden Dene
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(isActive || isPaused) && (
        <div className="mb-2 mt-4">
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden border border-gray-700/50">
            <div
              className={cn("h-1.5 transition-all duration-300 ease-out", isPaused ? "bg-yellow-500" : "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">{progress}%</span>
            <span className="text-xs text-gray-500">
              {uploadedChunks.length} / {totalChunks} parça
            </span>
          </div>
        </div>
      )}

      {/* Info message for needs_file */}
      {needsFile && (
        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
          <p className="text-xs text-orange-700">Sayfa yenilendiği için dosyayı tekrar seçmeniz gerekiyor.</p>
        </div>
      )}

      {/* Error message */}
      {status === 'failed' && error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* SHA-256 hash (when completed) */}
      {status === 'completed' && sha256 && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <p className="text-xs font-medium text-green-700 mb-1">SHA-256 Doğrulandı:</p>
          <p className="text-xs text-green-600 font-mono break-all">{sha256}</p>
        </div>
      )}
    </div>
  )
}

/**
 * Upload list component
 */
export function UploadList() {
  const { queue, clearCompleted } = useUploadStore(
    useShallow((state) => ({ queue: state.queue, clearCompleted: state.clearCompleted }))
  )

  /**
   * Convert Map to array and sort: active first, then paused, then by date
   */
  const sortedQueue = useMemo(() => {
    const uploads = Array.from(queue.values())
    return uploads.sort((a, b) => {
      const aActive = ['idle', 'hashing', 'initializing', 'uploading', 'completing'].includes(a.status)
      const bActive = ['idle', 'hashing', 'initializing', 'uploading', 'completing'].includes(b.status)
      const aPaused = a.status === 'paused'
      const bPaused = b.status === 'paused'

      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1
      if (aPaused && !bPaused && !bActive) return -1
      if (!aPaused && bPaused && !aActive) return 1

      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })
  }, [queue])

  /**
   * Calculate queue statistics
   */
  const queueStats = useMemo(() => {
    const active = sortedQueue.filter(item => ['idle', 'hashing', 'initializing', 'uploading', 'completing'].includes(item.status))
    const completed = sortedQueue.filter(item => item.status === 'completed')
    const failed = sortedQueue.filter(item => item.status === 'failed')
    const paused = sortedQueue.filter(item => item.status === 'paused')
    return { active, completed, failed, paused }
  }, [sortedQueue])

  /**
   * Calculate overall progress across all active uploads
   */
  const overallProgress = useMemo(() => {
    const activeUploads = queueStats.active
    if (activeUploads.length === 0) return 0
    const totalProgress = activeUploads.reduce((sum, item) => sum + item.progress, 0)
    return Math.round(totalProgress / activeUploads.length)
  }, [queueStats.active])

  /**
   * Handle clear completed
   */
  const handleClearCompleted = useCallback(() => {
    clearCompleted()
  }, [clearCompleted])

  if (sortedQueue.length === 0) {
    return null
  }

  const hasCompleted = sortedQueue.some((item) => item.status === 'completed')
  const hasMultipleActive = queueStats.active.length > 1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Aktif Yüklemeler <span className="text-gray-400 text-sm ml-2">({sortedQueue.length})</span>
          </h2>
          {/* Queue statistics pills */}
          {(queueStats.completed.length > 0 || queueStats.failed.length > 0 || queueStats.paused.length > 0) && (
            <div className="flex gap-1.5">
              {queueStats.completed.length > 0 && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full border border-green-500/30">
                  ✓ {queueStats.completed.length}
                </span>
              )}
              {queueStats.failed.length > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full border border-red-500/30">
                  ✗ {queueStats.failed.length}
                </span>
              )}
              {queueStats.paused.length > 0 && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full border border-yellow-500/30">
                  ⏸ {queueStats.paused.length}
                </span>
              )}
            </div>
          )}
        </div>
        {hasCompleted && (
          <button
            type="button"
            onClick={handleClearCompleted}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Tamamlananları Temizle
          </button>
        )}
      </div>

      {/* Overall progress bar (only when multiple active uploads) */}
      {hasMultipleActive && (
        <div className="glass-panel rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">
              Genel İlerleme ({queueStats.active.length} dosya)
            </span>
            <span className="text-sm font-semibold text-blue-400">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700/50">
            <div
              className="h-2 bg-gradient-to-r from-blue-500 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.6)] transition-all duration-300 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {sortedQueue.map((item) => (
        <UploadItemComponent
          key={item.id}
          id={item.id}
          fileName={item.fileName}
          fileSize={item.fileSize}
          status={item.status}
          progress={item.progress}
          uploadedChunks={item.uploadedChunks}
          totalChunks={item.totalChunks}
          error={item.error}
          sha256={item.sha256}
        />
      ))}
    </div>
  )
}
