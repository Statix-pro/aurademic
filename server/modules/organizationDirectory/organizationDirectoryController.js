import model from './organizationDirectoryModel.js';

const sendError = (res, error, fallback) => res.status(400).json({ success: false, message: error.message || fallback });

export const list = async (req, res) => {
  try { return res.json({ success: true, data: await model.listApproved(req.user?.id) }); }
  catch (error) { return sendError(res, error, 'Failed to load organizations'); }
};

export const submit = async (req, res) => {
  try { return res.status(201).json({ success: true, data: await model.submit(req.body, req.user?.id), message: 'Submitted for superadmin approval' }); }
  catch (error) { return sendError(res, error, 'Failed to submit organization'); }
};

export const update = async (req, res) => {
  try { return res.json({ success: true, data: await model.update(req.params.id, req.body, req.user?.id) }); }
  catch (error) { return sendError(res, error, 'Failed to update organization'); }
};

export const pending = async (req, res) => {
  try { return res.json({ success: true, data: await model.listPending() }); }
  catch (error) { return sendError(res, error, 'Failed to load pending organizations'); }
};

export const review = async (req, res) => {
  try {
    const decision = req.body?.decision;
    if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ success: false, message: 'decision must be approve or reject' });
    return res.json({ success: true, data: await model.review(req.params.id, decision, req.user?.id, req.body?.comment) });
  } catch (error) { return sendError(res, error, 'Failed to review organization'); }
};

export default { list, submit, update, pending, review };
