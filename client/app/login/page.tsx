'use client'

import { useState } from 'react'
import { authApi } from '@/lib/api'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: apiError } = await authApi.api.auth.login.post({ email, password })
      if (apiError || !data?.success) {
        setError(data?.error || apiError?.value?.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.')
      } else {
        // Force full page reload to clear any cached states and re-run AuthGuard
        window.location.href = '/'
      }
    } catch {
      setError('Giriş yapılırken bir ağ hatası oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden bg-gray-950">
      {/* Background aesthetics */}
      <div className="absolute top-1/4 left-1/4 w-[30vw] h-[30vw] min-w-[300px] min-h-[300px] bg-blue-600/10 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[25vw] h-[25vw] min-w-[250px] min-h-[250px] bg-purple-600/10 rounded-full blur-[100px] -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md p-8 glass-panel rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-500 border border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-neon border border-white/10">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Güvenli Alan</h1>
          <p className="text-gray-400 mt-2 text-sm">Devam etmek için ana bilgilerinizi girin</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center shadow-lg animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={(e) => { void handleLogin(e) }} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2 ml-1">E-POSTA ADRESİ</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium shadow-inner"
              placeholder="admin@ornek.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2 ml-1">ANA ŞİFRE</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium shadow-inner"
              placeholder="••••••••"
            />
          </div>
          
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-50 flex items-center justify-center group"
            >
              {loading ? (
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : (
                <span className="flex items-center gap-2">
                  Kilidi Aç
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
