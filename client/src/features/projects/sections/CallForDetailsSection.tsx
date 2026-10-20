import { ExternalLink, Plus } from 'lucide-react';
import React, { useMemo } from 'react';

import { Field, ReadOnlyValue, SelectField } from '../components/FormFields';
import SectionCard from '../components/SectionCard';
import {
  FUNDING_SOURCE_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  projectTypeRules,
  safeExternalUrl,
} from '../constants';
import { withSelectedOption } from '../selectOptions';

import type { ProjectFormState, ProjectOrganization, ProjectScheme } from '../types';

interface CallForDetailsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  organizations: ProjectOrganization[];
  schemes: ProjectScheme[];
  errors: Record<string, string>;
  disabled: boolean;
  onRequestOption: () => void;
}

/**
 * Funding agency and scheme, plus the scheme's own metadata. Domain, category
 * and website are read-only because they belong to the scheme in the master
 * list, not to this project.
 */
const CallForDetailsSection: React.FC<CallForDetailsSectionProps> = ({
  form,
  patch,
  organizations,
  schemes,
  errors,
  disabled,
  onRequestOption,
}) => {
  const selectedAgencyValue = form.fundingOrganizationId ? String(form.fundingOrganizationId) : '';
  const selectedSchemeValue = form.schemeId ? String(form.schemeId) : '';

  const agencyOptions = useMemo(
    () =>
      withSelectedOption(
        organizations
          .filter((organization) => organization.is_funding_agency !== 0)
          .map((organization) => ({
            value: String(organization.id),
            label: organization.short_name
              ? `${organization.name} (${organization.short_name})`
              : organization.name,
          })),
        selectedAgencyValue,
        form.fundingOrganizationName,
      ),
    [organizations, selectedAgencyValue, form.fundingOrganizationName],
  );

  const schemeOptions = useMemo(
    () =>
      withSelectedOption(
        schemes
          // Only this agency's schemes for this kind of grant: a scheme's
          // category comes from its type's list, and the save refuses one of
          // another type.
          .filter(
            (scheme) =>
              scheme.organization_id === form.fundingOrganizationId &&
              scheme.project_type === form.projectType,
          )
          .map((scheme) => ({ value: String(scheme.id), label: scheme.name })),
        selectedSchemeValue,
        form.schemeName,
      ),
    [schemes, form.fundingOrganizationId, form.projectType, selectedSchemeValue, form.schemeName],
  );

  const projectTypeLabel =
    PROJECT_TYPE_OPTIONS.find((option) => option.value === form.projectType)?.label ?? 'project';

  const selectedScheme = schemes.find((scheme) => scheme.id === form.schemeId) ?? null;
  // Shown as typed, but only linked when it is a real http(s) address.
  const website = selectedScheme?.website ?? null;
  const websiteLink = safeExternalUrl(website);

  return (
    <SectionCard
      title="Call for Details"
      className="pf-card--call"
      headerRight={
        <button
          type="button"
          className="pf-btn pf-btn--primary pf-btn--sm"
          onClick={onRequestOption}
          disabled={disabled}
        >
          <Plus size={14} aria-hidden="true" />
          Add Scheme
        </button>
      }
    >
      <Field
        label="Funding Agency"
        htmlFor="pf-funding-agency"
        error={errors.funding_organization_id}
      >
        <SelectField
          id="pf-funding-agency"
          value={selectedAgencyValue}
          onChange={(value) =>
            patch({
              fundingOrganizationId: value ? Number(value) : null,
              fundingOrganizationName:
                organizations.find((organization) => String(organization.id) === value)?.name ?? '',
              // The scheme list depends on the agency, so a change clears it.
              schemeId: null,
              schemeName: '',
            })
          }
          options={agencyOptions}
          disabled={disabled}
          invalid={Boolean(errors.funding_organization_id)}
        />
      </Field>

      <Field label="Funding Source" htmlFor="pf-funding-source" error={errors.funding_source}>
        <SelectField
          id="pf-funding-source"
          value={form.fundingSource}
          onChange={(fundingSource) => patch({ fundingSource })}
          options={FUNDING_SOURCE_OPTIONS}
          placeholder="Select Source"
          disabled={disabled}
          invalid={Boolean(errors.funding_source)}
        />
      </Field>

      <Field
        label="Scheme"
        htmlFor="pf-scheme"
        error={errors.scheme_id}
        hint={
          form.fundingOrganizationId && schemeOptions.length === 0
            ? `No ${projectTypeLabel} schemes listed for this agency yet — use Add Scheme to request one.`
            : undefined
        }
      >
        <SelectField
          id="pf-scheme"
          value={selectedSchemeValue}
          onChange={(value) =>
            patch({
              schemeId: value ? Number(value) : null,
              schemeName: schemes.find((scheme) => String(scheme.id) === value)?.name ?? '',
            })
          }
          options={schemeOptions}
          disabled={disabled || !form.fundingOrganizationId}
          invalid={Boolean(errors.scheme_id)}
        />
      </Field>

      {/* A travel grant scheme has no domain. */}
      {projectTypeRules(form.projectType).schemeHasDomain && (
        <Field label="Domain">
          <ReadOnlyValue value={selectedScheme?.domain} />
        </Field>
      )}

      <div className="pf-grid pf-grid--two">
        <Field label="Category">
          <ReadOnlyValue value={selectedScheme?.category} />
        </Field>

        <Field label="Website">
          <div className="pf-website">
            <ReadOnlyValue value={website} />
            <a
              className={`pf-icon-btn pf-icon-btn--ghost ${websiteLink ? '' : 'is-disabled'}`.trim()}
              href={websiteLink ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the scheme website"
              title={
                websiteLink
                  ? 'Open the scheme website'
                  : website
                    ? 'The recorded website is not a valid web address'
                    : 'No website recorded for this scheme'
              }
              onClick={(event) => {
                if (!websiteLink) event.preventDefault();
              }}
            >
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        </Field>
      </div>
    </SectionCard>
  );
};

export default CallForDetailsSection;
