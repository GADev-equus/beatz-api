import { ZodError } from 'zod';
import { getUserAuth } from '../middleware/auth.js';
import { registrationSchema } from '../validation/registrationSchema.js';
import { registerProfileService } from '../services/registrationService.js';

export const registerProfile = async (req, res, next) => {
  try {
    const auth = getUserAuth(req);
    const clerkUserId = auth?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = registrationSchema.parse(req.body || {});
    const result = await registerProfileService({ clerkUserId, input: parsed });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid payload', details: err.errors });
    }
    if (err?.status) {
      return res.status(err.status).json({ error: err.message || 'Registration failed' });
    }
    next(err);
  }
};
