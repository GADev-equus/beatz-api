import User from '../models/User.js';
import Parent from '../models/Parent.js';
import Student from '../models/Student.js';
import Tenant from '../models/Tenant.js';
import { normalizeString as normalize, normalizeEnrolments } from '../utils/normalizers.js';

const resolveTenant = async (tenant) => {
  if (!tenant) return { tenantDoc: null, tenantId: null };

  const tenantIdFromBody = normalize(tenant.id);
  const tenantName = normalize(tenant.name);
  const tenantType = normalize(tenant.type);

  if (tenantIdFromBody) {
    const tenantDoc = await Tenant.findById(tenantIdFromBody);
    if (!tenantDoc) {
      const error = new Error('tenant not found');
      error.status = 400;
      throw error;
    }
    return { tenantDoc, tenantId: tenantDoc._id };
  }

  if (tenantName && tenantType) {
    const tenantDoc =
      (await Tenant.findOne({ name: tenantName, type: tenantType })) ||
      (await Tenant.create({ name: tenantName, type: tenantType }));
    return { tenantDoc, tenantId: tenantDoc._id };
  }

  return { tenantDoc: null, tenantId: null };
};

export const registerProfileService = async ({ clerkUserId, input }) => {
  const {
    email,
    role,
    displayName,
    tenant,
    studentProfile = {},
    profile = {},
    children = [],
  } = input;

  const normalizedEmail = normalize(email).toLowerCase();
  const normalizedDisplayName = normalize(displayName);

  const { tenantDoc, tenantId } = await resolveTenant(tenant);

  const userUpdate = {
    email: normalizedEmail,
    role,
    tenantId: tenantId || undefined,
  };

  if (normalizedDisplayName) {
    userUpdate.displayName = normalizedDisplayName;
  }

  const profileFirstName = normalize(profile.firstName);
  const profileLastName = normalize(profile.lastName);
  const profileAvatarUrl = normalize(profile.avatarUrl);
  const profilePhone = normalize(profile.phone);

  if (profileFirstName || profileLastName || profileAvatarUrl || profilePhone) {
    userUpdate.profile = {
      firstName: profileFirstName,
      lastName: profileLastName,
      avatarUrl: profileAvatarUrl,
      phone: profilePhone,
    };
  }

  const user = await User.findOneAndUpdate(
    { clerkUserId },
    userUpdate,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const createdStudents = [];
  let parentDoc = null;

  if (['parent', 'teacher', 'admin'].includes(role)) {
    parentDoc = await Parent.findOneAndUpdate(
      { userId: user._id },
      {
        tenantId: tenantId || undefined,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!Array.isArray(parentDoc.childrenIds)) {
      parentDoc.childrenIds = [];
    }

    for (const child of children) {
      const childName = normalize(child.displayName);
      if (!childName) continue;

      const student = await Student.create({
        displayName: childName,
        yearGroup: normalize(child.yearGroup) || null,
        enrolments: normalizeEnrolments(child.enrolments),
        country: normalize(child.country) || null,
        tenantId: tenantId || undefined,
      });
      createdStudents.push(student);
      parentDoc.childrenIds.addToSet(student._id);
    }

    await parentDoc.save();
    await parentDoc.populate({
      path: 'childrenIds',
      model: 'Student',
    });
  }

  if (role === 'student') {
    const name = normalize(studentProfile.displayName) || normalizedDisplayName;
    const yearGroup = normalize(studentProfile.yearGroup);
    const country = normalize(studentProfile.country);
    const enrolments = normalizeEnrolments(studentProfile.enrolments);

    if (name) {
      const student = await Student.findOneAndUpdate(
        { userId: user._id },
        {
          displayName: name,
          yearGroup: yearGroup || null,
          country: country || null,
          enrolments,
          tenantId: tenantId || undefined,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      createdStudents.push(student);
    }
  }

  return {
    user,
    tenant: tenantDoc || (tenantId ? { _id: tenantId } : null),
    parent: parentDoc,
    students: createdStudents,
  };
};
