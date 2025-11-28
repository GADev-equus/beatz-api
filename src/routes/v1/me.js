import { Router } from 'express';
import { getUserAuth } from '../../middleware/auth.js';
import User from '../../models/User.js';
import Parent from '../../models/Parent.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const auth = getUserAuth(req);
    const clerkUserId = auth?.userId;

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ error: 'User record not found' });
    }

    const parent = await Parent.findOne({ userId: user._id }).populate({
      path: 'childrenIds',
      model: 'Student',
      populate: { path: 'subjectIds', model: 'Subject' },
    });

    res.json({ user, parent });
  } catch (err) {
    next(err);
  }
});

export default router;
