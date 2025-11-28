# API DB Schema (Draft)

Domain schema for the Beatz backend (JavaScript, ESM) using Express + Mongoose with Clerk identity. Models are normalized to support tenants, parents/students, subjects, and billing metadata.

## Context
- Stack: Express (ESM), Mongoose, versioned routes (`/api/v1`), future Clerk auth (env placeholders exist).
- Identity: Clerk provides authentication; Mongo stores domain data and roles.
- Tenancy: Users/parents/students reference `tenantId` to support school/family scopes.

## Collections & Relationships
- **User**: one per Clerk user; holds role and tenant pointer.
- **Parent**: links to `User`; owns many `Student` records; optional Stripe customer.
- **Student**: optional link to `User` (if student logs in); many-to-many subjects.
- **Subject**: catalog of subjects/boards.
- **Tenant**: schools/families; may store Stripe customer/subscription IDs.

## Recommended Schemas (ESM)
```js
// src/models/User.js
import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['student', 'parent', 'teacher', 'admin'], required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export default model('User', UserSchema);
```

```js
// src/models/Parent.js
import { Schema, model } from 'mongoose';

const ParentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    childrenIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
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

const StudentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // if student has login
    displayName: { type: String, required: true },
    yearGroup: { type: String, default: null },
    subjectIds: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
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

## Webhook Sync (Clerk → Mongo)
- Configure a Clerk webhook to call `/webhook/clerk` with `CLERK_WEBHOOK_SECRET`.
- On `user.created`, upsert a `User` with `clerkUserId`, primary email, default role/tenant as needed.
- Handle `user.updated` (email changes) and `user.deleted` (soft-delete or cascade) similarly.

## Protected Lookup Example
```js
// src/routes/v1/me.js (example)
import { Router } from 'express';
import { getAuth } from '@clerk/express';
import User from '../../models/User.js';
import Parent from '../../models/Parent.js';

const router = Router();

router.get('/me', async (req, res) => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });

  const user = await User.findOne({ clerkUserId });
  if (!user) return res.status(404).json({ error: 'User record not found' });

  const parent = await Parent.findOne({ userId: user._id })
    .populate({ path: 'childrenIds', model: 'Student', populate: { path: 'subjectIds', model: 'Subject' } });

  res.json({ user, parent });
});

export default router;
```

## Indexing & Integrity
- Index `clerkUserId`, `tenantId`, and common lookup fields (`userId` on Parent/Student).
- Prefer `timestamps: true` for auditing.
- Consider soft deletes (`active` flag) for GDPR/retention requirements.

## Folder Layout (aligned with current project)
- `src/models/` – schemas above.
- `src/routes/v1/` – versioned route modules; mount in `src/routes/v1/index.js`.
- `src/clerk/` – webhook/auth helpers when added.
- `src/services/` – business logic (billing, enrollment, permissions).

## Next Steps
- Add actual route files under `src/routes/v1/` to expose CRUD for these models.
- Implement Clerk middleware on protected routes.
- Add validation (e.g., zod/joi) and authorization checks per role/tenant.
