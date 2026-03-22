# CORS Error - Upload Failed

**Tarih:** 2026-03-22
**Dosyalar:** `backend/src/index.ts`

## Hata

```
[NOT_FOUND] NOT_FOUND
CORS error in browser network tab
```

Browser'da dosya upload denendiğinde:
1. Backend'de `NOT_FOUND` hatası
2. Network tab'de `CORS error` hatası

## Root Cause

1. **CORS middleware eksik**: Backend'de `@elysiajs/cors` kurulu değil
2. Client (localhost:3002) → Backend (localhost:3001) cross-origin request'i engelleniyor
3. Browser OPTIONS preflight request'i backend yanıt veremediği için NOT_FOUND alıyor

## Çözüm

```bash
# 1. Paketi yükle
cd backend && bun add @elysiajs/cors
```

```typescript
// 2. backend/src/index.ts
import { cors } from '@elysiajs/cors'

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  }))
```

## Test

```bash
# Backend'i yeniden başlat
cd backend && bun run dev

# Browser'da upload et
# Network tab'de CORS hatası olmamalı
# Upload başarılı olmalı
```
