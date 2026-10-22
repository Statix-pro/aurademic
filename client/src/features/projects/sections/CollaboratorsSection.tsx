import React, { useMemo } from 'react';

import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import TagSelectField from '../components/TagSelectField';
import YesNoSwitch from '../components/YesNoSwitch';
import { COLLABORATOR_CATEGORIES, COLLABORATOR_ROLES, MAX_COLLABORATORS } from '../constants';
import { createCollaboratorRow, removeAt, replaceAt } from '../projectFormState';
import { withSelectedOption } from '../selectOptions';

import type { CollaboratorRow, ProjectFormState, ProjectOrganization } from '../types';

/**
 * LEGACY: collaborators saved while the organization was typed (development builds of
 * 2026-10, before it became a master-list pick) carry `organization_name` with no
 * `organization_id`. Their name is offered under this value so it still shows, and saving
 * the row unchanged keeps it. Remove once no project_collaborators row has a name without
 * an id.
 */
const LEGACY_ORGANIZATION_PREFIX = 'legacy-org::';

const organizationValue = (row: CollaboratorRow): string => {
  if (row.organizationId) return String(row.organizationId);
  return row.organizationName ? `${LEGACY_ORGANIZATION_PREFIX}${row.organizationName}` : '';
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

  // Picked from the organization master, never typed: the finance tables offer a
  // collaborator as a party by its organization id (`financeOrganizations`), and free
  // text let one institution be saved as several spellings. A missing organization is
  // requested through Add Scheme and appears here once an admin approves it.
  const organizationOptions = useMemo(
    () =>
      organizations
        .filter((organization) => organization.is_internal !== 1)
        .map((organization) => ({ value: String(organization.id), label: organization.name })),
    [organizations],
  );

  const selectOrganization = (index: number, value: string) => {
    // LEGACY: re-picking a typed name changes nothing; see LEGACY_ORGANIZATION_PREFIX.
    if (value.startsWith(LEGACY_ORGANIZATION_PREFIX)) return;

    const organization = organizations.find((item) => String(item.id) === value);

    update(index, {
      organizationId: organization?.id ?? null,
      organizationName: organization?.name ?? '',
      // The master list knows where the organization is, so the city follows
      // the pick unless the user has already typed one.
      city: organization?.city && !rows[index].city ? organization.city : rows[index].city,
    });
  };

  const roleOptions = useMemo(
    () => COLLABORATOR_ROLES.map((role) => ({ value: role, label: role })),
    [],
  );

  const update = (index: number, changes: Partial<CollaboratorRow>) =>
    patch({ collaborators: replaceAt(rows, index, changes) });

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
                  <SelectField
                    value={organizationValue(row)}
                    onChange={(value) => selectOrganization(index, value)}
                    options={withSelectedOption(
                      organizationOptions,
                      organizationValue(row),
                      row.organizationName,
                    )}
                    disabled={disabled}
                    invalid={Boolean(errors[`collaborators[${index}].organization`])}
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
                    disabled={disabled}
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
                <input
                  type="text"
                  className="pf-input"
                  value={row.contactName}
                  onChange={(event) => update(index, { contactName: event.target.value })}
                  disabled={disabled}
                  aria-label="Contact name"
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
                  disabled={disabled}
                  aria-label="Contact designation"
                />
              </div>

              <div className="pf-inline-field pf-inline-field--email">
                <span className="pf-inline-field__label pf-inline-field__label--accent">Email</span>
                <input
                  type="email"
                  className={`pf-input ${errors[`collaborators[${index}].contact_email`] ? 'is-invalid' : ''}`.trim()}
                  value={row.contactEmail}
                  onChange={(event) => update(index, { contactEmail: event.target.value })}
                  disabled={disabled}
                  aria-label="Contact email"
                />
              </div>
            </div>

            {errors[`collaborators[${index}].contact_email`] && (
              <p className="pf-field__error">{errors[`collaborators[${index}].contact_email`]}</p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export default CollaboratorsSection;
