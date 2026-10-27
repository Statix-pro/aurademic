// A project collaborator may be picked from the Organization and Resource Person
// directories. The server, not the form, copies what a pick fills in -- organization name
// and city, the person's name and designation -- so a locked field cannot be changed by
// calling the API directly. A resource person's email is never copied: the directory keeps
// contacts private to whoever added the record, so the project only learns that one exists.
import { getDirectoryApprovalStatus } from './directoryApprovalStatus.js';

const toId = (value) => (value === null || value === undefined ? null : Number(value));

/**
 * The post a collaborator's designation comes from: the person's post at the collaborating
 * organization, else their current one. A post they still hold beats one they left, and
 * otherwise the directory's own order decides. The project form applies the same rule.
 */
export const pickDirectoryProfession = (professions = [], organizationId = null) => {
  const orgId = toId(organizationId);
  const isCurrent = (profession) => profession.status !== 'Relieved';
  const atOrganization = orgId
    ? professions.filter((profession) => toId(profession.organization_id) === orgId)
    : [];
  return (
    atOrganization.find(isCurrent) ??
    atOrganization[0] ??
    professions.find(isCurrent) ??
    professions[0] ??
    null
  );
};

const loadProfessions = async (connection, personIds) => {
  if (personIds.length === 0) return new Map();
  const [rows] = await connection.query(
    `SELECT resource_person_id, organization_id, designation, official_email, status
       FROM directory_resource_person_professions
      WHERE resource_person_id IN (?)
      ORDER BY resource_person_id, sort_order, id`,
    [personIds],
  );
  return rows.reduce((map, row) => {
    const id = Number(row.resource_person_id);
    map.set(id, [...(map.get(id) ?? []), row]);
    return map;
  }, new Map());
};

const unique = (values) => [...new Set(values.filter((value) => value !== null))];

// project_collaborators.contact_designation is VARCHAR(150); a directory post's is 255.
const CONTACT_DESIGNATION_MAX = 150;

/**
 * Fills each linked collaborator from the directories. `rows` carry the payload's
 * `directory_organization_id` / `directory_resource_person_id` and `sourceIndex` (the index
 * the form rendered the row at, which its errors are keyed by). Returns the filled rows and
 * any field errors: a link to a record that is gone, was rejected, or that the saver cannot
 * see must be re-picked.
 *
 * `keptOrganizationIds` / `keptPersonIds` are the links the project already holds, which
 * stay usable for every editor (see `usable` below).
 */
export const fillDirectoryCollaborators = async (
  connection,
  rows,
  { userId = null, keptOrganizationIds = new Set(), keptPersonIds = new Set() } = {},
) => {
  const organizationIds = unique(rows.map((row) => toId(row.directory_organization_id)));
  const personIds = unique(rows.map((row) => toId(row.directory_resource_person_id)));

  const [organizations] = organizationIds.length
    ? await connection.query(
        `SELECT id, name, city, is_active, updated_by, created_by
           FROM organizations
          WHERE id IN (?)`,
        [organizationIds],
      )
    : [[]];
  const [people] = personIds.length
    ? await connection.query(
        `SELECT id, name, is_active, updated_by, created_by
           FROM directory_resource_persons
          WHERE id IN (?)`,
        [personIds],
      )
    : [[]];
  const organizationById = new Map(organizations.map((row) => [Number(row.id), row]));
  const personById = new Map(people.map((row) => [Number(row.id), row]));
  const professionsByPerson = await loadProfessions(connection, personIds);

  // The directory's own visibility rule (resolveProfessionOrganizations in the Resource
  // Person model): only an Approved record or the saver's own Pending one may be picked --
  // other users' Pending records are private to them. A link the project already holds
  // stays, so a co-editor can still save a row someone else linked. Rejected never does.
  const usable = (record, keptIds) =>
    Boolean(record) &&
    getDirectoryApprovalStatus(record) !== 'Rejected' &&
    (Number(record.is_active) === 1 ||
      (userId !== null && Number(record.created_by) === Number(userId)) ||
      keptIds.has(Number(record.id)));

  const errors = [];
  const filled = rows.map((row) => {
    const field = `collaborators[${row.sourceIndex ?? row.display_order}]`;
    const next = { ...row };

    const organizationId = toId(row.directory_organization_id);
    if (organizationId) {
      const organization = organizationById.get(organizationId);
      if (usable(organization, keptOrganizationIds)) {
        next.organization_name = organization.name;
        next.city = organization.city || null;
      } else {
        errors.push({
          field: `${field}.organization`,
          message: 'This organization is no longer in the directory. Pick another.',
        });
      }
    }

    const personId = toId(row.directory_resource_person_id);
    if (personId) {
      const person = personById.get(personId);
      if (usable(person, keptPersonIds)) {
        const profession = pickDirectoryProfession(
          professionsByPerson.get(personId),
          organizationId,
        );
        next.contact_name = person.name;
        next.contact_designation =
          profession?.designation?.slice(0, CONTACT_DESIGNATION_MAX) || null;
        next.contact_email = null;
      } else {
        errors.push({
          field: `${field}.contact_name`,
          message: 'This person is no longer in the directory. Pick another.',
        });
      }
    }
    return next;
  });

  return { rows: filled, errors };
};

/**
 * For reading a project back: whether the directory holds an email for each linked
 * person, by the same post the designation was taken from. Keyed by collaborator id.
 */
export const loadDirectoryEmailOnFile = async (connection, collaborators) => {
  const linked = collaborators.filter((row) => row.directory_resource_person_id);
  const professionsByPerson = await loadProfessions(
    connection,
    unique(linked.map((row) => toId(row.directory_resource_person_id))),
  );
  return new Map(
    linked.map((row) => {
      const profession = pickDirectoryProfession(
        professionsByPerson.get(Number(row.directory_resource_person_id)),
        row.directory_organization_id,
      );
      return [row.id, Boolean(profession?.official_email)];
    }),
  );
};
