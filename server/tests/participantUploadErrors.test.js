import fs from 'fs';
import os from 'os';
import path from 'path';

import multer from 'multer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  handleParticipantUploadError,
  removeUploadedFile,
} from '../middleware/participantUploadMiddleware.js';

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
