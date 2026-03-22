# ============================================================
# CLAUDE.md — Cloud Storage System
# Scope: Full monorepo (backend/ + client/)
# Agent: Claude Code (claude-sonnet-4-5 / claude-opus-4-5)
# ============================================================

## ROLE

Sen bir Senior Full-Stack Software Architect'sin.
Uzmanlık alanın: yüksek performanslı dağıtık sistemler, end-to-end
tip güvenliği, ve bakım maliyeti düşük monorepo mimarisi.
Amaç: Prodüksiyon kalitesinde, hata payı sıfıra yakın bir
Cloud Storage uygulaması inşa etmek.

## MEMORY & KNOWLEDGE MANAGEMENT

⚠️ **KRİTİK KURAL** — Her hata çözüldüğünde .yasin/fixed/ 'e kayıt ZORUNLU

GÖREV BAŞLAMADAN şunu çalıştır:
```bash
find .agent/rules/ .yasin/fixed/ -name "*.md" 2>/dev/null | head -40
```
Bu dosyalar daha önce çözülmüş hataların ve mimari kararların
arşividir. Aynı hatayı iki kez yapma.

Kayıt kuralları:
- Hata çözüldü     → .yasin/fixed/YYYY-MM-DD-{slug}.md ⚠️ **ZORUNLU - HER HATA**
  Format: ## Hata | ## Root Cause | ## Çözüm | ## Test
- Yeni mimari karar → .agent/rules/spec.md güncelle
- Breaking change  → .agent/rules/BREAKING.md başına ekle

**Örnek kayıt formatı:**
```markdown
# Hata Başlığı

**Tarih:** YYYY-MM-DD
**Dosyalar:** path/to/file.ts

## Hata
Hata açıklaması ve console output

## Root Cause
Neden olduğu

## Çözüm
 nasıl düzeltildi

## Test
Nasıl doğrulandı
```

## ARCHITECTURE CONSTITUTION

YASAK — bunları hiçbir dosyada kullanma:
- any tipi (TypeScript)
- Sıkıştırılmış dosya transferi (integrity kırılır)
- Silent failure (her hata loglanır ve fırlatılır)
- Elysia.t kullanılmadan raw JSON schema

ZORUNLU — her dosyada bulunmalı:
- JSDoc bloğu (rol, bağımlılıklar, veri akışındaki yer)
- SHA-256 doğrulama (upload öncesi + sonrası)
- Zod/TypeBox schema (tüm API boundary'lerde)

## STACK SPECIFICATIONS

### Backend (backend/)
Runtime  : Bun ≥1.1
Framework: ElysiaJS + @elysiajs/eden (end-to-end typesafety)
Validation: TypeBox via Elysia.t — NO raw zod on routes
Upload   : Multipart chunked, resumable (tus protocol veya custom)
Storage  : Fiziksel dosya disk'te stream ile yaz, ASLA buffer'a alma
DB       : MongoDB (mongoose) — sadece metadata
Hashing  : crypto.subtle SHA-256, her chunk + final dosya

### Client (client/)
Framework: Next.js 14+ App Router
Language : TypeScript strict: true, noImplicitAny: true
Style    : Tailwind CSS + shadcn/ui
API      : Eden Treaty (Elysia client) — generated types, no fetch wrappers
State    : Zustand (upload queue) + TanStack Query (server state)
Upload UI: Progress bar, chunk indicator, pause/resume, hata recovery

### Monorepo (root)
Yapı     : backend/ + client/ + packages/types/
Shared   : packages/types/ → ortak TypeScript interface'leri
Lint     : ESLint flat config (strict) + Prettier
Git hooks: Husky + lint-staged (commit öncesi lint + type-check)

## EXECUTION PROTOCOL

Her görev şu formatı takip eder:

```
TASK {N}: {başlık}
───────────────────────────────
Ön koşul    : {bağımlı task varsa}
Dosyalar    : {etkilenecek dosyalar}
Test kriteri: {nasıl doğrulanacak}

Adımlar:
  [ ] 1. ...
  [ ] 2. ...
  [ ] 3. ...

Onay mı? [y/n]
```

KOD YAZMA — onay gelmeden başlama.
Onay geldikten sonra:
1. Adımları sırayla uygula
2. Her dosyayı bitirince lint + type-check çalıştır:
   cd backend && bun run typecheck && bun run lint
   cd client && npx tsc --noEmit && npx eslint src/
3. Hata varsa .yasin/fixed/ 'e kaydet, sonra devam et

## INIT SEQUENCE (İlk Çalıştırma)

Sırasıyla:
```
TASK 0: Anayasa ve iskelet
  [ ] .agent/rules/spec.md oluştur (bu dosyanın özeti)
  [ ] .yasin/fixed/ dizini oluştur (boş .gitkeep ile)
  [ ] packages/types/ oluştur
  [ ] backend/ — bun init, ElysiaJS, tsconfig strict
  [ ] client/  — create-next-app, tsconfig strict, shadcn init
  [ ] root package.json workspaces tanımla
  [ ] Husky + lint-staged kur
  [ ] Task listesini göster, onay bekle
```

## TASK ROADMAP (Sıra)

# Her task onaylandıktan sonra bir sonrakine geç:
TASK 1: Monorepo iskelet + CI/CD config ✅
TASK 2: MongoDB bağlantısı + File metadata schema ✅
TASK 3: Chunked upload endpoint + SHA-256 doğrulama ✅
TASK 4: Eden Treaty client setup + upload hook ✅
TASK 5: Upload UI — drag-drop, progress, pause/resume ✅
TASK 6: File listing, download (stream), silme endpoint'leri ✅
TASK 7: Error boundary, global error handler, retry logic ✅
TASK 8: E2E test (Playwright) + load test (autocannon)
TASK 9: File Management UI — List, Download, Delete ← ŞURADA

## TASK PROGRESS

### ✅ TASK 1: Monorepo iskelet + CI/CD config (TAMAMLANDI)
- ESLint flat config kuruldu (strict rules)
- GitHub Actions CI pipeline (.github/workflows/ci.yml)
- Test infrastructure (backend/test/, client/test/)
- Pre-commit hooks (lint-staged)
- Quality gates: lint ✅, typecheck ✅, test ✅

### ✅ TASK 2: MongoDB bağlantısı + File metadata schema (TAMAMLANDI)
- backend/src/config/database.ts → MongoDB connection + error handling
- backend/src/models/File.ts → Mongoose schema (SHA-256, chunks, status)

### ✅ TASK 3: Chunked upload endpoint + SHA-256 doğrulama (TAMAMLANDI)
- backend/src/routes/upload.ts → /upload/init, /upload/chunk, /upload/complete
- Chunk-by-chunk stream write (buffer yok)
- SHA-256 verification her chunk'ta

### ✅ TASK 4: Eden Treaty client + upload hook (TAMAMLANDI)
- client/lib/api.ts → Type-safe API client (Eden Treaty)
- client/hooks/useUpload.ts → Upload hook + progress tracking
- client/lib/store/uploadStore.ts → Zustand state management
- packages/types/src/index.ts → Shared TypeScript interfaces

### ✅ TASK 5: Upload UI (TAMAMLANDI)
- client/components/UploadButton.tsx → Drag-drop button
- client/components/UploadList.tsx → Progress bars, status indicators, pause/resume, retry
- Zustand selector fix (useShallow)
- FormData chunk upload fix

### ✅ TASK 6: File listing, download, delete (TAMAMLANDI)
- ✅ GET /files endpoint (backend/src/index.ts)
- ✅ CORS middleware (@elysiajs/cors)
- GET /files/:id/download (stream) → TASK 9'a ertelendi
- DELETE /files/:id → TASK 9'a ertelendi

### ✅ TASK 7: Error boundary, retry logic (TAMAMLANDI)
- client/app/error.tsx → Page error boundary
- client/app/global-error.tsx → Root error boundary
- client/app/loading.tsx → Loading state
- client/lib/error-handler.ts → Error reporting & retry utilities
- client/hooks/useUpload.ts → Chunk upload with retry logic

### ❌ TASK 8: E2E test + load test (BAŞLANMADI)

### ✅ TASK 9: File Management UI — List, Download, Delete (TAMAMLANDI)

**Backend Endpoint'leri:**
- ✅ GET /files/:id/download → Dosyayı stream olarak indirme
- ✅ DELETE /files/:id → Dosyayı silme (disk + DB)
- ✅ GET /files → Tüm dosyaları listeleme

**Client Component'leri:**
- ✅ client/components/FileList.tsx → Dosya listesi (arama, sıralama)
- ✅ client/components/FileItem.tsx → Tek dosya kartı (ikon, hash, işlemler)
- ✅ client/hooks/useFiles.ts → Dosya listesi fetch hook
- ✅ client/app/files/page.tsx → Ayrı dosyalar sayfası
- ✅ client/app/providers.tsx → QueryClientProvider wrapper

**Özellikler:**
- ✅ Dosya adı, boyut, yükleme tarihi gösterimi
- ✅ SHA-256 hash display (kopyalama butonu ile)
- ✅ Download butonu (stream)
- ✅ Delete butonu (confirm dialog ile)
- ✅ Arama/filtreleme (dosya adına göre)
- ✅ Sıralama (tarih, boyut, isim)
- ✅ Dosya tipi ikonları (resim, video, ses, PDF, varsayılan)

## QUALITY GATES

Bir task "done" sayılmaz, şunlar geçilmeden:

  ✓ bun run typecheck → 0 hata
  ✓ bun run lint      → 0 warning
  ✓ SHA-256 testi geçti
  ✓ Upload resume senaryosu manuel test edildi
  ✓ JSDoc tüm public fonksiyonlarda mevcut

## START

Şimdi TASK 0'ı sun. Onayımı al. Sonra başla.