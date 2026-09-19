import React from 'react';

import { SelectField } from '../components/FormFields';
import SectionCard from '../components/SectionCard';
import { PROJECT_STATUS_OPTIONS } from '../constants';

import type { ProjectFormState, ProjectStatus } from '../types';

interface ProjectStatusSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const ProjectStatusSection: React.FC<ProjectStatusSectionProps> = ({
  form,
  patch,
  errors,
  disabled,
}) => (
  <SectionCard title="Project Status" inline error={errors.project_closing_date}>
    <div className="pf-inline-grid">
      <div className="pf-inline-field">
        <label className="pf-inline-field__label" htmlFor="pf-start-date">
          Project Start Date
        </label>
        <input
          id="pf-start-date"
          type="date"
          className={`pf-input ${errors.project_start_date ? 'is-invalid' : ''}`.trim()}
          value={form.projectStartDate}
          onChange={(event) => patch({ projectStartDate: event.target.value })}
          disabled={disabled}
        />
      </div>

      <div className="pf-inline-field">
        <label className="pf-inline-field__label" htmlFor="pf-closing-date">
          Closing Date
        </label>
        <input
          id="pf-closing-date"
          type="date"
          className={`pf-input ${errors.project_closing_date ? 'is-invalid' : ''}`.trim()}
          value={form.projectClosingDate}
          min={form.projectStartDate || undefined}
          onChange={(event) => patch({ projectClosingDate: event.target.value })}
          disabled={disabled}
        />
      </div>

      <div className="pf-inline-field pf-inline-field--grow">
        <label className="pf-inline-field__label" htmlFor="pf-project-status">
          Status
        </label>
        <SelectField
          id="pf-project-status"
          value={form.projectStatus}
          onChange={(value) => patch({ projectStatus: value as ProjectStatus })}
          options={PROJECT_STATUS_OPTIONS}
          disabled={disabled}
          invalid={Boolean(errors.project_status)}
        />
      </div>
    </div>
  </SectionCard>
);

export default ProjectStatusSection;
