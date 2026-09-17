import { PROJECT_INCOME_HEADS } from './constants';
import { headIdentity } from './projectBudgetSummary';

import type { SelectOption } from './components/FormFields';
import type { BudgetHeadOption, ProjectFormState, ProjectOrganization } from './types';

/**
 * The project's expenditure heads, filed under the group each belongs to.
 * Valued by name, which is what a budget row stores — `Consumables` is offered
 * under both groups and is one head either way.
 *
 * The vocabulary comes from `project_budget_head_options` by way of
 * `ProjectLookups`, so a head an administrator adds is offered here without a
 * release.
 */
export function budgetHeadOptions(heads: BudgetHeadOption[]): SelectOption[] {
  return heads.map((head) => ({ value: head.name, label: head.name, group: head.head_group }));
}

/**
 * The same vocabulary as a flat list, each name once — for the multi-select on
 * the finance tables, which has no group headings and would otherwise offer
 * `Consumables` twice over, indistinguishably and under one React key.
 */
export function flatBudgetHeadOptions(heads: BudgetHeadOption[]): SelectOption[] {
  return [...new Set(heads.map((head) => head.name))].map((name) => ({ value: name, label: name }));
}

/**
 * The transaction ledger's head dropdown: the project's expenditure heads plus
 * the fixed income vocabulary, each option valued by the identity the
 * Transaction Summary groups on, so picking one settles both the head and which
 * side of the summary the row lands on.
 */
export function transactionHeadOptions(heads: BudgetHeadOption[]): SelectOption[] {
  return [
    ...PROJECT_INCOME_HEADS.map((name) => ({
      value: headIdentity('income', name),
      label: name,
      group: 'Income',
    })),
    ...heads.map((head) => ({
      value: headIdentity('expenditure', head.name),
      label: head.name,
      group: `Expenditure — ${head.head_group}`,
    })),
  ];
}

/**
 * The organizations the Financial Contribution and Finance Sharing tables offer:
 * the parties this project's money actually moves between, rather than the whole
 * master list.
 *
 * That is the collaborators the project has added, the funding agency from Call
 * for Details, and the host institution — the college puts up a matching share
 * on plenty of grants and takes one back when a grant is shared out, and it is
 * not something a project records anywhere else.
 *
 * A row already saved against an organization outside this list keeps it:
 * `withSelectedOption` re-offers the stored name, so narrowing the list here
 * never silently rewrites a saved figure's owner.
 */
export function financeOrganizations(
  organizations: ProjectOrganization[],
  form: Pick<ProjectFormState, 'fundingOrganizationId' | 'collaborators' | 'collaboratorsEnabled'>,
): ProjectOrganization[] {
  const allowed = new Set<number>();

  if (form.fundingOrganizationId) allowed.add(form.fundingOrganizationId);
  if (form.collaboratorsEnabled) {
    form.collaborators.forEach((row) => {
      if (row.organizationId) allowed.add(row.organizationId);
    });
  }

  return organizations.filter(
    (organization) => organization.is_internal === 1 || allowed.has(organization.id),
  );
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
