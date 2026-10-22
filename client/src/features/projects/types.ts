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

export type ManpowerSlot = 'profile';

/** The one upload on a Technology Transfer or outcome candidate row. */
export type OutcomeDocumentSlot = 'document';

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
  /**
   * The row covers every budget head rather than the ones listed. `heads` is
   * always empty while this is set — "all" and a specific list cannot both hold.
   */
  coversAllHeads: boolean;
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
  /** The party whose money this head is allotted from; optional. */
  contributionOrganizationId: number | null;
  contributionOrganizationName: string;
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
  /** How the money moved, as a `TRANSACTION_MODE_OPTIONS` value; '' when unstated. */
  paymentMode: string;
  /**
   * Who a receipt came from. Shown on income rows in place of the reference
   * number, and kept on every row so switching a row's head between the two
   * kinds hides the field it no longer uses rather than clearing it.
   */
  contributionOrganizationId: number | null;
  contributionOrganizationName: string;
  credit: string;
  debit: string;
  /**
   * Whether this row is counted in the Transaction Summary's Actuals. On by
   * default; an internal transfer or a correction entry is real money in the
   * account but not what the project spent against its budget. The ledger's own
   * running Balance ignores this — the cash position is the cash position.
   */
  countsAsActual: boolean;
}

/** One entry in the Documents tab's correspondence log. */
export interface DocumentTransactionRow {
  key: string;
  /** Stored row id; null until the row has been saved once. */
  id: number | null;
  transactionDate: string;
  /** `'inward'` or `'outward'`; '' until picked. */
  direction: string;
  /** A `DOCUMENT_TRANSACTION_KIND_OPTIONS` value; '' until picked. */
  documentKind: string;
  description: string;
  documents: Record<OutcomeDocumentSlot, DocumentSlotState>;
}

/** One publication on the Outcomes tab. */
export interface PublicationRow {
  key: string;
  /** A `PUBLICATION_TYPE_OPTIONS` value; '' until picked. */
  publicationType: string;
  doi: string;
  /** The portal `journals` record the DOI matched on Fetch; null otherwise. */
  journalId: number | null;
  title: string;
  venue: string;
  publicationYear: string;
}

/** What `GET /project-options/doi` found for a DOI. */
export interface DoiLookupResult {
  doi: string;
  /** `portal` when it matched a Journals record, `crossref` otherwise. */
  source: 'portal' | 'crossref';
  journal_id: number | null;
  publication_type: string | null;
  title: string | null;
  venue: string | null;
  publication_year: number | null;
}

/** One IPR on the Outcomes tab. */
export interface IprRow {
  key: string;
  iprType: string;
  iprNumber: string;
  status: string;
  title: string;
  filingDate: string;
  grantDate: string;
}

/** One technology transfer on the Outcomes tab. */
export interface TechTransferRow {
  key: string;
  /** Stored row id; null until the row has been saved once. */
  id: number | null;
  category: string;
  description: string;
  /** The level as a string, `'3'` to `'9'`; '' when unstated. */
  trl: string;
  documents: Record<OutcomeDocumentSlot, DocumentSlotState>;
}

/** One person who earned a degree or fellowship through the project. */
export interface OutcomeCandidateRow {
  key: string;
  /** Stored row id; null until the row has been saved once. */
  id: number | null;
  candidateName: string;
  degree: string;
  university: string;
  documents: Record<OutcomeDocumentSlot, DocumentSlotState>;
}

/** One person the project employs, on the Manpower tab. */
export interface ManpowerRow {
  key: string;
  /** Stored row id; null until the row has been saved once. */
  id: number | null;
  /** A `MANPOWER_ROLE_OPTIONS` value; '' until picked. */
  role: string;
  name: string;
  qualification: string;
  salary: string;
  joiningDate: string;
  mobile: string;
  email: string;
  remarks: string;
  relievingDate: string;
  documents: Record<ManpowerSlot, DocumentSlotState>;
}

/** One facility the project set up, on the Facility tab. */
export interface FacilityRow {
  key: string;
  facilityName: string;
  /** A `FACILITY_TYPE_OPTIONS` value; '' when unstated. */
  facilityType: string;
  installationDate: string;
  cost: string;
  make: string;
  model: string;
  serialNo: string;
  /** Where it is entered in the stock register — its S.No. and page no. */
  stockRegisterRef: string;
  /** Listed on the I-STEM portal; the ID is only asked for, and kept, while it is. */
  istemListed: boolean;
  istemId: string;
  supplierName: string;
  supplierAddress: string;
  /** The supplier's contact, on the strip's Contact Details line. */
  contactPerson: string;
  contactDesignation: string;
  contactMobile: string;
  contactEmail: string;
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
  /** A `PROJECT_TYPE_OPTIONS` value; never blank — a new project starts with one. */
  projectType: string;
  title: string;
  projectCost: string;
  durationYears: string;
  durationMonths: string;
  durationDays: string;
  /** A `RESEARCH_TYPE_OPTIONS` value; '' when unstated. Asked of a research project. */
  researchType: string;
  /** A `LEVEL_OPTIONS` value; '' when unstated. Asked of an Event or Fellowship. */
  level: string;
  nationalInitiatives: string[];
  sdgs: string[];

  // Call for details
  fundingOrganizationId: number | null;
  /** A `FUNDING_SOURCE_OPTIONS` value; '' when unstated. */
  fundingSource: string;
  /** A curated Domains entry; '' when unstated. The project's own, not the scheme's. */
  domain: string;
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
  /** A `GRANT_CREDITED_TO_OPTIONS` value; '' when unstated. */
  grantCreditedTo: string;

  // Grant disbursement
  disbursements: DisbursementRow[];

  // Project status
  projectStartDate: string;
  projectClosingDate: string;
  projectStatus: ProjectStatus;

  /**
   * LEGACY: the six counts typed before the Outcomes tab existed. Read-only —
   * the form shows them but no longer sends them, so an older project keeps
   * its figures. Remove once no project carries a non-zero count.
   */
  outcome: OutcomeCounts;

  // Budget tab
  /**
   * The income heads this project declares as applicable, from
   * `PROJECT_INCOME_HEADS`. They decide what the ledger's head picker offers on
   * the income side and what the Transaction Summary lists there.
   */
  incomeHeads: string[];
  budgetYears: BudgetYearColumn[];
  budgetRows: BudgetAllotmentRow[];
  budgetAllotments: BudgetAllotmentMap;

  // Transaction tab
  transactionAccounts: TransactionAccount[];

  // Facility tab
  facilities: FacilityRow[];

  // Manpower tab
  manpower: ManpowerRow[];

  // Outcomes tab
  publications: PublicationRow[];
  iprs: IprRow[];
  techTransfers: TechTransferRow[];
  outcomeCandidates: OutcomeCandidateRow[];

  // Documents tab
  documentTransactions: DocumentTransactionRow[];

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
  /** The kind of grant it funds; the form offers only the project's own type. */
  project_type: string;
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

/**
 * An entry on one of the admin-curated lists (`project_vocabulary_options`):
 * National Initiatives, Domains, or a project type's Categories. Stored on
 * projects and schemes by name, so value and label are one.
 */
export interface VocabularyEntry {
  list_key: 'national_initiative' | 'domain' | 'category';
  /** The project type a category is for; '' on the other two lists. */
  project_type: string;
  name: string;
}

export interface ProjectLookups {
  organizations: ProjectOrganization[];
  schemes: ProjectScheme[];
  departments: DepartmentOption[];
  accounts: AccountOption[];
  budgetHeads: BudgetHeadOption[];
  vocabulary: VocabularyEntry[];
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
