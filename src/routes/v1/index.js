import { Router } from 'express';
import publicRoutes from '../public.js';
import meRoutes from './me.js';
import registrationRoutes from './registrations.js';
import studentRoutes from './students.js';
import metaRoutes from './meta.js';
import notificationRoutes from './notifications.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use('/public', publicRoutes);
router.use('/meta', metaRoutes);
router.use('/me', requireAuth, meRoutes);
router.use('/registrations', requireAuth, registrationRoutes);
router.use('/students', requireAuth, studentRoutes);
router.use('/notifications', requireAuth, notificationRoutes);

export default router;
