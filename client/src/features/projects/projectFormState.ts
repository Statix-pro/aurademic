/**
 * Form state factories and the server → state mapping for the project form.
 *
 * Keeping this out of the components means the form can be created empty, be
 * hydrated from a saved project, and be diffed in tests without rendering.
 */

import { DEFAULT_COUNTRY, DISBURSEMENT_SLOTS, HOST_ORGANIZATION_NAME } from './constants';

import type {
  BudgetAllotmentMap,
  BudgetAllotmentRow,
  BudgetYearColumn,
  CollaboratorRow,
  DisbursementRow,
  DisbursementSlot,
  DocumentSlotState,
  FinanceRow,
  InvestigatorRow,
  MemberType,
  ProjectDocumentType,
  ProjectFormState,
  TransactionAccount,
  TransactionHeadKind,
  TransactionRow,
} from './types';

const PROJECT_DOCUMENT_TYPES: ProjectDocumentType[] = [
  'presentation',
  'sanction_order',
  'project_report',
  'utilization_certificate_soe',
  'bill_copies',
  'bank_statement',
];

let keyCounter = 0;

/** Local row identity. Not sent to the server except as a disbursement's key. */
export function nextRowKey(prefix = 'row'): string {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
}

export function emptyDocumentSlot(): DocumentSlotState {
  return { file: null, filePath: '', originalName: '', removed: false };
}

function emptyDocumentMap<T extends string>(types: readonly T[]): Record<T, DocumentSlotState> {
  return types.reduce(
    (map, type) => {
      map[type] = emptyDocumentSlot();
      return map;
    },
    {} as Record<T, DocumentSlotState>,
  );
}

export function createInvestigatorRow(overrides: Partial<InvestigatorRow> = {}): InvestigatorRow {
  const memberType: MemberType = overrides.memberType ?? 'faculty';

  return {
    key: nextRowKey('investigator'),
    memberType,
    identityCode: '',
    name: '',
    department: '',
    // Internal members always belong to the host institution; the field is
    // shown read-only so it cannot drift.
    organization: memberType === 'external' ? '' : HOST_ORGANIZATION_NAME,
    country: memberType === 'external' ? '' : DEFAULT_COUNTRY,
    email: '',
    isPrincipal: false,
    ...overrides,
  };
}

export function createCollaboratorRow(): CollaboratorRow {
  return {
    key: nextRowKey('collaborator'),
    category: '',
    roles: [],
    organizationId: null,
    organizationName: '',
    city: '',
    hasActiveMou: false,
    contactName: '',
    contactDesignation: '',
    contactEmail: '',
  };
}

export function createFinanceRow(): FinanceRow {
  return {
    key: nextRowKey('finance'),
    organizationId: null,
    organizationName: '',
    coversAllHeads: false,
    heads: [],
    amount: '',
  };
}

export function createBudgetYearColumn(): BudgetYearColumn {
  return { key: nextRowKey('budget-year'), financialYear: '' };
}

export function createBudgetAllotmentRow(): BudgetAllotmentRow {
  return {
    key: nextRowKey('budget-row'),
    budgetHeadName: '',
    contributionOrganizationId: null,
    contributionOrganizationName: '',
  };
}

/** Address of one cell in the allotment matrix. */
export function allotmentKey(rowKey: string, columnKey: string): string {
  return `${rowKey}|${columnKey}`;
}

export function createTransactionRow(): TransactionRow {
  return {
    key: nextRowKey('transaction'),
    financialYear: '',
    transactionDate: '',
    headKind: 'expenditure',
    headName: '',
    particulars: '',
    referenceNo: '',
    paymentMode: '',
    contributionOrganizationId: null,
    contributionOrganizationName: '',
    credit: '',
    debit: '',
    countsAsActual: true,
  };
}

export function createTransactionAccount(): TransactionAccount {
  return {
    key: nextRowKey('account'),
    accountOptionId: null,
    accountName: '',
    transactions: [createTransactionRow()],
  };
}

export function createDisbursementRow(): DisbursementRow {
  return {
    key: nextRowKey('disbursement'),
    id: null,
    financialYear: '',
    organizationId: null,
    organizationName: '',
    amount: '',
    disbursementDate: '',
    documents: emptyDocumentMap(DISBURSEMENT_SLOTS),
  };
}

export function createEmptyProjectForm(): ProjectFormState {
  return {
    drivenBy: 'faculty',
    investigators: [createInvestigatorRow({ isPrincipal: true })],

    title: '',
    projectCost: '',
    durationYears: '',
    durationMonths: '',
    durationDays: '',
    nationalInitiatives: [],
    sdgs: [],

    fundingOrganizationId: null,
    schemeId: null,
    fundingOrganizationName: '',
    schemeName: '',

    collaboratorsEnabled: false,
    financialContributionEnabled: false,
    financeSharingEnabled: false,
    presentationEnabled: false,

    collaborators: [createCollaboratorRow()],
    financialContributions: [createFinanceRow()],
    financeSharing: [createFinanceRow()],

    submittedOn: '',
    submissionMode: '',
    referenceNumber: '',
    cfrdCopySubmitted: false,
    cfrdCopySubmittedOn: '',
    proposalStatus: 'draft',

    presentationDate: '',
    presentationVenue: '',
    presentationPanelists: '',

    resultMode: '',
    resultDate: '',
    finalResult: '',

    sanctionDate: '',
    sanctionReferenceNo: '',
    sanctionMode: '',

    disbursements: [createDisbursementRow()],

    projectStartDate: '',
    projectClosingDate: '',
    projectStatus: '',

    outcome: {
      journalArticles: '',
      conferences: '',
      iprs: '',
      products: '',
      techTransfers: '',
      startups: '',
    },

    // Nothing ticked: which income heads apply is a statement about the project,
    // and pre-ticking them would put the fixed four-line schedule back — the
    // thing the card exists to replace.
    incomeHeads: [],

    // One empty row and column so the matrix has something to type into, as
    // every other repeatable section of the form does.
    budgetYears: [createBudgetYearColumn()],
    budgetRows: [createBudgetAllotmentRow()],
    budgetAllotments: {},

    transactionAccounts: [createTransactionAccount()],

    documents: emptyDocumentMap(PROJECT_DOCUMENT_TYPES),

    remarks: '',
  };
}

// ---------------------------------------------------------------------------
// Server → form state
// ---------------------------------------------------------------------------

const text = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const flag = (value: unknown): boolean => value === 1 || value === true || value === '1';

/**
 * A stored flag whose column default is on, so a value the response does not
 * carry reads as on rather than off. `flag` alone answers false for a missing
 * field, which would show every row of a ledger saved before the column existed
 * as excluded from its own totals.
 */
const flagDefaultOn = (value: unknown): boolean =>
  value === undefined || value === null ? true : flag(value);

/** Dates arrive pre-formatted as `YYYY-MM-DD`; anything else is treated as empty. */
const dateInput = (value: unknown): string => {
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
};

/** `0` is shown as an empty count field so the form does not read as filled in. */
const countInput = (value: unknown): string => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? String(count) : '';
};

const amountInput = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : '';
};

function storedDocumentSlot(document: unknown): DocumentSlotState {
  const source = document as { file_path?: string; original_name?: string } | null;
  if (!source?.file_path) return emptyDocumentSlot();

  return {
    file: null,
    filePath: source.file_path,
    originalName: source.original_name ?? '',
    removed: false,
  };
}

/** Rebuilds form state from `GET /projects/:id`. */

export function projectToFormState(project: any): ProjectFormState {
  const empty = createEmptyProjectForm();

  const investigators: InvestigatorRow[] = Array.isArray(project?.investigators)
    ? project.investigators.map((row: any) =>
        createInvestigatorRow({
          memberType: (row.member_type ?? 'faculty') as MemberType,
          identityCode: text(row.identity_code),
          name: text(row.name),
          department: text(row.department),
          organization: text(row.organization),
          country: text(row.country),
          email: text(row.email),
          isPrincipal: flag(row.is_principal),
        }),
      )
    : [];

  // Every project has exactly one PI; a row saved without the flag falls back
  // to the first, which is where the server's own fallback puts it too.
  if (investigators.length > 0 && !investigators.some((row) => row.isPrincipal)) {
    investigators[0] = { ...investigators[0], isPrincipal: true };
  }

  const collaborators: CollaboratorRow[] = Array.isArray(project?.collaborators)
    ? project.collaborators.map((row: any) => ({
        ...createCollaboratorRow(),
        category: text(row.category),
        // One comma-separated column on the way in and out; a role the list no
        // longer offers is kept as its own chip rather than dropped.
        roles: text(row.role)
          .split(',')
          .map((role: string) => role.trim())
          .filter(Boolean),
        organizationId: row.organization_id ?? null,
        organizationName: text(row.organization_name || row.organization_label),
        city: text(row.city),
        hasActiveMou: flag(row.has_active_mou),
        contactName: text(row.contact_name),
        contactDesignation: text(row.contact_designation),
        contactEmail: text(row.contact_email),
      }))
    : [];

  const financeRows = (rows: unknown): FinanceRow[] =>
    Array.isArray(rows)
      ? rows.map((row: any) => ({
          ...createFinanceRow(),
          organizationId: row.organization_id ?? null,
          organizationName: text(row.organization_name || row.organization_label),
          amount: amountInput(row.amount),
          coversAllHeads: flag(row.covers_all_heads),
          heads: Array.isArray(row.heads)
            ? row.heads.map((head: any) => text(head.budget_head_name)).filter(Boolean)
            : [],
        }))
      : [];

  // The matrix comes back addressed by the two header tables' ids; the form
  // works in its own keys, so each header gets a fresh key and the cells are
  // rewritten against them.
  const budgetYears: BudgetYearColumn[] = Array.isArray(project?.budget?.years)
    ? project.budget.years.map((row: any) => ({
        ...createBudgetYearColumn(),
        financialYear: text(row.financial_year),
      }))
    : [];
  const yearKeyById = new Map<number, string>(
    (project?.budget?.years ?? []).map((row: any, index: number) => [
      row.id,
      budgetYears[index].key,
    ]),
  );

  const budgetRows: BudgetAllotmentRow[] = Array.isArray(project?.budget?.heads)
    ? project.budget.heads.map((row: any) => ({
        ...createBudgetAllotmentRow(),
        budgetHeadName: text(row.budget_head_name),
        contributionOrganizationId: row.contribution_organization_id ?? null,
        contributionOrganizationName: text(
          row.contribution_organization_name || row.contribution_organization_label,
        ),
      }))
    : [];
  const rowKeyById = new Map<number, string>(
    (project?.budget?.heads ?? []).map((row: any, index: number) => [
      row.id,
      budgetRows[index].key,
    ]),
  );

  const budgetAllotments: BudgetAllotmentMap = (project?.budget?.allotments ?? []).reduce(
    (map: BudgetAllotmentMap, cell: any) => {
      const rowKey = rowKeyById.get(cell.budget_head_row_id);
      const columnKey = yearKeyById.get(cell.budget_year_id);
      const amount = amountInput(cell.amount);
      if (rowKey && columnKey && amount) map[allotmentKey(rowKey, columnKey)] = amount;
      return map;
    },
    {},
  );

  const transactionAccounts: TransactionAccount[] = Array.isArray(project?.transaction_accounts)
    ? project.transaction_accounts.map((account: any) => {
        const transactions: TransactionRow[] = (
          Array.isArray(account.transactions) ? account.transactions : []
        ).map((row: any) => ({
          ...createTransactionRow(),
          financialYear: text(row.financial_year),
          transactionDate: dateInput(row.transaction_date),
          headKind: (row.head_kind === 'income' ? 'income' : 'expenditure') as TransactionHeadKind,
          headName: text(row.head_name),
          particulars: text(row.particulars),
          referenceNo: text(row.reference_no),
          paymentMode: text(row.payment_mode),
          contributionOrganizationId: row.contribution_organization_id ?? null,
          contributionOrganizationName: text(
            row.contribution_organization_name || row.contribution_organization_label,
          ),
          credit: amountInput(row.credit),
          debit: amountInput(row.debit),
          countsAsActual: flagDefaultOn(row.counts_as_actual),
        }));

        return {
          ...createTransactionAccount(),
          accountOptionId: account.account_option_id ?? null,
          accountName: text(account.account_name),
          // An account saved with no rows still needs somewhere to type. The
          // server stores the ledger in date order, but sorting again here
          // keeps the running balance right for anything saved before it did.
          transactions:
            transactions.length > 0 ? sortTransactions(transactions) : [createTransactionRow()],
        };
      })
    : [];

  const disbursements: DisbursementRow[] = Array.isArray(project?.disbursements)
    ? project.disbursements.map((row: any) => ({
        ...createDisbursementRow(),
        id: row.id ?? null,
        financialYear: text(row.financial_year),
        organizationId: row.organization_id ?? null,
        organizationName: text(row.organization_name || row.organization_label),
        amount: amountInput(row.amount),
        disbursementDate: dateInput(row.disbursement_date),
        documents: DISBURSEMENT_SLOTS.reduce(
          (map, slot) => {
            map[slot] = storedDocumentSlot(row.documents?.[slot]);
            return map;
          },
          {} as Record<DisbursementSlot, DocumentSlotState>,
        ),
      }))
    : [];

  return {
    ...empty,

    drivenBy: project?.driven_by === 'student' ? 'student' : 'faculty',
    // A saved project always has at least one investigator, but a blank row
    // keeps the section usable if that ever stops being true.
    investigators: investigators.length > 0 ? investigators : empty.investigators,

    title: text(project?.title),
    projectCost: amountInput(project?.project_cost),
    durationYears: countInput(project?.duration_years),
    durationMonths: countInput(project?.duration_months),
    durationDays: countInput(project?.duration_days),
    nationalInitiatives: Array.isArray(project?.national_initiatives)
      ? project.national_initiatives.map(text)
      : [],
    sdgs: Array.isArray(project?.sdgs) ? project.sdgs.map(text) : [],

    fundingOrganizationId: project?.funding_organization_id ?? null,
    schemeId: project?.scheme_id ?? null,
    fundingOrganizationName: text(project?.funding_organization_name),
    schemeName: text(project?.scheme_name),

    collaboratorsEnabled: flag(project?.collaborators_enabled),
    financialContributionEnabled: flag(project?.financial_contribution_enabled),
    financeSharingEnabled: flag(project?.finance_sharing_enabled),
    presentationEnabled: flag(project?.presentation_enabled),

    collaborators: collaborators.length > 0 ? collaborators : empty.collaborators,
    financialContributions: (() => {
      const rows = financeRows(project?.financial_contributions);
      return rows.length > 0 ? rows : empty.financialContributions;
    })(),
    financeSharing: (() => {
      const rows = financeRows(project?.finance_sharing);
      return rows.length > 0 ? rows : empty.financeSharing;
    })(),

    submittedOn: dateInput(project?.submitted_on),
    submissionMode: text(project?.submission_mode),
    referenceNumber: text(project?.reference_number),
    cfrdCopySubmitted: flag(project?.cfrd_copy_submitted),
    cfrdCopySubmittedOn: dateInput(project?.cfrd_copy_submitted_on),
    proposalStatus: (project?.proposal_status ?? 'draft') as ProjectFormState['proposalStatus'],

    presentationDate: dateInput(project?.presentation_date),
    presentationVenue: text(project?.presentation_venue),
    presentationPanelists: text(project?.presentation_panelists),

    resultMode: text(project?.result_mode),
    resultDate: dateInput(project?.result_date),
    finalResult: (text(project?.final_result) || '') as ProjectFormState['finalResult'],

    sanctionDate: dateInput(project?.sanction_date),
    sanctionReferenceNo: text(project?.sanction_reference_no),
    sanctionMode: (text(project?.sanction_mode) || '') as ProjectFormState['sanctionMode'],

    disbursements: disbursements.length > 0 ? disbursements : empty.disbursements,

    projectStartDate: dateInput(project?.project_start_date),
    projectClosingDate: dateInput(project?.project_closing_date),
    projectStatus: (text(project?.project_status) || '') as ProjectFormState['projectStatus'],

    outcome: {
      journalArticles: countInput(project?.outcome_journal_articles),
      conferences: countInput(project?.outcome_conferences),
      iprs: countInput(project?.outcome_iprs),
      products: countInput(project?.outcome_products),
      techTransfers: countInput(project?.outcome_tech_transfers),
      startups: countInput(project?.outcome_startups),
    },

    incomeHeads: Array.isArray(project?.income_heads)
      ? project.income_heads.map((name: any) => text(name)).filter(Boolean)
      : [],
    budgetYears: budgetYears.length > 0 ? budgetYears : empty.budgetYears,
    budgetRows: budgetRows.length > 0 ? budgetRows : empty.budgetRows,
    budgetAllotments,

    transactionAccounts:
      transactionAccounts.length > 0 ? transactionAccounts : empty.transactionAccounts,

    documents: PROJECT_DOCUMENT_TYPES.reduce(
      (map, type) => {
        map[type] = storedDocumentSlot(project?.documents?.[type]);
        return map;
      },
      {} as Record<ProjectDocumentType, DocumentSlotState>,
    ),

    remarks: text(project?.remarks),
  };
}

// ---------------------------------------------------------------------------
// Immutable row helpers
// ---------------------------------------------------------------------------

/** Returns a copy of `rows` with `changes` merged into the row at `index`. */
export function replaceAt<T>(rows: T[], index: number, changes: Partial<T>): T[] {
  return rows.map((row, position) => (position === index ? { ...row, ...changes } : row));
}

export function removeAt<T>(rows: T[], index: number): T[] {
  return rows.filter((_, position) => position !== index);
}

/** Moves a row, used by the investigator drag handle. */
export function moveItem<T>(rows: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows;

  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Ledger order: by date, oldest first.
 *
 * A running balance says what is in the account *after* a transaction, which is
 * only true when every earlier-dated row sits above it — so the ledger keeps
 * itself in date order rather than the order rows happened to be typed in.
 * Rows with no date yet are still being filled in and stay at the bottom, where
 * the "add row" button is. `sort` is stable, so two transactions on the same day
 * keep the order the user put them in, which is a real decision only they can
 * make.
 */
export function sortTransactions(rows: TransactionRow[]): TransactionRow[] {
  return [...rows].sort((left, right) => {
    if (!left.transactionDate) return right.transactionDate ? 1 : 0;
    if (!right.transactionDate) return -1;
    return left.transactionDate.localeCompare(right.transactionDate);
  });
}

/**
 * Drops allotment amounts whose row or column has just been removed, so a head
 * or year deleted and then re-added does not come back carrying the old
 * figures.
 */
export function pruneAllotments(
  allotments: BudgetAllotmentMap,
  rows: BudgetAllotmentRow[],
  columns: BudgetYearColumn[],
): BudgetAllotmentMap {
  const live = new Set(
    rows.flatMap((row) => columns.map((column) => allotmentKey(row.key, column.key))),
  );

  return Object.fromEntries(Object.entries(allotments).filter(([key]) => live.has(key)));
}

/** Sums the amount column of a finance table, ignoring blank rows. */
export function sumAmounts(rows: Array<{ amount: string }>): number {
  return rows.reduce((total, row) => {
    const amount = Number(String(row.amount).replace(/,/g, ''));
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
}

export { PROJECT_DOCUMENT_TYPES };
