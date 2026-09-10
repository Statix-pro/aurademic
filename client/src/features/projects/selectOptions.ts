import { PROJECT_BUDGET_HEAD_GROUPS, PROJECT_INCOME_HEADS } from './constants';
import { headIdentity } from './projectBudgetSummary';

import type { SelectOption } from './components/FormFields';

/**
 * The project's expenditure heads, filed under the group each belongs to.
 * Valued by name, which is what a budget row stores — `Consumables` appears
 * under both groups and is one head either way.
 */
export function budgetHeadOptions(): SelectOption[] {
  return PROJECT_BUDGET_HEAD_GROUPS.flatMap((group) =>
    group.heads.map((name) => ({ value: name, label: name, group: group.label })),
  );
}

/**
 * The transaction ledger's head dropdown: the project's expenditure heads plus
 * the fixed income vocabulary, each option valued by the identity the
 * Transaction Summary groups on, so picking one settles both the head and which
 * side of the summary the row lands on.
 */
export function transactionHeadOptions(): SelectOption[] {
  return [
    ...PROJECT_INCOME_HEADS.map((name) => ({
      value: headIdentity('income', name),
      label: name,
      group: 'Income',
    })),
    ...PROJECT_BUDGET_HEAD_GROUPS.flatMap((group) =>
      group.heads.map((name) => ({
        value: headIdentity('expenditure', name),
        label: name,
        group: `Expenditure — ${group.label}`,
      })),
    ),
  ];
}

/**
 * Keeps a stored selection visible in a dropdown even when it is no longer
 * offered — an administrator can deactivate a funding agency or scheme that
 * existing projects still point at, and a budget head can be dropped from the
 * vocabulary while sanctioned budgets still sit under it. Without this the
 * select would render empty and a save would silently drop the value.
 */
export function withSelectedOption(
  options: SelectOption[],
  value: string,
  label?: string | null,
): SelectOption[] {
  if (!value || options.some((option) => option.value === value)) return options;

  return [{ value, label: label?.trim() || 'Currently selected (no longer listed)' }, ...options];
}
