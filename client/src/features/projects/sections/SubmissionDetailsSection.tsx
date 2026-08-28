import React from 'react';

import { SelectField } from '../components/FormFields';
import SectionCard from '../components/SectionCard';
import YesNoSwitch from '../components/YesNoSwitch';
import { PROPOSAL_STATUS_OPTIONS, SUBMISSION_MODE_OPTIONS } from '../constants';

import type { ProjectFormState, ProposalStatus } from '../types';

interface SubmissionDetailsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const SubmissionDetailsSection: React.FC<SubmissionDetailsSectionProps> = ({
  form,
  patch,
  errors,
  disabled,
}) => (
  <SectionCard title="Submission Details">
    <div className="pf-inline-grid">
      <div className="pf-inline-field">
        <label className="pf-inline-field__label" htmlFor="pf-submitted-on">
          Submitted on
        </label>
        <input
          id="pf-submitted-on"
          type="date"
          className={`pf-input ${errors.submitted_on ? 'is-invalid' : ''}`.trim()}
          value={form.submittedOn}
          onChange={(event) => patch({ submittedOn: event.target.value })}
          disabled={disabled}
        />
      </div>

      <div className="pf-inline-field">
        <label className="pf-inline-field__label" htmlFor="pf-submission-mode">
          Mode of Submission
        </label>
        <SelectField
          id="pf-submission-mode"
          value={form.submissionMode}
          onChange={(value) => patch({ submissionMode: value })}
          options={SUBMISSION_MODE_OPTIONS}
          placeholder="Select"
          disabled={disabled}
        />
      </div>

      <div className="pf-inline-field pf-inline-field--grow">
        <label className="pf-inline-field__label" htmlFor="pf-reference-number">
          Reference Number
        </label>
        <input
          id="pf-reference-number"
          type="text"
          className="pf-input"
          value={form.referenceNumber}
          onChange={(event) => patch({ referenceNumber: event.target.value })}
          disabled={disabled}
        />
      </div>
    </div>

    <div className="pf-inline-grid">
      <div className="pf-inline-field pf-inline-field--tight">
        <span className="pf-inline-field__label">Submission of full proposal copy to CFRD</span>
        <YesNoSwitch
          name="cfrdCopySubmitted"
          value={form.cfrdCopySubmitted}
          onChange={(value) =>
            patch({
              cfrdCopySubmitted: value,
              // "No" cannot carry a handover date.
              cfrdCopySubmittedOn: value ? form.cfrdCopySubmittedOn : '',
            })
          }
          disabled={disabled}
          label="Submission of full proposal copy to CFRD"
        />
      </div>

      <div className="pf-inline-field">
        <label className="pf-inline-field__label" htmlFor="pf-cfrd-date">
          Date
        </label>
        <input
          id="pf-cfrd-date"
          type="date"
          className={`pf-input ${errors.cfrd_copy_submitted_on ? 'is-invalid' : ''}`.trim()}
          value={form.cfrdCopySubmittedOn}
          onChange={(event) => patch({ cfrdCopySubmittedOn: event.target.value })}
          disabled={disabled || !form.cfrdCopySubmitted}
        />
      </div>

      <div className="pf-inline-field pf-inline-field--grow">
        <label className="pf-inline-field__label" htmlFor="pf-proposal-status">
          Status
        </label>
        <SelectField
          id="pf-proposal-status"
          value={form.proposalStatus}
          onChange={(value) => patch({ proposalStatus: value as ProposalStatus })}
          options={PROPOSAL_STATUS_OPTIONS}
          placeholder="Select"
          disabled={disabled}
          invalid={Boolean(errors.proposal_status)}
        />
      </div>
    </div>
  </SectionCard>
);

export default SubmissionDetailsSection;
