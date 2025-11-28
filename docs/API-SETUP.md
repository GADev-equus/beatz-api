# API Setup Guide (JavaScript)

Baseline Express server (JavaScript only) running on port 8000 with security middleware, logging, environment handling, Mongo wiring, and versioned routes (`/api/v1`). Reflects the current `api/` codebase.

## Structure
- `package.json` – scripts (`dev`, `start`), ESM (`type: "module"`), core deps (`express`, `helmet`, `cors`, `morgan`, `dotenv`, `mongoose`, `@clerk/express`), dev deps (`nodemon`, `cross-env`, `react` to satisfy Clerk peer warning).
- `.env.example` – copy to `.env` and fill values.
- `src/config/env.js` – loads/validates env vars (port, prefix, version, CORS, Clerk, Mongo, Stripe).
- `src/config/mongo.js` – Mongo connection helpers (connect/disconnect, strictQuery).
- `src/utils/logger.js` – console logger with timestamps.
- `src/middleware/auth.js` – Clerk auth wiring (`clerkMiddleware`, `requireAuth`); rejects protected routes if not configured.
- `src/middleware/errorHandler.js` – JSON errors; stack hidden in production.
- `src/middleware/notFound.js` – 404 handler.
- `src/routes/health.js` – `GET /health` uptime probe.
- `src/routes/public.js` – `GET /api/v1/public/ping` sample.
- `src/routes/v1/index.js` – mounts v1 routes under API prefix/version.
- `src/routes/v1/me.js` – protected user lookup (`GET /api/v1/me`) using Clerk auth.
- `src/app.js` – Express app factory (helmet, cors, morgan, parsers, versioned routes).
- `src/server.js` – boots HTTP server, connects Mongo, graceful shutdown.
- `src/models/*` – User, Parent, Student, Subject, Tenant schemas (Mongoose).

## Env Vars
Copy `.env.example` to `.env` and set:
- `PORT` (default 8000), `NODE_ENV`, `API_PREFIX` (default `/api`), `API_VERSION` (default `v1`).
- `CORS_ORIGINS` comma-separated (leave blank to allow all in dev).
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (for auth).
- `MONGO_URL` for Mongo connection.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (future billing).

## Run
```bash
npm install
npm run dev    # nodemon, NODE_ENV=development
# or
npm start      # NODE_ENV=production
```
Server listens on `http://localhost:${PORT||8000}`.

## Routes (current)
- `GET /health` → `{ status, uptime, timestamp }`
- `GET /api/v1/public/ping` → `{ message: "pong" }`
- `GET /api/v1/me` → `{ user, parent }` (requires Clerk auth; returns 401 without a valid session/JWT)

## Extension patterns
- Add protected routes under `src/routes/v1/` and mount them in `src/routes/v1/index.js`.
- Apply auth middleware (Clerk) before protected routes (already wired; set Clerk env vars).
- Add Mongo services/business logic and additional route modules as features land.
- Keep cross-cutting middleware centralized in `src/app.js`.

## Mongo behavior
- On startup, `connectMongo()` uses `MONGO_URL`; if missing, logs a warning and continues (non-fatal).
- On shutdown (`SIGINT`, `SIGTERM`) or fatal errors, HTTP closes then Mongo disconnects.
- `strictQuery` enabled; `autoIndex` disabled by default; `serverSelectionTimeoutMS` set to 5s.

## Clerk middleware note
- `withClerkMiddleware` wraps `clerkMiddleware()` when Clerk env vars are set; it attaches `req.auth()` (function) or `req.auth` so handlers can read `userId` or use `getAuth(req)`.
- If Clerk isn’t configured, protected routes return 503; set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` to enable auth.
