# Copilot / AI Agent Instructions — Petra Stream

This file gives focused, actionable guidance so an AI coding agent can be productive immediately in this repository.

1) Repo layout (what matters)
- `contracts/` — Hardhat contracts and tests. Key scripts: `npm run compile`, `npm run test`, deploy scripts in `scripts/`.
- `backend/` — NestJS service. Important folders: `src/indexer` (chain event handling), `src/gateway` (socket.io gateways), `src/streams` (stream business logic), `prisma/` (Postgres models), and `src/db/mongo.ts` (Mongo models for streams/chat/users).
- `frontend/` — Vite + React SPA. Look at `src/lib/socket.ts` and `src/lib/api.ts` for integration points.

2) Big picture / architecture
- Three subprojects: on-chain contracts (Hardhat) → backend indexer listens to contract logs and writes to Postgres (Prisma) and Mongo; backend exposes HTTP + socket.io API consumed by frontend.
- Backend is polyglot: Prisma (Postgres) for canonical on-chain records (`backend/prisma/schema.prisma`) and Mongo for fast/social data (streams, chat, users) (`backend/src/db/mongo.ts`). Changes to event handling will often touch both places (see `backend/src/indexer/block-indexer.service.ts`).
- Realtime: socket.io is used (server in `backend/src/gateway/*.ts`, client in `frontend/src/lib/socket.ts`). Event naming and payload shapes are defined in notifications and chat gateways.

3) Common developer workflows (commands)
- Contracts: cd `contracts` → `npm install` → `npm run compile` / `npm run test` / `npm run deploy:shannon`.
- Backend: cd `backend` → `npm install` → `npm run dev` (local TypeScript dev server using `ts-node-dev`), `npm run build` to produce `dist/`.
- Backend DB: `docker-compose.yml` in `backend/` defines `postgres` and `redis` for local development. Prisma commands: `npm run prisma:generate` and `npm run prisma:migrate`.
- Frontend: cd `frontend` → `npm install` → `npm run dev` (Vite). API and socket endpoints configurable via `VITE_API_URL` and `VITE_SOCKET_URL`.

4) Important environment variables
- Blockchain endpoints: `SOMNIA_WS`, `SOMNIA_HTTP`, `SOMNIA_TEST_WS`, `SOMNIA_TEST_HTTP`, `SOMNIA_RPC_URL`.
- Contract addresses: `REGISTRY_ADDRESS`, `VAULT_ADDRESS` (used by indexer to subscribe to logs).
- Databases: `DATABASE_URL` (Postgres for Prisma), `MONGO_URL` (Mongo for social/chat).
- API/runtime: `VITE_API_URL`, `VITE_SOCKET_URL` (frontend).

5) Project-specific conventions and patterns
- Dual persistence: treat Prisma/Postgres as the source of truth for on-chain financial records and balances; treat Mongo for ephemeral/social and playback/stateful stream metadata. When adding new event-derived data, decide which store to update and update both where appropriate (see `block-indexer.service.ts` and `streams.service.ts`).
- Indexer safety: the indexer subscribes to contract logs by address and parses with minimal ABI fragments. Do not assume full ABI — follow existing pattern (use `Interface` with only events needed).
- Loose typing in indexer: code intentionally uses `any` in a few places to avoid tight ethers version types — preserve this when modifying event parsing.
- Socket messages: gateways call `notify*` methods; follow existing payload shapes (check `notifications.gateway.ts`) and emit matching events on the frontend `socket` client.

6) Key files to inspect when making changes
- Event ingestion and mapping: `backend/src/indexer/block-indexer.service.ts`
- Streams domain logic: `backend/src/streams/streams.service.ts` and `backend/src/streams/streams.controller.ts`
- Realtime: `backend/src/gateway/notifications.gateway.ts`, `backend/src/gateway/chat.gateway.ts`
- DB models: `backend/prisma/schema.prisma` and `backend/src/db/mongo.ts`
- Prisma client: `backend/src/prisma/client.ts`
- Frontend integration: `frontend/src/lib/api.ts`, `frontend/src/lib/socket.ts`, and page `frontend/src/pages/StreamDetail.tsx`.

7) Tests and CI notes
- Contracts have tests: run from `contracts` with `npm run test`.
- Backend and frontend currently have lint/format scripts configured (`npm run lint`, `npm run format`). No automated unit tests detected for backend/frontend.

8) When editing code, prefer:
- Minimal, focused changes that preserve existing event shapes and DB contracts.
- Update both Prisma schema and Mongo model usage if adding new persisted fields derived from contract events.
- Add env var usage to README or `.env.example` when new runtime variables are required.

If anything in this summary is unclear or you'd like the file to include additional examples (e.g., typical event payloads, sample `.env`), tell me which sections to expand.
