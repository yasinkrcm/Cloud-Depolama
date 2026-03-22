/**
 * @file page.tsx
 * @role Home page for Cloud Storage app with upload UI (Dark)
 * @depends UploadButton, UploadList components
 * @dataflow Server component → renders upload interface
 */

import { UploadButton } from '@/components/UploadButton'
import { UploadList } from '@/components/UploadList'
import { CreateNoteButton } from '@/components/CreateNoteButton'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-0 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl relative z-10">
        {/* Header with glassmorphism */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
                Bulut Depolama
              </h1>
              <p className="text-gray-400">
                SHA-256 doğrulamalı, güvenli ve yüksek performanslı dosya depolama
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
              <CreateNoteButton />
              <Link
                href="/files"
                className="px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-white/10 text-white rounded-xl sm:rounded-full hover:bg-white/20 transition-all duration-200 font-medium flex items-center gap-2 shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0l-4 4m0 0l4 4m4 4v4a2 2 0 002-2h-4a2 2 0 00-2-2v-4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 002 2m-6 9h12a2 2 0 002 2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2m-6 9h12a2 2 0 002 2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2" />
                </svg>
                <span>Dosyalarım</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
            <UploadButton />
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
            <UploadList />
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="font-semibold text-white mb-2">Uçtan Uca Şifreli</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Tüm dosyalar SHA-256 hash&apos;leri ile doğrulanır
            </p>
          </div>

          <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="font-semibold text-white mb-2">Parçalı Yüklemeler</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Büyük dosyalar güvenilir aktarım için parçalara bölünür
            </p>
          </div>

          <div className="group bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <span className="text-2xl">🔄</span>
            </div>
            <h3 className="font-semibold text-white mb-2">Sürdürülebilir</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Kesintiye uğrayan yüklemelere istendiği zaman devam edilebilir
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>Powered by Bun, ElysiaJS & Next.js</p>
          <p>Yasin KARAÇAM</p>

        </div>
      </div>
    </main>
  )
}
