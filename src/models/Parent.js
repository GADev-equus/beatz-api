import { Schema, model } from 'mongoose';

const ParentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    childrenIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    stripeCustomerId: { type: String, default: null },
  },
  { timestamps: true }
);

export default model('Parent', ParentSchema);
