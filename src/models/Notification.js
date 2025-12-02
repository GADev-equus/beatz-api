import { Schema, model } from 'mongoose';

const NotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'subject_requested',
        'subject_approved',
        'subject_rejected',
        'subject_modified',
        'invitation_accepted',
      ],
      required: true,
    },
    message: { type: String, required: true },
    relatedStudentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    relatedEnrolmentIndex: { type: Number, default: null },
    read: { type: Boolean, default: false, index: true },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 2592000, // 30 days in seconds (30 * 24 * 60 * 60)
      index: true,
    },
  },
  { timestamps: false },
);

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export default model('Notification', NotificationSchema);
