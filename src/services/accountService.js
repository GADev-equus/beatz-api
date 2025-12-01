import User from '../models/User.js';
import Parent from '../models/Parent.js';

export const getAccountByClerkId = async (clerkUserId) => {
  const user = await User.findOne({ clerkUserId });
  if (!user) {
    return { user: null, parent: null };
  }

  const parent = await Parent.findOne({ userId: user._id }).populate({
    path: 'childrenIds',
    model: 'Student',
  });

  return { user, parent };
};

// Optionally upsert a minimal user record if it does not exist yet.
export const getOrCreateAccountFromAuth = async (auth) => {
  const clerkUserId = auth?.userId;
  if (!clerkUserId) return { user: null, parent: null };

  const claims = typeof auth?.sessionClaims === 'object' ? auth.sessionClaims : {};
  const email = auth?.emailAddress || claims?.email || claims?.email_address || '';
  const firstName = claims?.first_name || '';
  const lastName = claims?.last_name || '';
  const displayName = claims?.name || `${firstName} ${lastName}`.trim();

  const user =
    (await User.findOne({ clerkUserId })) ||
    (await User.create({
      clerkUserId,
      email: email || 'unknown@example.com',
      displayName: displayName?.trim() || email || 'New User',
      role: 'parent', // default role; can be updated via registration flow
    }));

  const parent = await Parent.findOne({ userId: user._id });

  return { user, parent };
};
