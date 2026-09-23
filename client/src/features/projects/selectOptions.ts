import { headIdentity } from './projectBudgetSummary';

import type { SelectOption } from './components/FormFields';
import type {
  BudgetAllotmentRow,
  BudgetHeadOption,
  ProjectFormState,
  ProjectOrganization,
} from './types';

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
 * The transaction ledger's head dropdown: the heads this project actually
 * budgeted for, plus the income heads it ticked. Each option is valued by the
 * identity the Transaction Summary groups on, so picking one settles both the
 * head and which side of the summary the row lands on.
 *
 * The expenditure side comes from the Budget Allotment matrix rather than the
 * whole admin vocabulary: a ledger row filed under a head the project never
 * allotted has no budget to be counted against, and lands in the summary as an
 * unbudgeted line. Offering only what the Budget tab lists is what stops that
 * happening by a stray pick.
 *
 * A row already saved against a head that has since left the matrix keeps it —
 * `withSelectedOption` re-offers the stored name, so narrowing the list here
 * never silently rewrites a saved entry's head.
 *
 * Expenditure is listed first because it is the side the project chose: most
 * ledger rows are spending, and the heads the user picked on the Budget tab are
 * what they come here looking for. Income sits below them, and is now the
 * project's own selection too — the heads ticked on the Income Heads card,
 * rather than the whole vocabulary.
 */
export function transactionHeadOptions(
  budgetRows: BudgetAllotmentRow[],
  incomeHeads: string[],
): SelectOption[] {
  // Heads are stored by name and the matrix already refuses the same head
  // twice, but two rows naming one head would collide on a single identity —
  // and so on a single option — so the first one named wins.
  const seen = new Set<string>();
  const allottedHeads: string[] = [];

  budgetRows.forEach((row) => {
    const name = row.budgetHeadName.trim();
    if (!name || seen.has(name.toLowerCase())) return;

    seen.add(name.toLowerCase());
    allottedHeads.push(name);
  });

  return [
    ...allottedHeads.map((name) => ({
      value: headIdentity('expenditure', name),
      label: name,
      group: 'Expenditure',
    })),
    ...incomeHeads.map((name) => ({
      value: headIdentity('income', name),
      label: name,
      group: 'Income',
    })),
  ];
}

/**
 * The organizations the Financial Contribution and Budget Sharing tables offer:
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
 *
 * Budget Sharing narrows this once more, leaving out the funding agency — it is
 * where the money came from, not a party it is shared out to. That filter lives
 * beside the table in `ProjectForm`, since nothing else needs it.
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
