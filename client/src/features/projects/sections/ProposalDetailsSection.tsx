import React, { useMemo } from 'react';

import { Field } from '../components/FormFields';
import SectionCard from '../components/SectionCard';
import TagSelectField from '../components/TagSelectField';
import { NATIONAL_INITIATIVES, SUSTAINABLE_DEVELOPMENT_GOALS } from '../constants';

import type { ProjectFormState } from '../types';

interface ProposalDetailsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

const ProposalDetailsSection: React.FC<ProposalDetailsSectionProps> = ({
  form,
  patch,
  errors,
  disabled,
}) => {
  const initiativeOptions = useMemo(() => toOptions(NATIONAL_INITIATIVES), []);
  const sdgOptions = useMemo(() => toOptions(SUSTAINABLE_DEVELOPMENT_GOALS), []);

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

      <div className="pf-grid pf-grid--budget">
        <Field label="Budget" htmlFor="pf-project-cost" error={errors.project_cost}>
          <input
            id="pf-project-cost"
            type="text"
            inputMode="decimal"
            className={`pf-input ${errors.project_cost ? 'is-invalid' : ''}`.trim()}
            placeholder="Enter Project Cost"
            value={form.projectCost}
            onChange={(event) => patch({ projectCost: event.target.value })}
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
                { key: 'durationYears', placeholder: 'Years', max: 50 },
                { key: 'durationMonths', placeholder: 'Months', max: 11 },
                { key: 'durationDays', placeholder: 'Days', max: 30 },
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
                onChange={(event) => patch({ [part.key]: event.target.value })}
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
