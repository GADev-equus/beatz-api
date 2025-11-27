# API Setup Guide (JavaScript)

Baseline Express server (no TypeScript) running on port 8000 with security, logging, env handling, and versioned routes (`/api/v1`). This matches the current `api/` code.

## Structure
- `package.json` – scripts (`dev`, `start`), type `module`.
- `.env.example` – copy to `.env` and fill values.
- `src/config/env.js` – loads/validates env vars (port, prefix, version, CORS, Clerk, Mongo, Stripe).
- `src/utils/logger.js` – console-based logger with timestamps.
- `src/middleware/errorHandler.js` – consistent JSON errors; hides stack in production.
- `src/middleware/notFound.js` – 404 handler.
- `src/routes/health.js` – `GET /health` uptime probe.
- `src/routes/public.js` – `GET /api/v1/public/ping` sample.
- `src/routes/v1/index.js` – mounts v1 routes under API prefix/version.
- `src/app.js` – Express app factory (helmet, cors, morgan, parsers, versioned routes).
- `src/server.js` – bootstraps the HTTP server and graceful shutdown.

## Env Vars
Copy `.env.example` to `.env`:
- `PORT` (default 8000), `NODE_ENV`, `API_PREFIX` (default `/api`), `API_VERSION` (default `v1`).
- `CORS_ORIGINS` comma-separated (leave blank to allow all in dev).
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (for future auth wiring).
- `MONGO_URL` for Mongo connection when added.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (future billing).

## Run
```bash
npm install
npm run dev   # nodemon, NODE_ENV=development
# or
npm start     # NODE_ENV=production
```
Server listens on `http://localhost:${PORT||8000}`.

## Routes (current)
- `GET /health` → `{ status, uptime, timestamp }`
- `GET /api/v1/public/ping` → `{ message: "pong" }`

## Patterns to extend
- Add protected routes under `src/routes/v1/` and mount them in `src/routes/v1/index.js`.
- Add auth middleware (Clerk) before protected route mounts.
- Add Mongo models/services once the database layer is connected.
- Keep cross-cutting middleware centralized in `src/app.js`.
