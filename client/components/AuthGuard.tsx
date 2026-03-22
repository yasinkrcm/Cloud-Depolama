'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Exclude auth routes from validation check to prevent infinite loops
    if (pathname === '/login' || pathname === '/register') {
      setIsAuthenticated(true)
      return
    }

    const checkAuth = async () => {
      try {
        const { data, error } = await (api as any).api.auth.me.get()
        if (data?.success && !error) {
          setIsAuthenticated(true)
        } else {
          // Verify if there's any user registered in DB at all
          const { data: statusData } = await (api as any).api.auth['setup-status'].get()
          if (statusData?.hasUser) {
            router.replace('/login')
          } else {
            router.replace('/register')
          }
        }
      } catch (err) {
        console.error('Kimlik doğrulama başarısız oldu:', err)
        router.replace('/login')
      }
    }

    checkAuth()
  }, [pathname, router])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gray-950 -z-20" />
        <div className="absolute center-blob w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-primary/20 rounded-full blur-[100px] -z-10 animate-pulse" />
        
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin shadow-neon" />
        <h2 className="mt-8 text-sm font-semibold text-blue-400 tracking-[0.3em] font-mono animate-pulse">GÜVENLİ BAĞLANTI SAĞLANIYOR</h2>
      </div>
    )
  }

  return <>{children}</>
}
