import fs from 'fs';
import os from 'os';
import path from 'path';

import multer from 'multer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PARTICIPANT_UPLOAD_DIRS,
  handleParticipantUploadError,
  removeUploadedFile,
  uploadPaymentProof,
  uploadRegistrationDocument,
} from '../middleware/participantUploadMiddleware.js';

/**
 * Runs a Multer instance's fileFilter directly.
 * Resolves true when the file is accepted, or the rejection message.
 */
const runFileFilter = (uploader, { originalname, mimetype }) =>
  new Promise((resolve) => {
    uploader.fileFilter({}, { originalname, mimetype }, (err, accepted) =>
      resolve(err ? err.message : accepted),
    );
  });

/** Writes a real file so the cleanup path is exercised against the filesystem. */
const makeUploadedFile = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'participant-upload-'));
  const filePath = path.join(dir, 'proof.png');
  fs.writeFileSync(filePath, 'not-really-a-png');

  return { path: filePath, filename: 'proof.png' };
};

describe('removeUploadedFile', () => {
  it('deletes a file Multer already wrote', async () => {
    const file = makeUploadedFile();

    await removeUploadedFile(file);

    expect(fs.existsSync(file.path)).toBe(false);
  });

  it('is a no-op when there is no file, and never throws on a missing one', async () => {
    await expect(removeUploadedFile(undefined)).resolves.toBeUndefined();
    await expect(
      removeUploadedFile({ path: '/tmp/does-not-exist-12345' }),
    ).resolves.toBeUndefined();
  });
});

describe('participant upload file filter', () => {
  // The attack this closes: mimetype is client-controlled and
  // sanitizeUploadFilename keeps the extension, so a .html accepted as image/png
  // lands on disk as .html and express.static serves it as text/html from the
  // API origin — script execution alongside the staff portal.
  it('rejects a disguised .html even when it claims an allowed mimetype', async () => {
    await expect(
      runFileFilter(uploadPaymentProof, { originalname: 'evil.html', mimetype: 'image/png' }),
    ).resolves.toMatch(/must end in \.png/);
  });

  it('rejects an extension that belongs to a different allowed type', async () => {
    await expect(
      runFileFilter(uploadRegistrationDocument, {
        originalname: 'notes.pdf',
        mimetype: 'image/jpeg',
      }),
    ).resolves.toMatch(/must end in \.jpg or \.jpeg/);
  });

  it('rejects a disallowed mimetype outright', async () => {
    await expect(
      runFileFilter(uploadPaymentProof, { originalname: 'doc.pdf', mimetype: 'application/pdf' }),
    ).resolves.toMatch(/^Invalid file type\. Allowed:/);
  });

  it('accepts a genuine image, case-insensitively on the extension', async () => {
    await expect(
      runFileFilter(uploadPaymentProof, { originalname: 'proof.PNG', mimetype: 'image/png' }),
    ).resolves.toBe(true);
    await expect(
      runFileFilter(uploadPaymentProof, { originalname: 'photo.jpeg', mimetype: 'image/jpeg' }),
    ).resolves.toBe(true);
  });

  it('accepts a PDF where documents are allowed', async () => {
    await expect(
      runFileFilter(uploadRegistrationDocument, {
        originalname: 'id.pdf',
        mimetype: 'application/pdf',
      }),
    ).resolves.toBe(true);
  });

  it('lists every participant directory for the static-serving guard', () => {
    expect(PARTICIPANT_UPLOAD_DIRS).toEqual(
      new Set([
        'participant-photos',
        'participant-id-cards',
        'registration-documents',
        'payment-proofs',
      ]),
    );
  });
});

describe('handleParticipantUploadError', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {};
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  const respondedWith = () => res.json.mock.calls.at(-1)?.[0];

  // The app-wide errorHandler answers 500 with `{ error }`, a shape the event
  // site's apiFetch cannot read — the participant saw "Request failed (500)".
  it('turns an oversized upload into a 400 the client can display', async () => {
    const err = new multer.MulterError('LIMIT_FILE_SIZE');

    await handleParticipantUploadError(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(respondedWith()).toEqual({ success: false, message: 'That file is too large' });
    expect(next).not.toHaveBeenCalled();
  });

  it('turns a rejected file type into a 400 carrying the allowed types', async () => {
    const err = new Error('Invalid file type. Allowed: image/jpeg, image/png');

    await handleParticipantUploadError(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(respondedWith().success).toBe(false);
    expect(respondedWith().message).toMatch(/image\/png/);
  });

  it('deletes the partially stored file before answering', async () => {
    req.file = makeUploadedFile();

    await handleParticipantUploadError(new multer.MulterError('LIMIT_FILE_SIZE'), req, res, next);

    expect(fs.existsSync(req.file.path)).toBe(false);
  });

  it('passes an unrelated error on to the app-wide handler', async () => {
    const err = new Error('database is on fire');

    await handleParticipantUploadError(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
