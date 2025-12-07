import express from 'express';
import authController from './authController.js';
const router = express.Router();
router.post('/google', authController.googleLogin);
export default router;
