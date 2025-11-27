import { Router } from 'express';
import publicRoutes from '../public.js';

const router = Router();

router.use('/public', publicRoutes);

export default router;
