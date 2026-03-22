'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: apiError } = await (api as any).api.auth.register.post({ email, password })
      if (apiError || !data?.success) {
        setError(data?.error || apiError?.value?.error || 'Kayıt başarısız oldu.')
      } else {
        // Force full page reload to clear any cached states and re-run AuthGuard
        window.location.href = '/'
      }
    } catch (err) {
      setError('Kayıt olurken ağ hatası meydana geldi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden bg-gray-950">
      {/* Background aesthetics */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] min-w-[400px] min-h-[400px] bg-green-500/10 rounded-full blur-[150px] -z-10 animate-pulse" />

      <div className="w-full max-w-md p-8 glass-panel rounded-[2rem] shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-700 border border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-teal-500/20 text-emerald-400 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] border border-white/10">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Kurulum</h1>
          <p className="text-gray-400 mt-2 text-sm leading-relaxed">
            Sisteme Hoş Geldiniz! <strong>Ana Yönetici</strong> hesabını kurun. Kurulum tamamlandıktan sonra sistem dışarıdan kayıtlara kalıcı olarak kilitlenecektir.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center shadow-lg animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2 ml-1">Yönetici E-Postası</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium shadow-inner"
              placeholder="admin@ornek.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2 ml-1">Ana Şifre</label>
            <input 
              type="password" 
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium shadow-inner"
              placeholder="•••••••• (En az 6 hane)"
            />
          </div>
          
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 flex items-center justify-center group"
            >
              {loading ? (
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : (
                <span className="flex items-center gap-2">
                  Depolamayı Başlat
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
