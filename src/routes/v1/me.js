import { Router } from 'express';
import { getMe } from '../../controllers/meController.js';
import {
  getMyStudentProfile,
  updateMyProfile,
} from '../../controllers/studentController.js';

const router = Router();

router.get('/', getMe);
router.get('/student-profile', getMyStudentProfile);
router.put('/student-profile', updateMyProfile);

export default router;
