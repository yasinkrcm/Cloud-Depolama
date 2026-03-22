/**
 * @file layout.tsx
 * @role Root layout for Next.js App Router
 * @depends Next.js App Router, Providers component
 * @dataflow Server component wrapper → renders children with providers
 */

import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { AuthGuard } from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: 'Bulut Depolama',
  description: 'Yüksek performanslı bulut dosya depolama sistemi',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AuthGuard>
            {children}
          </AuthGuard>
        </Providers>
      </body>
    </html>
  )
}
