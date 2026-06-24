import express from 'express';
import accountOptionsController from './accountOptionsController.js';
import { authMiddleware, superAdminMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', accountOptionsController.listAccountOptions);
router.post('/', superAdminMiddleware, accountOptionsController.createAccountOption);
router.patch('/:id', superAdminMiddleware, accountOptionsController.updateAccountOption);
router.delete('/:id', superAdminMiddleware, accountOptionsController.deleteAccountOption);

export default router;
