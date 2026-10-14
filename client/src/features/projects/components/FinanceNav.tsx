import { ArrowLeftRight, PieChart, Wallet } from 'lucide-react';
import React, { useMemo } from 'react';

import { FINANCE_SECTIONS } from '../constants';
import { buildTransactionSummary, formatBudgetTotal, toAmount } from '../projectBudgetSummary';

import type { FinanceSection } from '../constants';
import type { ProjectFormState } from '../types';

interface FinanceNavProps {
  form: ProjectFormState;
  active: FinanceSection;
  onSelect: (section: FinanceSection) => void;
}

const ICONS: Record<FinanceSection, typeof Wallet> = {
  budget: Wallet,
  transaction: ArrowLeftRight,
  summary: PieChart,
};

const rupees = (value: number | null) => `₹ ${formatBudgetTotal(value)}`;

/**
 * The Finance tab's sub-tabs: Budget, Transaction and Summary, each with the
 * one figure that says where it stands, so the strip doubles as an overview
 * and the user can see which part needs them before opening it.
 *
 * Every figure is derived from the form as it stands, the same way the
 * Summary's own table is, so it moves as the user types.
 */
const FinanceNav: React.FC<FinanceNavProps> = ({ form, active, onSelect }) => {
  const captions = useMemo(() => {
    const summary = buildTransactionSummary({
      budgetRows: form.budgetRows,
      budgetYears: form.budgetYears,
      budgetAllotments: form.budgetAllotments,
      incomeHeads: form.incomeHeads,
      accounts: form.transactionAccounts,
      financialYear: '',
    });

    // A row with neither a credit nor a debit is a line not filled in yet, and
    // the save drops it, so it is not counted as an entry.
    const entries = form.transactionAccounts.reduce(
      (count, account) =>
        count +
        account.transactions.filter((row) => toAmount(row.credit) > 0 || toAmount(row.debit) > 0)
          .length,
      0,
    );

    // Actuals can run below zero — a credit against an expenditure head is a
    // refund — so the caption uses the Summary's own word for the figure
    // rather than "spent".
    const { budget, actuals } = summary.expenditureTotal;

    return {
      budget: budget === null ? 'Nothing allotted yet' : `${rupees(budget)} allotted`,
      transaction:
        entries === 0
          ? 'No entries yet'
          : `${entries} ${entries === 1 ? 'entry' : 'entries'} · ${form.transactionAccounts.length} ${
              form.transactionAccounts.length === 1 ? 'account' : 'accounts'
            }`,
      summary:
        budget === null
          ? 'Budget against actuals'
          : `Actuals ${rupees(actuals)} of ${rupees(budget)}`,
    };
  }, [
    form.budgetRows,
    form.budgetYears,
    form.budgetAllotments,
    form.incomeHeads,
    form.transactionAccounts,
  ]);

  // Arrow, Home and End move between the sub-tabs, as on the tabs above.
  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>, fromIndex: number) => {
    const lastIndex = FINANCE_SECTIONS.length - 1;
    const nextIndex = {
      ArrowRight: fromIndex === lastIndex ? 0 : fromIndex + 1,
      ArrowLeft: fromIndex === 0 ? lastIndex : fromIndex - 1,
      Home: 0,
      End: lastIndex,
    }[event.key];

    if (nextIndex === undefined) return;

    event.preventDefault();
    onSelect(FINANCE_SECTIONS[nextIndex].id);
    const nextTab = event.currentTarget.parentElement?.children[nextIndex];
    if (nextTab instanceof HTMLElement) nextTab.focus();
  };

  return (
    <div className="pf-finance-nav" role="tablist" aria-label="Finance sections">
      {FINANCE_SECTIONS.map((section, index) => {
        const Icon = ICONS[section.id];
        const isActive = active === section.id;

        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`pf-finance-tab-${section.id}`}
            aria-selected={isActive}
            aria-controls={`pf-panel-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            className={`pf-finance-nav__item ${isActive ? 'is-active' : ''}`.trim()}
            onClick={() => onSelect(section.id)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            <span className="pf-finance-nav__icon" aria-hidden="true">
              <Icon size={15} />
            </span>
            <span className="pf-finance-nav__text">
              <span className="pf-finance-nav__label">{section.label}</span>
              <span className="pf-finance-nav__caption">{captions[section.id]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default FinanceNav;
