import { getAuth, clerkMiddleware } from '@clerk/express';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const authConfigured = Boolean(config.clerk.secretKey);

if (!authConfigured) {
  logger.warn('CLERK_SECRET_KEY not set. Auth middleware will reject protected routes.');
}

// When configured, clerkMiddleware attaches `req.auth` (see Clerk docs).
export const withClerkMiddleware = authConfigured ? clerkMiddleware() : (_req, _res, next) => next();

export const requireAuth = authConfigured
  ? (req, res, next) => {
      const auth = typeof req.auth === 'function' ? req.auth() : req.auth ?? getAuth(req);
      if (!auth?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return next();
    }
  : (_req, res) => res.status(503).json({ error: 'Auth is not configured' });

export const getUserAuth = (req) => {
  if (!authConfigured) return null;
  if (typeof req.auth === 'function') {
    return req.auth();
  }
  return req.auth ?? getAuth(req);
};

export const isAuthConfigured = authConfigured;
