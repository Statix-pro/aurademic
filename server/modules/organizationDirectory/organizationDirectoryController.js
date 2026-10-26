import model from './organizationDirectoryModel.js';

const errorResponse = (error) => {
  if (error?.code === 'ER_DUP_ENTRY' || Number(error?.errno) === 1062) {
    return [409, { success: false, message: 'An organization with this name already exists.' }];
  }
  if (/^(organization|record) not found$/i.test(error?.message || '')) {
    return [404, { success: false, message: 'Organization not found.' }];
  }
  if (/^organization name is required$/i.test(error?.message || '')) {
    return [400, { success: false, message: error.message }];
  }
  const statusCode = Number(error?.statusCode ?? error?.status);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) {
    return [
      statusCode,
      { success: false, message: statusCode < 500 ? error.message : 'Internal server error' },
    ];
  }
  return [500, { success: false, message: 'Internal server error' }];
};

// Expected 4xx outcomes (not found, duplicate, validation) are not faults, so only 5xx
// responses log the error and its stack.
const sendError = (res, error) => {
  const [status, body] = errorResponse(error);
  if (status >= 500) console.error('Organization directory request failed:', error);
  return res.status(status).json(body);
};

export const list = async (req, res) => {
  try {
    return res.json({ success: true, data: await model.listApproved(req.user?.id) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const submit = async (req, res) => {
  try {
    return res.status(201).json({
      success: true,
      data: await model.submit(req.body, req.user?.id),
      message: 'Submitted for superadmin approval',
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const update = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: await model.update(req.params.id, req.body, req.user?.id),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const pending = async (req, res) => {
  try {
    return res.json({ success: true, data: await model.listPending() });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateSubmission = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: await model.updateSubmission(req.params.id, req.body),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const review = async (req, res) => {
  try {
    const decision = req.body?.decision;
    if (!['approve', 'reject'].includes(decision))
      return res
        .status(400)
        .json({ success: false, message: 'decision must be approve or reject' });
    return res.json({
      success: true,
      data: await model.review(req.params.id, decision, req.user, req.body?.comment),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listOptions = async (req, res) => {
  try {
    return res.json({ success: true, data: await model.listOptions() });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listAllOptions = async (req, res) => {
  try {
    return res.json({ success: true, data: await model.listOptions({ includeInactive: true }) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const addOption = async (req, res) => {
  try {
    return res
      .status(201)
      .json({ success: true, data: await model.addOptions(req.params.list, req.body) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateOption = async (req, res) => {
  try {
    return res.json({ success: true, data: await model.updateOption(req.params.id, req.body) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteOption = async (req, res) => {
  try {
    const data = await model.deleteOption(req.params.id);
    return res.json({
      success: true,
      data,
      message: data.deactivated
        ? 'Records already use this entry, so it was made inactive instead of deleted.'
        : 'Entry deleted.',
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export default {
  list,
  submit,
  update,
  pending,
  updateSubmission,
  review,
  listOptions,
  listAllOptions,
  addOption,
  updateOption,
  deleteOption,
};
