# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + Socket.io
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Sky Hosting (`artifacts/sky-hosting`)
- A next-generation instant deployment platform with "Dark Aero" aesthetic
- React + Vite frontend with TailwindCSS + shadcn/ui
- Deep space dark theme, glassmorphism cards, neon green LIVE badges
- Pages: Dashboard, Project Detail, API Docs, Admin Panel
- Real-time deployment logs via Socket.io
- Routes: `/` (Dashboard), `/projects/:id`, `/docs`, `/admin`

### API Server (`artifacts/api-server`)
- Express 5 backend with Socket.io for real-time build logs
- Routes: `/api/v1/projects`, `/api/v1/deploy`, `/api/v1/deployments`, `/api/v1/logs/:id`, `/api/v1/admin/stats`
- **Real build engine** (`lib/realBuildEngine.ts`): actual `git clone`, `npm install`, build detection, process spawning
- Preview router (`lib/previewRouter.ts`): serves static files or proxies live Node.js processes at `/preview/:deploymentId/`
- Supports: Static HTML (serve direct), Node.js with build script (serve dist/), Node.js server (spawn + proxy on port 25000+)
- Live URLs use real Replit dev domain: `https://<domain>/preview/<deploymentId>/`
- API key auth via Bearer tokens

## Database Schema

Tables:
- `projects` — project records with runtime detection
- `deployments` — deployment history and status
- `deployment_logs` — per-deployment log entries
- `api_keys` — authentication keys (scopes: read, write, admin)

## Socket.io

- Server path: `/api/socket.io`
- Events emitted by server: `deployment:log`, `deployment:status`
- Events listened by server: `subscribe:deployment`, `unsubscribe:deployment`

## Important Notes

- `lib/api-zod/src/index.ts` is patched post-codegen to only export `./generated/api` (avoids duplicate export conflicts)
- The codegen patch is in `lib/api-spec/package.json`'s `codegen` script
