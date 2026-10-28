import model from './resourcepersonDirectoryModel.js';
import { deleteUploadedFile } from '../shared/uploadPaths.js';
const errorResponse = (e) => {
  if (e?.code === 'ER_DUP_ENTRY' || Number(e?.errno) === 1062) {
    return [409, { success: false, message: 'This person already exists.' }];
  }
  if (/^(resource person|record) not found$/i.test(e?.message || '')) {
    return [404, { success: false, message: 'Person not found.' }];
  }
  if (/^first name and last name are required$/i.test(e?.message || '')) {
    return [400, { success: false, message: e.message }];
  }
  const statusCode = Number(e?.statusCode ?? e?.status);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) {
    return [
      statusCode,
      { success: false, message: statusCode < 500 ? e.message : 'Internal server error' },
    ];
  }
  return [500, { success: false, message: 'Internal server error' }];
};
// Expected 4xx outcomes (not found, duplicate, validation) are not faults, so only 5xx
// responses log the error and its stack.
const fail = (res, e) => {
  const [status, body] = errorResponse(e);
  if (status >= 500) console.error('Resource person directory request failed:', e);
  return res.status(status).json(body);
};
export const list = async (req, res) => {
  try {
    return res.json({ success: true, data: await model.list(req.user) });
  } catch (e) {
    return fail(res, e);
  }
};
const discardUploads = (files = {}) =>
  Object.values(files)
    .flat()
    .forEach((file) => deleteUploadedFile(file.path));
export const submit = async (req, res) => {
  try {
    return res.status(201).json({
      success: true,
      data: await model.submit(req.body, req.files || {}, req.user?.id),
      message: 'Submitted for approval',
    });
  } catch (e) {
    discardUploads(req.files);
    return fail(res, e);
  }
};
export const update = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: await model.update(req.params.id, req.body, req.files || {}, req.user?.id),
      message: 'Person updated',
    });
  } catch (e) {
    discardUploads(req.files);
    return fail(res, e);
  }
};
export const pending = async (req, res) => {
  try {
    return res.json({ success: true, data: await model.pending() });
  } catch (e) {
    return fail(res, e);
  }
};
export const review = async (req, res) => {
  try {
    if (!['approve', 'reject'].includes(req.body?.decision))
      return res.status(400).json({ success: false, message: 'Invalid decision' });
    return res.json({
      success: true,
      data: await model.review(req.params.id, req.body.decision, req.user, req.body?.comment),
    });
  } catch (e) {
    return fail(res, e);
  }
};
export default {
  list,
  submit,
  update,
  pending,
  review,
};
