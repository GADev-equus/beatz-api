import { ZodError } from 'zod';
import { getUserAuth } from '../middleware/auth.js';
import {
  listStudentsForGuardian,
  createStudentForGuardian,
  updateStudentForGuardian,
  inviteStudentAccount,
  getStudentProfileForUser,
  approveStudentEnrolment,
  rejectStudentEnrolment,
  updateMyStudentProfile,
  resendStudentInvitation,
} from '../services/studentService.js';
import {
  createStudentSchema,
  updateStudentSchema,
  inviteStudentSchema,
  updateMyStudentProfileSchema,
  rejectEnrolmentSchema,
} from '../validation/studentSchema.js';

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
    return res
      .status(400)
      .json({ error: 'Invalid payload', details: err.errors });
  }
  if (err?.status) {
    return res
      .status(err.status)
      .json({ error: err.message, details: err.details });
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
    const { student } = await updateStudentForGuardian(
      clerkUserId,
      req.params.studentId,
      payload,
    );
    res.json({ student });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const inviteStudent = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const payload = inviteStudentSchema.parse(req.body || {});
    const { invite } = await inviteStudentAccount(
      clerkUserId,
      req.params.studentId,
      payload.email,
    );
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

export const resendInvitation = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const { invite } = await resendStudentInvitation(
      clerkUserId,
      req.params.studentId,
    );
    res.status(202).json({ message: 'Invitation resent', invite });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const approveEnrolment = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const { studentId, enrolmentIndex } = req.params;
    const index = parseInt(enrolmentIndex, 10);

    if (isNaN(index) || index < 0) {
      return res.status(400).json({ error: 'Invalid enrolment index' });
    }

    const { student, enrolment } = await approveStudentEnrolment(
      clerkUserId,
      studentId,
      index,
    );
    res.json({
      message: 'Enrolment approved',
      student,
      enrolment,
      billing: {
        monthlyTotal: student.enrolments
          .filter((e) => e.billingStatus === 'placeholder_active')
          .reduce((sum, e) => sum + (e.monthlyPrice || 0), 0),
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const rejectEnrolment = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const { studentId, enrolmentIndex } = req.params;
    const index = parseInt(enrolmentIndex, 10);

    if (isNaN(index) || index < 0) {
      return res.status(400).json({ error: 'Invalid enrolment index' });
    }

    const payload = rejectEnrolmentSchema.parse(req.body || {});
    const { student, enrolment } = await rejectStudentEnrolment(
      clerkUserId,
      studentId,
      index,
      payload.rejectionReason,
    );

    res.json({
      message: 'Enrolment rejected',
      student,
      enrolment,
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const clerkUserId = ensureAuth(req);
    const payload = updateMyStudentProfileSchema.parse(req.body || {});
    const { student } = await updateMyStudentProfile(clerkUserId, payload);
    res.json({ student });
  } catch (err) {
    handleError(err, res, next);
  }
};
