import path from 'path';

import db from '../../config/connection.js';
import { getDirectoryApprovalStatus } from '../shared/directoryApprovalStatus.js';
import { deleteUploadedFile } from '../shared/uploadPaths.js';
import '../shared/workflow/directoryWorkflowAdapter.js';
import workflowService from '../shared/workflow/workflowService.js';

const text = (v) => (v === '' || v === undefined ? null : v);
const fields = [
  'title',
  'first_name',
  'last_name',
  'gender',
  'dob',
  'status',
  'category',
  'tag',
  'specialization',
  'mobile',
  'personal_email',
  'official_email',
  'linked_in',
  'photo_name',
  'photo_path',
  'photo_mime_type',
  'photo_file_size',
  'resume_name',
  'resume_path',
  'resume_mime_type',
  'resume_file_size',
];
const serializePerson = (person, professions = person.professions || []) => ({
  ...person,
  name: [person.title, person.first_name, person.last_name].filter(Boolean).join(' '),
  firstName: person.first_name,
  lastName: person.last_name,
  personalEmail: person.personal_email,
  officialEmail: person.official_email,
  linkedIn: person.linked_in,
  photoName: person.photo_name,
  photoPath: person.photo_path,
  resumeName: person.resume_name,
  resumePath: person.resume_path,
  professions: professions.map((profession) => ({
    ...profession,
    orgLinkedIn: profession.org_linked_in ?? profession.orgLinkedIn,
  })),
  date:
    person.date ??
    (person.created_at ? new Date(person.created_at).toISOString().slice(0, 10) : null),
});
const PRIVATE_PERSON_FIELDS = [
  'dob',
  'mobile',
  'personal_email',
  'personalEmail',
  'official_email',
  'officialEmail',
  'linked_in',
  'linkedIn',
  'address',
  'photo_name',
  'photoName',
  'photo_path',
  'photoPath',
  'photo_mime_type',
  'photo_file_size',
  'resume_name',
  'resumeName',
  'resume_path',
  'resumePath',
  'resume_mime_type',
  'resume_file_size',
];
const serializePublicPerson = (person, professions) => {
  const publicPerson = serializePerson(person, professions);
  for (const field of PRIVATE_PERSON_FIELDS) delete publicPerson[field];
  return publicPerson;
};
const loadProfessionsByPerson = async (personIds) => {
  if (!personIds.length) return new Map();
  const placeholders = personIds.map(() => '?').join(', ');
  const [professions] = await db.query(
    `SELECT * FROM directory_resource_person_professions
     WHERE resource_person_id IN (${placeholders})
     ORDER BY resource_person_id, sort_order, id`,
    personIds,
  );
  const byPerson = new Map();
  for (const profession of professions) {
    const personId = Number(profession.resource_person_id);
    const items = byPerson.get(personId) || [];
    items.push(profession);
    byPerson.set(personId, items);
  }
  return byPerson;
};
const RESOURCE_PERSON_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'resource-persons');
// File columns come only from a file multer has just written. A path taken from the
// request body would let a caller point a record at someone else's upload, which
// update() then deletes when a replacement arrives.
const uploadedFileFields = (file, prefix) => ({
  [`${prefix}_name`]: file?.filename ? file.originalname || null : null,
  [`${prefix}_path`]: file?.filename ? `/uploads/resource-persons/${file.filename}` : null,
  [`${prefix}_mime_type`]: file?.filename ? file.mimetype || null : null,
  [`${prefix}_file_size`]: file?.filename ? file.size || null : null,
});
const storedFileFields = (row, prefix) =>
  Object.fromEntries(
    ['name', 'path', 'mime_type', 'file_size'].map((suffix) => [
      `${prefix}_${suffix}`,
      row[`${prefix}_${suffix}`] ?? null,
    ]),
  );
const normalize = (input = {}, files = {}) => ({
  title: text(input.title) || 'Dr.',
  first_name: text(input.first_name ?? input.firstName),
  last_name: text(input.last_name ?? input.lastName),
  gender: text(input.gender) || 'Male',
  dob: text(input.dob),
  status: text(input.status) || 'In Service',
  category: text(input.category) || 'Academic',
  tag: text(input.tag) || 'General',
  specialization: text(input.specialization),
  mobile: text(input.mobile),
  personal_email: text(input.personal_email ?? input.personalEmail),
  official_email: text(input.official_email ?? input.officialEmail),
  linked_in: text(input.linked_in ?? input.linkedIn),
  ...uploadedFileFields(files.photoFile?.[0], 'photo'),
  ...uploadedFileFields(files.resumeFile?.[0], 'resume'),
});
const parseProfessions = (value) => {
  let professions = value || [];
  if (typeof professions === 'string') {
    try {
      professions = professions ? JSON.parse(professions) : [];
    } catch {
      const error = new Error('Professions must be a JSON array');
      error.status = 400;
      throw error;
    }
  }
  if (
    !Array.isArray(professions) ||
    professions.some(
      (profession) => !profession || typeof profession !== 'object' || Array.isArray(profession),
    )
  ) {
    const error = new Error('Professions must be a JSON array');
    error.status = 400;
    throw error;
  }
  return professions;
};
// Returns the on-disk path of a stored file only when it sits inside this module's own
// upload folder, so a replaced-file cleanup can never reach another module's uploads.
const storedUploadPath = (storedPath) => {
  const resolved = path.resolve(process.cwd(), String(storedPath).replace(/^[/\\]+/, ''));
  return resolved.startsWith(`${RESOURCE_PERSON_UPLOAD_DIR}${path.sep}`) ? resolved : null;
};
const deleteReplacedFile = (storedPath) => {
  const resolved = storedUploadPath(storedPath);
  if (resolved) deleteUploadedFile(resolved);
  else console.error('Refused to delete a resource-person file outside its folder:', storedPath);
};

export default {
  async list(userId) {
    const [people] = await db.query(
      'SELECT *, DATE(created_at) AS date FROM directory_resource_persons WHERE created_by = ? ORDER BY id DESC',
      [userId || 0],
    );
    const professionsByPerson = await loadProfessionsByPerson(people.map((person) => person.id));
    for (const person of people)
      person.professions = professionsByPerson.get(Number(person.id)) || [];
    return people.map((person) => {
      const isOwner = Number(person.created_by) === Number(userId);
      return {
        ...(isOwner ? serializePerson(person) : serializePublicPerson(person)),
        approvalStatus: getDirectoryApprovalStatus(person),
        isOwner,
      };
    });
  },
  async submit(input, files, userId) {
    const person = normalize(input, files);
    if (!person.first_name || !person.last_name)
      throw new Error('First name and last name are required');
    const professions = parseProfessions(input.professions);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const cols = [...fields, 'is_active', 'created_by'];
      const [result] = await connection.execute(
        `INSERT INTO directory_resource_persons (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        [...fields.map((f) => person[f]), 0, userId || null],
      );
      for (const [i, p] of professions.entries())
        await connection.execute(
          'INSERT INTO directory_resource_person_professions (resource_person_id, designation, department, organization, city, state, country, org_linked_in, status, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [
            result.insertId,
            p.designation || null,
            p.department || null,
            p.organization || null,
            p.city || null,
            p.state || null,
            p.country || null,
            p.orgLinkedIn ?? p.org_linked_in ?? null,
            p.status || 'Working',
            i,
          ],
        );
      await workflowService.startWorkflow({
        moduleKey: 'resource_person_directory',
        recordId: result.insertId,
        tx: connection,
      });
      const [rows] = await connection.execute(
        'SELECT *, DATE(created_at) AS date FROM directory_resource_persons WHERE id = ?',
        [result.insertId],
      );
      await connection.commit();
      return {
        ...serializePerson(rows[0], professions),
        approvalStatus: 'Pending',
        isOwner: true,
      };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },
  async update(id, input, files, userId) {
    const person = normalize(input, files);
    if (!person.first_name || !person.last_name)
      throw new Error('First name and last name are required');
    const professions = parseProfessions(input.professions);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute(
        'SELECT * FROM directory_resource_persons WHERE id = ? AND created_by = ?',
        [id, userId || 0],
      );
      if (!existing[0]) {
        const error = new Error('Resource person not found');
        error.status = 404;
        throw error;
      }
      const current = existing[0];
      const fileFields = [
        'photo_name',
        'photo_path',
        'photo_mime_type',
        'photo_file_size',
        'resume_name',
        'resume_path',
        'resume_mime_type',
        'resume_file_size',
      ];
      const updateFields = fields.filter((field) => !fileFields.includes(field));
      const values = updateFields.map((field) => person[field]);
      // A filename may be sent back by the edit form even when no replacement
      // was uploaded. Only update stored file metadata when a new file exists.
      if (files.photoFile?.[0]) {
        for (const field of ['photo_name', 'photo_path', 'photo_mime_type', 'photo_file_size']) {
          updateFields.push(field);
          values.push(person[field]);
        }
      }
      if (files.resumeFile?.[0]) {
        for (const field of [
          'resume_name',
          'resume_path',
          'resume_mime_type',
          'resume_file_size',
        ]) {
          updateFields.push(field);
          values.push(person[field]);
        }
      }
      // A user edit is a new submission for approval. Do not set updated_by:
      // that column identifies the super-admin who rejected a record.
      updateFields.push('is_active', 'updated_by');
      values.push(0, null);
      values.push(id);
      await connection.execute(
        `UPDATE directory_resource_persons SET ${updateFields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
        values,
      );
      await connection.execute(
        'DELETE FROM directory_resource_person_professions WHERE resource_person_id = ?',
        [id],
      );
      for (const [index, profession] of professions.entries())
        await connection.execute(
          'INSERT INTO directory_resource_person_professions (resource_person_id, designation, department, organization, city, state, country, org_linked_in, status, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [
            id,
            profession.designation || null,
            profession.department || null,
            profession.organization || null,
            profession.city || null,
            profession.state || null,
            profession.country || null,
            profession.orgLinkedIn ?? profession.org_linked_in ?? null,
            profession.status || 'Working',
            index,
          ],
        );
      const workflow = await workflowService.startWorkflow({
        moduleKey: 'resource_person_directory',
        recordId: id,
        tx: connection,
      });
      await workflowService.logWorkflowResubmission({
        moduleKey: 'resource_person_directory',
        recordId: id,
        stage: workflow?.state?.currentStage || 'directory_admin',
        actor: { userId },
        tx: connection,
      });
      await connection.commit();
      if (files.photoFile?.[0] && current.photo_path && current.photo_path !== person.photo_path) {
        deleteReplacedFile(current.photo_path);
      }
      if (
        files.resumeFile?.[0] &&
        current.resume_path &&
        current.resume_path !== person.resume_path
      ) {
        deleteReplacedFile(current.resume_path);
      }
      const savedPerson = {
        id: Number(id),
        ...person,
        // Untouched files keep their stored metadata, as the UPDATE above did.
        ...(files.photoFile?.[0] ? {} : storedFileFields(current, 'photo')),
        ...(files.resumeFile?.[0] ? {} : storedFileFields(current, 'resume')),
        created_at: current.created_at,
      };
      return {
        ...serializePerson(savedPerson, professions),
        approvalStatus: 'Pending',
        isOwner: true,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  async pending() {
    const [rows] = await db.query(
      "SELECT rp.*, u.name AS submitted_by_name, u.email AS submitted_by_email, CASE WHEN rp.is_active=1 THEN 'Approved' WHEN rp.updated_by IS NOT NULL THEN 'Rejected' ELSE 'Pending' END AS approvalStatus FROM directory_resource_persons rp LEFT JOIN users u ON u.id=rp.created_by ORDER BY rp.created_at",
    );
    const professionsByPerson = await loadProfessionsByPerson(rows.map((person) => person.id));
    return rows.map((person) => {
      const professions = professionsByPerson.get(Number(person.id)) || [];
      const primaryProfession = professions[0];
      return {
        ...serializePerson(person, professions),
        submitted_by_name: person.submitted_by_name,
        submitted_by_email: person.submitted_by_email,
        approvalStatus: person.approvalStatus,
        organization: primaryProfession?.organization || null,
        city: primaryProfession?.city || null,
      };
    });
  },
  async review(id, decision, actor, comment) {
    await workflowService.actOnWorkflow({
      moduleKey: 'resource_person_directory',
      recordId: id,
      decision: decision === 'approve' ? 'approved' : 'rejected',
      feedback: comment || (decision === 'reject' ? 'Rejected by super administrator' : null),
      actor,
      metadata: {
        origin: 'api',
        moduleMeta: { route: 'PATCH /api/admin/resource-person-submissions/:id/review' },
      },
    });
    return { id: Number(id), status: decision === 'approve' ? 'Approved' : 'Rejected' };
  },
};
