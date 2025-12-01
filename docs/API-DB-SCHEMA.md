# API DB Schema (Current)

Domain schema for the Beatz backend (JavaScript, ESM) using Express + Mongoose with Clerk identity. Models are normalized to support tenants, parents/students, enrolments, and billing metadata.

## Context
- Stack: Express (ESM), Mongoose, versioned routes (`/api/v1`), Clerk auth middleware.
- Identity: Clerk provides authentication; Mongo stores domain data, roles, and enrolments.
- Tenancy: Users/parents/students reference `tenantId` to support school/family scopes.

## Collections & Relationships
- **User**: one per Clerk user; holds role, display name, profile, and tenant pointer.
- **Parent**: links to `User`; owns many `Student` records; optional Stripe customer id.
- **Student**: optional link to `User` (if student logs in); includes enrolments (subject, level, exam body, books, exam dates) and country/yearGroup for curriculum context.
- **Subject**: catalog of subjects/boards (kept for reference; enrolments store subject strings).
- **Tenant**: schools/families; may store Stripe customer/subscription IDs.

## Schemas (ESM)
```js
// src/models/User.js
import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    displayName: { type: String, default: '' },
    profile: {
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
      avatarUrl: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    role: { type: String, enum: ['student', 'parent', 'teacher', 'admin'], required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

export default model('User', UserSchema);
```

```js
// src/models/Parent.js
import { Schema, model } from 'mongoose';

const ParentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    childrenIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Student' }], default: [] },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    stripeCustomerId: { type: String, default: null },
  },
  { timestamps: true }
);

export default model('Parent', ParentSchema);
```

```js
// src/models/Student.js
import { Schema, model } from 'mongoose';

const BookSchema = new Schema(
  {
    title: { type: String, required: true },
    author: { type: String, default: '' },
  },
  { _id: false }
);

const EnrolmentSchema = new Schema(
  {
    subject: { type: String, required: true },
    level: { type: String, default: null },
    examBody: { type: String, default: null },
    books: { type: [BookSchema], default: [] },
    examDates: { type: [String], default: [] },
  },
  { _id: false }
);

const StudentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // if student has login
    displayName: { type: String, required: true },
    yearGroup: { type: String, default: null },
    country: { type: String, default: null },
    enrolments: { type: [EnrolmentSchema], default: [] },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  },
  { timestamps: true }
);

export default model('Student', StudentSchema);
```

```js
// src/models/Subject.js
import { Schema, model } from 'mongoose';

const SubjectSchema = new Schema(
  {
    name: { type: String, required: true },
    examBoards: [{ type: String }],
  },
  { timestamps: true }
);

export default model('Subject', SubjectSchema);
```

```js
// src/models/Tenant.js
import { Schema, model } from 'mongoose';

const TenantSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['family', 'school'], required: true },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model('Tenant', TenantSchema);
```

## Enrolment options endpoint
- `GET /api/v1/meta/enrolment-options` exposes static dropdown data to the frontend (`countries`, `levelsByCountry`, `examBodiesByCountry`).

## Webhook Sync (Clerk → Mongo)
- Configure a Clerk webhook to call `/webhook/clerk` (when added) with `CLERK_WEBHOOK_SECRET`.
- On `user.created`, upsert a `User` with `clerkUserId`, primary email, default role/tenant as needed.
- Handle `user.updated` (email changes) and `user.deleted` (soft-delete or cascade) similarly.

## Indexing & Integrity
- Index `clerkUserId`, `tenantId`, and common lookup fields (`userId` on Parent/Student).
- Prefer `timestamps: true` for auditing.
- Consider soft deletes (`active` flag) for GDPR/retention requirements.
- Use zod validation on requests (see `src/validation/`) to keep payloads aligned with these schemas.

## Folder Layout (aligned with current project)
- `src/models/` — schemas above.
- `src/controllers/` — controller functions for health, public ping, me lookups, registrations, students, meta options.
- `src/services/` — domain/service layer (account lookups, registration orchestration, student CRUD/invite).
- `src/validation/` — zod schemas for request validation.
- `src/routes/v1/` — versioned route modules mounted under `src/routes/v1/index.js`.
