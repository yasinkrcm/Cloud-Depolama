# QueryClientProvider Missing Error

**Tarih:** 2026-03-22
**Dosyalar:** `client/app/layout.tsx`, `client/app/providers.tsx`

## Hata

```
Error: No QueryClient set, use QueryClientProvider to set one
```

TanStack Query (`useQuery`, `useMutation`) kullanan component'ler QueryClientProvider olmadan çalışmıyor.

## Root Cause

1. `client/app/layout.tsx` sadece `{children}` döndürüyordu
2. TanStack Query ile `useFiles` hook'u QueryClientProvider gerektiriyor
3. Next.js App Router'te provider'ları client component olarak eklemek gerekir

## Çözüm

```typescript
// 1. client/app/providers.tsx oluştur (client component)
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// 2. client/app/layout.tsx'yi güncelle
import { Providers } from './providers'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

## Test

```bash
# Sayfa yükleme kontrolü
curl http://localhost:3000/files | grep "My Files"

# Browser'da dosya listesi görünmeli
# Arama çalışmalı
# Sıralama çalışmalı
```

## Ek Not

Ayrıca `mimeType` undefined hatası için optional chaining eklendi:
```typescript
function FileIcon({ mimeType }: { mimeType?: string }) {
  if (mimeType?.startsWith('image/')) { ... }
}
```
