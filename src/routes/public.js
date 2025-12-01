import { Router } from 'express';
import { ping } from '../controllers/publicController.js';

const router = Router();

router.get('/ping', ping);

export default router;
