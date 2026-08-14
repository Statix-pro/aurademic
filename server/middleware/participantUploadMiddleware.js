import fs from 'fs';
import path from 'path';

import multer from 'multer';

import { sanitizeUploadFilename, resolveUploadPath } from '../modules/shared/uploadPaths.js';

// Participant uploads are public-facing, so they are stricter than the staff
// uploader: images only for proofs/photos, smaller size cap, and one directory
// per category so an admin can find files without a DB lookup.
export const PARTICIPANT_UPLOAD_CATEGORIES = {
  photo: 'participant-photos',
  idCard: 'participant-id-cards',
  registrationDocument: 'registration-documents',
  paymentProof: 'payment-proofs',
};

// MIME type -> the extensions allowed to carry it.
//
// The declared mimetype alone is not a check: it comes from the client, and
// sanitizeUploadFilename keeps whatever extension the client supplied. Accepting
// on mimetype only let `evil.html` be uploaded as `image/png` and land on disk
// as `.html`, which express.static then serves as text/html from the API origin
// — script execution alongside the staff portal. Both halves must agree.
const IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const DOCUMENT_TYPES = { ...IMAGE_TYPES, 'application/pdf': ['.pdf'] };

const resolveDir = (category) => {
  const dir = path.join(process.cwd(), 'uploads', category);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
};

const buildUploader = (category, allowedTypes, maxBytes) => {
  const allowedMimes = Object.keys(allowedTypes);

  return multer({
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
      const extensions = allowedTypes[file.mimetype];

      if (!extensions) {
        cb(new Error(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`));
        return;
      }

      // Compare against the sanitized name, which is what actually reaches disk.
      const extension = path.extname(sanitizeUploadFilename(file.originalname)).toLowerCase();

      if (!extensions.includes(extension)) {
        cb(
          new Error(
            `Invalid file type. A ${file.mimetype} file must end in ${extensions.join(' or ')}`,
          ),
        );
        return;
      }

      cb(null, true);
    },
    limits: { fileSize: maxBytes },
  });
};

export const uploadParticipantPhoto = buildUploader(
  PARTICIPANT_UPLOAD_CATEGORIES.photo,
  IMAGE_TYPES,
  2 * 1024 * 1024,
);

export const uploadParticipantIdCard = buildUploader(
  PARTICIPANT_UPLOAD_CATEGORIES.idCard,
  DOCUMENT_TYPES,
  5 * 1024 * 1024,
);

export const uploadRegistrationDocument = buildUploader(
  PARTICIPANT_UPLOAD_CATEGORIES.registrationDocument,
  DOCUMENT_TYPES,
  5 * 1024 * 1024,
);

export const uploadPaymentProof = buildUploader(
  PARTICIPANT_UPLOAD_CATEGORIES.paymentProof,
  IMAGE_TYPES,
  5 * 1024 * 1024,
);

/** Directories holding participant-uploaded files, for the static-serving guard. */
export const PARTICIPANT_UPLOAD_DIRS = new Set(Object.values(PARTICIPANT_UPLOAD_CATEGORIES));

/** Web path stored in the DB and served by express.static('/uploads'). */
export const toPublicUploadPath = (category, filename) => `/uploads/${category}/${filename}`;

/**
 * Deletes a file Multer already wrote to disk.
 *
 * Multer stores the upload before the route handler runs, so any handler that
 * fails after that point leaves a file nothing in the DB refers to. Best-effort:
 * a failed cleanup is logged, never thrown, because the request has already
 * failed for a more interesting reason.
 */
export const removeUploadedFile = async (file) => {
  if (!file?.path) {
    return;
  }

  const resolved = resolveUploadPath(file.path);
  if (!resolved) {
    console.error('Refused to delete an upload outside the uploads directory:', file.path);
    return;
  }

  try {
    await fs.promises.unlink(resolved);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to remove orphaned upload:', file.path, error);
    }
  }
};

/**
 * Turns a Multer rejection into the `{ success, message }` shape the event site
 * parses. Without this these reach the app-wide errorHandler, which answers 500
 * with an `{ error }` body — so the participant is told "Request failed (500)"
 * when the real cause is a file that is too large or of the wrong type.
 *
 * Mount with `router.use()` after the routes that upload.
 */
export const handleParticipantUploadError = async (err, req, res, next) => {
  if (!err) {
    return next();
  }

  await removeUploadedFile(req.file);

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large' : `Upload rejected: ${err.message}`;

    return res.status(400).json({ success: false, message });
  }

  // fileFilter rejects with a plain Error carrying the allowed-types message.
  if (err.message?.startsWith('Invalid file type')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  return next(err);
};
