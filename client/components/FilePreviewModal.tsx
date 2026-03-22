'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FileItem } from '@/hooks/useFiles'
import { API_BASE_URL } from '@/lib/api'

interface FilePreviewModalProps {
  file: FileItem | null
  onClose: () => void
}

function FileIconBig({ mimeType, className }: { mimeType?: string; className?: string }) {
  if (mimeType?.startsWith('image/')) return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  if (mimeType?.startsWith('video/')) return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  if (mimeType?.startsWith('audio/')) return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
  if (mimeType?.includes('pdf')) return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent back body scrolling
  useEffect(() => {
    setMounted(true)
    if (file) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [file])

  if (!file || !mounted) return null

  const previewUrl = `${API_BASE_URL}/files/${file.id}/download?inline=true`
  const downloadUrl = `${API_BASE_URL}/files/${file.id}/download`
  
  const isImage = file.mimeType?.startsWith('image/')
  const isVideo = file.mimeType?.startsWith('video/')
  const isAudio = file.mimeType?.startsWith('audio/')
  const isPdf = file.mimeType?.includes('pdf')
  const isText = file.mimeType === 'text/plain'

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 md:p-12 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Window Container */}
      <div 
        className="relative w-full max-w-6xl h-fit max-h-[85vh] bg-gray-950 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <FileIconBig mimeType={file.mimeType} className="w-6 h-6 text-blue-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-white text-sm sm:text-base truncate break-all">{file.fileName}</h3>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={downloadUrl}
              download={file.fileName}
              className="p-2.5 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] border border-blue-500/20 flex items-center gap-2"
              title="İndir"
              onClick={e => e.stopPropagation()}
            >
              <svg className="w-4 h-4 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold pr-1">İndir</span>
            </a>
            <hr className="w-px h-6 bg-white/10 mx-1 border-none" />
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-red-500/20 rounded-full transition-colors"
              title="Kapat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-black/50 relative min-h-0 flex items-center justify-center p-2 sm:p-6 md:p-8">
          {isImage ? (
            <div className={`w-full h-full flex ${isZoomed ? 'items-start justify-start' : 'items-center justify-center'} overflow-auto`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={file.fileName}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsZoomed(!isZoomed)
                }}
                className={isZoomed
                  ? "w-auto h-auto max-w-none origin-top-left cursor-zoom-out select-none scale-[1.3] transition-transform duration-300"
                  : "max-w-full max-h-full min-h-[200px] object-contain cursor-zoom-in drop-shadow-2xl select-none transition-transform duration-300 rounded-lg"
                }
                draggable={false}
              />
            </div>
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden shadow-2xl">
              <video
                src={previewUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              className="w-full h-[75vh] bg-white rounded-xl shadow-2xl"
              title={file.fileName}
            />
          ) : isText ? (
            <iframe
              src={previewUrl}
              className="w-full h-[75vh] max-w-4xl bg-white text-black rounded-xl p-4 shadow-2xl mx-auto block"
              title={file.fileName}
            />
          ) : isAudio ? (
            <div className="flex flex-col items-center justify-center w-[90%] max-w-md p-8 bg-gray-900 border border-white/10 rounded-3xl shadow-2xl">
              <FileIconBig mimeType={file.mimeType} className="w-20 h-20 text-teal-400 mb-6 drop-shadow-lg" />
              <h2 className="text-lg text-white font-medium mb-8 text-center break-all line-clamp-3 px-2">{file.fileName}</h2>
              <audio src={previewUrl} controls autoPlay className="w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-[90%] max-w-md p-8 bg-gray-900 border border-white/10 rounded-3xl shadow-2xl">
              <FileIconBig mimeType={file.mimeType} className="w-20 h-20 text-gray-500 mb-6" />
              <h2 className="text-lg text-white font-medium mb-2 text-center break-all line-clamp-3">{file.fileName}</h2>
              <p className="text-gray-400 mb-8">Önizleme yok</p>
              <a
                href={downloadUrl}
                download={file.fileName}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all duration-200 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                </svg>
                <span>Dosyayı İndir</span>
              </a>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  )
}
