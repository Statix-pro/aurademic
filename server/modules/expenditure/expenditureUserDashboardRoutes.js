import express from 'express';
import expenditureController from './expenditureController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/', expenditureController.getExpenditureDashboard);

export default router;
