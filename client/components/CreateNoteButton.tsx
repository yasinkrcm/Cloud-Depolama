'use client'

import { useState } from 'react'
import { useUpload } from '@/hooks/useUpload'

import { useQueryClient } from '@tanstack/react-query'

export function CreateNoteButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const { uploadFile } = useUpload()
  const queryClient = useQueryClient()

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return
    
    // Create a physical File object from the string content
    const file = new File([content], `${title.trim()}.txt`, { type: 'text/plain' })
    
    // Upload it using the existing robust chunked upload system!
    await uploadFile(file, undefined, () => {
      void queryClient.invalidateQueries({ queryKey: ['files'] })
    })
    
    setIsOpen(false)
    setTitle('')
    setContent('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 sm:px-4 sm:py-2 bg-primary/20 hover:bg-primary/30 text-blue-400 hover:text-blue-300 border border-primary/30 rounded-xl transition-all flex items-center gap-2 shadow-neon group"
        title="Not Oluştur"
      >
        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="font-medium whitespace-nowrap">Yeni Not</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-lg glass-panel rounded-3xl p-6 sm:p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold text-white mb-6">Not Oluştur</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="note-title" className="block text-sm font-medium text-gray-400 mb-1.5">Not Başlığı</label>
                <input
                  id="note-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn., Toplantı Özeti"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  autoFocus
                />
              </div>
              
              <div>
                <label htmlFor="note-content" className="block text-sm font-medium text-gray-400 mb-1.5">İçerik</label>
                <textarea
                  id="note-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Notunuzu buraya yazın..."
                  rows={6}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                İptal Et
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!title.trim() || !content.trim()}
                className="px-5 py-2.5 bg-primary/20 text-blue-400 border border-primary/30 rounded-xl font-medium hover:bg-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-neon"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
