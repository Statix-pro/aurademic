import { ArrowRightLeft, Lightbulb, Newspaper, Users } from 'lucide-react';
import React from 'react';

import SectionCard from '../components/SectionCard';
import { OUTCOME_FIELDS } from '../constants';

import type { OutcomeCounts, ProjectFormState } from '../types';

interface OutcomeSummarySectionProps {
  form: ProjectFormState;
}

/**
 * How many rows on each table below are filled in — the same test the save
 * uses to drop a blank row, so a card never counts a row that will not be kept.
 */
export function countOutcomes(form: ProjectFormState) {
  return {
    publications: form.publications.filter((row) => row.doi.trim() || row.title.trim()).length,
    iprs: form.iprs.filter((row) => row.iprNumber.trim() || row.title.trim()).length,
    techTransfers: form.techTransfers.filter((row) => row.category).length,
    candidates: form.outcomeCandidates.filter((row) => row.candidateName.trim()).length,
  };
}

/**
 * The four cards at the top of the Outcomes tab. Nothing here is an input:
 * each figure is read from the table beneath it.
 */
const OutcomeSummarySection: React.FC<OutcomeSummarySectionProps> = ({ form }) => {
  const counts = countOutcomes(form);
  const cards = [
    { label: 'Publications', value: counts.publications, Icon: Newspaper },
    { label: 'IPR', value: counts.iprs, Icon: Lightbulb },
    { label: 'Tech Transfer', value: counts.techTransfers, Icon: ArrowRightLeft },
    { label: 'Manpower', value: counts.candidates, Icon: Users },
  ];

  // LEGACY: counts typed on the old Outcome card, before these tables existed.
  // Shown so an older project's figures stay visible; nothing edits or saves
  // them. Remove once no project carries a non-zero count.
  const legacyCounts = OUTCOME_FIELDS.map((field) => ({
    label: field.label,
    value: Number(form.outcome[field.key as keyof OutcomeCounts] || 0),
  })).filter((field) => field.value > 0);

  return (
    <SectionCard title="Outcomes">
      <div className="pf-outcome-cards">
        {cards.map(({ label, value, Icon }) => (
          <div className="pf-outcome-card" key={label}>
            <span className="pf-outcome-card__icon" aria-hidden="true">
              <Icon size={30} />
            </span>
            <div>
              <span className="pf-outcome-card__label">{label}</span>
              <span className="pf-outcome-card__value">{value}</span>
            </div>
          </div>
        ))}
      </div>

      {legacyCounts.length > 0 && (
        <p className="pf-outcome-legacy">
          Counts recorded before this tab existed:{' '}
          {legacyCounts.map((field) => `${field.label} ${field.value}`).join(' · ')}. Add the items
          to the tables below to replace them.
        </p>
      )}
    </SectionCard>
  );
};

export default OutcomeSummarySection;
