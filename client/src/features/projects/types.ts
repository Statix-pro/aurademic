/**
 * Types for the research-project form.
 *
 * Form state is camelCase; the API stores snake_case. The mapping lives in
 * `projectFormState.ts` (server response → state) and `projectsApi.ts`
 * (state → request), so no other module needs to know both shapes.
 */

export type MemberType = 'faculty' | 'student' | 'external';

export type DrivenBy = 'faculty' | 'student';

export type ProposalStatus =
  | 'draft'
  | 'submitted'
  | 'accepted_for_evaluation'
  | 'shortlisted'
  | 'shortlisted_for_presentation'
  | 'result_announced';

export type FinalResult = '' | 'selected' | 'not_selected';

export type SanctionMode =
  | ''
  | 'installment'
  | 'advance'
  | 'reimbursement'
  | 'advance_reimbursement';

export type ProjectStatus = '' | 'ongoing' | 'completed' | 'closed';

export type ProjectDocumentType =
  | 'presentation'
  | 'sanction_order'
  | 'project_report'
  | 'utilization_certificate_soe'
  | 'bill_copies'
  | 'bank_statement';

export type DisbursementSlot = 'sanction' | 'uc_soe' | 'report';

/** One upload control: a newly picked file, an already stored one, or neither. */
export interface DocumentSlotState {
  file: File | null;
  /** Path of the stored file, relative to the server root. */
  filePath: string;
  originalName: string;
  /** True once the user clears a stored file, so the save removes it. */
  removed: boolean;
}

export interface InvestigatorRow {
  /** Stable local key — rows are reordered, so the array index is not one. */
  key: string;
  memberType: MemberType;
  /** ERP id for faculty, register number for students; empty for external. */
  identityCode: string;
  name: string;
  department: string;
  organization: string;
  country: string;
  email: string;
  /** Chosen, not positional: the one Principal Investigator; the rest are Co-PIs. */
  isPrincipal: boolean;
}

export interface CollaboratorRow {
  key: string;
  category: string;
  /**
   * The parts a collaborator plays, several at once. Stored as one
   * comma-separated string in `project_collaborators.role`, which is what every
   * screen that reads a project back renders.
   */
  roles: string[];
  organizationId: number | null;
  organizationName: string;
  city: string;
  hasActiveMou: boolean;
  contactName: string;
  contactDesignation: string;
  contactEmail: string;
}

export interface FinanceRow {
  key: string;
  organizationId: number | null;
  organizationName: string;
  /** Budget head names, which is how a project stores its heads. */
  heads: string[];
  amount: string;
}

export interface DisbursementRow {
  key: string;
  /** Stored row id; null until the row has been saved once. */
  id: number | null;
  financialYear: string;
  organizationId: number | null;
  organizationName: string;
  amount: string;
  disbursementDate: string;
  documents: Record<DisbursementSlot, DocumentSlotState>;
}

/** Which side of the Transaction Summary a ledger row is counted on. */
export type TransactionHeadKind = 'expenditure' | 'income';

/** One financial-year column of the Budget Allotment matrix. */
export interface BudgetYearColumn {
  key: string;
  financialYear: string;
}

/** One budget-head row of the Budget Allotment matrix. */
export interface BudgetAllotmentRow {
  key: string;
  budgetHeadName: string;
}

/**
 * The amounts inside the matrix, keyed `${rowKey}|${columnKey}`. A flat map
 * rather than a nested array so adding or removing a row or a column never has
 * to reshape the amounts alongside it.
 */
export type BudgetAllotmentMap = Record<string, string>;

/** One ledger line under a transaction account. */
export interface TransactionRow {
  key: string;
  financialYear: string;
  transactionDate: string;
  /** Follows the head that was picked; decides which summary section counts it. */
  headKind: TransactionHeadKind;
  headName: string;
  particulars: string;
  referenceNo: string;
  credit: string;
  debit: string;
}

/** A bank account the project's money moves through, with its own ledger. */
export interface TransactionAccount {
  key: string;
  accountOptionId: number | null;
  accountName: string;
  transactions: TransactionRow[];
}

export interface OutcomeCounts {
  journalArticles: string;
  conferences: string;
  iprs: string;
  products: string;
  techTransfers: string;
  startups: string;
}

export interface ProjectFormState {
  // Investigators
  drivenBy: DrivenBy;
  investigators: InvestigatorRow[];

  // Proposal details
  title: string;
  projectCost: string;
  durationYears: string;
  durationMonths: string;
  durationDays: string;
  nationalInitiatives: string[];
  sdgs: string[];

  // Call for details
  fundingOrganizationId: number | null;
  schemeId: number | null;
  /**
   * Names of the stored agency and scheme, kept so a selection that has since
   * been deactivated is still shown by its real name rather than disappearing
   * from the dropdown.
   */
  fundingOrganizationName: string;
  schemeName: string;

  // Section toggles
  collaboratorsEnabled: boolean;
  financialContributionEnabled: boolean;
  financeSharingEnabled: boolean;
  presentationEnabled: boolean;

  collaborators: CollaboratorRow[];
  financialContributions: FinanceRow[];
  financeSharing: FinanceRow[];

  // Submission details
  submittedOn: string;
  submissionMode: string;
  referenceNumber: string;
  cfrdCopySubmitted: boolean;
  cfrdCopySubmittedOn: string;
  proposalStatus: ProposalStatus;

  // Presentation
  presentationDate: string;
  presentationVenue: string;
  presentationPanelists: string;

  // Result announcement
  resultMode: string;
  resultDate: string;
  finalResult: FinalResult;

  // Sanction details
  sanctionDate: string;
  sanctionReferenceNo: string;
  sanctionMode: SanctionMode;

  // Grant disbursement
  disbursements: DisbursementRow[];

  // Project status
  projectStartDate: string;
  projectClosingDate: string;
  projectStatus: ProjectStatus;

  outcome: OutcomeCounts;

  // Budget tab
  budgetYears: BudgetYearColumn[];
  budgetRows: BudgetAllotmentRow[];
  budgetAllotments: BudgetAllotmentMap;

  // Transaction tab
  transactionAccounts: TransactionAccount[];

  documents: Record<ProjectDocumentType, DocumentSlotState>;

  remarks: string;
}

// ---------------------------------------------------------------------------
// Lookup data
// ---------------------------------------------------------------------------

export interface ProjectOrganization {
  id: number;
  name: string;
  short_name: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  website: string | null;
  is_funding_agency?: number;
  is_internal?: number;
}

export interface ProjectScheme {
  id: number;
  organization_id: number;
  name: string;
  domain: string | null;
  category: string | null;
  website: string | null;
}

export interface DepartmentOption {
  id: number;
  name: string;
  code: string | null;
}

/** A bank account from the shared `account_options` list. */
export interface AccountOption {
  id: number;
  name: string;
}

/** A head from the admin-curated `project_budget_head_options` vocabulary. */
export interface BudgetHeadOption {
  id: number;
  name: string;
  /** The vocabulary it is offered under — 'Research Projects', say. */
  head_group: string;
}

export interface ProjectLookups {
  organizations: ProjectOrganization[];
  schemes: ProjectScheme[];
  departments: DepartmentOption[];
  accounts: AccountOption[];
  budgetHeads: BudgetHeadOption[];
}

export interface EmployeeSearchResult {
  id: number;
  name: string;
  email: string | null;
  designation: string | null;
  author_id: string | null;
  organization: string | null;
  department: string | null;
  country: string | null;
}

/** Field-level messages returned by the API, keyed as `investigators[0].name`. */
export interface ProjectFieldError {
  field: string;
  message: string;
}

export interface ProjectAccess {
  isOwner: boolean;
  isInvestigator: boolean;
  isPrincipalInvestigator: boolean;
  canEdit: boolean;
}
