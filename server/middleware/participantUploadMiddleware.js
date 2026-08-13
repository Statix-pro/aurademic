import fs from 'fs';
import path from 'path';

import multer from 'multer';

import { sanitizeUploadFilename } from '../modules/shared/uploadPaths.js';

// Participant uploads are public-facing, so they are stricter than the staff
// uploader: images only for proofs/photos, smaller size cap, and one directory
// per category so an admin can find files without a DB lookup.
export const PARTICIPANT_UPLOAD_CATEGORIES = {
  photo: 'participant-photos',
  idCard: 'participant-id-cards',
  registrationDocument: 'registration-documents',
  paymentProof: 'payment-proofs',
};

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_MIMES = [...IMAGE_MIMES, 'application/pdf'];

const resolveDir = (category) => {
  const dir = path.join(process.cwd(), 'uploads', category);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
};

const buildUploader = (category, allowedMimes, maxBytes) =>
  multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, resolveDir(category)),
      filename: (req, file, cb) => {
        // originalname is client-supplied and multer does not sanitize it, so
        // path syntax is stripped before it reaches disk.
        const participantId = req.participant?.id ?? 'anon';
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `p${participantId}-${unique}-${sanitizeUploadFilename(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }

      cb(new Error(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`));
    },
    limits: { fileSize: maxBytes },
  });

export const uploadParticipantPhoto = buildUploader(
  PARTICIPANT_UPLOAD_CATEGORIES.photo,
  IMAGE_MIMES,
  2 * 1024 * 1024,
);

export const uploadParticipantIdCard = buildUploader(
  PARTICIPANT_UPLOAD_CATEGORIES.idCard,
  DOCUMENT_MIMES,
  5 * 1024 * 1024,
);

export const uploadRegistrationDocument = buildUploader(
  PARTICIPANT_UPLOAD_CATEGORIES.registrationDocument,
  DOCUMENT_MIMES,
  5 * 1024 * 1024,
);

export const uploadPaymentProof = buildUploader(
  PARTICIPANT_UPLOAD_CATEGORIES.paymentProof,
  IMAGE_MIMES,
  5 * 1024 * 1024,
);

/** Web path stored in the DB and served by express.static('/uploads'). */
export const toPublicUploadPath = (category, filename) => `/uploads/${category}/${filename}`;
