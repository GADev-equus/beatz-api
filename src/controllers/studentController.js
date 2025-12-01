import { ZodError } from 'zod';
import { getUserAuth } from '../middleware/auth.js';
import {
  listStudentsForGuardian,
  createStudentForGuardian,
  updateStudentForGuardian,
  inviteStudentAccount,
  getStudentProfileForUser,
} from '../services/studentService.js';
import { createStudentSchema, updateStudentSchema, inviteStudentSchema } from '../validation/studentSchema.js';

const ensureAuth = (req) => {
  const auth = getUserAuth(req);
  if (!auth?.userId) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return auth.userId;
};

const handleError = (err, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid payload', details: err.errors });
  }
  if (err?.status) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  return next(err);
};

export const getStudents = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const { students } = await listStudentsForGuardian(clerkUserId);
    res.json({ students });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createStudent = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const payload = createStudentSchema.parse(req.body || {});
    const { student } = await createStudentForGuardian(clerkUserId, payload);
    res.status(201).json({ student });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateStudent = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const payload = updateStudentSchema.parse(req.body || {});
    const { student } = await updateStudentForGuardian(clerkUserId, req.params.studentId, payload);
    res.json({ student });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const inviteStudent = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const payload = inviteStudentSchema.parse(req.body || {});
    const { invite } = await inviteStudentAccount(clerkUserId, req.params.studentId, payload.email);
    res.status(202).json({ message: 'Invitation sent', invite });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getMyStudentProfile = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const { user, student } = await getStudentProfileForUser(clerkUserId);
    res.json({ user, student });
  } catch (err) {
    handleError(err, res, next);
  }
};
