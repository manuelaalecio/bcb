# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**BCB (Big Chat Brasil)** — fullstack chat platform for companies to message end-customers. Companies authenticate via CPF/CNPJ, send messages with a priority queue, and are billed per message (prepaid or postpaid). The full spec is in [ESPECIFICACAO-BCB.md](ESPECIFICACAO-BCB.md) — treat it as the source of truth for business rules and architecture decisions.

## Commands

### Backend (`cd backend`)
```bash
npm run start:dev       # dev server with watch on :3000
npm run build           # compile TypeScript
npm run test            # unit tests (Jest)
npm run test:e2e        # e2e tests
npm run test:cov        # test coverage
npm run lint            # ESLint --fix
npm run format          # Prettier
npx prisma migrate dev  # apply migrations (requires DB)
npx prisma studio       # browse DB in browser
```

### Frontend (`cd frontend`)
```bash
npm run dev     # Vite dev server (port varies)
npm run build   # tsc -b && vite build
npm run lint    # ESLint
npm run format  # Prettier
```

### Full stack via Docker
```bash
cp .env.example .env
docker compose up --build      # all services
docker compose up db           # DB only (for local dev)
```

Services: Frontend `:8080` · Backend `:3000` · Swagger `:3000/docs` · Postgres `:5432`

### Run a single test
```bash
cd backend && npx jest src/path/to/file.spec.ts
```

## Architecture

Monorepo with three top-level directories: `backend/`, `frontend/`, and `docker-compose.yml` at the root.

### Backend (NestJS + Prisma + PostgreSQL + socket.io)

Organized as **vertical slices** — each feature owns its module, controller, service, and DTOs:

- `prisma/` — `PrismaModule` (@Global) with `PrismaService` extending `PrismaClient`
- `common/` — `AuthGuard` (JWT validation, injects client into request), `@CurrentClient()` decorator, `HttpExceptionFilter`
- `auth/` — `POST /auth` with CPF/CNPJ validation, returns JWT + client
- `clients/` — client CRUD, credit/limit management
- `billing/` — Strategy pattern: `PrepaidStrategy` (debits balance) and `PostpaidStrategy` (tracks monthlyUsage), both wrapped in `prisma.$transaction`
- `conversations/` — `GET /conversations`, `GET /:id/messages`
- `messages/` — `POST /messages`: orchestrates `billing.charge()` → create `Message(queued)` → `queue.enqueue()`
- `queue/` — in-memory priority queue (custom data structure, no Redis/BullMQ): urgent messages go before normal; `message.worker.ts` uses `setInterval` to advance status and emit WebSocket events
- `realtime/` — `chat.gateway.ts` on namespace `/chat`: emits `message:status`, `typing`, `presence`

**Key constraints:**
- Prisma 6 (`@prisma/client`) — deliberately not Prisma 7 (ESM/CommonJS conflict with NestJS)
- **Monetary values are always `Prisma.Decimal`** in DB and service layer — never `Float`. Use `.add()`, `.sub()`, `.gte()` methods. Convert to `number` only in JSON responses.
- Controllers receive resolved data only; all business logic lives in services
- `@CurrentClient()` injects the authenticated client — controllers never access `req` directly

### Frontend (React + Vite + TypeScript)

Planned structure under `frontend/src/`:
- `lib/api.ts` — axios instance with Bearer token interceptor
- `lib/socket.ts` — socket.io-client singleton
- `store/auth.store.ts` — Zustand: token + logged-in client (persisted)
- `hooks/` — React Query hooks: `useConversations`, `useMessages`, `useSendMessage` (with optimistic updates), `useChatSocket`
- `features/auth/`, `features/conversations/`, `features/chat/` — page-level components
- `components/` — generic UI primitives

**State management split:** React Query handles server state (conversations, messages). Zustand handles auth and socket connection. Optimistic updates: message appears as `queued` immediately; WebSocket confirms `sent/delivered/read`.

### Data model summary

`Client` → `Conversation[]` (one per recipient) → `Message[]` → `Transaction?`

Message status lifecycle: `queued → processing → sent → delivered → read` (or `failed`). The recipient side is **simulated** — the worker advances `sent→delivered→read` via timers.

### API contract

All endpoints except `POST /auth` require `Authorization: Bearer <token>`.

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/auth` | Login with `{ documentId, documentType }` |
| `GET` | `/conversations` | List conversations for authenticated client |
| `GET` | `/conversations/:id/messages` | Message history |
| `POST` | `/messages` | Send message (triggers billing + queue) |
| `POST` | `/clients` | Create client (admin) |
| `PATCH` | `/clients/:id/credit` | Add credit/limit (admin) |

Error responses follow `{ statusCode, error, message }`. Billing failures → 422. Unauthorized → 401.

## Conventions

- TypeScript strict — no `any`; use DTO types throughout
- DTOs use `class-validator` decorators; `ValidationPipe` global with `whitelist: true`
- Billing costs: normal = R$0.25, urgent = R$0.50
- Migrations in `prisma/migrations/` must always be committed
- Commits are small and per vertical slice, e.g. `feat(auth): login via documentId`
