import {
  addOptions,
  deleteOption as deleteListOption,
  listOptions,
  reviewOption,
  suggestSpecialization,
  updateOption as updateListOption,
} from '../shared/directoryLists.js';

// The list rules throw errors carrying a 4xx status for expected outcomes (not found,
// duplicate, validation); anything else is a fault and is logged.
const sendError = (res, error) => {
  const status = Number(error?.status);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ success: false, message: error.message });
  }
  console.error('Directory list request failed:', error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};

export const list = async (req, res) => {
  try {
    // The user's own suggestions are offered to them while they wait for review.
    return res.json({ success: true, data: await listOptions({ userId: req.user?.id }) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listAll = async (req, res) => {
  try {
    return res.json({ success: true, data: await listOptions({ includeInactive: true }) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const add = async (req, res) => {
  try {
    return res
      .status(201)
      .json({ success: true, data: await addOptions(req.params.list, req.body) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const suggest = async (req, res) => {
  try {
    const { entry, created } = await suggestSpecialization(req.body, req.user?.id);
    return res.status(created ? 201 : 200).json({
      success: true,
      data: entry,
      message: created
        ? 'Added. The Directory Admin will review it; until then only you can pick it.'
        : undefined,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const review = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: await reviewOption(req.params.id, req.body?.decision, req.user?.id),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const update = async (req, res) => {
  try {
    return res.json({ success: true, data: await updateListOption(req.params.id, req.body) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const remove = async (req, res) => {
  try {
    const data = await deleteListOption(req.params.id);
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

export default { list, listAll, add, suggest, review, update, remove };
