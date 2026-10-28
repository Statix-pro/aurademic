import express from 'express';

import controller from './directoryOptionsController.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(authMiddleware);
// The Tag and Specialization lists both directories share: every directory user reads the
// active entries for the forms, and anyone who may add a record may suggest a Specialization
// for review; either directory's Directory Admin sees retired and suggested entries, reviews
// suggestions and changes the lists. Super admins pass permissionMiddleware on their own.
const canReadDirectory = permissionMiddleware(['directory.read']);
const canSuggest = permissionMiddleware(['directory.create']);
const canManageLists = permissionMiddleware([
  'organization_directory.workflow.directory_admin',
  'resource_person_directory.workflow.directory_admin',
]);
router.get('/', canReadDirectory, controller.list);
router.get('/all', canManageLists, controller.listAll);
router.post('/suggestions', canSuggest, controller.suggest);
router.post('/:list(tag|specialization)', canManageLists, controller.add);
router.patch('/:id(\\d+)/review', canManageLists, controller.review);
router.put('/:id(\\d+)', canManageLists, controller.update);
router.delete('/:id(\\d+)', canManageLists, controller.remove);

export default router;
