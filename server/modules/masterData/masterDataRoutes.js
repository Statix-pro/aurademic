import express from 'express';
import masterDataController from './masterDataController.js';
import {
    authMiddleware,
    superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

// All master data routes require authentication + super admin
router.use(authMiddleware);
router.use(superAdminMiddleware);

// ============================================
// DEPARTMENTS
// ============================================
router.get('/departments', masterDataController.getDepartments);
router.post('/departments', masterDataController.createDepartment);
router.put('/departments/:id', masterDataController.updateDepartment);
router.delete('/departments/:id', masterDataController.deleteDepartment);

// ============================================
// ENTITY TYPES (read-only for now)
// ============================================
router.get('/entity-types', masterDataController.getEntityTypes);

// ============================================
// ENTITIES
// ============================================
router.get('/entities', masterDataController.getEntities);
router.post('/entities', masterDataController.createEntity);
router.put('/entities/:id', masterDataController.updateEntity);
router.delete('/entities/:id', masterDataController.deleteEntity);

// ============================================
// EMPLOYEES
// ============================================
router.get('/employees/lookup', masterDataController.searchEmployeesLookup);
router.get('/employees', masterDataController.getEmployees);
router.post('/employees', masterDataController.createEmployee);
router.put('/employees/:id', masterDataController.updateEmployee);
router.delete('/employees/:id', masterDataController.deleteEmployee);

export default router;
