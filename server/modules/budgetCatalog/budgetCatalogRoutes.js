import express from 'express';
import budgetCatalogController from './budgetCatalogController.js';
import {
    authMiddleware,
    superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// Read: any authenticated user for active dropdown data.
// Inactive/deleted rows are admin maintenance data, so keep includeInactive guarded.
router.get('/', (req, res, next) => {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    if (!includeInactive) return next();
    return superAdminMiddleware(req, res, next);
}, budgetCatalogController.getCatalog);

// Write: super admin only
router.post('/heads', superAdminMiddleware, budgetCatalogController.createHead);
router.patch('/heads/:id', superAdminMiddleware, budgetCatalogController.updateHead);
router.delete('/heads/:id', superAdminMiddleware, budgetCatalogController.deleteHead);

router.post('/sub-heads', superAdminMiddleware, budgetCatalogController.createSubHead);
router.post('/sub-heads/bulk', superAdminMiddleware, budgetCatalogController.createSubHeadsBulk);
router.patch('/sub-heads/:id', superAdminMiddleware, budgetCatalogController.updateSubHead);
router.delete('/sub-heads/:id', superAdminMiddleware, budgetCatalogController.deleteSubHead);

export default router;
