import { Schema, model } from 'mongoose';

const SubjectSchema = new Schema(
  {
    name: { type: String, required: true },
    examBoards: [{ type: String }],
  },
  { timestamps: true }
);

export default model('Subject', SubjectSchema);
