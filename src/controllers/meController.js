import { getUserAuth } from '../middleware/auth.js';
import {
  getAccountByClerkId,
  getOrCreateAccountFromAuth,
} from '../services/accountService.js';

export const getMe = async (req, res, next) => {
  try {
    const auth = getUserAuth(req);
    const clerkUserId = auth?.userId;

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Try to find the account
    const { user, parent } = await getAccountByClerkId(clerkUserId);

    // Don't auto-create users here - let them complete registration first
    if (!user) {
      return res
        .status(404)
        .json({
          error: 'User record not found. Please complete registration.',
        });
    }

    res.json({ user, parent });
  } catch (err) {
    next(err);
  }
};
