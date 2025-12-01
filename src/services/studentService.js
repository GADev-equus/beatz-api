import Parent from '../models/Parent.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { normalizeString, normalizeEnrolments } from '../utils/normalizers.js';

const guardianRoles = ['parent', 'teacher', 'admin'];

const buildError = (message, status = 400, details) => {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
};

const requireGuardianContext = async (clerkUserId) => {
  const user = await User.findOne({ clerkUserId });
  if (!user) {
    throw buildError('User record not found', 404);
  }
  if (!guardianRoles.includes(user.role)) {
    throw buildError('Forbidden: guardian role required', 403);
  }
  const parent = await Parent.findOne({ userId: user._id });
  if (!parent) {
    throw buildError('Parent profile not found for user', 404);
  }
  return { user, parent };
};

const sanitizeStudentPayload = (payload, tenantId) => {
  const displayName = normalizeString(payload.displayName);
  if (!displayName) {
    throw buildError('displayName is required', 400);
  }

  const yearGroupRaw = normalizeString(payload.yearGroup);
  const countryRaw = normalizeString(payload.country);
  const enrolments = normalizeEnrolments(payload.enrolments);

  return {
    displayName,
    yearGroup: yearGroupRaw || null,
    country: countryRaw || null,
    enrolments,
    tenantId: tenantId || undefined,
  };
};

export const listStudentsForGuardian = async (clerkUserId) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const students = await Student.find({ _id: { $in: parent.childrenIds } }).sort({ displayName: 1 });
  return { user, parent, students };
};

export const createStudentForGuardian = async (clerkUserId, payload) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const tenantId = user.tenantId || parent.tenantId || null;
  const studentPayload = sanitizeStudentPayload(payload, tenantId);

  const student = await Student.create(studentPayload);
  parent.childrenIds.addToSet(student._id);
  await parent.save();

  return { user, parent, student };
};

export const updateStudentForGuardian = async (clerkUserId, studentId, payload) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const belongsToGuardian = parent.childrenIds.some((id) => id?.toString() === studentId);
  if (!belongsToGuardian) {
    throw buildError('Student not found for guardian', 404);
  }

  const update = {};
  if (payload.displayName !== undefined) {
    const name = normalizeString(payload.displayName);
    if (!name) {
      throw buildError('displayName cannot be empty', 400);
    }
    update.displayName = name;
  }

  if (payload.yearGroup !== undefined) {
    const year = normalizeString(payload.yearGroup);
    update.yearGroup = year || null;
  }

  if (payload.country !== undefined) {
    const country = normalizeString(payload.country);
    update.country = country || null;
  }

  if (payload.enrolments !== undefined) {
    update.enrolments = normalizeEnrolments(payload.enrolments);
  }

  const student = await Student.findOneAndUpdate({ _id: studentId }, update, { new: true });
  if (!student) {
    throw buildError('Student not found', 404);
  }

  return { user, parent, student };
};

const inviteViaClerk = async ({ email, metadata }) => {
  if (!config.clerk.secretKey) {
    throw buildError('Clerk secret key not configured; cannot send invite', 503);
  }
  if (typeof fetch !== 'function') {
    throw buildError('fetch is not available in this runtime', 500);
  }

  const response = await fetch('https://api.clerk.com/v1/invitations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.clerk.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: email,
      public_metadata: metadata,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error('Clerk invite failed', { status: response.status, body: text });
    throw buildError('Failed to send invitation', 502, text);
  }

  const data = await response.json();
  return data;
};

export const inviteStudentAccount = async (clerkUserId, studentId, email) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const student = await Student.findById(studentId);
  if (!student || !parent.childrenIds.some((id) => id?.toString() === studentId)) {
    throw buildError('Student not found for guardian', 404);
  }

  const normalizedEmail = normalizeString(email).toLowerCase();
  if (!normalizedEmail) {
    throw buildError('email is required', 400);
  }

  const metadata = {
    role: 'student',
    studentId: student._id.toString(),
    tenantId: (student.tenantId || user.tenantId || parent.tenantId || '').toString() || undefined,
  };

  const invite = await inviteViaClerk({ email: normalizedEmail, metadata });
  return { user, parent, student, invite };
};

export const getStudentProfileForUser = async (clerkUserId) => {
  const user = await User.findOne({ clerkUserId });
  if (!user) {
    throw buildError('User record not found', 404);
  }
  if (user.role !== 'student') {
    throw buildError('Forbidden: student role required', 403);
  }

  const student = await Student.findOne({ userId: user._id });
  if (!student) {
    throw buildError('Student profile not found for user', 404);
  }

  return { user, student };
};
