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
  const students = await Student.find({
    _id: { $in: parent.childrenIds },
  }).sort({ displayName: 1 });
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

export const updateStudentForGuardian = async (
  clerkUserId,
  studentId,
  payload,
) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const belongsToGuardian = parent.childrenIds.some(
    (id) => id?.toString() === studentId,
  );
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

  const student = await Student.findOneAndUpdate({ _id: studentId }, update, {
    new: true,
  });
  if (!student) {
    throw buildError('Student not found', 404);
  }

  return { user, parent, student };
};

const inviteViaClerk = async ({ email, metadata }) => {
  if (!config.clerk.secretKey) {
    throw buildError(
      'Clerk secret key not configured; cannot send invite',
      503,
    );
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
    logger.error('Clerk invite failed', {
      status: response.status,
      body: text,
    });
    throw buildError('Failed to send invitation', 502, text);
  }

  const data = await response.json();
  return data;
};

export const inviteStudentAccount = async (clerkUserId, studentId, email) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const student = await Student.findById(studentId);
  if (
    !student ||
    !parent.childrenIds.some((id) => id?.toString() === studentId)
  ) {
    throw buildError('Student not found for guardian', 404);
  }

  const normalizedEmail = normalizeString(email).toLowerCase();
  if (!normalizedEmail) {
    throw buildError('email is required', 400);
  }

  // Check cooldown period (24 hours)
  if (student.invitedAt) {
    const hoursSinceLastInvite =
      (Date.now() - new Date(student.invitedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastInvite < 24 && student.invitationStatus === 'pending') {
      throw buildError('Please wait 24 hours before resending invitation', 429);
    }
  }

  const metadata = {
    role: 'student',
    studentId: student._id.toString(),
    tenantId:
      (student.tenantId || user.tenantId || parent.tenantId || '').toString() ||
      undefined,
    guardianUserId: user._id.toString(),
  };

  const invite = await inviteViaClerk({ email: normalizedEmail, metadata });

  // Update student invitation status
  student.invitationStatus = 'pending';
  student.invitedEmail = normalizedEmail;
  student.invitedAt = new Date();
  await student.save();

  return { user, parent, student, invite };
};

export const resendStudentInvitation = async (clerkUserId, studentId) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const student = await Student.findById(studentId);
  if (
    !student ||
    !parent.childrenIds.some((id) => id?.toString() === studentId)
  ) {
    throw buildError('Student not found for guardian', 404);
  }

  if (!student.invitedEmail) {
    throw buildError('No previous invitation found for this student', 400);
  }

  // Check cooldown period (24 hours)
  if (student.invitedAt) {
    const hoursSinceLastInvite =
      (Date.now() - new Date(student.invitedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastInvite < 24) {
      throw buildError(
        `Please wait ${Math.ceil(
          24 - hoursSinceLastInvite,
        )} more hours before resending`,
        429,
      );
    }
  }

  const metadata = {
    role: 'student',
    studentId: student._id.toString(),
    tenantId:
      (student.tenantId || user.tenantId || parent.tenantId || '').toString() ||
      undefined,
    guardianUserId: user._id.toString(),
  };

  const invite = await inviteViaClerk({
    email: student.invitedEmail,
    metadata,
  });

  // Update invitation timestamp
  student.invitedAt = new Date();
  student.invitationStatus = 'pending';
  await student.save();

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

export const approveStudentEnrolment = async (
  clerkUserId,
  studentId,
  enrolmentIndex,
) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const student = await Student.findById(studentId);

  if (
    !student ||
    !parent.childrenIds.some((id) => id?.toString() === studentId)
  ) {
    throw buildError('Student not found for guardian', 404);
  }

  if (
    !Array.isArray(student.enrolments) ||
    !student.enrolments[enrolmentIndex]
  ) {
    throw buildError('Enrolment not found', 404);
  }

  const enrolment = student.enrolments[enrolmentIndex];

  if (enrolment.approvalStatus === 'approved') {
    throw buildError('Enrolment already approved', 400);
  }

  // Update enrolment approval status
  enrolment.approvalStatus = 'approved';
  enrolment.approvedAt = new Date();
  enrolment.billingStatus = 'placeholder_active';
  enrolment.monthlyPrice = 29.99; // Placeholder price
  enrolment.rejectedAt = null;
  enrolment.rejectionReason = null;

  await student.save();

  // Create notification for student
  if (student.userId) {
    try {
      const { createNotification } = await import('./notificationService.js');
      await createNotification({
        userId: student.userId,
        type: 'subject_approved',
        message: `Your guardian approved ${enrolment.subject} - you can now access it!`,
        relatedStudentId: student._id,
        relatedEnrolmentIndex: enrolmentIndex,
      });
    } catch (err) {
      logger.error('Failed to create approval notification:', err);
    }
  }

  return { user, parent, student, enrolment };
};

export const rejectStudentEnrolment = async (
  clerkUserId,
  studentId,
  enrolmentIndex,
  rejectionReason,
) => {
  const { user, parent } = await requireGuardianContext(clerkUserId);
  const student = await Student.findById(studentId);

  if (
    !student ||
    !parent.childrenIds.some((id) => id?.toString() === studentId)
  ) {
    throw buildError('Student not found for guardian', 404);
  }

  if (
    !Array.isArray(student.enrolments) ||
    !student.enrolments[enrolmentIndex]
  ) {
    throw buildError('Enrolment not found', 404);
  }

  const enrolment = student.enrolments[enrolmentIndex];

  // Update enrolment rejection status
  enrolment.approvalStatus = 'rejected';
  enrolment.rejectedAt = new Date();
  enrolment.rejectionReason = rejectionReason || 'No reason provided';
  enrolment.approvedAt = null;
  enrolment.billingStatus = 'inactive';
  enrolment.monthlyPrice = 0;

  await student.save();

  // Create notification for student
  if (student.userId) {
    try {
      const { createNotification } = await import('./notificationService.js');
      await createNotification({
        userId: student.userId,
        type: 'subject_rejected',
        message: `Your guardian rejected ${enrolment.subject} - Reason: ${
          rejectionReason || 'Not specified'
        }`,
        relatedStudentId: student._id,
        relatedEnrolmentIndex: enrolmentIndex,
      });
    } catch (err) {
      logger.error('Failed to create rejection notification:', err);
    }
  }

  return { user, parent, student, enrolment };
};

export const updateMyStudentProfile = async (clerkUserId, payload) => {
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

  // Track which enrolments were modified to trigger re-approval
  const modifiedIndices = [];
  const guardianNeedsNotification = [];

  if (payload.enrolments !== undefined) {
    const newEnrolments = normalizeEnrolments(payload.enrolments);

    // Compare with existing enrolments to detect modifications
    newEnrolments.forEach((newEnrol, idx) => {
      const existingEnrol = student.enrolments[idx];

      if (!existingEnrol) {
        // New enrolment - set to pending approval
        newEnrol.approvalStatus = 'pending_approval';
        modifiedIndices.push(idx);
        guardianNeedsNotification.push(`New subject: ${newEnrol.subject}`);
      } else if (existingEnrol.approvalStatus === 'approved') {
        // Check if approved enrolment was modified
        const wasModified =
          existingEnrol.subject !== newEnrol.subject ||
          existingEnrol.level !== newEnrol.level ||
          existingEnrol.examBody !== newEnrol.examBody;

        if (wasModified) {
          // Reset approval status
          newEnrol.approvalStatus = 'pending_approval';
          newEnrol.approvedAt = null;
          newEnrol.billingStatus = 'inactive';
          newEnrol.monthlyPrice = 0;
          modifiedIndices.push(idx);
          guardianNeedsNotification.push(
            `Modified subject: ${newEnrol.subject} (re-approval needed)`,
          );
        } else {
          // Keep existing approval status
          newEnrol.approvalStatus = existingEnrol.approvalStatus;
          newEnrol.approvedAt = existingEnrol.approvedAt;
          newEnrol.billingStatus = existingEnrol.billingStatus;
          newEnrol.monthlyPrice = existingEnrol.monthlyPrice;
        }
      } else {
        // Keep existing status for non-approved enrolments
        newEnrol.approvalStatus =
          existingEnrol.approvalStatus || 'pending_approval';
        newEnrol.approvedAt = existingEnrol.approvedAt;
        newEnrol.rejectedAt = existingEnrol.rejectedAt;
        newEnrol.rejectionReason = existingEnrol.rejectionReason;
        newEnrol.billingStatus = existingEnrol.billingStatus;
        newEnrol.monthlyPrice = existingEnrol.monthlyPrice;
      }
    });

    student.enrolments = newEnrolments;
  }

  // Update other fields if provided
  if (payload.yearGroup !== undefined) {
    student.yearGroup = normalize(payload.yearGroup) || null;
  }

  await student.save();

  // Notify guardian if there are modifications
  if (guardianNeedsNotification.length > 0) {
    try {
      const parent = await Parent.findOne({
        childrenIds: student._id,
      }).populate('userId');
      if (parent && parent.userId) {
        const { createNotification } = await import('./notificationService.js');
        await createNotification({
          userId: parent.userId._id,
          type: 'subject_modified',
          message: `${student.displayName}: ${guardianNeedsNotification.join(
            ', ',
          )}`,
          relatedStudentId: student._id,
        });
      }
    } catch (err) {
      logger.error('Failed to create guardian notification:', err);
    }
  }

  return { user, student };
};
