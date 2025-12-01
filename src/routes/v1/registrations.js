import { Router } from 'express';
import { registerProfile } from '../../controllers/registrationController.js';

const router = Router();

router.post('/', registerProfile);

export default router;
