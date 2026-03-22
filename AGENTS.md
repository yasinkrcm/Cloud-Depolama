# AGENTS.md
# Universal agent memory file (Claude Code, Cursor, Gemini CLI, Copilot)
# Linux Foundation / Agentic AI Foundation standard — 2026

## Project

Cloud Storage — Bun/ElysiaJS backend + Next.js client
Single-user, production-grade, resumable chunked upload system.

## Stack

- Backend : Bun + ElysiaJS + Eden (end-to-end typesafety)
- Client  : Next.js App Router + Eden Treaty
- Storage : MongoDB (metadata) + disk streams (files)
- Upload  : SHA-256 verified multipart chunks, resumable

## Hard Rules

- Never use TypeScript any
- Never compress files (breaks SHA-256 integrity checks)
- Never buffer entire file in memory — stream always
- Every route must have Elysia.t schema validation
- Every public function must have JSDoc

## Commands

```bash
# Backend
cd backend && bun run dev       # start dev server
cd backend && bun run typecheck # type check
cd backend && bun run lint      # lint

# Client
cd client && npm run dev        # start dev server
cd client && npx tsc --noEmit   # type check
```

## Before Writing Code

Present a task list with affected files and test criteria.
Wait for approval. Then implement step by step.
After each file: run typecheck + lint before continuing.