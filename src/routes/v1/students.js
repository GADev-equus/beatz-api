import { Router } from 'express';
import {
  createStudent,
  getStudents,
  inviteStudent,
  updateStudent,
  resendInvitation,
  approveEnrolment,
  rejectEnrolment,
} from '../../controllers/studentController.js';

const router = Router();

router.get('/', getStudents);
router.post('/', createStudent);
router.put('/:studentId', updateStudent);
router.post('/:studentId/invite', inviteStudent);
router.post('/:studentId/resend-invite', resendInvitation);
router.post('/:studentId/enrolments/:enrolmentIndex/approve', approveEnrolment);
router.post('/:studentId/enrolments/:enrolmentIndex/reject', rejectEnrolment);

export default router;
