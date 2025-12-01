import { getUserAuth } from '../middleware/auth.js';
import { getAccountByClerkId, getOrCreateAccountFromAuth } from '../services/accountService.js';

export const getMe = async (req, res, next) => {
  try {
    const auth = getUserAuth(req);
    const clerkUserId = auth?.userId;

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Try to find the account; if missing, upsert a minimal record to let the user in.
    const { user, parent } = await getAccountByClerkId(clerkUserId);
    const account = user ? { user, parent } : await getOrCreateAccountFromAuth(auth);

    if (!account.user) {
      return res.status(404).json({ error: 'User record not found' });
    }

    res.json(account);
  } catch (err) {
    next(err);
  }
};
