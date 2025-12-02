import { getUserAuth } from '../middleware/auth.js';
import {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
} from '../services/notificationService.js';

const handleError = (err, res, next) => {
  if (err?.status) {
    return res.status(err.status).json({ error: err.message });
  }
  return next(err);
};

export const getNotifications = async (req, res, next) => {
  try {
    const auth = getUserAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find user to get userId
    const User = (await import('../models/User.js')).default;
    const user = await User.findOne({ clerkUserId: auth.userId });
    if (!user) {
      // User hasn't completed registration yet, return empty notifications
      return res.json({ notifications: [], unreadCount: 0 });
    }

    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

    const notifications = await getNotificationsForUser(user._id, {
      unreadOnly,
      limit,
    });
    const unreadCount = await getUnreadCount(user._id);

    res.json({ notifications, unreadCount });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const auth = getUserAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const User = (await import('../models/User.js')).default;
    const user = await User.findOne({ clerkUserId: auth.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notification = await markNotificationAsRead(
      req.params.notificationId,
      user._id,
    );
    res.json({ notification });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const auth = getUserAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const User = (await import('../models/User.js')).default;
    const user = await User.findOne({ clerkUserId: auth.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await markAllNotificationsAsRead(user._id);
    res.json({
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    handleError(err, res, next);
  }
};
