import { Schema, model } from 'mongoose';

const BookSchema = new Schema(
  {
    title: { type: String, required: true },
    author: { type: String, default: '' },
  },
  { _id: false }
);

const EnrolmentSchema = new Schema(
  {
    subject: { type: String, required: true },
    level: { type: String, default: null },
    examBody: { type: String, default: null },
    books: { type: [BookSchema], default: [] },
    examDates: { type: [String], default: [] },
  },
  { _id: false }
);

const StudentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    displayName: { type: String, required: true },
    yearGroup: { type: String, default: null },
    country: { type: String, default: null },
    enrolments: { type: [EnrolmentSchema], default: [] },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  },
  { timestamps: true }
);

export default model('Student', StudentSchema);
