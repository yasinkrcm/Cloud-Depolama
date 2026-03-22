# .agent/rules/spec.md
# Cloud Storage System — Architecture Specification
# Generated from CLAUDE.md constitution

## ROLE
Senior Full-Stack Software Architect
Uzmanlık: Yüksek performanslı dağıtık sistemler, end-to-end tip güvenliği, bakım maliyeti düşük monorepo mimarisi

## MEMORY & KNOWLEDGE MANAGEMENT

### Arşiv Dizinleri
- `.agent/rules/` → Mimari kararlar ve spesifikasyonlar
- `.yasin/fixed/` → Çözülmüş hata raporları (YYYY-MM-DD-{slug}.md formatında)

### Kayıt Formatı
```markdown
## Hata
{açıklama}

## Root Cause
{neden oldu}

## Çözüm
{nasıl çözüldü}

## Test
{doğrulama adımları}
```

## ARCHITECTURE CONSTITUTION

### YASAKLI KULLANIMLAR
- ❌ `any` tipi (TypeScript)
- ❌ Sıkıştırılmış dosya transferi (integrity kırılır)
- ❌ Silent failure (her hata loglanır ve fırlatılır)
- ❌ Elysia.t kullanılmadan raw JSON schema

### ZORUNLU GEREKSİNİMLER
- ✅ JSDoc bloğu (her dosyada)
- ✅ SHA-256 doğrulama (upload öncesi + sonrası)
- ✅ Zod/TypeBox schema (tüm API boundary'lerde)

## STACK SPECIFICATIONS

### Backend (backend/)
```
Runtime  : Bun ≥1.1
Framework: ElysiaJS + @elysiajs/eden
Validation: TypeBox via Elysia.t
Upload   : Multipart chunked, resumable
Storage  : Fiziksel dosya disk'te stream ile yaz
DB       : MongoDB (mongoose) — sadece metadata
Hashing  : crypto.subtle SHA-256
```

### Client (client/)
```
Framework: Next.js 14+ App Router
Language : TypeScript strict: true, noImplicitAny: true
Style    : Tailwind CSS + shadcn/ui
API      : Eden Treaty (Elysia client)
State    : Zustand (upload queue) + TanStack Query (server state)
Upload UI: Progress bar, chunk indicator, pause/resume
```

### Monorepo (root)
```
Yapı     : backend/ + client/ + packages/types/
Shared   : packages/types/ → ortak TypeScript interface'leri
Lint     : ESLint flat config (strict) + Prettier
Git hooks: Husky + lint-staged
```

## EXECUTION PROTOCOL

### Task Format
```
TASK {N}: {başlık}
───────────────────────────────
Ön koşul    : {bağımlı task varsa}
Dosyalar    : {etkilenecek dosyalar}
Test kriteri: {nasıl doğrulanacak}

Adımlar:
  [ ] 1. ...
  [ ] 2. ...

Onay mı? [y/n]
```

### Quality Gates
Bir task "done" sayılmaz şunlar geçilmeden:
- ✓ `bun run typecheck` → 0 hata
- ✓ `bun run lint` → 0 warning
- ✓ SHA-256 testi geçti
- ✓ Upload resume senaryosu test edildi
- ✓ JSDoc tüm public fonksiyonlarda mevcut

## FILE HEADER TEMPLATE
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
app.onError(({ code, error, set }) => {
  console.error(`[${code}]`, error.message, error.stack)
  set.status = code === 'NOT_FOUND' ? 404 : 500
  return { error: error.message, code }
})
```

## SHA-256 VERIFICATION PATTERN
```typescript
const hashBuffer = await crypto.subtle.digest('SHA-256', chunkData)
const hashHex = Buffer.from(hashBuffer).toString('hex')
if (hashHex !== expectedHash) {
  throw new Error(`Chunk integrity failed: expected ${expectedHash}`)
}
```

## TASK ROADMAP
- TASK 1: Monorepo iskelet + CI/CD config
- TASK 2: MongoDB bağlantısı + File metadata schema
- TASK 3: Chunked upload endpoint + SHA-256 doğrulama
- TASK 4: Eden Treaty client setup + upload hook
- TASK 5: Upload UI — drag-drop, progress, pause/resume
- TASK 6: File listing, download, silme endpoint'leri
- TASK 7: Error boundary, global error handler, retry logic
- TASK 8: E2E test (Playwright) + load test (autocannon)
