import { z } from 'zod';

const roleEnum = z.enum(['student', 'parent', 'teacher', 'admin']);
const tenantTypeEnum = z.enum(['family', 'school']);

const bookSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().optional(),
});

const enrolmentSchema = z.object({
  subject: z.string().trim().min(1),
  level: z.string().trim().optional(),
  examBody: z.string().trim().optional(),
  books: z.array(bookSchema).optional(),
  examDates: z.array(z.string().trim()).optional(),
});

const childSchema = z.object({
  displayName: z.string().trim().min(1, 'displayName is required'),
  yearGroup: z.string().trim().optional(),
  country: z.string().trim().optional(),
  enrolments: z.array(enrolmentSchema).optional(),
});

const profileSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  avatarUrl: z.string().trim().url().optional(),
  phone: z.string().trim().optional(),
});

const tenantSchema = z
  .object({
    id: z.string().trim().optional(),
    name: z.string().trim().optional(),
    type: tenantTypeEnum.optional(),
  })
  .refine(
    (data) => {
      if (data.id) return true;
      if (data.name && data.type) return true;
      return !data.name && !data.type;
    },
    { message: 'Provide tenant.id or both tenant.name and tenant.type' }
  )
  .optional();

export const registrationSchema = z.object({
  email: z.string().trim().email(),
  role: roleEnum,
  displayName: z.string().trim().optional(),
  tenant: tenantSchema,
  profile: profileSchema.optional(),
  studentProfile: z
    .object({
      displayName: z.string().trim().optional(),
      yearGroup: z.string().trim().optional(),
      country: z.string().trim().optional(),
      enrolments: z.array(enrolmentSchema).optional(),
    })
    .optional(),
  children: z.array(childSchema).optional(),
});
