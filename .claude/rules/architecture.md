# .claude/rules/architecture.md
# Modüler kural dosyası — CLAUDE.md'den @import edilir
# Claude Code v2.0+ (Ocak 2026) gerektirir

## STACK DETAILS

### Backend (backend/)
Runtime     : Bun ≥1.1
Framework   : ElysiaJS + @elysiajs/eden
Validation  : TypeBox via Elysia.t (Zod sadece shared types'ta)
Upload      : Multipart chunked, resumable — chunk başına stream yaz,
              ASLA tüm dosyayı buffer'a alma
Storage     : Fiziksel dosya disk'te, metadata MongoDB'de
Hashing     : crypto.subtle SHA-256 — her chunk + final dosya

### Client (client/)
Framework   : Next.js 14+ App Router
Language    : TypeScript strict:true, noImplicitAny:true
Style       : Tailwind CSS + shadcn/ui
API client  : Eden Treaty (generated types, no manuel fetch wrapper)
State       : Zustand (upload queue) + TanStack Query (server state)
Upload UI   : Progress bar, chunk indicator, pause/resume, hata recovery

### Shared (packages/types/)
- Ortak TypeScript interface'leri burada
- Backend ve client bu paketi import eder
- Zod schema burada tanımlanabilir, Elysia.t değil

## FILE HEADER TEMPLATE

Her dosyanın başında:
```typescript
/**
 * @file {dosya adı}
 * @role {bu dosyanın tek cümlelik görevi}
 * @depends {kullandığı modüller/servisler}
 * @dataflow {veri nereden gelir → ne döner}
 */
```

## ERROR HANDLING PATTERN

```typescript
// Backend — Elysia global error handler
app.onError(({ code, error, set }) => {
  // 1. Logla
  console.error(`[${code}]`, error.message, error.stack)
  // 2. Fırlat (silent failure yasak)
  set.status = code === 'NOT_FOUND' ? 404 : 500
  return { error: error.message, code }
})
```

## SHA-256 VERIFICATION PATTERN

```typescript
// chunk upload sonrası doğrulama
const hashBuffer = await crypto.subtle.digest('SHA-256', chunkData)
const hashHex = Buffer.from(hashBuffer).toString('hex')
if (hashHex !== expectedHash) {
  throw new Error(`Chunk integrity failed: expected ${expectedHash}`)
}
```

## TSCONFIG BASELINE

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```