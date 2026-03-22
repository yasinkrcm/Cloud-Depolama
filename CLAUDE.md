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

GÖREV BAŞLAMADAN şunu çalıştır:
```bash
find .agent/rules/ .yasin/fixed/ -name "*.md" 2>/dev/null | head -40
```
Bu dosyalar daha önce çözülmüş hataların ve mimari kararların
arşividir. Aynı hatayı iki kez yapma.

Kayıt kuralları:
- Yeni mimari karar → .agent/rules/spec.md güncelle
- Hata çözüldü     → .yasin/fixed/YYYY-MM-DD-{slug}.md
  Format: ## Hata | ## Root Cause | ## Çözüm | ## Test
- Breaking change  → .agent/rules/BREAKING.md başına ekle

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
TASK 1: Monorepo iskelet + CI/CD config
TASK 2: MongoDB bağlantısı + File metadata schema
TASK 3: Chunked upload endpoint (backend) + SHA-256 doğrulama
TASK 4: Eden Treaty client setup + upload hook (client)
TASK 5: Upload UI — drag-drop, progress, pause/resume
TASK 6: File listing, download (stream), silme endpoint'leri
TASK 7: Error boundary, global error handler, retry logic
TASK 8: E2E test (Playwright) + load test (autocannon)

## QUALITY GATES

Bir task "done" sayılmaz, şunlar geçilmeden:

  ✓ bun run typecheck → 0 hata
  ✓ bun run lint      → 0 warning
  ✓ SHA-256 testi geçti
  ✓ Upload resume senaryosu manuel test edildi
  ✓ JSDoc tüm public fonksiyonlarda mevcut

## START

Şimdi TASK 0'ı sun. Onayımı al. Sonra başla.