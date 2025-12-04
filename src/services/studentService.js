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

  const student = await Student.findOne({ userId: user._id });
  if (!student) {
    // If no student profile exists, user must be a student role
    if (user.role !== 'student') {
      throw buildError(
        'Forbidden: student role or student profile required',
        403,
      );
    }
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

export const updateMyStudentProfile = async (
  clerkUserId,
  payload,
  invitationMetadata = {},
  userEmail = '',
) => {
  // Try to find existing user
  let user = await User.findOne({ clerkUserId });
  let student = null;

  logger.info(
    `updateMyStudentProfile called - clerkUserId: ${clerkUserId}, userEmail: ${userEmail}, hasInvitationMetadata: ${!!invitationMetadata.studentId}`,
  );

  // If user doesn't exist, check if this is an invited student and auto-create the user
  if (!user) {
    logger.info(
      'User not found, attempting auto-registration for invited student',
    );

    // Try to find student by invitation metadata first
    const studentId = invitationMetadata.studentId;

    if (studentId) {
      logger.info(`Looking up student by invitation metadata: ${studentId}`);
      student = await Student.findById(studentId);
      if (student) {
        logger.info(
          `Found student via metadata: ${student._id}, userId: ${student.userId}`,
        );
      }
    }

    // If no invitation metadata, try to find by invited email
    if (!student && userEmail) {
      const normalizedEmail = normalizeString(userEmail).toLowerCase();
      logger.info(`Looking up student by email: ${normalizedEmail}`);
      student = await Student.findOne({
        invitedEmail: normalizedEmail,
        userId: null, // Not yet linked to a user
        invitationStatus: 'pending',
      });
      if (student) {
        logger.info(`Found student via email: ${student._id}`);
      } else {
        logger.warn(`No pending student found for email: ${normalizedEmail}`);
      }
    }

    if (student && !student.userId) {
      // Auto-create user record for invited student
      logger.info('Creating user record for invited student');
      user = await User.create({
        clerkUserId,
        email: student.invitedEmail || userEmail,
        role: 'student',
        displayName: student.displayName || '',
        tenantId: student.tenantId || invitationMetadata.tenantId,
      });

      // Link the student to the user
      student.userId = user._id;
      student.invitationStatus = 'accepted';
      await student.save();

      logger.info(
        `Auto-created user record for invited student: ${clerkUserId}, linked to student: ${student._id}`,
      );
    }

    // If still no user, throw error
    if (!user) {
      logger.error('Failed to create user - no invitation found');
      throw buildError(
        'User record not found. Please ensure you were invited by a guardian.',
        404,
      );
    }
  } else {
    logger.info(`Found existing user: ${user._id}, role: ${user.role}`);
  }

  // If we don't have student yet, look it up
  if (!student) {
    student = await Student.findOne({ userId: user._id });
    if (student) {
      logger.info(`Found student profile: ${student._id}`);
    } else {
      logger.warn(`No student profile found for user: ${user._id}`);
    }
  }

  if (!student) {
    // If no student profile exists, user must be a student role
    logger.error(`No student profile - user role is: ${user.role}`);
    if (user.role !== 'student') {
      throw buildError(
        'Forbidden: student role or student profile required',
        403,
      );
    }
    throw buildError('Student profile not found for user', 404);
  }

  // Track which enrolments were modified to trigger re-approval
  const modifiedIndices = [];
  const guardianNeedsNotification = [];
  if (payload.enrolments !== undefined) {
    const newEnrolments = normalizeEnrolments(payload.enrolments);
    const existingEnrolments = Array.isArray(student.enrolments)
      ? [...student.enrolments]
      : [];

    const findExistingIndex = (enrol) =>
      existingEnrolments.findIndex(
        (e) =>
          (e.subject || '').toLowerCase() === (enrol.subject || '').toLowerCase() &&
          (e.country || '').toLowerCase() === (enrol.country || '').toLowerCase() &&
          (e.level || '').toLowerCase() === (enrol.level || '').toLowerCase() &&
          (e.examBody || '').toLowerCase() === (enrol.examBody || '').toLowerCase(),
      );

    const mergedEnrolments = [];

    const existingKeys = existingEnrolments.map((e) =>
      [
        (e.subject || '').toLowerCase(),
        (e.country || '').toLowerCase(),
        (e.level || '').toLowerCase(),
        (e.examBody || '').toLowerCase(),
      ].join('|'),
    );

    const newKeys = newEnrolments.map((e) =>
      [
        (e.subject || '').toLowerCase(),
        (e.country || '').toLowerCase(),
        (e.level || '').toLowerCase(),
        (e.examBody || '').toLowerCase(),
      ].join('|'),
    );

    newEnrolments.forEach((newEnrol) => {
      const existingIndex = findExistingIndex(newEnrol);
      const existingEnrol = existingIndex >= 0 ? existingEnrolments[existingIndex] : null;

      if (!existingEnrol) {
        // New enrolment - set to pending approval and append
        newEnrol.approvalStatus = 'pending_approval';
        newEnrol.approvedAt = null;
        newEnrol.rejectedAt = null;
        newEnrol.rejectionReason = null;
        newEnrol.billingStatus = 'inactive';
        newEnrol.monthlyPrice = 0;
        mergedEnrolments.push(newEnrol);
        modifiedIndices.push(mergedEnrolments.length - 1);
        guardianNeedsNotification.push(`New subject: ${newEnrol.subject}`);
        return;
      }

      // Existing enrolment found
      const wasModified =
        existingEnrol.subject !== newEnrol.subject ||
        (existingEnrol.country || '') !== (newEnrol.country || '') ||
        existingEnrol.level !== newEnrol.level ||
        existingEnrol.examBody !== newEnrol.examBody;

      if (existingEnrol.approvalStatus === 'approved' && wasModified) {
        newEnrol.approvalStatus = 'pending_approval';
        newEnrol.approvedAt = null;
        newEnrol.rejectedAt = null;
        newEnrol.rejectionReason = null;
        newEnrol.billingStatus = 'inactive';
        newEnrol.monthlyPrice = 0;
        modifiedIndices.push(mergedEnrolments.length);
        guardianNeedsNotification.push(
          `Modified subject: ${newEnrol.subject} (re-approval needed)`,
        );
      } else {
        newEnrol.approvalStatus =
          existingEnrol.approvalStatus || 'pending_approval';
        newEnrol.approvedAt = existingEnrol.approvedAt;
        newEnrol.rejectedAt = existingEnrol.rejectedAt;
        newEnrol.rejectionReason = existingEnrol.rejectionReason;
        newEnrol.billingStatus = existingEnrol.billingStatus;
        newEnrol.monthlyPrice = existingEnrol.monthlyPrice;
      }

      mergedEnrolments.push(newEnrol);
    });

    // Detect removals (in existing but not in new payload)
    existingEnrolments.forEach((existing) => {
      const key = [
        (existing.subject || '').toLowerCase(),
        (existing.country || '').toLowerCase(),
        (existing.level || '').toLowerCase(),
        (existing.examBody || '').toLowerCase(),
      ].join('|');
      if (!newKeys.includes(key)) {
        guardianNeedsNotification.push({
          type: 'subject_removed',
          subject: existing.subject,
        });
      }
    });

    // Replacing enrolments with merged list means rows removed in the payload are deleted.
    student.enrolments = mergedEnrolments;
  }

  // Update other fields if provided
  if (payload.displayName !== undefined) {
    const normalizedDisplayName = normalizeString(payload.displayName);
    if (!normalizedDisplayName) {
      throw buildError('Display name cannot be empty', 400);
    }
    student.displayName = normalizedDisplayName;
  }

  if (payload.yearGroup !== undefined) {
    student.yearGroup = normalizeString(payload.yearGroup) || null;
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
        for (const item of guardianNeedsNotification) {
          if (typeof item === 'string') {
            await createNotification({
              userId: parent.userId._id,
              type: 'subject_modified',
              message: `${student.displayName}: ${item}`,
              relatedStudentId: student._id,
            });
          } else if (item?.type === 'subject_removed') {
            await createNotification({
              userId: parent.userId._id,
              type: 'subject_removed',
              message: `${student.displayName}: Removed subject ${item.subject}`,
              relatedStudentId: student._id,
            });
          }
        }
      }
    } catch (err) {
      logger.error('Failed to create guardian notification:', err);
    }
  }

  return { user, student };
};
