import { Router } from 'express';
import { createStudent, getStudents, inviteStudent, updateStudent } from '../../controllers/studentController.js';

const router = Router();

router.get('/', getStudents);
router.post('/', createStudent);
router.put('/:studentId', updateStudent);
router.post('/:studentId/invite', inviteStudent);

export default router;
