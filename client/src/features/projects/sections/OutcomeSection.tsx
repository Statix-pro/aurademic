import React from 'react';

import SectionCard from '../components/SectionCard';
import { OUTCOME_FIELDS } from '../constants';

import type { OutcomeCounts, ProjectFormState } from '../types';

interface OutcomeSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  disabled: boolean;
}

/** Counts of what the project produced — one small number field per outcome. */
const OutcomeSection: React.FC<OutcomeSectionProps> = ({ form, patch, disabled }) => (
  <SectionCard title="Outcome" inline>
    <div className="pf-outcome">
      {OUTCOME_FIELDS.map((field) => (
        <div className="pf-outcome__item" key={field.key}>
          <label className="pf-inline-field__label" htmlFor={`pf-outcome-${field.key}`}>
            {field.label}
          </label>
          <input
            id={`pf-outcome-${field.key}`}
            type="number"
            min={0}
            className="pf-input pf-input--count"
            value={form.outcome[field.key as keyof OutcomeCounts]}
            onChange={(event) =>
              patch({ outcome: { ...form.outcome, [field.key]: event.target.value } })
            }
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  </SectionCard>
);

export default OutcomeSection;
