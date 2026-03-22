/**
 * @file UploadButton.tsx
 * @role File upload button component with drag-and-drop (Dark)
 * @depends React, useUpload hook
 * @dataflow User action → file selection → upload process
 */

'use client'

import { useCallback, useState } from 'react'
import { useUpload } from '@/hooks/useUpload'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Upload button component (Dark)
 */
export function UploadButton() {
  const { uploadFile, isUploading } = useUpload()
  const [isDragging, setIsDragging] = useState(false)
  const queryClient = useQueryClient()

  /**
   * Handle file selection
   */
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const MAX_FILE_SIZE = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE) || 10737418240;

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      if (file && file.size > MAX_FILE_SIZE) {
        alert(`Dosya boyutu ${(MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(1)}GB limitini aşıyor: ${file.name}`)
        continue
      }
      
      if (file && file.size > 0) {
        await uploadFile(file, undefined, () => {
          void queryClient.invalidateQueries({ queryKey: ['files'] })
        })
      }
    }
  }, [uploadFile, queryClient])

  /**
   * Handle drag events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    void handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  /**
   * Handle file input change
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(e.target.files)
    // Reset input
    e.target.value = ''
  }, [handleFiles])

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300',
        isDragging
          ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
          : 'border-white/20 hover:border-white/30 bg-white/5 hover:bg-white/10'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-upload"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleInputChange}
        disabled={isUploading}
        multiple
      />

      <div className="flex flex-col items-center gap-4">
        {/* Animated icon */}
        <div className={cn(
          'w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300',
          isDragging ? 'bg-blue-500 scale-110' : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20',
          !isDragging && 'hover:scale-105 hover:from-blue-500/30 hover:to-purple-500/30'
        )}>
          {isDragging ? (
            <svg className="w-10 h-10 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003 3v-1m-4-4l-4 4m0 0l4 4m4-4v12" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </div>

        <div className="text-center">
          <p className={cn(
            'text-lg font-semibold transition-colors',
            isDragging ? 'text-white' : 'text-gray-200'
          )}>
            {isDragging ? 'Dosyaları buraya bırakın' : 'Dosyaları sürükleyip bırakın veya seçmek için tıklayın'}
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Dosyalar şifrelenir ve güvenli bir şekilde saklanır
          </p>

          {isUploading && (
            <div className="flex justify-center items-center gap-2 text-blue-400 mt-3">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium">Yükleniyor...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
