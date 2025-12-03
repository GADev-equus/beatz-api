import { z } from 'zod';

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

export const createStudentSchema = z.object({
  displayName: z.string().trim().min(1),
  yearGroup: z.string().trim().optional(),
  country: z.string().trim().optional(),
  enrolments: z.array(enrolmentSchema).optional(),
});

export const updateStudentSchema = z
  .object({
    displayName: z.string().trim().optional(),
    yearGroup: z.string().trim().optional(),
    country: z.string().trim().optional(),
    enrolments: z.array(enrolmentSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const inviteStudentSchema = z.object({
  email: z.string().trim().email(),
});

export const rejectEnrolmentSchema = z.object({
  rejectionReason: z.string().trim().min(1, 'Rejection reason is required'),
});

export const updateMyStudentProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).optional(),
    yearGroup: z.string().trim().optional(),
    enrolments: z.array(enrolmentSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
