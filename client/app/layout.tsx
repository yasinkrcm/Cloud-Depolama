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
  icons: {
    icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%233b82f6%22/%3E%3Cpath d=%22M9 19C9 16.2386 11.2386 14 14 14C14.3108 14 14.6128 14.0324 14.9035 14.094C15.6837 12.2779 17.4519 11 19.5 11C22.3137 11 24.6362 13.2386 24.9734 16C24.9823 16 24.9912 16 25 16C27.2091 16 29 17.7909 29 20C29 22.2091 27.2091 24 25 24H11C8.23858 24 6 21.7614 6 19C6 19.5523 6.44772 20 7 20H9Z%22 fill=%22white%22 opacity=%22.95%22/%3E%3C/svg%3E',
    apple: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 180 180%22%3E%3Crect width=%22180%22 height=%22180%22 rx=%2240%22 fill=%22%233b82f6%22/%3E%3Cpath d=%22M55 100C55 76 75 56 99 56C102 56 105 56.3 107.8 56.9C111.5 44 124 34 139 34C158 34 173.5 49.5 173.5 68.5C173.5 69.2 173.5 69.8 173.4 70.5C181 73.5 186.5 80.5 186.5 89C186.5 100 177.5 109 166.5 109H68C52 109 39 96 39 80C39 80 39 86 39 86C39 86 44.5 100 55 100Z%22 fill=%22white%22 opacity=%22.95%22/%3E%3C/svg%3E',
  },
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
