import { PROJECT_INCOME_HEADS } from './constants';
import { headIdentity } from './projectBudgetSummary';

import type { SelectOption } from './components/FormFields';
import type { BudgetHead } from '../../shared/hooks/useBudgetCatalog';

/**
 * Expenditure heads from the shared budget catalog, filed under the catalog's
 * own group labels. Retired heads are left out; `withSelectedOption` puts one
 * back when a saved row still points at it.
 */
export function budgetHeadOptions(heads: BudgetHead[]): SelectOption[] {
  return heads
    .filter((head) => head.is_active)
    .map((head) => ({
      value: String(head.id),
      label: head.name,
      group: head.group_label || undefined,
    }));
}

/**
 * The transaction ledger's head dropdown: the catalog's expenditure heads plus
 * the fixed income vocabulary, each option valued by the identity the
 * Transaction Summary groups on, so picking one settles both the head and which
 * side of the summary the row lands on.
 */
export function transactionHeadOptions(heads: BudgetHead[]): SelectOption[] {
  return [
    ...PROJECT_INCOME_HEADS.map((name) => ({
      value: headIdentity('income', null, name),
      label: name,
      group: 'Income',
    })),
    ...heads
      .filter((head) => head.is_active)
      .map((head) => ({
        value: headIdentity('expenditure', head.id, head.name),
        label: head.name,
        group: head.group_label ? `Expenditure — ${head.group_label}` : 'Expenditure',
      })),
  ];
}

/**
 * Keeps a stored selection visible in a dropdown even when it is no longer
 * offered — an administrator can deactivate a funding agency or scheme that
 * existing projects still point at, and without this the select would render
 * empty and a save would silently drop the value.
 */
export function withSelectedOption(
  options: SelectOption[],
  value: string,
  label?: string | null,
): SelectOption[] {
  if (!value || options.some((option) => option.value === value)) return options;

  return [{ value, label: label?.trim() || 'Currently selected (no longer listed)' }, ...options];
}
