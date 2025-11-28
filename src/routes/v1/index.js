import { Router } from 'express';
import publicRoutes from '../public.js';
import meRoutes from './me.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use('/public', publicRoutes);
router.use('/me', requireAuth, meRoutes);

export default router;
