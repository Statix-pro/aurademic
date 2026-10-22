import model from './resourcepersonDirectoryModel.js';
import { deleteUploadedFile } from '../shared/uploadPaths.js';
const fail = (res, e) => {
  console.error('Resource person directory request failed:', e);

  if (e?.code === 'ER_DUP_ENTRY' || Number(e?.errno) === 1062) {
    return res
      .status(409)
      .json({ success: false, message: 'This resource person already exists.' });
  }
  if (/^(resource person|record) not found$/i.test(e?.message || '')) {
    return res.status(404).json({ success: false, message: 'Resource person not found.' });
  }
  if (/^first name and last name are required$/i.test(e?.message || '')) {
    return res.status(400).json({ success: false, message: e.message });
  }
  const statusCode = Number(e?.statusCode ?? e?.status);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) {
    return res.status(statusCode).json({
      success: false,
      message: statusCode < 500 ? e.message : 'Internal server error',
    });
  }
  return res.status(500).json({ success: false, message: 'Internal server error' });
};
export const list = async (req, res) => {
  try {
    return res.json({ success: true, data: await model.list(req.user?.id) });
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
      message: 'Resource person updated',
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
export default { list, submit, update, pending, review };
