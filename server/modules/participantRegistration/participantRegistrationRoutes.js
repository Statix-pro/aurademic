import express from 'express';

import { participantAuthMiddleware } from '../../middleware/participantAuthMiddleware.js';
import {
  PARTICIPANT_UPLOAD_CATEGORIES,
  uploadParticipantIdCard,
  uploadParticipantPhoto,
  uploadPaymentProof,
  uploadRegistrationDocument,
} from '../../middleware/participantUploadMiddleware.js';

import participantRegistrationController from './participantRegistrationController.js';

const router = express.Router();

// Every route below belongs to the signed-in participant. Staff tokens are
// rejected here, and each /:id handler re-checks ownership in the controller.
router.use(participantAuthMiddleware);

// --- Profile ---
router.get('/profile', (req, res) => participantRegistrationController.getProfile(req, res));
router.put('/profile/personal', (req, res) =>
  participantRegistrationController.savePersonalDetails(req, res),
);
router.put('/profile/profession', (req, res) =>
  participantRegistrationController.saveProfessionDetails(req, res),
);
router.post('/profile/photo', uploadParticipantPhoto.single('file'), (req, res) =>
  participantRegistrationController.uploadProfileFile(
    req,
    res,
    'photo_path',
    PARTICIPANT_UPLOAD_CATEGORIES.photo,
  ),
);
router.post('/profile/id-card', uploadParticipantIdCard.single('file'), (req, res) =>
  participantRegistrationController.uploadProfileFile(
    req,
    res,
    'id_card_path',
    PARTICIPANT_UPLOAD_CATEGORIES.idCard,
  ),
);

// --- Registrations ---
router.get('/registrations', (req, res) =>
  participantRegistrationController.listRegistrations(req, res),
);
router.post('/registrations', (req, res) =>
  participantRegistrationController.createRegistration(req, res),
);
router.delete('/registrations/:id', (req, res) =>
  participantRegistrationController.cancelRegistration(req, res),
);
router.put('/registrations/:id/team', (req, res) =>
  participantRegistrationController.saveTeamMembers(req, res),
);
router.put('/registrations/:id/accommodation', (req, res) =>
  participantRegistrationController.saveAccommodation(req, res),
);
router.post('/registrations/:id/documents', uploadRegistrationDocument.single('file'), (req, res) =>
  participantRegistrationController.uploadRegistrationDocument(req, res),
);
router.get('/registrations/:id/payments', (req, res) =>
  participantRegistrationController.listPayments(req, res),
);
router.post('/registrations/:id/payments', uploadPaymentProof.single('file'), (req, res) =>
  participantRegistrationController.submitPaymentProof(req, res),
);
router.post('/registrations/:id/feedback', (req, res) =>
  participantRegistrationController.submitFeedback(req, res),
);

export default router;
