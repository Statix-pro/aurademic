import db from '../../config/connection.js';
import { getDirectoryApprovalStatus } from '../shared/directoryApprovalStatus.js';
import '../shared/workflow/directoryWorkflowAdapter.js';
import workflowService from '../shared/workflow/workflowService.js';

const ORG_FIELDS = [
  'name',
  'abbreviation',
  'establishment_year',
  'sector',
  'category',
  'tag',
  'website',
  'linked_in',
  'address',
  'city',
  'state',
  'country',
  'pin_code',
  'status',
];

export const normalizePayload = (input = {}) => {
  const aliases = {
    establishment_year: 'establishmentYear',
    linked_in: 'linkedIn',
    pin_code: 'pinCode',
  };
  return Object.fromEntries(
    ORG_FIELDS.map((field) => {
      const value = input[field] ?? input[aliases[field]];
      if (field === 'category') return [field, value || 'Academic'];
      if (field === 'tag') return [field, value || 'General'];
      if (field === 'status') return [field, value || 'Active'];
      return [field, value === '' ? null : (value ?? null)];
    }),
  );
};

const serialize = (row) => ({
  ...row,
  establishmentYear: row.establishment_year,
  linkedIn: row.linked_in,
  pinCode: row.pin_code,
  date: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null,
});

export default {
  async listApproved(userId) {
    const [rows] = await db.query(
      `SELECT *, DATE(created_at) AS date FROM organizations
       WHERE created_by = ?
       ORDER BY id DESC`,
      [userId || 0],
    );
    return rows.map((row) => {
      const isOwner = Number(row.created_by) === Number(userId);
      return {
        ...serialize(row),
        approvalStatus: getDirectoryApprovalStatus(row),
        isOwner,
      };
    });
  },

  async submit(input, userId) {
    const payload = normalizePayload(input);
    if (!payload.name) throw new Error('Organization name is required');
    const columns = [...ORG_FIELDS, 'is_active', 'created_by'];
    const values = [...ORG_FIELDS.map((field) => payload[field]), 0, userId || null];
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `INSERT INTO organizations (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values,
      );
      await workflowService.startWorkflow({
        moduleKey: 'organization_directory',
        recordId: result.insertId,
        tx: connection,
      });
      const [rows] = await connection.execute(
        'SELECT *, DATE(created_at) AS date FROM organizations WHERE id = ?',
        [result.insertId],
      );
      await connection.commit();
      // Same shape as listApproved, so the dashboard row keeps its Edit button.
      return { ...serialize(rows[0]), approvalStatus: 'Pending', isOwner: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async update(id, input, userId) {
    const payload = normalizePayload(input);
    if (!payload.name) throw new Error('Organization name is required');
    const assignments = ORG_FIELDS.map((field) => `${field} = ?`).join(', ');
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute(
        'SELECT id FROM organizations WHERE id = ? AND created_by = ? FOR UPDATE',
        [id, userId || 0],
      );
      if (!existing[0]) throw new Error('Organization not found');

      // Editing reopens this owner's record for review. updated_by identifies
      // a reviewer, so clear it until an admin makes the next decision.
      await connection.execute(
        `UPDATE organizations SET ${assignments}, is_active = 0, updated_by = NULL WHERE id = ?`,
        [...ORG_FIELDS.map((field) => payload[field]), id],
      );
      const workflow = await workflowService.startWorkflow({
        moduleKey: 'organization_directory',
        recordId: id,
        tx: connection,
      });
      await workflowService.logWorkflowResubmission({
        moduleKey: 'organization_directory',
        recordId: id,
        stage: workflow?.state?.currentStage || 'directory_admin',
        actor: { userId },
        tx: connection,
      });
      const [rows] = await connection.execute(
        'SELECT *, DATE(created_at) AS date FROM organizations WHERE id = ?',
        [id],
      );
      await connection.commit();
      return { ...serialize(rows[0]), approvalStatus: 'Pending', isOwner: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async listPending() {
    const [rows] = await db.query(
      `SELECT o.*, u.name AS submitted_by_name, u.email AS submitted_by_email
       FROM organizations o LEFT JOIN users u ON u.id = o.created_by
       ORDER BY o.created_at ASC`,
    );
    return rows.map((row) => ({
      ...serialize(row),
      approvalStatus: row.is_active ? 'Approved' : row.updated_by ? 'Rejected' : 'Pending',
      submitted_by: row.created_by,
      submitted_by_name: row.submitted_by_name,
      submitted_by_email: row.submitted_by_email,
    }));
  },

  async review(id, decision, actor, comment) {
    await workflowService.actOnWorkflow({
      moduleKey: 'organization_directory',
      recordId: id,
      decision: decision === 'approve' ? 'approved' : 'rejected',
      feedback: comment || (decision === 'reject' ? 'Rejected by super administrator' : null),
      actor,
      metadata: {
        origin: 'api',
        moduleMeta: { route: 'PATCH /api/organization-submissions/:id/review' },
      },
    });
    return { id: Number(id), status: decision === 'approve' ? 'Approved' : 'Rejected' };
  },
};
