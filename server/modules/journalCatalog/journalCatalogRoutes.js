import path from 'path';

import express from 'express';
import multer from 'multer';

import journalCatalogController from './journalCatalogController.js';
import { authMiddleware, superAdminMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// A data-maintenance tool rather than part of the portal's day-to-day work: bulk-loading the
// journal list rewrites what every publication reads, so — like Master Data — only a super
// admin reaches it, and no role permission opens it.
router.use(authMiddleware);
router.use(superAdminMiddleware);

/**
 * The admin screen gzips files before sending them (a Scopus export with abstracts is ~29 MB
 * as text and ~5 MB compressed), so this stays well inside IIS's 30 MB request limit.
 */
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const IMPORT_EXTENSIONS = ['.csv', '.tsv', '.txt', '.gz'];

/**
 * Held in memory, never written to disk: the files carry staff names and author IDs, and
 * `uploads/` is served publicly. The workbook formats are converted to CSV in the browser, so
 * only delimited text — plain or gzipped — reaches the server.
 */
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (IMPORT_EXTENSIONS.includes(extension)) return cb(null, true);
    return cb(new Error(`Upload a ${IMPORT_EXTENSIONS.join(', ')} file.`));
  },
}).single('file');

/** Turns multer's own rejections (size, type) into the API's error envelope. */
const acceptImportFile = (req, res, next) =>
  importUpload(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      success: false,
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? `The file is larger than ${MAX_IMPORT_BYTES / (1024 * 1024)} MB.`
          : error.message,
    });
  });

router.get('/sources', journalCatalogController.getSources);
router.get('/journals', journalCatalogController.listJournals);

router.get('/imports', journalCatalogController.listImports);
router.get('/imports/:id', journalCatalogController.getImport);
router.get('/imports/:id/rows', journalCatalogController.listImportRows);
router.post('/imports/:source/preview', acceptImportFile, journalCatalogController.previewImport);
router.post('/imports/:id/apply', journalCatalogController.applyImport);
router.post('/imports/:id/discard', journalCatalogController.discardImport);
router.post('/imports/:id/exceptions/resolve', journalCatalogController.resolveExceptions);

router.get('/scopus-ids', journalCatalogController.listScopusIds);
router.delete('/scopus-ids/:id', journalCatalogController.removeScopusId);

export default router;
