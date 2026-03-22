/**
 * @file useFiles.ts
 * @role React hook for fetching and managing uploaded files
 * @depends @tanstack/react-query, API client
 * @dataflow Server state → File list → UI display
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/api'

/**
 * File item from server
 */
export interface FileItem {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  sha256: string
  uploadStatus: 'completed' | 'pending' | 'failed'
  uploadedChunks: number[]
  totalChunks: number
  progress: number
  uploadedAt: string
  completedAt?: string
}

/**
 * Fetch all files
 */
export function useFiles() {
  return useQuery({
    queryKey: ['files'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/files`)
      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }
      const result = await response.json() as {
        success: boolean
        data: FileItem[]
      }
      return result.data
    },
    refetchInterval: 10000 // Poll every 10 seconds
  })
}

/**
 * Delete file mutation
 */
export function useDeleteFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/files/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete file')
      }
      return response.json()
    },
    onSuccess: () => {
      // Refetch files list
      queryClient.invalidateQueries({ queryKey: ['files'] })
    }
  })
}

/**
 * Get download URL for a file
 */
export function getDownloadUrl(id: string): string {
  return `${API_BASE_URL}/files/${id}/download`
}
