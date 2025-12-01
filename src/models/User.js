import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    displayName: { type: String, default: '' },
    profile: {
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
      avatarUrl: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    role: { type: String, enum: ['student', 'parent', 'teacher', 'admin'], required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

export default model('User', UserSchema);
