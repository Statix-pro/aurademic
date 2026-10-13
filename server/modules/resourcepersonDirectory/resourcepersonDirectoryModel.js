import db from '../../config/connection.js';
import '../shared/workflow/directoryWorkflowAdapter.js';
import workflowService from '../shared/workflow/workflowService.js';

const text = (v) => (v === '' || v === undefined ? null : v);
const fields = ['title','first_name','last_name','gender','dob','status','category','tag','specialization','mobile','personal_email','official_email','linked_in','photo_name','photo_path','photo_mime_type','photo_file_size','resume_name','resume_path','resume_mime_type','resume_file_size'];
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
  professions: professions.map((profession) => ({ ...profession, orgLinkedIn: profession.org_linked_in ?? profession.orgLinkedIn })),
  date: person.date ?? (person.created_at ? new Date(person.created_at).toISOString().slice(0, 10) : null),
});
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
const normalize = (input = {}, files = {}) => ({
  title: text(input.title) || 'Dr.', first_name: text(input.first_name ?? input.firstName), last_name: text(input.last_name ?? input.lastName),
  gender: text(input.gender) || 'Male', dob: text(input.dob), status: text(input.status) || 'In Service', category: text(input.category) || 'Academic', tag: text(input.tag) || 'General', specialization: text(input.specialization), mobile: text(input.mobile), personal_email: text(input.personal_email ?? input.personalEmail), official_email: text(input.official_email ?? input.officialEmail), linked_in: text(input.linked_in ?? input.linkedIn), photo_name: files.photoFile?.[0]?.originalname || text(input.photoName), photo_path: files.photoFile?.[0]?.filename ? `/uploads/resource-persons/${files.photoFile[0].filename}` : text(input.photoPath), photo_mime_type: files.photoFile?.[0]?.mimetype || text(input.photoMimeType), photo_file_size: files.photoFile?.[0]?.size || Number(input.photoFileSize) || null, resume_name: files.resumeFile?.[0]?.originalname || text(input.resumeName), resume_path: files.resumeFile?.[0]?.filename ? `/uploads/resource-persons/${files.resumeFile[0].filename}` : text(input.resumePath), resume_mime_type: files.resumeFile?.[0]?.mimetype || text(input.resumeMimeType), resume_file_size: files.resumeFile?.[0]?.size || Number(input.resumeFileSize) || null,
});

export default {
  async list(userId) {
    const [people] = await db.query('SELECT *, DATE(created_at) AS date FROM directory_resource_persons WHERE created_by = ? ORDER BY id DESC', [userId || 0]);
    const professionsByPerson = await loadProfessionsByPerson(people.map((person) => person.id));
    for (const person of people) person.professions = professionsByPerson.get(Number(person.id)) || [];
    return people.map((person) => ({ ...serializePerson(person), approvalStatus: person.is_active ? 'Approved' : (person.updated_by ? 'Rejected' : 'Pending') }));
  },
  async submit(input, files, userId) {
    const person = normalize(input, files); if (!person.first_name || !person.last_name) throw new Error('First name and last name are required');
    const connection = await db.getConnection();
    try { await connection.beginTransaction(); const cols = [...fields, 'is_active', 'created_by']; const [result] = await connection.execute(`INSERT INTO directory_resource_persons (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, [...fields.map((f) => person[f]), 0, userId || null]); const professions = JSON.parse(input.professions || '[]'); for (const [i, p] of professions.entries()) await connection.execute('INSERT INTO directory_resource_person_professions (resource_person_id, designation, department, organization, city, state, country, org_linked_in, status, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)', [result.insertId, p.designation || null, p.department || null, p.organization || null, p.city || null, p.state || null, p.country || null, p.orgLinkedIn ?? p.org_linked_in ?? null, p.status || 'Working', i]); await workflowService.startWorkflow({ moduleKey: 'resource_person_directory', recordId: result.insertId, tx: connection }); const [rows] = await connection.execute('SELECT *, DATE(created_at) AS date FROM directory_resource_persons WHERE id = ?', [result.insertId]); await connection.commit(); return { ...serializePerson(rows[0], professions), approvalStatus: 'Pending' }; } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
  },
  async update(id, input, files, userId) {
    const person = normalize(input, files);
    if (!person.first_name || !person.last_name) throw new Error('First name and last name are required');
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute('SELECT * FROM directory_resource_persons WHERE id = ? AND created_by = ?', [id, userId || 0]);
      if (!existing[0]) throw new Error('Resource person not found');
      const current = existing[0];
      const fileFields = ['photo_name', 'photo_path', 'photo_mime_type', 'photo_file_size', 'resume_name', 'resume_path', 'resume_mime_type', 'resume_file_size'];
      const updateFields = fields.filter((field) => !fileFields.includes(field));
      const values = updateFields.map((field) => person[field]);
      // A filename may be sent back by the edit form even when no replacement
      // was uploaded. Only update stored file metadata when a new file exists.
      if (files.photoFile?.[0]) { for (const field of ['photo_name', 'photo_path', 'photo_mime_type', 'photo_file_size']) { updateFields.push(field); values.push(person[field]); } }
      if (files.resumeFile?.[0]) { for (const field of ['resume_name', 'resume_path', 'resume_mime_type', 'resume_file_size']) { updateFields.push(field); values.push(person[field]); } }
      // A user edit is a new submission for approval. Do not set updated_by:
      // that column identifies the super-admin who rejected a record.
      updateFields.push('is_active', 'updated_by'); values.push(0, null); values.push(id);
      await connection.execute(`UPDATE directory_resource_persons SET ${updateFields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`, values);
      const professions = JSON.parse(input.professions || '[]');
      await connection.execute('DELETE FROM directory_resource_person_professions WHERE resource_person_id = ?', [id]);
      for (const [index, profession] of professions.entries()) await connection.execute('INSERT INTO directory_resource_person_professions (resource_person_id, designation, department, organization, city, state, country, org_linked_in, status, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, profession.designation || null, profession.department || null, profession.organization || null, profession.city || null, profession.state || null, profession.country || null, profession.orgLinkedIn ?? profession.org_linked_in ?? null, profession.status || 'Working', index]);
      await workflowService.startWorkflow({ moduleKey: 'resource_person_directory', recordId: id, tx: connection });
      await connection.commit();
      const savedPerson = {
        id: Number(id), ...person,
        photo_name: files.photoFile?.[0] ? person.photo_name : current.photo_name,
        photo_path: files.photoFile?.[0] ? person.photo_path : current.photo_path,
        resume_name: files.resumeFile?.[0] ? person.resume_name : current.resume_name,
        resume_path: files.resumeFile?.[0] ? person.resume_path : current.resume_path,
        created_at: current.created_at,
      };
      return { ...serializePerson(savedPerson, professions), approvalStatus: 'Pending' };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  },
  async pending() {
    const [rows] = await db.query("SELECT rp.*, u.name AS submitted_by_name, u.email AS submitted_by_email, CASE WHEN rp.is_active=1 THEN 'Approved' WHEN rp.updated_by IS NOT NULL THEN 'Rejected' ELSE 'Pending' END AS approvalStatus FROM directory_resource_persons rp LEFT JOIN users u ON u.id=rp.created_by ORDER BY rp.created_at");
    const professionsByPerson = await loadProfessionsByPerson(rows.map((person) => person.id));
    for (const person of rows) {
      const primaryProfession = professionsByPerson.get(Number(person.id))?.[0];
      person.organization = primaryProfession?.organization || null;
      person.city = primaryProfession?.city || null;
    }
    return rows;
  },
  async review(id, decision, actor, comment) { await workflowService.actOnWorkflow({ moduleKey: 'resource_person_directory', recordId: id, decision: decision === 'approve' ? 'approved' : 'rejected', feedback: comment || (decision === 'reject' ? 'Rejected by super administrator' : null), actor, metadata: { origin: 'api', moduleMeta: { route: 'PATCH /api/admin/resource-person-submissions/:id/review' } } }); return { id: Number(id), status: decision === 'approve' ? 'Approved' : 'Rejected' }; },
};
