import { Schema, model } from 'mongoose';

const StudentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    displayName: { type: String, required: true },
    yearGroup: { type: String, default: null },
    subjectIds: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  },
  { timestamps: true }
);

export default model('Student', StudentSchema);
