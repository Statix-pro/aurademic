import path from 'path';

import db from '../../config/connection.js';
import { getDirectoryApprovalStatus } from '../shared/directoryApprovalStatus.js';
import {
  DEFAULT_TAG,
  createDirectoryLists,
  parseSpecializations,
} from '../shared/directoryLists.js';
import { deleteUploadedFile } from '../shared/uploadPaths.js';
import '../shared/workflow/directoryWorkflowAdapter.js';
import workflowService from '../shared/workflow/workflowService.js';

const text = (v) => (v === '' || v === undefined ? null : v);
// Multipart fields arrive as strings, so `false` is "false".
const isTrue = (v) => v === true || v === 'true';
const fields = [
  'title',
  'first_name',
  'last_name',
  'gender',
  'dob',
  'status',
  'category',
  'tag',
  'mobile',
  'personal_email',
  'linked_in',
  'remarks',
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
  specializations: person.specializations || [],
  name: [person.title, person.first_name, person.last_name].filter(Boolean).join(' '),
  firstName: person.first_name,
  lastName: person.last_name,
  personalEmail: person.personal_email,
  linkedIn: person.linked_in,
  photoName: person.photo_name,
  photoPath: person.photo_path,
  resumeName: person.resume_name,
  resumePath: person.resume_path,
  professions: professions.map(
    ({
      linked_organization_name: linkedName,
      organization_status: linkedStatus,
      ...profession
    }) => ({
      ...profession,
      // A linked organization shows under its current name, so a rename carries through.
      organization: linkedName ?? profession.organization,
      organizationId: profession.organization_id ?? profession.organizationId ?? null,
      organizationStatus: linkedStatus ?? profession.organizationStatus ?? null,
      orgLinkedIn: profession.org_linked_in ?? profession.orgLinkedIn,
      officialEmail: profession.official_email ?? profession.officialEmail,
      officialEmailType: profession.official_email_type ?? profession.officialEmailType ?? null,
    }),
  ),
  date:
    person.date ??
    (person.created_at ? new Date(person.created_at).toISOString().slice(0, 10) : null),
});
// Everything else in an Approved record (photo included) is visible to every user; only
// its creator may edit it. These are locked: contacts show to others as dots, the resume
// not at all.
const PRIVATE_PERSON_FIELDS = [
  'dob',
  'mobile',
  'personal_email',
  'personalEmail',
  'address',
  'resume_name',
  'resumeName',
  'resume_path',
  'resumePath',
  'resume_mime_type',
  'resume_file_size',
  // The submitter's own notes on the person (fees, availability, ...), locked like a contact.
  'remarks',
  // Holds the reviewer's feedback, which is between the submitter and the reviewer.
  'workflow_state',
];
const serializePublicPerson = (person, professions) => {
  const publicPerson = serializePerson(person, professions);
  for (const field of PRIVATE_PERSON_FIELDS) delete publicPerson[field];
  // A profession's official email is a contact too. Whether one exists is not: a project
  // collaborator picked from the directory shows a filled, unreadable Email field.
  publicPerson.professions = publicPerson.professions.map(
    ({
      official_email: officialEmail,
      officialEmail: email,
      official_email_type: _officialEmailType,
      officialEmailType: _emailType,
      ...profession
    }) => ({ ...profession, hasOfficialEmail: Boolean(officialEmail ?? email) }),
  );
  // Tells the form the contact fields were withheld, not left blank, so it shows them locked.
  publicPerson.contactHidden = true;
  return publicPerson;
};
const loadProfessionsByPerson = async (personIds) => {
  if (!personIds.length) return new Map();
  const placeholders = personIds.map(() => '?').join(', ');
  const [professions] = await db.query(
    `SELECT p.*, o.name AS linked_organization_name,
            CASE WHEN o.id IS NULL THEN NULL
                 WHEN o.is_active = 1 THEN 'Approved'
                 WHEN o.updated_by IS NOT NULL THEN 'Rejected'
                 ELSE 'Pending' END AS organization_status
       FROM directory_resource_person_professions p
       LEFT JOIN organizations o ON o.id = p.organization_id
      WHERE p.resource_person_id IN (${placeholders})
      ORDER BY p.resource_person_id, p.sort_order, p.id`,
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
// Specialization picks against the Tag and Specialization lists both directories share
// (modules/shared/directoryLists.js).
const lists = createDirectoryLists({
  picks: 'directory_resource_person_specializations',
  recordColumn: 'resource_person_id',
});
// A resource person is not approved while an organization it names is still Pending or was
// Rejected. A profession row linked by organization_id is held by that organization; an
// unlinked row (older free text) by the organizations of that name, unless one is Approved.
// A name that matches no organization holds nothing.
// `lock` (inside a transaction, `tx`) share-locks the rows read, so an organization cannot
// leave Approved, and the profession rows cannot change, until that transaction ends.
const loadOrganizationHoldsByPerson = async (personIds, { tx = db, lock = false } = {}) => {
  if (!personIds.length) return new Map();
  const placeholders = personIds.map(() => '?').join(', ');
  const [rows] = await tx.query(
    `SELECT p.resource_person_id, MIN(o.name) AS name,
            MAX(o.is_active = 1) AS approved,
            MAX(o.is_active = 0 AND o.updated_by IS NULL) AS pending
       FROM directory_resource_person_professions p
       JOIN organizations o
         ON (p.organization_id IS NOT NULL AND o.id = p.organization_id)
         OR (p.organization_id IS NULL AND o.name = TRIM(p.organization))
      WHERE p.resource_person_id IN (${placeholders})
      GROUP BY p.resource_person_id, p.id${lock ? ' FOR SHARE' : ''}`,
    personIds,
  );
  const byPerson = new Map();
  for (const row of rows) {
    if (Number(row.approved)) continue;
    const personId = Number(row.resource_person_id);
    const hold = { name: row.name, status: Number(row.pending) ? 'Pending' : 'Rejected' };
    const holds = byPerson.get(personId) || [];
    if (!holds.some((h) => h.name === hold.name)) byPerson.set(personId, [...holds, hold]);
  }
  return byPerson;
};
// A profession row that picks an organization stores its id and, as the fallback name, its
// current name. Only an organization the submitter can see may be picked -- an Approved one
// or their own -- and never a Rejected one. Rows without an id keep their text unlinked.
// `keptIds` are the links the record already holds: like a retired list value, a stored link
// stays even when the submitter could not pick it now (its owner edited it back to Pending,
// or the migration linked another user's Pending organization). The approval hold still
// stops the record being approved until that organization is.
const resolveProfessionOrganizations = async (
  connection,
  professions,
  userId,
  keptIds = new Set(),
) => {
  const ids = [
    ...new Set(
      professions
        .map((p) => Number(p.organizationId ?? p.organization_id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (!ids.length) return professions.map((p) => ({ ...p, organizationId: null }));
  const [rows] = await connection.execute(
    `SELECT id, name, is_active, updated_by, created_by FROM organizations
      WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  return professions.map((p) => {
    const id = Number(p.organizationId ?? p.organization_id);
    if (!Number.isInteger(id) || id <= 0) return { ...p, organizationId: null };
    const org = byId.get(id);
    const visible =
      org &&
      (Number(org.is_active) === 1 || Number(org.created_by) === Number(userId) || keptIds.has(id));
    if (!visible) {
      throw Object.assign(new Error('Organization not found. Choose it again.'), { status: 400 });
    }
    if (getDirectoryApprovalStatus(org) === 'Rejected') {
      throw Object.assign(new Error(`"${org.name}" was rejected. Choose another organization.`), {
        status: 400,
      });
    }
    return {
      ...p,
      organizationId: id,
      organization: org.name,
      organizationStatus: getDirectoryApprovalStatus(org),
    };
  });
};
// The holds of rows just saved, from the organizations resolveProfessionOrganizations read.
// (Unlinked free-text rows are left to the next list(), which matches them by name.)
const holdsFromProfessions = (professions) =>
  professions
    .filter((p) => p.organizationId && p.organizationStatus !== 'Approved')
    .map((p) => ({ name: p.organization, status: p.organizationStatus }))
    .filter((hold, i, all) => all.findIndex((h) => h.name === hold.name) === i);
// Whether the official email is the person's own or a role mailbox (membersecretary@...)
// that the post's next holder reads. Kept only beside an email, and only as one of the two.
// A loaded row carries both keys and the form edits only officialEmailType, so a type the
// form left unset (null) must not fall back to the stored one, which may belong to an
// address since replaced.
const OFFICIAL_EMAIL_TYPES = ['personal', 'role'];
const officialEmailType = (p) => {
  const type = 'officialEmailType' in p ? p.officialEmailType : p.official_email_type;
  return (p.officialEmail ?? p.official_email) && OFFICIAL_EMAIL_TYPES.includes(type) ? type : null;
};
const insertProfessions = async (connection, personId, professions) => {
  for (const [index, p] of professions.entries())
    await connection.execute(
      'INSERT INTO directory_resource_person_professions (resource_person_id, designation, department, organization, organization_id, city, state, country, org_linked_in, official_email, official_email_type, status, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        personId,
        p.designation || null,
        p.department || null,
        p.organization || null,
        p.organizationId || null,
        p.city || null,
        p.state || null,
        p.country || null,
        p.orgLinkedIn ?? p.org_linked_in ?? null,
        // A loaded row carries both keys and the form edits only officialEmail, so a
        // cleared field ('') must not fall back to the stored official_email.
        (p.officialEmail ?? p.official_email) || null,
        officialEmailType(p),
        p.status || 'Working',
        index,
      ],
    );
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
  tag: text(input.tag) || DEFAULT_TAG,
  mobile: text(input.mobile),
  personal_email: text(input.personal_email ?? input.personalEmail),
  linked_in: text(input.linked_in ?? input.linkedIn),
  remarks: text(typeof input.remarks === 'string' ? input.remarks.trim() : input.remarks),
  ...uploadedFileFields(files.photoFile?.[0], 'photo'),
  ...uploadedFileFields(files.resumeFile?.[0], 'resume'),
});
const filled = (value) => typeof value === 'string' && value.trim() !== '';
// Beyond the name, a directory entry is only useful if the person can be reached, holds a
// post (projects take a collaborator's designation from it) and can be found by subject.
// Records saved before this rule get these on their next edit.
const assertRequired = (person, professions, specializations) => {
  const missing = [];
  const hasPostEmail = professions.some((p) => filled(p.officialEmail ?? p.official_email));
  if (!filled(person.mobile) && !filled(person.personal_email) && !hasPostEmail)
    missing.push('a mobile number or an email');
  const hasPost = professions.some(
    (p) =>
      filled(p.designation) &&
      (filled(p.organization) || Number(p.organizationId ?? p.organization_id) > 0),
  );
  if (!hasPost) missing.push('a post with its designation and organization');
  if (specializations.length === 0) missing.push('at least one specialization');
  if (missing.length > 0) {
    const error = new Error(`Add ${missing.join(', ')}.`);
    error.status = 400;
    throw error;
  }
};
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
  async list(user) {
    const userId = user?.id;
    const [people] = await db.query(
      // Approved records form the shared directory; Pending and Rejected ones stay with
      // their submitter. Other users' records are redacted below (serializePublicPerson),
      // but who added a record stays visible, so a reader can ask them about it.
      `SELECT rp.*, DATE(rp.created_at) AS date,
              u.name AS submitted_by_name, u.email AS submitted_by_email
         FROM directory_resource_persons rp
         LEFT JOIN users u ON u.id = rp.created_by
        WHERE rp.created_by = ? OR rp.is_active = 1
        ORDER BY rp.id DESC`,
      [userId || 0],
    );
    const personIds = people.map((person) => person.id);
    const professionsByPerson = await loadProfessionsByPerson(personIds);
    const specializationsByPerson = await lists.loadSpecializationsByRecord(personIds);
    for (const person of people) {
      person.professions = professionsByPerson.get(Number(person.id)) || [];
      person.specializations = specializationsByPerson.get(Number(person.id)) || [];
    }
    // The submitter is told which organization holds a record up; an Approved record has
    // none, so only the user's own unapproved ones are checked.
    const holdsByPerson = await loadOrganizationHoldsByPerson(
      people
        .filter(
          (person) =>
            Number(person.created_by) === Number(userId) &&
            getDirectoryApprovalStatus(person) !== 'Approved',
        )
        .map((person) => person.id),
    );
    return people.map((person) => {
      const isOwner = Number(person.created_by) === Number(userId);
      // Super admins see every record in full, as they already do on the approval page.
      const seesContacts = isOwner || Boolean(user?.isSuperAdmin);
      return {
        ...(seesContacts ? serializePerson(person) : serializePublicPerson(person)),
        approvalStatus: getDirectoryApprovalStatus(person),
        isOwner,
        ...(isOwner ? { organizationHolds: holdsByPerson.get(Number(person.id)) || [] } : {}),
      };
    });
  },
  async submit(input, files, userId) {
    const person = normalize(input, files);
    if (!person.first_name || !person.last_name)
      throw new Error('First name and last name are required');
    const professions = parseProfessions(input.professions);
    const requestedSpecializations = parseSpecializations(input.specializations);
    assertRequired(person, professions, requestedSpecializations);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const listed = await lists.toListedValues(connection, {
        tag: person.tag,
        specializations: requestedSpecializations,
      });
      person.tag = listed.tag;
      const cols = [...fields, 'is_active', 'created_by'];
      const [result] = await connection.execute(
        `INSERT INTO directory_resource_persons (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        [...fields.map((f) => person[f]), 0, userId || null],
      );
      const savedProfessions = await resolveProfessionOrganizations(
        connection,
        professions,
        userId,
      );
      await insertProfessions(connection, result.insertId, savedProfessions);
      await lists.replaceSpecializations(connection, result.insertId, listed.specializations, {
        isNew: true,
      });
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
        ...serializePerson(
          { ...rows[0], specializations: listed.specializations },
          savedProfessions,
        ),
        approvalStatus: 'Pending',
        isOwner: true,
        // Same shape as list(), so the dashboard row says at once what holds it.
        organizationHolds: holdsFromProfessions(savedProfessions),
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
    const requestedSpecializations = parseSpecializations(input.specializations);
    assertRequired(person, professions, requestedSpecializations);
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
      const listed = await lists.toListedValues(
        connection,
        { tag: person.tag, specializations: requestedSpecializations },
        { tag: current.tag, specializations: await lists.loadSpecializations(connection, id) },
      );
      person.tag = listed.tag;
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
      // A file's columns change only when a new file arrives or the owner removed the
      // stored one; otherwise they keep what is stored. A new file wins over removal.
      // `person` already holds the new file's metadata, or nulls when there is none.
      const fileChanges = {
        photo: Boolean(files.photoFile?.[0]) || isTrue(input.removePhoto),
        resume: Boolean(files.resumeFile?.[0]) || isTrue(input.removeResume),
      };
      for (const prefix of ['photo', 'resume']) {
        if (!fileChanges[prefix]) continue;
        for (const suffix of ['name', 'path', 'mime_type', 'file_size']) {
          updateFields.push(`${prefix}_${suffix}`);
          values.push(person[`${prefix}_${suffix}`]);
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
      const [storedLinks] = await connection.execute(
        'SELECT organization_id FROM directory_resource_person_professions WHERE resource_person_id = ? AND organization_id IS NOT NULL',
        [id],
      );
      const keptOrganizationIds = new Set(storedLinks.map((row) => Number(row.organization_id)));
      await connection.execute(
        'DELETE FROM directory_resource_person_professions WHERE resource_person_id = ?',
        [id],
      );
      const savedProfessions = await resolveProfessionOrganizations(
        connection,
        professions,
        userId,
        keptOrganizationIds,
      );
      await insertProfessions(connection, id, savedProfessions);
      await lists.replaceSpecializations(connection, id, listed.specializations);
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
      // Only after commit, so a rolled-back edit never loses the stored file.
      for (const prefix of ['photo', 'resume']) {
        const storedPath = current[`${prefix}_path`];
        if (fileChanges[prefix] && storedPath && storedPath !== person[`${prefix}_path`]) {
          deleteReplacedFile(storedPath);
        }
      }
      const savedPerson = {
        id: Number(id),
        ...person,
        // Untouched files keep their stored metadata, as the UPDATE above did.
        ...(fileChanges.photo ? {} : storedFileFields(current, 'photo')),
        ...(fileChanges.resume ? {} : storedFileFields(current, 'resume')),
        created_at: current.created_at,
        specializations: listed.specializations,
      };
      return {
        ...serializePerson(savedPerson, savedProfessions),
        approvalStatus: 'Pending',
        isOwner: true,
        organizationHolds: holdsFromProfessions(savedProfessions),
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
    const personIds = rows.map((person) => person.id);
    const professionsByPerson = await loadProfessionsByPerson(personIds);
    const specializationsByPerson = await lists.loadSpecializationsByRecord(personIds);
    const holdsByPerson = await loadOrganizationHoldsByPerson(personIds);
    return rows.map((person) => {
      const professions = professionsByPerson.get(Number(person.id)) || [];
      const specializations = specializationsByPerson.get(Number(person.id)) || [];
      const serialized = serializePerson({ ...person, specializations }, professions);
      // From the serialized row, so a linked organization shows under its current name.
      const primaryProfession = serialized.professions[0];
      return {
        ...serialized,
        submitted_by_name: person.submitted_by_name,
        submitted_by_email: person.submitted_by_email,
        approvalStatus: person.approvalStatus,
        organization: primaryProfession?.organization || null,
        city: primaryProfession?.city || null,
        // Organizations that keep this record from being approved; see review().
        organizationHolds: holdsByPerson.get(Number(person.id)) || [],
      };
    });
  },
  async review(id, decision, actor, comment) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      if (decision === 'approve') await assertNoOrganizationHolds(connection, id);
      await workflowService.actOnWorkflow({
        moduleKey: 'resource_person_directory',
        recordId: id,
        decision: decision === 'approve' ? 'approved' : 'rejected',
        feedback: comment || (decision === 'reject' ? 'Rejected by super administrator' : null),
        actor,
        metadata: {
          origin: 'api',
          moduleMeta: { route: 'PATCH /api/resource-person-submissions/:id/review' },
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
// Runs in the approving transaction, so what it checks is what gets approved. The person
// row is locked first -- the order update() takes it in -- so an owner's edit has either
// committed or waits for the decision; the share locks on the profession and organization
// rows then keep a linked organization from leaving Approved before the approval commits.
async function assertNoOrganizationHolds(connection, id) {
  await connection.execute('SELECT id FROM directory_resource_persons WHERE id = ? FOR UPDATE', [
    id,
  ]);
  const holds =
    (await loadOrganizationHoldsByPerson([Number(id)], { tx: connection, lock: true })).get(
      Number(id),
    ) || [];
  if (holds.length) {
    const pending = holds.filter((hold) => hold.status === 'Pending').map((h) => `"${h.name}"`);
    const rejected = holds.filter((hold) => hold.status === 'Rejected').map((h) => `"${h.name}"`);
    const error = new Error(
      [
        pending.length &&
          `Approve the organization ${pending.join(', ')} first; it is still pending.`,
        rejected.length &&
          `The organization ${rejected.join(', ')} was rejected; the submitter needs to choose another.`,
      ]
        .filter(Boolean)
        .join(' '),
    );
    error.status = 409;
    throw error;
  }
}
