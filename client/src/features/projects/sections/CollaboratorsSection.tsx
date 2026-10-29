import React, { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../../contexts/AuthContext';
import CustomModal from '../../../shared/components/ui/CustomModal';
import { hasPermission, isSuperAdmin } from '../../../shared/utils/permissionUtils';
import OrganizationDirectory from '../../organizationdirectory/OrganizationDirectory';
import ResourcePersonDirectory from '../../resourcepersondirectory/ResourcePersonDirectory';
import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import SuggestInput from '../components/SuggestInput';
import TagSelectField from '../components/TagSelectField';
import YesNoSwitch from '../components/YesNoSwitch';
import { COLLABORATOR_CATEGORIES, COLLABORATOR_ROLES, MAX_COLLABORATORS } from '../constants';
import { createCollaboratorRow, removeAt, replaceAt } from '../projectFormState';
import projectsApi from '../projectsApi';

import type { Organization } from '../../organizationdirectory/OrganizationDirectory';
import type {
  ProfessionDetail,
  ResourcePerson,
} from '../../resourcepersondirectory/ResourcePersonDirectory';
import type { CollaboratorRow, ProjectFormState, ProjectOrganization } from '../types';

/** Shown in a linked person's Email: the directory has one, but keeps it private. */
const EMAIL_ON_FILE_MASK = '••••••••';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A post at the organization: linked to it, or -- typed in before the organization was in
 * the directory -- naming it. The server matches the same way (directoryCollaborators.js).
 */
const isPostAt = (profession: ProfessionDetail, organization: Organization) =>
  profession.organizationId
    ? Number(profession.organizationId) === organization.id
    : sameName(profession.organization || '', organization.name);

const worksAt = (person: ResourcePerson, organization: Organization) =>
  (person.professions ?? []).some((profession) => isPostAt(profession, organization));

/**
 * The post a collaborator's designation comes from: the person's post at the collaborating
 * organization, else their current one; a post they still hold beats one they left. The
 * server applies the same rule on save (modules/shared/directoryCollaborators.js).
 */
const pickProfession = (
  professions: ProfessionDetail[] = [],
  organization: Organization | null,
): ProfessionDetail | null => {
  const isCurrent = (profession: ProfessionDetail) => profession.status !== 'Relieved';
  const atOrganization = organization
    ? professions.filter((profession) => isPostAt(profession, organization))
    : [];
  return (
    atOrganization.find(isCurrent) ??
    atOrganization[0] ??
    professions.find(isCurrent) ??
    professions[0] ??
    null
  );
};

/** What a row holds of a person, emptied. */
const NO_PERSON: Partial<CollaboratorRow> = {
  directoryResourcePersonId: null,
  contactName: '',
  contactDesignation: '',
  contactEmail: '',
  contactEmailOnFile: false,
};

/**
 * Keeps a role that is not in the list selectable — the field was free text
 * before it was a multi-select, so a project saved then still carries whatever
 * was typed, and an edit to any other cell would otherwise save the row without
 * it.
 */
const withStoredRoles = (
  options: { value: string; label: string }[],
  roles: string[],
): { value: string; label: string }[] => {
  const offered = new Set(options.map((option) => option.value));
  const missing = roles
    .filter((role) => !offered.has(role))
    .map((role) => ({
      value: role,
      label: role,
    }));

  return missing.length > 0 ? [...missing, ...options] : options;
};

interface CollaboratorsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  organizations: ProjectOrganization[];
  errors: Record<string, string>;
  disabled: boolean;
}

const CollaboratorsSection: React.FC<CollaboratorsSectionProps> = ({
  form,
  patch,
  organizations,
  errors,
  disabled,
}) => {
  const rows = form.collaborators;

  // Organization and Name are picked from the directories. A pick links the row and locks
  // what the directory fills in (City; Designation and Email); typing over a pick unlinks
  // it, and text that is in neither directory is saved as typed. Rejected records are
  // never offered; a submitter's own Pending ones are, as on the Resource Person form.
  const [directory, setDirectory] = useState<{
    organizations: Organization[];
    people: ResourcePerson[];
  }>({ organizations: [], people: [] });
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  // A collaborator missing from a directory can be added to it from here, without leaving
  // the unsaved project. The new record waits for approval like any other, and is linked
  // to the row that asked for it -- its submitter may pick their own Pending records.
  const { user } = useAuth();
  const canAddToDirectory =
    !disabled && (isSuperAdmin(user) || hasPermission(user, 'directory.create'));
  const [adding, setAdding] = useState<{
    kind: 'organization' | 'person';
    rowKey: string;
  } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    projectsApi
      .fetchCollaboratorDirectory()
      .then((loaded) => {
        if (cancelled) return;
        setDirectory(loaded);
        setDirectoryError(null);
      })
      .catch((error: any) => {
        if (!cancelled)
          setDirectoryError(
            `${error?.message || 'The directories could not be loaded.'} You can still type a collaborator in.`,
          );
      });
    return () => {
      cancelled = true;
    };
  }, [disabled]);

  const directoryOrganizations = useMemo(
    () =>
      directory.organizations.filter((organization) => organization.approvalStatus !== 'Rejected'),
    [directory.organizations],
  );
  const directoryPeople = useMemo(
    () => directory.people.filter((person) => person.approvalStatus !== 'Rejected'),
    [directory.people],
  );

  const organizationSuggestions = useMemo(
    () =>
      directoryOrganizations.map((organization) => ({
        value: String(organization.id),
        label: organization.name,
      })),
    [directoryOrganizations],
  );

  const linkedOrganization = (row: CollaboratorRow) =>
    row.directoryOrganizationId
      ? directoryOrganizations.find((item) => item.id === row.directoryOrganizationId)
      : undefined;

  /**
   * Once an organization is picked, only the people with a post there; for a typed-in
   * organization, everyone.
   */
  const peopleFor = (row: CollaboratorRow) => {
    const organization = linkedOrganization(row);
    return organization
      ? directoryPeople.filter((person) => worksAt(person, organization))
      : directoryPeople;
  };

  const peopleSuggestions = (row: CollaboratorRow) => {
    const organization = linkedOrganization(row) ?? null;
    return peopleFor(row).map((person) => {
      const designation = pickProfession(person.professions, organization)?.designation;
      return {
        value: String(person.id),
        label: designation ? `${person.name} · ${designation}` : person.name,
      };
    });
  };

  // The finance tables' organization master (`financeOrganizations`) is a separate list: a
  // collaborator whose name matches an entry (in any capitals) is still linked to it, which
  // is what makes it a party in the finance tables.
  const externalOrganizations = useMemo(
    () => organizations.filter((organization) => organization.is_internal !== 1),
    [organizations],
  );

  const findMasterOrganization = (name: string) => {
    const needle = name.trim().toLowerCase();
    return needle
      ? externalOrganizations.find((organization) => organization.name.toLowerCase() === needle)
      : undefined;
  };

  /** Designation and email from a linked person's post at the given organization. */
  const personDetails = (
    person: ResourcePerson,
    organization: Organization | null,
  ): Partial<CollaboratorRow> => {
    const profession = pickProfession(person.professions, organization);
    return {
      contactName: person.name,
      contactDesignation: profession?.designation || '',
      contactEmail: '',
      // The post's official email, or else the person's own.
      contactEmailOnFile: Boolean(
        profession?.officialEmail ||
        profession?.hasOfficialEmail ||
        person.personalEmail ||
        person.hasPersonalEmail,
      ),
    };
  };

  const linkOrganization = (index: number, organization: Organization) => {
    const personId = rows[index].directoryResourcePersonId;
    const person = personId ? directoryPeople.find((item) => item.id === personId) : undefined;
    update(index, {
      directoryOrganizationId: organization.id,
      organizationName: organization.name,
      organizationId: findMasterOrganization(organization.name)?.id ?? null,
      city: organization.city || '',
      // A linked person's designation follows the post at the new organization; one with
      // no post there could not be picked for it, so they are cleared from the row.
      ...(person
        ? worksAt(person, organization)
          ? personDetails(person, organization)
          : NO_PERSON
        : {}),
    });
  };

  const typeOrganization = (index: number, text: string) => {
    const match = findMasterOrganization(text);
    // Typing over a picked organization drops its city with it, so the row never keeps
    // the previous organization's city.
    const city = rows[index].directoryOrganizationId ? '' : rows[index].city;
    update(index, {
      organizationName: text,
      directoryOrganizationId: null,
      organizationId: match?.id ?? null,
      city: match?.city && !city ? match.city : city,
    });
  };

  const pickOrganization = (index: number, option: { value: string }) => {
    const organization = directoryOrganizations.find((item) => String(item.id) === option.value);
    if (organization) linkOrganization(index, organization);
  };

  // Leaving the field links a name typed in full, preferring an Approved entry, and
  // otherwise settles it on the finance master's spelling.
  const settleOrganization = (index: number) => {
    const row = rows[index];
    if (row.directoryOrganizationId || !row.organizationName.trim()) return;
    const matches = directoryOrganizations.filter((organization) =>
      sameName(organization.name, row.organizationName),
    );
    const match =
      matches.find((organization) => organization.approvalStatus === 'Approved') ?? matches[0];
    if (match) {
      linkOrganization(index, match);
      return;
    }
    const master = findMasterOrganization(row.organizationName);
    if (master && master.name !== row.organizationName)
      update(index, { organizationName: master.name, organizationId: master.id });
  };

  const linkPerson = (index: number, person: ResourcePerson) =>
    update(index, {
      directoryResourcePersonId: person.id,
      ...personDetails(person, linkedOrganization(rows[index]) ?? null),
    });

  // Typing over a picked person unlinks them and drops their designation, so the row
  // never pairs one person's post with another's name. The email was never held.
  const typeName = (index: number, text: string) =>
    update(index, {
      contactName: text,
      directoryResourcePersonId: null,
      contactEmailOnFile: false,
      ...(rows[index].directoryResourcePersonId ? { contactDesignation: '' } : {}),
    });

  const pickPerson = (index: number, option: { value: string }) => {
    const person = directoryPeople.find((item) => String(item.id) === option.value);
    if (person) linkPerson(index, person);
  };

  // A name typed in full is linked only when exactly one person has it.
  const settleName = (index: number) => {
    const row = rows[index];
    if (row.directoryResourcePersonId || !row.contactName.trim()) return;
    const matches = peopleFor(row).filter((person) => sameName(person.name, row.contactName));
    if (matches.length === 1) linkPerson(index, matches[0]);
  };

  const roleOptions = useMemo(
    () => COLLABORATOR_ROLES.map((role) => ({ value: role, label: role })),
    [],
  );

  const update = (index: number, changes: Partial<CollaboratorRow>) =>
    patch({ collaborators: replaceAt(rows, index, changes) });

  const addingIndex = adding ? rows.findIndex((row) => row.key === adding.rowKey) : -1;
  const addingRow = addingIndex >= 0 ? rows[addingIndex] : undefined;

  const openAdding = (kind: 'organization' | 'person', row: CollaboratorRow) => {
    setAddError(null);
    setAdding({ kind, rowKey: row.key });
  };

  const closeAdding = () => {
    setAdding(null);
    setAddError(null);
  };

  const saveOrganization = async (organizationData: Omit<Organization, 'id' | 'date'>) => {
    setAddError(null);
    try {
      const created = await projectsApi.createDirectoryOrganization(organizationData);
      setDirectory((prev) => ({ ...prev, organizations: [created, ...prev.organizations] }));
      if (addingIndex >= 0) linkOrganization(addingIndex, created);
      closeAdding();
    } catch (error: any) {
      setAddError(error?.message || 'The organization could not be added to the directory.');
    }
  };

  const savePerson = async (personData: Omit<ResourcePerson, 'id' | 'date'>) => {
    setAddError(null);
    try {
      const created = await projectsApi.createDirectoryPerson(personData);
      setDirectory((prev) => ({ ...prev, people: [created, ...prev.people] }));
      const organization = addingRow ? linkedOrganization(addingRow) : undefined;
      // Linked only where they could have been picked: a post moved to another
      // organization in the form leaves them in the directory but off this row.
      if (addingIndex >= 0 && (!organization || worksAt(created, organization)))
        linkPerson(addingIndex, created);
      closeAdding();
    } catch (error: any) {
      setAddError(error?.message || 'The person could not be added to the directory.');
    }
  };

  const addErrorFooter = addError ? (
    <div className="alert alert-danger mb-0 w-100" role="alert">
      {addError}
    </div>
  ) : undefined;

  return (
    <SectionCard
      title="Collaborator(s)"
      error={errors.collaborators}
      toggle={{
        checked: form.collaboratorsEnabled,
        onChange: (checked) => patch({ collaboratorsEnabled: checked }),
        label: 'Enable collaborators',
        disabled,
      }}
    >
      {directoryError && <p className="pf-field__error">{directoryError}</p>}
      <div className="pf-rows">
        {rows.map((row, index) => (
          <div className="pf-collaborator" key={row.key}>
            <div className="pf-collaborator__main">
              <div className="pf-inline-field pf-collaborator__category">
                <span className="pf-inline-field__label">Category</span>
                <SelectField
                  value={row.category}
                  onChange={(value) => update(index, { category: value })}
                  options={COLLABORATOR_CATEGORIES.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                  disabled={disabled}
                  ariaLabel="Collaborator category"
                />
              </div>

              <div className="pf-inline-field pf-collaborator__role">
                <span className="pf-inline-field__label">Role</span>
                <TagSelectField
                  singleLine
                  // A role typed in before the list existed is kept selectable,
                  // so editing anything else on the row does not drop it.
                  options={withStoredRoles(roleOptions, row.roles)}
                  value={row.roles}
                  onChange={(values) => update(index, { roles: values })}
                  placeholder="Select role(s)"
                  disabled={disabled}
                  emptyMessage="No matches"
                />
              </div>

              <div className="pf-collaborator__line">
                <div className="pf-inline-field pf-collaborator__org">
                  <span className="pf-inline-field__label">Organization</span>
                  <SuggestInput
                    value={row.organizationName}
                    onChange={(text) => typeOrganization(index, text)}
                    onPick={(option) => pickOrganization(index, option)}
                    onBlur={() => settleOrganization(index)}
                    suggestions={organizationSuggestions}
                    placeholder="Type or pick an organization"
                    disabled={disabled}
                    action={
                      canAddToDirectory
                        ? {
                            label: 'Add an organization to the directory',
                            onSelect: () => openAdding('organization', row),
                          }
                        : undefined
                    }
                    invalid={Boolean(errors[`collaborators[${index}].organization`])}
                    maxLength={255}
                    ariaLabel="Collaborating organization"
                  />
                </div>

                <div className="pf-inline-field pf-collaborator__city">
                  <span className="pf-inline-field__label">City</span>
                  <input
                    type="text"
                    className="pf-input"
                    value={row.city}
                    onChange={(event) => update(index, { city: event.target.value })}
                    // From the Organization directory once one is picked; edited there.
                    disabled={disabled || Boolean(row.directoryOrganizationId)}
                    aria-label="City"
                  />
                </div>

                <div className="pf-inline-field pf-inline-field--tight pf-collaborator__mou">
                  <span className="pf-inline-field__label">Active MoU</span>
                  <YesNoSwitch
                    name={`mou-${row.key}`}
                    value={row.hasActiveMou}
                    onChange={(value) => update(index, { hasActiveMou: value })}
                    disabled={disabled}
                    label="Active MoU"
                  />
                </div>
              </div>

              <RowActions
                itemLabel="collaborator"
                onAdd={() => patch({ collaborators: [...rows, createCollaboratorRow()] })}
                showAdd={index === rows.length - 1}
                addDisabled={rows.length >= MAX_COLLABORATORS}
                onRemove={() => patch({ collaborators: removeAt(rows, index) })}
                canRemove={rows.length > 1}
                disabled={disabled}
              />
            </div>

            <div className="pf-collaborator__contact">
              <div className="pf-inline-field pf-inline-field--grow pf-inline-field--wide">
                <span className="pf-inline-field__label pf-inline-field__label--accent">Name</span>
                <SuggestInput
                  value={row.contactName}
                  onChange={(text) => typeName(index, text)}
                  onPick={(option) => pickPerson(index, option)}
                  onBlur={() => settleName(index)}
                  suggestions={peopleSuggestions(row)}
                  placeholder="Type or pick a person"
                  disabled={disabled}
                  action={
                    canAddToDirectory
                      ? {
                          label: 'Add a person to the directory',
                          onSelect: () => openAdding('person', row),
                        }
                      : undefined
                  }
                  invalid={Boolean(errors[`collaborators[${index}].contact_name`])}
                  maxLength={255}
                  ariaLabel="Contact name"
                />
              </div>

              <div className="pf-inline-field">
                <span className="pf-inline-field__label pf-inline-field__label--accent">
                  Designation
                </span>
                <input
                  type="text"
                  className="pf-input"
                  value={row.contactDesignation}
                  onChange={(event) => update(index, { contactDesignation: event.target.value })}
                  // From the person's post in the directory once they are picked.
                  disabled={disabled || Boolean(row.directoryResourcePersonId)}
                  aria-label="Contact designation"
                />
              </div>

              <div className="pf-inline-field pf-inline-field--email">
                <span className="pf-inline-field__label pf-inline-field__label--accent">Email</span>
                {row.directoryResourcePersonId ? (
                  // The directory keeps a person's email private to whoever added them, so a
                  // linked row shows only whether there is one.
                  <input
                    type="text"
                    className="pf-input"
                    value={row.contactEmailOnFile ? EMAIL_ON_FILE_MASK : ''}
                    placeholder="None in the directory"
                    title={
                      row.contactEmailOnFile
                        ? 'In the People directory, visible only to whoever added them'
                        : undefined
                    }
                    disabled
                    aria-label={
                      row.contactEmailOnFile
                        ? 'Contact email: kept private in the directory'
                        : 'Contact email: none in the directory'
                    }
                  />
                ) : (
                  <input
                    type="email"
                    className={`pf-input ${errors[`collaborators[${index}].contact_email`] ? 'is-invalid' : ''}`.trim()}
                    value={row.contactEmail}
                    onChange={(event) => update(index, { contactEmail: event.target.value })}
                    disabled={disabled}
                    aria-label="Contact email"
                  />
                )}
              </div>
            </div>

            {['organization', 'contact_name', 'contact_email']
              .map((key) => errors[`collaborators[${index}].${key}`])
              .filter(Boolean)
              .map((message) => (
                <p key={message} className="pf-field__error">
                  {message}
                </p>
              ))}
          </div>
        ))}
      </div>

      <CustomModal
        show={adding?.kind === 'organization'}
        onHide={closeAdding}
        title="Add Organization"
        size="xl"
        scrollable
        className="pf-directory-modal"
        // In the footer so a save failure stays visible however far the form is scrolled.
        footer={addErrorFooter}
      >
        <OrganizationDirectory editingOrg={null} onSave={saveOrganization} onCancel={closeAdding} />
      </CustomModal>

      <CustomModal
        show={adding?.kind === 'person'}
        onHide={closeAdding}
        title="Add Person"
        size="xl"
        scrollable
        className="pf-directory-modal"
        footer={addErrorFooter}
      >
        {adding?.kind === 'person' && (
          <ResourcePersonDirectory
            editingPerson={null}
            organizations={directoryOrganizations}
            // Their first post starts at the row's organization, so they are listed under it.
            initialOrganization={addingRow ? linkedOrganization(addingRow) : null}
            onSave={savePerson}
            onCancel={closeAdding}
          />
        )}
      </CustomModal>
    </SectionCard>
  );
};

export default CollaboratorsSection;
