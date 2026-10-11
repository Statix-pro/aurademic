import model from './resourcepersonDirectoryModel.js';
const fail = (res, e) => res.status(400).json({ success: false, message: e.message || 'Resource person request failed' });
export const list = async (req, res) => { try { return res.json({ success: true, data: await model.list(req.user?.id) }); } catch (e) { return fail(res, e); } };
export const submit = async (req, res) => { try { return res.status(201).json({ success: true, data: await model.submit(req.body, req.files || {}, req.user?.id), message: 'Submitted for approval' }); } catch (e) { return fail(res, e); } };
export const update = async (req, res) => { try { return res.json({ success: true, data: await model.update(req.params.id, req.body, req.files || {}, req.user?.id), message: 'Resource person updated' }); } catch (e) { return fail(res, e); } };
export const pending = async (req, res) => { try { return res.json({ success: true, data: await model.pending() }); } catch (e) { return fail(res, e); } };
export const review = async (req, res) => { try { if (!['approve','reject'].includes(req.body?.decision)) return res.status(400).json({ success: false, message: 'Invalid decision' }); return res.json({ success: true, data: await model.review(req.params.id, req.body.decision, req.user?.id) }); } catch (e) { return fail(res, e); } };
export default { list, submit, update, pending, review };
