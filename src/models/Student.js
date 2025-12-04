import { Schema, model } from 'mongoose';

const BookSchema = new Schema(
  {
    title: { type: String, required: true },
    author: { type: String, default: '' },
  },
  { _id: false },
);

const EnrolmentSchema = new Schema(
  {
    subject: { type: String, required: true },
    country: { type: String, default: null },
    level: { type: String, default: null },
    examBody: { type: String, default: null },
    books: { type: [BookSchema], default: [] },
    examDates: { type: [String], default: [] },
    approvalStatus: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'rejected'],
      default: 'draft',
    },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    billingStatus: {
      type: String,
      enum: ['inactive', 'placeholder_active'],
      default: 'inactive',
    },
    monthlyPrice: { type: Number, default: 0 },
  },
  { _id: false },
);

const StudentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    displayName: { type: String, required: true },
    yearGroup: { type: String, default: null },
    country: { type: String, default: null },
    enrolments: { type: [EnrolmentSchema], default: [] },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    invitationStatus: {
      type: String,
      enum: ['none', 'pending', 'accepted', 'expired'],
      default: 'none',
      index: true,
    },
    invitedEmail: { type: String, default: null },
    invitedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default model('Student', StudentSchema);
