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

export interface BudgetHeadRef {
  id: number | null;
  name: string;
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
  /** Set by the row's position: the top row is the PI, the rest are Co-PIs. */
  isPrincipal: boolean;
  /** Chosen, not positional: the investigator who corresponds for the project. */
  isPrimary: boolean;
}

export interface CollaboratorRow {
  key: string;
  category: string;
  role: string;
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
  heads: BudgetHeadRef[];
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

export interface ProjectLookups {
  organizations: ProjectOrganization[];
  schemes: ProjectScheme[];
  departments: DepartmentOption[];
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
