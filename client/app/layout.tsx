/**
 * @file layout.tsx
 * @role Root layout for Next.js App Router
 * @depends Next.js App Router
 * @dataflow Server component wrapper → renders children
 */

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cloud Storage',
  description: 'High-performance cloud file storage system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
