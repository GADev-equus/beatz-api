import { getAuth, clerkMiddleware } from '@clerk/express';
import config from '../config/env.js';

const authConfigured = Boolean(config.clerk.secretKey);

// When configured, clerkMiddleware attaches `req.auth` (see Clerk docs).
export const withClerkMiddleware = authConfigured
  ? clerkMiddleware()
  : (_req, _res, next) => next();

export const requireAuth = authConfigured
  ? (req, res, next) => {
      const auth = req.auth ?? getAuth(req);

      if (!auth?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return next();
    }
  : (_req, res) => res.status(503).json({ error: 'Auth is not configured' });

export const getUserAuth = (req) => {
  if (!authConfigured) return null;
  return req.auth ?? getAuth(req);
};
