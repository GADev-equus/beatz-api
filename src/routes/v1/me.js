import { Router } from 'express';
import { getMe } from '../../controllers/meController.js';
import { getMyStudentProfile } from '../../controllers/studentController.js';

const router = Router();

router.get('/', getMe);
router.get('/student-profile', getMyStudentProfile);

export default router;
