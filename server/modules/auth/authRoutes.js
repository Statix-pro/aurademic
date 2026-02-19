import express from 'express';
import authController from './authController.js';
import asyncHandler from '../../middleware/asyncHandler.js';

const router = express.Router();

router.post('/google', asyncHandler((req, res) => {
  return authController.googleLogin(req, res);
}));
export default router;
