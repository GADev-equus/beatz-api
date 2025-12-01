import { Router } from 'express';
import { getEnrolmentOptions } from '../../controllers/metaController.js';

const router = Router();

router.get('/enrolment-options', getEnrolmentOptions);

export default router;
