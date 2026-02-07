# ChaosOps API

Backend API for ChaosOps simulation platform.

## Stack
- **Framework:** Hono (TypeScript)
- **Database:** SQLite + Drizzle ORM
- **Auth:** Better Auth

## Quick Start

```bash
pnpm install
pnpm approve-builds
pnpm run db:push
cp .env.example .env
pnpm run dev
```

Open http://localhost:3000

## API Endpoints

- `GET /` - Health check
- `POST /api/runs` - Create run
- `GET /api/runs` - List runs
- `GET /api/runs/:id` - Get run
- `POST /api/runs/:id/start` - Start simulation
- `POST /api/runs/:id/events` - Insert events (batch OK)
- `GET /api/runs/:id/events` - Get events

## Database

```bash
pnpm run db:push      # Apply schema
pnpm run db:studio    # Open GUI
```
