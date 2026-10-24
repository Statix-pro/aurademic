import React from 'react';

import SectionCard from '../components/SectionCard';
import { PROJECT_INCOME_HEADS } from '../constants';

interface IncomeHeadsSectionProps {
  /** The heads currently ticked, as `PROJECT_INCOME_HEADS` names. */
  value: string[];
  onChange: (heads: string[]) => void;
  disabled: boolean;
}

/**
 * Which of the four income heads apply to this project.
 *
 * The income side of the ledger used to be a fixed schedule every project
 * carried: four heads offered in the ledger's picker and four 0.00 rows in the
 * Transaction Summary, whether or not the project ever received under them. A
 * grant with no matching share has no HI Contribution and an account that earns
 * nothing has no Bank Interest, so which of them apply is a property of the
 * project and is stated here.
 *
 * It sits on the Budget tab, above the allotment matrix, because it is the same
 * kind of declaration: the matrix says which heads the project spends under,
 * this says which it receives under.
 *
 * Un-ticking a head only stops it being *offered*. A ledger row already filed
 * under it keeps it, still counts toward Actuals, and is still listed in the
 * summary — see `buildTransactionSummary`, which lists a recorded head whether
 * or not it was ticked. Nothing a user has entered disappears from a tick.
 */
const IncomeHeadsSection: React.FC<IncomeHeadsSectionProps> = ({ value, onChange, disabled }) => {
  const selected = new Set(value);

  const toggle = (name: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(name);
    else next.delete(name);

    // Kept in the card's own order rather than click order, so the ledger's
    // picker and the summary read the same way on every project — which is the
    // order the server stores them in too.
    onChange(PROJECT_INCOME_HEADS.filter((head) => next.has(head)));
  };

  return (
    <SectionCard
      title="Income Heads"
      info="Tick the heads this project receives under. Only these are offered under Finance → Transaction."
    >
      <div className="pf-income-heads">
        {PROJECT_INCOME_HEADS.map((name) => (
          <label className="pf-income-heads__option" key={name}>
            <input
              type="checkbox"
              className="pf-checkbox"
              checked={selected.has(name)}
              onChange={(event) => toggle(name, event.target.checked)}
              disabled={disabled}
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </SectionCard>
  );
};

export default IncomeHeadsSection;
