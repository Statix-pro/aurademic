import React, { useMemo } from 'react';

import { AmountInput, Field, SelectField } from '../components/FormFields';
import SectionCard from '../components/SectionCard';
import TagSelectField from '../components/TagSelectField';
import {
  LEVEL_OPTIONS,
  RESEARCH_TYPE_OPTIONS,
  SUSTAINABLE_DEVELOPMENT_GOALS,
  projectTypeRules,
} from '../constants';
import { vocabularyOptions } from '../selectOptions';

import type { ProjectFormState, VocabularyEntry } from '../types';

interface ProposalDetailsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  /** The admin-curated lists; National Initiatives is read from them. */
  vocabulary: VocabularyEntry[];
  errors: Record<string, string>;
  disabled: boolean;
}

const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

const ProposalDetailsSection: React.FC<ProposalDetailsSectionProps> = ({
  form,
  patch,
  vocabulary,
  errors,
  disabled,
}) => {
  // An initiative the admin has since retired stays on the project as a chip:
  // TagSelectField shows a value that is no longer offered.
  const initiativeOptions = useMemo(
    () => vocabularyOptions(vocabulary, 'national_initiative'),
    [vocabulary],
  );
  const sdgOptions = useMemo(() => toOptions(SUSTAINABLE_DEVELOPMENT_GOALS), []);
  // The type itself is not asked here: it is picked in the dialog the Projects
  // page's Add opens, and decides which of these fields the form shows.
  const rules = projectTypeRules(form.projectType);

  return (
    <SectionCard title="Proposal Details" className="pf-card--proposal">
      <Field label="Title" htmlFor="pf-title" error={errors.title}>
        <input
          id="pf-title"
          type="text"
          className={`pf-input ${errors.title ? 'is-invalid' : ''}`.trim()}
          placeholder="Enter Title"
          value={form.title}
          onChange={(event) => patch({ title: event.target.value })}
          disabled={disabled}
          maxLength={500}
        />
      </Field>

      {/* An Event or Fellowship is classed by level in the research type's
          place; a Travel Grant asks neither. */}
      {rules.asksResearchType && (
        <Field label="Research Type" htmlFor="pf-research-type" error={errors.research_type}>
          <SelectField
            id="pf-research-type"
            value={form.researchType}
            onChange={(researchType) => patch({ researchType })}
            options={RESEARCH_TYPE_OPTIONS}
            placeholder="Select Research Type"
            disabled={disabled}
            invalid={Boolean(errors.research_type)}
          />
        </Field>
      )}

      {rules.asksLevel && (
        <Field label="Level" htmlFor="pf-level" error={errors.level}>
          <SelectField
            id="pf-level"
            value={form.level}
            onChange={(level) => patch({ level })}
            options={LEVEL_OPTIONS}
            placeholder="Select Level"
            disabled={disabled}
            invalid={Boolean(errors.level)}
          />
        </Field>
      )}

      <div className="pf-grid pf-grid--budget">
        <Field label="Budget" htmlFor="pf-project-cost" error={errors.project_cost}>
          <AmountInput
            id="pf-project-cost"
            className={`pf-input ${errors.project_cost ? 'is-invalid' : ''}`.trim()}
            placeholder="Enter Project Cost"
            value={form.projectCost}
            onChange={(projectCost) => patch({ projectCost })}
            disabled={disabled}
          />
        </Field>

        <Field
          label="Duration"
          error={errors.duration_years || errors.duration_months || errors.duration_days}
        >
          <div className="pf-duration">
            {(
              [
                // The same caps the server enforces in `normalizeProjectPayload`.
                { key: 'durationYears', placeholder: 'Years', max: 10 },
                { key: 'durationMonths', placeholder: 'Months', max: 12 },
                { key: 'durationDays', placeholder: 'Days', max: 31 },
              ] as const
            ).map((part) => (
              <input
                key={part.key}
                type="number"
                min={0}
                max={part.max}
                className="pf-input pf-input--compact"
                placeholder={part.placeholder}
                value={form[part.key]}
                onChange={(event) => {
                  // `max` only bounds the spinner; a typed figure past the cap
                  // is refused here so it never reaches the save.
                  const { value } = event.target;
                  if (value !== '' && Number(value) > part.max) return;
                  patch({ [part.key]: value });
                }}
                disabled={disabled}
                aria-label={`Duration in ${part.placeholder.toLowerCase()}`}
              />
            ))}
          </div>
        </Field>
      </div>

      <Field label="National Initiatives" htmlFor="pf-initiatives">
        <TagSelectField
          id="pf-initiatives"
          options={initiativeOptions}
          value={form.nationalInitiatives}
          onChange={(values) => patch({ nationalInitiatives: values })}
          placeholder="Type to Search and Select National Initiatives"
          disabled={disabled}
        />
      </Field>

      <Field label="Sustainable Development Goals (SDGs)" htmlFor="pf-sdgs">
        <TagSelectField
          id="pf-sdgs"
          options={sdgOptions}
          value={form.sdgs}
          onChange={(values) => patch({ sdgs: values })}
          placeholder="Type to Search and Select SDG"
          disabled={disabled}
        />
      </Field>
    </SectionCard>
  );
};

export default ProposalDetailsSection;
