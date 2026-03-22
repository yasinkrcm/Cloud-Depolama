/**
 * @file FileItem.tsx
 * @role Single file card component with preview (Apple-style)
 * @depends React, useFiles hooks
 * @dataflow File data → Preview card → Download/Delete actions
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getDownloadUrl, type FileItem } from '@/hooks/useFiles'
import { API_BASE_URL } from '@/lib/api'
import { FilePreviewModal } from './FilePreviewModal'

/**
 * File icon by MIME type
 */
function FileIcon({ mimeType, className }: { mimeType?: string; className?: string }) {
  if (mimeType?.startsWith('image/')) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }

  if (mimeType?.startsWith('video/')) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  }

  if (mimeType?.startsWith('audio/')) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    )
  }

  if (mimeType?.includes('pdf')) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }

  // Default file icon
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Format date
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return minutes === 0 ? 'Az önce' : `${minutes} dk önce`
  }

  // Today
  if (date.toDateString() === now.toDateString()) {
    return `Bugün, ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
  }

  // Yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `Dün, ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
  }

  // This week
  if (diff < 604800000) {
    return date.toLocaleDateString('tr-TR', { weekday: 'long' })
  }

  return date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })
}

/**
 * Props
 */
interface FileItemProps {
  file: FileItem
  onDelete: () => void
}

/**
 * File item component (Apple-style)
 */
export function FileItemComponent({ file, onDelete }: FileItemProps) {
  const [showHash, setShowHash] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)

  const isImage = file.mimeType?.startsWith('image/')
  const isVideo = file.mimeType?.startsWith('video/')
  const isAudio = file.mimeType?.startsWith('audio/')
  const isPdf = file.mimeType?.includes('pdf')

  /**
   * Copy SHA-256 hash to clipboard
   */
  const copyHash = async () => {
    await navigator.clipboard.writeText(file.sha256)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * Handle delete with confirmation
   */
  const handleDelete = async () => {
    if (!confirm(`"${file.fileName}" dosyasını kalıcı olarak silmek istediğinize emin misiniz?`)) return

    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/files/${file.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
      onDelete()
    } catch {
      alert('Dosya silinirken bir hata oluştu.')
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * Get URLs
   */
  const previewUrl = `${API_BASE_URL}/files/${file.id}/download?inline=true`
  const downloadUrl = `${API_BASE_URL}/files/${file.id}/download`

  return (
    <>
      <div
        className="group relative glass-panel rounded-2xl overflow-hidden hover:bg-white/5 transition-all duration-300 cursor-pointer"
        onClick={() => setPreviewModalOpen(true)}
      >
        {/* Preview Area */}
        <div className="aspect-video relative overflow-hidden bg-black/50 border-b border-white/5">
          {isImage && !previewError ? (
            <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
              {/* Blurred background for aesthetic effect when image aspect ratio doesn't match */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-125"
                style={{ backgroundImage: `url(${previewUrl})` }}
              />
              <img
                src={previewUrl}
                alt={file.fileName}
                className="w-full h-full object-contain relative z-10 drop-shadow-lg"
                onError={() => setPreviewError(true)}
              />
            </div>
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-pink-500/10">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/10 hover:bg-white/10 transition-colors">
                  <svg className="w-8 h-8 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-200">Video Önizlemesi</p>
                <p className="text-xs text-gray-400">İzlemek için tıklayın</p>
              </div>
            </div>
          ) : isPdf ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500/10 to-orange-500/10">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/10">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-200">PDF Belgesi</p>
                <p className="text-xs text-gray-400">{file.fileSize > 0 ? formatFileSize(file.fileSize) : ''}</p>
              </div>
            </div>
          ) : isAudio ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-teal-500/10">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center mx-auto mb-3 border border-white/10 hover:bg-white/10 transition-colors">
                  <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-200">Ses Dosyası</p>
                <p className="text-xs text-gray-400">Dinlemek için tıklayın</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
              <div className="text-center">
                <FileIcon mimeType={file.mimeType} className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Önizlemek için tıklayın</p>
              </div>
            </div>
          )}
        </div>

        {/* Content Overlay - Actions on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
          <div className="absolute top-3 right-3 flex gap-2 translate-y-[-10px] group-hover:translate-y-0 transition-all duration-300">
            {/* Download */}
            <a
              href={downloadUrl}
              download={file.fileName}
              onClick={e => e.stopPropagation()}
              className="p-2 bg-white/10 hover:bg-blue-500/20 backdrop-blur-md rounded-full text-white hover:text-blue-300 border border-white/10 hover:border-blue-500/30 hover:scale-110 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
              title="İndir"
            >
              <svg className="w-4 h-4 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            </a>

            {/* Delete */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              disabled={isDeleting}
              className="p-2 bg-white/10 hover:bg-red-500/20 backdrop-blur-md rounded-full text-white hover:text-red-400 border border-white/10 hover:border-red-500/30 hover:scale-110 transition-all disabled:opacity-50"
              title="Delete"
            >
              {isDeleting ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 011-1h-4a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* File Info */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-100 truncate text-sm" title={file.fileName}>
                {file.fileName}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {formatFileSize(file.fileSize)} · {formatDate(file.uploadedAt)}
              </p>
            </div>

            {/* Hash toggle button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowHash(!showHash)
              }}
              className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
              title="SHA-256"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
          </div>

          {/* SHA-256 Hash (expandable) */}
          {showHash && (
            <div className="mt-4 p-3 bg-black/40 border border-white/5 shadow-inner rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-400 tracking-wider">SHA-256 CHECK</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyHash()
                  }}
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-full hover:bg-blue-500/10"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 font-mono break-all leading-relaxed selection:bg-blue-500/30">{file.sha256}</p>
            </div>
          )}
        </div>
      </div>
      {previewModalOpen && <FilePreviewModal file={file} onClose={() => setPreviewModalOpen(false)} />}
    </>
  )
}
