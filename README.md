# ChaosOps

Deterministic simulation runner + fault injection + black-box recorder with "Why did it fail?" analysis.

## Development Setup

### Quick Start

```bash
docker compose up
```

This runs:
- **PostgreSQL**: Database at localhost:5432
- **API** (Hono): Auto-reloads on file changes at http://localhost:3000

API Docs: http://localhost:3000/docs

### Frontend Development

Frontend is deployed separately to Cloudflare. Run locally:

```bash
cd web
npm install
npm run start
```

Access at http://localhost:4200

### Manual API Development

If you prefer running API outside Docker:

```bash
# Terminal 1 - Database only
docker compose up db

# Terminal 2 - API
cd api
pnpm install
pnpm run dev
```

## Architecture

- **Frontend:** Angular 21 → Cloudflare
- **Backend:** Hono (TypeScript) REST + WebSocket API
- **Database:** PostgreSQL 16 with Drizzle ORM
- **Auth:** Better Auth with pg provider
- **Docs:** Scalar API Reference

## API Endpoints

See interactive docs at http://localhost:3000/docs

- `POST /runs` - Create run from TaskSpec + FaultProfile
- `GET /runs` - List all runs
- `GET /runs/:id` - Get run details
- `POST /runs/:id/start` - Start a run
- `POST /runs/:id/stop` - Stop a run
- `GET /runs/:id/events` - Get run events
- `POST /events` - Record events (WebSocket or REST)

## Database Management

```bash
cd api

# Generate migration
pnpm run db:generate

# Push schema changes
pnpm run db:push

# Open Drizzle Studio
pnpm run db:studio
```
