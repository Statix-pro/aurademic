import db from '../../config/connection.js';
import { getDirectoryApprovalStatus } from '../shared/directoryApprovalStatus.js';
import {
  DEFAULT_TAG,
  createDirectoryLists,
  parseSpecializations,
  specializationHoldError,
} from '../shared/directoryLists.js';
import '../shared/workflow/directoryWorkflowAdapter.js';
import workflowService from '../shared/workflow/workflowService.js';

const ORG_FIELDS = [
  'name',
  'abbreviation',
  'establishment_year',
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
  'funding',
];
// The column is an ENUM; anything else, '' included, is stored as unknown.
const FUNDING_VALUES = ['Private', 'Public'];

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
      if (field === 'tag') return [field, value || DEFAULT_TAG];
      if (field === 'status') return [field, value || 'Active'];
      if (field === 'funding') return [field, FUNDING_VALUES.includes(value) ? value : null];
      return [field, value === '' ? null : (value ?? null)];
    }),
  );
};

// Every save -- submit, owner edit, reviewer edit -- needs a name and a funding. Funding
// arrived after records existed, so an older one gets it on its next edit.
const filled = (value) => typeof value === 'string' && value.trim() !== '';
const isIndia = (country) => filled(country) && country.trim().toLowerCase() === 'india';
const assertRequired = (payload) => {
  if (!payload.name) throw new Error('Organization name is required');
  if (!payload.funding) {
    const error = new Error('Choose whether the organization is privately or publicly funded.');
    error.status = 400;
    throw error;
  }
  // Where it is: the Resource Person form and project collaborators copy this address, so a
  // gap here would spread. A state is required in India, whose list the form offers; other
  // countries type a province, and not every country has one.
  const missing = [
    !filled(payload.city) && 'the city',
    isIndia(payload.country) && !filled(payload.state) && 'the state',
    !filled(payload.country) && 'the country',
  ].filter(Boolean);
  if (missing.length > 0) {
    const error = new Error(`Add ${missing.join(', ')}.`);
    error.status = 400;
    throw error;
  }
};

// Specialization picks against the Tag and Specialization lists both directories share
// (modules/shared/directoryLists.js).
const lists = createDirectoryLists({
  picks: 'directory_organization_specializations',
  recordColumn: 'organization_id',
});

const serialize = (row) => ({
  ...row,
  specializations: row.specializations || [],
  establishmentYear: row.establishment_year,
  linkedIn: row.linked_in,
  pinCode: row.pin_code,
  date: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null,
});

export default {
  async listApproved(userId) {
    const [rows] = await db.query(
      // Approved organizations form the shared directory; Pending and Rejected ones stay
      // with their submitter. Organization fields are public, so nothing is redacted. The
      // submitter's name and email let a reader ask them about the organization.
      `SELECT o.*, DATE(o.created_at) AS date,
              u.name AS submitted_by_name, u.email AS submitted_by_email
         FROM organizations o
         LEFT JOIN users u ON u.id = o.created_by
        WHERE o.created_by = ? OR o.is_active = 1
        ORDER BY o.id DESC`,
      [userId || 0],
    );
    const specializationsByOrg = await lists.loadSpecializationsByRecord(rows.map((row) => row.id));
    // The submitter is told which suggested specializations hold their record up; an
    // Approved record has none, so only the user's own unapproved ones are checked.
    const holdsByOrg = await lists.loadSpecializationHolds(
      rows
        .filter(
          (row) =>
            Number(row.created_by) === Number(userId) &&
            getDirectoryApprovalStatus(row) !== 'Approved',
        )
        .map((row) => row.id),
    );
    return rows.map((row) => {
      row.specializations = specializationsByOrg.get(Number(row.id)) || [];
      const isOwner = Number(row.created_by) === Number(userId);
      // workflow_state holds the reviewer's feedback, which is only the submitter's.
      const { workflow_state: workflowState, ...publicRow } = row;
      return {
        ...serialize(isOwner ? { ...publicRow, workflow_state: workflowState } : publicRow),
        approvalStatus: getDirectoryApprovalStatus(row),
        isOwner,
        ...(isOwner ? { specializationHolds: holdsByOrg.get(Number(row.id)) || [] } : {}),
      };
    });
  },

  async submit(input, userId) {
    const payload = normalizePayload(input);
    assertRequired(payload);
    const requestedSpecializations = parseSpecializations(input.specializations);
    const columns = [...ORG_FIELDS, 'is_active', 'created_by'];
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const listed = await lists.toListedValues(
        connection,
        { tag: payload.tag, specializations: requestedSpecializations },
        {},
        { userId },
      );
      payload.tag = listed.tag;
      const values = [...ORG_FIELDS.map((field) => payload[field]), 0, userId || null];
      const [result] = await connection.execute(
        `INSERT INTO organizations (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values,
      );
      await lists.replaceSpecializations(connection, result.insertId, listed.specializations, {
        isNew: true,
      });
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
      const holds = await lists.loadSpecializationHolds([result.insertId]);
      // Same shape as listApproved, so the dashboard row keeps its Edit button.
      return {
        ...serialize({ ...rows[0], specializations: listed.specializations }),
        approvalStatus: 'Pending',
        isOwner: true,
        specializationHolds: holds.get(Number(result.insertId)) || [],
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async update(id, input, userId) {
    const payload = normalizePayload(input);
    assertRequired(payload);
    const requestedSpecializations = parseSpecializations(input.specializations);
    const assignments = ORG_FIELDS.map((field) => `${field} = ?`).join(', ');
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute(
        'SELECT id, tag FROM organizations WHERE id = ? AND created_by = ? FOR UPDATE',
        [id, userId || 0],
      );
      if (!existing[0]) throw new Error('Organization not found');
      const listed = await lists.toListedValues(
        connection,
        { tag: payload.tag, specializations: requestedSpecializations },
        { tag: existing[0].tag, specializations: await lists.loadSpecializations(connection, id) },
        { userId },
      );
      payload.tag = listed.tag;

      // Editing reopens this owner's record for review. updated_by identifies
      // a reviewer, so clear it until an admin makes the next decision.
      await connection.execute(
        `UPDATE organizations SET ${assignments}, is_active = 0, updated_by = NULL WHERE id = ?`,
        [...ORG_FIELDS.map((field) => payload[field]), id],
      );
      await lists.replaceSpecializations(connection, id, listed.specializations);
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
      const holds = await lists.loadSpecializationHolds([Number(id)]);
      return {
        ...serialize({ ...rows[0], specializations: listed.specializations }),
        approvalStatus: 'Pending',
        isOwner: true,
        specializationHolds: holds.get(Number(id)) || [],
      };
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
    const specializationsByOrg = await lists.loadSpecializationsByRecord(rows.map((row) => row.id));
    const holdsByOrg = await lists.loadSpecializationHolds(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...serialize({ ...row, specializations: specializationsByOrg.get(Number(row.id)) || [] }),
      approvalStatus: row.is_active ? 'Approved' : row.updated_by ? 'Rejected' : 'Pending',
      // Suggested specializations that keep this record from being approved; see review().
      specializationHolds: holdsByOrg.get(Number(row.id)) || [],
      submitted_by: row.created_by,
      submitted_by_name: row.submitted_by_name,
      submitted_by_email: row.submitted_by_email,
    }));
  },

  // A reviewer corrects a submission before deciding on it. Only Pending rows qualify, and
  // the approval state is left alone: updated_by marks a decision, so setting it here would
  // read as Rejected, and no workflow step runs because nothing has been decided yet.
  // `reviewerId`: the form lets a reviewer add a Specialization too, which is theirs until
  // reviewed, like a submitter's -- and the record then waits for it like any other.
  async updateSubmission(id, input, reviewerId = null) {
    const payload = normalizePayload(input);
    assertRequired(payload);
    const requestedSpecializations = parseSpecializations(input.specializations);
    const assignments = ORG_FIELDS.map((field) => `${field} = ?`).join(', ');
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute(
        'SELECT id, tag, is_active, updated_by FROM organizations WHERE id = ? FOR UPDATE',
        [id],
      );
      if (!existing[0]) throw new Error('Organization not found');
      if (getDirectoryApprovalStatus(existing[0]) !== 'Pending') {
        const error = new Error('Only pending organizations can be edited.');
        error.status = 409;
        throw error;
      }
      const listed = await lists.toListedValues(
        connection,
        { tag: payload.tag, specializations: requestedSpecializations },
        { tag: existing[0].tag, specializations: await lists.loadSpecializations(connection, id) },
        { userId: reviewerId },
      );
      payload.tag = listed.tag;

      await connection.execute(`UPDATE organizations SET ${assignments} WHERE id = ?`, [
        ...ORG_FIELDS.map((field) => payload[field]),
        id,
      ]);
      await lists.replaceSpecializations(connection, id, listed.specializations);
      const [rows] = await connection.execute(
        `SELECT o.*, u.name AS submitted_by_name, u.email AS submitted_by_email
         FROM organizations o LEFT JOIN users u ON u.id = o.created_by
         WHERE o.id = ?`,
        [id],
      );
      await connection.commit();
      const holds = await lists.loadSpecializationHolds([Number(id)]);
      // Same shape as listPending, so the approval row is replaced in place.
      const row = rows[0];
      return {
        ...serialize({ ...row, specializations: listed.specializations }),
        approvalStatus: 'Pending',
        specializationHolds: holds.get(Number(id)) || [],
        submitted_by: row.created_by,
        submitted_by_name: row.submitted_by_name,
        submitted_by_email: row.submitted_by_email,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async review(id, decision, actor, comment) {
    // Approved organizations are shared, but names are unique only per submitter, so two
    // users can submit the same organization. Refuse to approve a second copy; the reviewer
    // rejects it instead. Names compare trimmed, space-collapsed and case-insensitive.
    if (decision === 'approve') {
      const [duplicates] = await db.execute(
        `SELECT existing.id
         FROM organizations target
         JOIN organizations existing
           ON existing.id <> target.id
          AND existing.is_active = 1
          AND LOWER(REGEXP_REPLACE(TRIM(existing.name), '[[:space:]]+', ' '))
            = LOWER(REGEXP_REPLACE(TRIM(target.name), '[[:space:]]+', ' '))
         WHERE target.id = ?
         LIMIT 1`,
        [id],
      );
      if (duplicates[0]) {
        const error = new Error(
          'An organization with this name is already in the directory. Reject this duplicate instead.',
        );
        error.status = 409;
        throw error;
      }
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      // Checked in the approving transaction: the organization row is locked first, the
      // order update() takes it in, and the share lock on the suggested entries keeps one
      // from leaving Approved before the approval commits.
      if (decision === 'approve') {
        await connection.execute('SELECT id FROM organizations WHERE id = ? FOR UPDATE', [id]);
        const holds = await lists.loadSpecializationHolds([Number(id)], {
          tx: connection,
          lock: true,
        });
        const holdError = specializationHoldError(holds.get(Number(id)));
        if (holdError) throw holdError;
      }
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
        tx: connection,
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return { id: Number(id), status: decision === 'approve' ? 'Approved' : 'Rejected' };
  },
};
