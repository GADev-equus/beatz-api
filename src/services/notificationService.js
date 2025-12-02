import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';

export const createNotification = async ({
  userId,
  type,
  message,
  relatedStudentId,
  relatedEnrolmentIndex,
}) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      message,
      relatedStudentId: relatedStudentId || null,
      relatedEnrolmentIndex:
        relatedEnrolmentIndex !== undefined ? relatedEnrolmentIndex : null,
      read: false,
    });
    return notification;
  } catch (err) {
    logger.error('Failed to create notification:', err);
    // Don't throw - notifications shouldn't break the main flow
    return null;
  }
};

export const getNotificationsForUser = async (
  userId,
  { unreadOnly = false, limit = 50 } = {},
) => {
  const query = { userId };
  if (unreadOnly) {
    query.read = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('relatedStudentId', 'displayName')
    .lean();

  return notifications;
};

export const markNotificationAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true },
  );

  if (!notification) {
    const error = new Error('Notification not found');
    error.status = 404;
    throw error;
  }

  return notification;
};

export const markAllNotificationsAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, read: false },
    { read: true },
  );

  return { modifiedCount: result.modifiedCount };
};

export const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({ userId, read: false });
  return count;
};
