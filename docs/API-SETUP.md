# API Setup Guide (JavaScript)

Baseline Express server (JavaScript only) running on port 8000 with security middleware, logging, environment handling, Mongo wiring, and versioned routes (`/api/v1`). Reflects the current `api/` codebase.

## Structure
- `package.json` — scripts (`dev`, `start`), ESM (`"type": "module"`), core deps (`express`, `helmet`, `cors`, `morgan`, `dotenv`, `mongoose`, `@clerk/express`), dev deps (`nodemon`, `cross-env`, `react` to satisfy Clerk peer warning).
- `.env.example` — copy to `.env` and fill values.
- `src/config/env.js` — loads/validates env vars (port, prefix, version, CORS, Clerk, Mongo, Stripe) and normalizes the API base path (avoids `/api/v1/v1` if the prefix already includes a version).
- `src/config/mongo.js` — Mongo connection helpers (connect/disconnect, strictQuery).
- `src/utils/logger.js` — console logger with timestamps.
- `src/utils/normalizers.js` — shared helpers for trimming enrolment/book payloads.
- `src/constants/enrolmentOptions.js` — static dropdown data for enrolment options.
- `src/middleware/auth.js` — Clerk auth wiring (`clerkMiddleware`, `requireAuth`); rejects protected routes if not configured.
- `src/middleware/errorHandler.js` — JSON errors; stack hidden in production.
- `src/middleware/notFound.js` — 404 handler.
- `src/controllers/*` — thin controllers for health, public ping, meta options, me lookup, registrations, and students.
- `src/services/*` — domain/service layer (account lookups, registration orchestration, student CRUD/invite).
- `src/validation/*` — zod schemas for request validation (registration and student payloads).
- `src/routes/health.js` — `GET /health` uptime probe.
- `src/routes/public.js` — `GET /api/v1/public/ping` sample.
- `src/routes/v1/index.js` — mounts v1 routes under API prefix/version.
- `src/routes/v1/me.js` — protected user lookup (`GET /api/v1/me`) and student profile (`GET /api/v1/me/student-profile`).
- `src/routes/v1/meta.js` — public enrolment options (`GET /api/v1/meta/enrolment-options`).
- `src/routes/v1/registrations.js` — onboarding endpoint (`POST /api/v1/registrations`, protected).
- `src/routes/v1/students.js` — guardian-facing student CRUD + invite (protected).
- `src/app.js` — Express app factory (helmet, cors, morgan, parsers, versioned routes).
- `src/server.js` — boots HTTP server, connects Mongo, graceful shutdown.
- `src/models/*` — User, Parent, Student (with enrolments), Subject, Tenant schemas (Mongoose).

## Env Vars
Copy `.env.example` to `.env` and set:
- `PORT` (default 8000), `NODE_ENV`, `API_PREFIX` (default `/api`), `API_VERSION` (default `v1`). The base path is normalized, so if you set `API_PREFIX=/api/v1` and leave `API_VERSION=v1`, the server still mounts at `/api/v1` (no double version).
- `CORS_ORIGINS` comma-separated (leave blank to allow all in dev).
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (for auth; secret required for invites).
- `MONGO_URL` for Mongo connection, `MONGO_DB_NAME` for the target database (avoid `admin`; give your user `readWrite` on this DB).
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
- `GET /api/v1/meta/enrolment-options` → `{ countries, levelsByCountry, examBodiesByCountry }`
- `GET /api/v1/me` → `{ user, parent }` (requires Clerk auth)
- `GET /api/v1/me/student-profile` → `{ user, student }` (requires Clerk auth with student role)
- `POST /api/v1/registrations` → upserts the authenticated Clerk user into Mongo; optionally creates a tenant, guardian record, and student records from the payload (requires Clerk auth)
- `GET /api/v1/students` → list guardian’s students (requires Clerk auth, guardian roles)
- `POST /api/v1/students` → create student for guardian
- `PUT /api/v1/students/:studentId` → update student for guardian
- `POST /api/v1/students/:studentId/invite` → send Clerk invite for student email (requires Clerk secret)

Example registration payload:
```json
{
  "email": "user@example.com",
  "role": "parent",
  "displayName": "Alex Parent",
  "tenant": { "name": "Family Alpha", "type": "family" },
  "profile": { "firstName": "Alex", "lastName": "Parent", "phone": "+44..." },
  "children": [
    {
      "displayName": "Kid One",
      "yearGroup": "Year 5",
      "country": "UK",
      "enrolments": [
        { "subject": "Maths", "level": "GCSE", "examBody": "Edexcel" }
      ]
    }
  ]
}
```

## Extension patterns
- Add protected routes under `src/routes/v1/` and mount them in `src/routes/v1/index.js`.
- Apply auth middleware (Clerk) before protected routes (already wired; set Clerk env vars).
- Keep business logic in services and validate with zod schemas in `src/validation/`.
- Keep cross-cutting middleware centralized in `src/app.js`.

## Mongo behavior
- On startup, `connectMongo()` uses `MONGO_URL`; if missing, logs a warning and continues (non-fatal).
- `MONGO_DB_NAME` selects the database; ensure your Mongo user has `readWrite` on that DB.
- On shutdown (`SIGINT`, `SIGTERM`) or fatal errors, HTTP closes then Mongo disconnects.
- `strictQuery` enabled; `autoIndex` disabled by default; `serverSelectionTimeoutMS` set to 5s.

## Clerk middleware note
- `withClerkMiddleware` wraps `clerkMiddleware()` when Clerk env vars are set; it attaches `req.auth()` (function) or `req.auth` so handlers can read `userId` or use `getAuth(req)`.
- If Clerk is not configured, protected routes return 503/401; set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` to enable auth.
