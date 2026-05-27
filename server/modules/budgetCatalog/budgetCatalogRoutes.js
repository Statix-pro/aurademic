import express from 'express';
import budgetCatalogController from './budgetCatalogController.js';
import {
    authMiddleware,
    superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

const normalizeApiEnvelope = (_req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (
            body &&
            typeof body === 'object' &&
            Object.prototype.hasOwnProperty.call(body, 'success')
        ) {
            return originalJson(body);
        }

        if (res.statusCode >= 400) {
            return originalJson({
                success: false,
                message: body?.message || 'Request failed',
                ...(body?.error ? { error: body.error } : {}),
                ...(body?.shouldLogout !== undefined ? { shouldLogout: body.shouldLogout } : {}),
                ...(body?.tokenExpired !== undefined ? { tokenExpired: body.tokenExpired } : {}),
            });
        }

        return originalJson(body);
    };
    return next();
};

router.use(normalizeApiEnvelope);
router.use(authMiddleware);

// Read: any authenticated user for active dropdown data.
// Inactive/deleted rows are admin maintenance data, so keep includeInactive guarded.
router.get('/', (req, res, next) => {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    if (!includeInactive) return next();
    return superAdminMiddleware(req, res, next);
}, budgetCatalogController.getCatalog);

// Write: super admin only
router.get('/tags', superAdminMiddleware, budgetCatalogController.getTags);
router.post('/tags', superAdminMiddleware, budgetCatalogController.createTag);
router.patch('/tags/:id', superAdminMiddleware, budgetCatalogController.updateTag);
router.delete('/tags/:id', superAdminMiddleware, budgetCatalogController.deleteTag);

router.post('/heads', superAdminMiddleware, budgetCatalogController.createHead);
router.patch('/heads/:id', superAdminMiddleware, budgetCatalogController.updateHead);
router.delete('/heads/:id', superAdminMiddleware, budgetCatalogController.deleteHead);

router.post('/sub-heads', superAdminMiddleware, budgetCatalogController.createSubHead);
router.post('/sub-heads/bulk', superAdminMiddleware, budgetCatalogController.createSubHeadsBulk);
router.patch('/sub-heads/:id', superAdminMiddleware, budgetCatalogController.updateSubHead);
router.delete('/sub-heads/:id', superAdminMiddleware, budgetCatalogController.deleteSubHead);

export default router;
