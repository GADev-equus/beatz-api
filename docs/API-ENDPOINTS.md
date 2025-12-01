# API Endpoints (v1)

Overview of the current Express API surface (ESM, versioned under `/api/v1`). All protected routes require Clerk auth unless noted.

## Public
- `GET /health` — Uptime probe; returns `{ status, uptime, timestamp }`.
- `GET /api/v1/public/ping` — Simple liveness check; returns `{ message: "pong" }`.
- `GET /api/v1/meta/enrolment-options` — Static options for enrolment dropdowns (countries, levels, exam bodies).

### Postman sample (public ping)
- Method: `GET`
- URL: `http://localhost:8000/api/v1/public/ping`
- Auth: None
- Tests: expect status `200` and body `{ "message": "pong" }`.

### Postman sample (meta options)
- Method: `GET`
- URL: `http://localhost:8000/api/v1/meta/enrolment-options`
- Auth: None
- Tests: expect status `200` with `{ countries, levelsByCountry, examBodiesByCountry }`.

## Authenticated
- `GET /api/v1/me` — Returns the authenticated user record (Mongo) and related parent/guardian profile (with populated children). Requires Clerk session/JWT.
- `GET /api/v1/me/student-profile` — For a logged-in student, returns their `user` record plus linked `student` profile (including enrolments).

### Postman sample (`/me`)
- Method: `GET`
- URL: `http://localhost:8000/api/v1/me`
- Headers: `Authorization: Bearer <CLERK_JWT>`
- Tests: expect `200` with `{ user, parent }` or `401` if token missing/invalid.

### Postman sample (`/me/student-profile`)
- Method: `GET`
- URL: `http://localhost:8000/api/v1/me/student-profile`
- Headers: `Authorization: Bearer <CLERK_JWT>`
- Tests: expect `200` with `{ user, student }` when the session user has the `student` role.

## Registration / Onboarding
- `POST /api/v1/registrations` — Upserts the authenticated Clerk user into Mongo, optionally creates/links a tenant, guardian profile, and student records from the payload. Validated via zod.
  - Payload example:
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
            {
              "subject": "Biology",
              "level": "GCSE",
              "examBody": "AQA",
              "books": [{ "title": "AQA GCSE Biology Student Book" }]
            }
          ]
        }
      ]
    }
    ```
  - Supported roles: `student`, `parent`, `teacher`, `admin` (guardian roles create a `Parent` profile to manage students).
  - Tenant options: pass `tenant.id` to link an existing tenant, or both `tenant.name` + `tenant.type` (`family` | `school`) to create/find.

### Postman sample (`/registrations`)
- Method: `POST`
- URL: `http://localhost:8000/api/v1/registrations`
- Headers: `Content-Type: application/json`, `Authorization: Bearer <CLERK_JWT>`
- Body (raw JSON):
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
          { "subject": "English Literature", "level": "GCSE", "examBody": "Edexcel" }
        ]
      }
    ]
  }
  ```
- Tests: expect `201` with `{ user, tenant, parent, students }` or `400` with details if validation fails.

## Students (guardian-facing)
- `GET /api/v1/students` — List all students associated with the authenticated guardian (parent/teacher/admin).
- `POST /api/v1/students` — Create a student under the guardian. Payload: `{ "displayName": "Sam Doe", "yearGroup": "Year 6", "country": "UK", "enrolments": [ { "subject": "Maths" } ] }`.
- `PUT /api/v1/students/:studentId` — Update fields and enrolments for a specific student (must belong to guardian).
- `POST /api/v1/students/:studentId/invite` — Attempts to send a Clerk invitation for the student email; requires server-side Clerk secret.

### Postman sample (`/students` list)
- Method: `GET`
- URL: `http://localhost:8000/api/v1/students`
- Headers: `Authorization: Bearer <CLERK_JWT>`
- Tests: expect `200` with `{ students: [...] }`.

### Postman sample (create student)
- Method: `POST`
- URL: `http://localhost:8000/api/v1/students`
- Headers: `Content-Type: application/json`, `Authorization: Bearer <CLERK_JWT>`
- Body:
  ```json
  { "displayName": "Sam Doe", "yearGroup": "Year 5", "country": "USA", "enrolments": [ { "subject": "Math" } ] }
  ```
- Tests: expect `201` with `{ student }`.

### Postman sample (update student)
- Method: `PUT`
- URL: `http://localhost:8000/api/v1/students/<studentId>`
- Headers: `Content-Type: application/json`, `Authorization: Bearer <CLERK_JWT>`
- Body:
  ```json
  { "yearGroup": "Year 6", "enrolments": [ { "subject": "Physics", "examBody": "AQA" } ] }
  ```
- Tests: expect `200` with `{ student }`.

### Postman sample (invite student)
- Method: `POST`
- URL: `http://localhost:8000/api/v1/students/<studentId>/invite`
- Headers: `Content-Type: application/json`, `Authorization: Bearer <CLERK_JWT>`
- Body:
  ```json
  { "email": "student@example.com" }
  ```
- Tests: expect `202` with `{ message, invite }` when server-side Clerk secret is configured, or a `4xx/5xx` with error details otherwise.

## Notes
- API prefix/version: `${API_PREFIX}/${API_VERSION}` (defaults: `/api/v1`).
- Auth: Clerk middleware must be configured via env (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`); otherwise protected routes return 503/401.
- Data: ensure `MONGO_URL` points to a database where your user has `readWrite` (set `MONGO_DB_NAME` or use a URI that targets your app DB rather than `admin`).
- Responses are JSON; errors are returned as `{ error, details? }`.
