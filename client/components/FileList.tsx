/**
 * @file FileList.tsx
 * @role Display list of uploaded files with preview grid (Apple-style)
 * @depends React, useFiles hook, FileItem component
 * @dataflow File data → Category filter → FileItem grid
 */

'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useFiles } from '@/hooks/useFiles'
import { FileItemComponent } from './FileItem'
import { CreateNoteButton } from './CreateNoteButton'

/**
 * File categories
 */
type FileCategory = 'all' | 'images' | 'videos' | 'audio' | 'pdfs' | 'notes' | 'others'

/**
 * Sort options
 */
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc'

/**
 * File list component (Apple-style)
 */
export function FileList() {
  const { data: files, isLoading, error, refetch } = useFiles()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [category, setCategory] = useState<FileCategory>('all')

  /**
   * Filter and sort files
   */
  const filteredAndSortedFiles = useMemo(() => {
    if (!files) return []

    let result = [...files].filter(f => f.uploadStatus === 'completed')

    // Filter by category
    if (category !== 'all') {
      result = result.filter(file => {
        switch (category) {
          case 'images':
            return file.mimeType?.startsWith('image/')
          case 'videos':
            return file.mimeType?.startsWith('video/')
          case 'audio':
            return file.mimeType?.startsWith('audio/')
          case 'pdfs':
            return file.mimeType?.includes('pdf')
          case 'notes':
            return file.mimeType === 'text/plain'
          case 'others':
            return !file.mimeType?.startsWith('image/') &&
                   !file.mimeType?.startsWith('video/') &&
                   !file.mimeType?.startsWith('audio/') &&
                   !file.mimeType?.includes('pdf') &&
                   file.mimeType !== 'text/plain'
          default:
            return true
        }
      })
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(file =>
        file.fileName.toLowerCase().includes(query)
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        case 'date-asc':
          return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
        case 'name-asc':
          return a.fileName.localeCompare(b.fileName)
        case 'name-desc':
          return b.fileName.localeCompare(a.fileName)
        case 'size-desc':
          return b.fileSize - a.fileSize
        case 'size-asc':
          return a.fileSize - b.fileSize
        default:
          return 0
      }
    })

    return result
  }, [files, searchQuery, sortBy, category])

  // Count files by category
  const categoryCounts = useMemo(() => {
    if (!files) return {}
    const completed = files.filter(f => f.uploadStatus === 'completed')
    return {
      all: completed.length,
      images: completed.filter(f => f.mimeType?.startsWith('image/')).length,
      videos: completed.filter(f => f.mimeType?.startsWith('video/')).length,
      audio: completed.filter(f => f.mimeType?.startsWith('audio/')).length,
      pdfs: completed.filter(f => f.mimeType?.includes('pdf')).length,
      notes: completed.filter(f => f.mimeType === 'text/plain').length,
      others: completed.filter(f =>
        !f.mimeType?.startsWith('image/') &&
        !f.mimeType?.startsWith('video/') &&
        !f.mimeType?.startsWith('audio/') &&
        !f.mimeType?.includes('pdf') &&
        f.mimeType !== 'text/plain'
      ).length
    }
  }, [files])

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          href="/"
          className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
            Dosyalarım
          </h1>
          {files && <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{categoryCounts.all} dosya güvenli bir şekilde depolanıyor</p>}
        </div>

        <CreateNoteButton />

        <button
          type="button"
          onClick={() => refetch()}
          className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title="Yenile"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Category Filter (Apple-style tabs) */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 pb-2">
        <CategoryButton
          label="Tümü"
          count={categoryCounts.all || 0}
          active={category === 'all'}
          onClick={() => setCategory('all')}
        />
        <CategoryButton
          label="Resimler"
          count={categoryCounts.images || 0}
          active={category === 'images'}
          onClick={() => setCategory('images')}
        />
        <CategoryButton
          label="Videolar"
          count={categoryCounts.videos || 0}
          active={category === 'videos'}
          onClick={() => setCategory('videos')}
        />
        <CategoryButton
          label="Ses"
          count={categoryCounts.audio || 0}
          active={category === 'audio'}
          onClick={() => setCategory('audio')}
        />
        <CategoryButton
          label="PDF'ler"
          count={categoryCounts.pdfs || 0}
          active={category === 'pdfs'}
          onClick={() => setCategory('pdfs')}
        />
        <CategoryButton
          label="Notlar"
          count={categoryCounts.notes || 0}
          active={category === 'notes'}
          onClick={() => setCategory('notes')}
        />
        <CategoryButton
          label="Diğerleri"
          count={categoryCounts.others || 0}
          active={category === 'others'}
          onClick={() => setCategory('others')}
        />
      </div>

      {/* Search and sort bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Dosya ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 bg-white/5 border border-white/10 text-white placeholder:text-gray-500 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white/10 transition-colors outline-none text-sm"
          />
        </div>

        {/* Custom Sort dropdown */}
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-16">
          <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center shadow-lg">
          <p className="text-red-400 font-medium tracking-wide">Dosyalar yüklenemedi</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-400 hover:text-red-300 underline underline-offset-4"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredAndSortedFiles.length === 0 && (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 border-dashed backdrop-blur-sm">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a3 3 0 013-3h6a3 3 0 013 3v8a3 3 0 01-3 3H9a3 3 0 01-3-3V7a3 3 0 013-3z" />
          </svg>
          <p className="text-gray-400 text-lg font-medium">
            {searchQuery ? 'Aramanızla eşleşen dosya yok' : category !== 'all' ? 'Bu kategoride dosya yok' : 'Henüz dosya yüklenmedi'}
          </p>
        </div>
      )}

      {/* File grid (Apple-style masonry layout) */}
      {!isLoading && !error && filteredAndSortedFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredAndSortedFiles.map((file) => (
            <FileItemComponent
              key={file.id}
              file={file}
              onDelete={() => refetch()}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Category filter tab button
 */
function CategoryButton({
  label,
  count,
  active,
  onClick
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 whitespace-nowrap border
        ${active
          ? 'bg-primary/20 text-blue-400 border-primary/30 shadow-neon'
          : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200'
        }
      `}
    >
      {label} <span className={active ? 'text-primary/80' : 'text-gray-600 ml-0.5'}>({count})</span>
    </button>
  )
}

/**
 * Sort options for dropdown
 */
const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: 'En Yeniler' },
  { value: 'date-asc', label: 'En Eskiler' },
  { value: 'name-asc', label: 'İsim (A-Z)' },
  { value: 'name-desc', label: 'İsim (Z-A)' },
  { value: 'size-desc', label: 'En Büyük Boyut' },
  { value: 'size-asc', label: 'En Küçük Boyut' },
]

/**
 * Custom sort dropdown component
 */
function SortDropdown({ value, onChange }: { value: SortOption; onChange: (value: SortOption) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedLabel = sortOptions.find(opt => opt.value === value)?.label || 'Sırala'

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-900 rounded-xl hover:bg-gray-50 focus:ring-2 focus:ring-primary focus:bg-white/10 transition-colors outline-none text-[10px] sm:text-xs cursor-pointer min-w-[100px] sm:min-w-[140px] justify-between shadow-sm"
      >
        <span className="font-medium truncate">{selectedLabel}</span>
        <svg
          className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-600 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[140px] sm:min-w-[180px]">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`
                  w-full text-left px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-medium transition-colors
                  ${value === option.value
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
