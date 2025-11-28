import { Schema, model } from 'mongoose';

const TenantSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['family', 'school'], required: true },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model('Tenant', TenantSchema);
