import React from 'react';

import { SelectField } from '../components/FormFields';
import SectionCard from '../components/SectionCard';
import { FINAL_RESULT_OPTIONS, RESULT_MODE_OPTIONS } from '../constants';

import type { FinalResult, ProjectFormState } from '../types';

interface ResultAnnouncementSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const ResultAnnouncementSection: React.FC<ResultAnnouncementSectionProps> = ({
  form,
  patch,
  errors,
  disabled,
}) => (
  <SectionCard title="Result Announcement" inline>
    <div className="pf-inline-grid">
      <div className="pf-inline-field">
        <label className="pf-inline-field__label" htmlFor="pf-result-mode">
          Mode
        </label>
        <SelectField
          id="pf-result-mode"
          value={form.resultMode}
          onChange={(value) => patch({ resultMode: value })}
          options={RESULT_MODE_OPTIONS}
          placeholder="Select"
          disabled={disabled}
        />
      </div>

      <div className="pf-inline-field">
        <label className="pf-inline-field__label" htmlFor="pf-result-date">
          Date
        </label>
        <input
          id="pf-result-date"
          type="date"
          className={`pf-input ${errors.result_date ? 'is-invalid' : ''}`.trim()}
          value={form.resultDate}
          onChange={(event) => patch({ resultDate: event.target.value })}
          disabled={disabled}
        />
      </div>

      <div className="pf-inline-field pf-inline-field--grow">
        <label className="pf-inline-field__label" htmlFor="pf-final-result">
          Final Result
        </label>
        <SelectField
          id="pf-final-result"
          value={form.finalResult}
          onChange={(value) => patch({ finalResult: value as FinalResult })}
          options={FINAL_RESULT_OPTIONS}
          placeholder="Select"
          disabled={disabled}
          invalid={Boolean(errors.final_result)}
        />
      </div>
    </div>
  </SectionCard>
);

export default ResultAnnouncementSection;
