/**
 * Option lists and labels for the research-project form.
 *
 * These are stable national/UN vocabularies rather than institution data, so
 * they live in code next to the form (as the journal form does for SDGs)
 * instead of in a master table an admin would have to seed.
 */

import type { DisbursementSlot, ProjectDocumentType, ProposalStatus } from './types';

export const HOST_ORGANIZATION_NAME = 'K.S.Rangasamy College of Technology';
export const DEFAULT_COUNTRY = 'India';

export const MAX_INVESTIGATORS = 15;
export const MAX_COLLABORATORS = 20;
export const MAX_FINANCE_ROWS = 30;
export const MAX_DISBURSEMENTS = 30;
export const MAX_BUDGET_YEARS = 15;
export const MAX_BUDGET_HEAD_ROWS = 40;
export const MAX_TRANSACTION_ACCOUNTS = 10;
export const MAX_TRANSACTIONS_PER_ACCOUNT = 500;

/**
 * The income side of the transaction ledger: the four ways money reaches a
 * project account. A closed list rather than institution data — unlike the
 * expenditure heads, which an administrator curates under Project Form Options
 * and which reach the form through `ProjectLookups.budgetHeads`. Mirrored by
 * `PROJECT_INCOME_HEADS` in `server/modules/project/projectPayload.js`, which
 * validates them.
 *
 * Which of the four apply is ticked per project on the Income Heads card; this
 * is the vocabulary that card offers, not what any one project uses.
 */
export const PROJECT_INCOME_HEADS = [
  'Grant-in-aid',
  'Bank Interest',
  'HI Contribution',
  'Other Income',
];

/** Matches the server-side document check advertised on every upload control. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_ACCEPT = 'application/pdf';

export const MEMBER_TYPE_OPTIONS = [
  { value: 'faculty', label: 'Faculty' },
  { value: 'student', label: 'Student' },
  { value: 'external', label: 'External' },
] as const;

/**
 * What a collaborating organization brings to the project. A collaborator can
 * play several of these at once — a partner institute that shares a facility
 * and funds part of the work — so the field is a multi-select.
 *
 * Roles are stored as free text, so this list is what is offered rather than
 * what is allowed — a project saved against a role that has since left the list
 * keeps it, via `withStoredRoles` in `CollaboratorsSection`.
 */
export const COLLABORATOR_ROLES = [
  'Technical Support',
  'Financial Support',
  'Facility Access',
  'Resource Provider',
  'Mentorship',
  'Field Trial Support',
  'Validation Support',
  'Implementation Partner',
  'Training Partner',
  'Industry Partner',
  'Community Partner',
];

export const COLLABORATOR_CATEGORIES = [
  'Academic',
  'Industry',
  'Government',
  'Research Laboratory',
  'NGO',
  'International',
  'Other',
];

/**
 * How a ledger entry's money moved. Valued lower-cased to match the
 * `project_transactions.payment_mode` enum, and labelled as the office writes
 * them — NEFT and PFMS are names, not sentences.
 */
export const TRANSACTION_MODE_OPTIONS = [
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'dd', label: 'DD' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'pfms', label: 'PFMS' },
];

export const SUBMISSION_MODE_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'email', label: 'Email' },
  { value: 'portal', label: 'Agency Portal' },
  { value: 'post', label: 'Post / Courier' },
];

/**
 * The proposal statuses in the order a proposal passes through them. Later
 * sections of the form only appear once the proposal has reached the stage they
 * describe — there is nothing to record about a sanction while the agency is
 * still evaluating the proposal.
 */
export const PROPOSAL_STAGE_ORDER: ProposalStatus[] = [
  'draft',
  'submitted',
  'accepted_for_evaluation',
  'shortlisted',
  'shortlisted_for_presentation',
  'result_announced',
];

/** True when `current` is at or past `required` in the pipeline above. */
export function hasReachedProposalStage(
  current: ProposalStatus,
  required: ProposalStatus,
): boolean {
  return PROPOSAL_STAGE_ORDER.indexOf(current) >= PROPOSAL_STAGE_ORDER.indexOf(required);
}

export const PROPOSAL_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'accepted_for_evaluation', label: 'Accepted for Evaluation' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'shortlisted_for_presentation', label: 'Shortlisted for Presentation' },
  { value: 'result_announced', label: 'Result Announced' },
];

export const RESULT_MODE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
  { value: 'letter', label: 'Letter' },
  { value: 'portal', label: 'Agency Portal' },
  { value: 'phone', label: 'Phone' },
];

export const FINAL_RESULT_OPTIONS = [
  { value: 'selected', label: 'Selected' },
  { value: 'not_selected', label: 'Not Selected' },
];

export const SANCTION_MODE_OPTIONS = [
  { value: 'installment', label: 'Installment' },
  { value: 'advance', label: 'Advance' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'advance_reimbursement', label: 'Advance + Reimbursement' },
];

export const PROJECT_STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

/** Government of India programmes projects are commonly aligned with. */
export const NATIONAL_INITIATIVES = [
  'Atmanirbhar Bharat',
  'Atal Innovation Mission',
  'Digital India',
  'Green Hydrogen Mission',
  'Jal Jeevan Mission',
  'Make in India',
  'National Education Policy 2020',
  'National Mission on Quantum Technologies',
  'National Quantum Mission',
  'National Solar Mission',
  'Skill India',
  'Smart Cities Mission',
  'Startup India',
  'Svamitva',
  'Swachh Bharat Mission',
  'Unnat Bharat Abhiyan',
  'Vocal for Local',
];

/** The 17 UN Sustainable Development Goals, worded as in the journal form. */
export const SUSTAINABLE_DEVELOPMENT_GOALS = [
  '1. No Poverty',
  '2. Zero Hunger',
  '3. Good Health and Well-being',
  '4. Quality Education',
  '5. Gender Equality',
  '6. Clean Water and Sanitation',
  '7. Affordable and Clean Energy',
  '8. Decent Work and Economic Growth',
  '9. Industry, Innovation and Infrastructure',
  '10. Reduced Inequality',
  '11. Sustainable Cities and Communities',
  '12. Responsible Consumption and Production',
  '13. Climate Action',
  '14. Life Below Water',
  '15. Life on Land',
  '16. Peace and Justice Strong Institutions',
  '17. Partnerships for the Goals',
];

export const PROJECT_DOCUMENT_LABELS: Record<ProjectDocumentType, string> = {
  presentation: 'Presentation File',
  sanction_order: 'Sanction Order',
  project_report: 'Project Report',
  utilization_certificate_soe: 'Utilization Certificate & SoE',
  bill_copies: 'Bill Copies',
  bank_statement: 'Bank Statement',
};

/** The four cards under "Final Documents", in the order the design shows them. */
export const FINAL_DOCUMENT_TYPES: ProjectDocumentType[] = [
  'project_report',
  'utilization_certificate_soe',
  'bill_copies',
  'bank_statement',
];

export const DISBURSEMENT_SLOT_LABELS: Record<DisbursementSlot, string> = {
  sanction: 'Sanction',
  uc_soe: 'UC & SoE',
  report: 'Report',
};

export const DISBURSEMENT_SLOTS: DisbursementSlot[] = ['sanction', 'uc_soe', 'report'];

export const OUTCOME_FIELDS = [
  { key: 'journalArticles', label: 'Journal Article' },
  { key: 'conferences', label: 'Conference' },
  { key: 'iprs', label: 'IPR' },
  { key: 'products', label: 'Product' },
  { key: 'techTransfers', label: 'Tech Transfer' },
  { key: 'startups', label: 'Start-up' },
] as const;

/**
 * Indian financial years for the year dropdowns — the budget allotment columns,
 * the grant disbursements and the ledger — as a window around the current year,
 * so past tranches and a future year's release are both selectable.
 *
 * Oldest first, as a calendar reads. The current year was once listed first,
 * then the years ahead, then the years behind, to keep the likeliest year at
 * the top — but a list that ran 2026-27 … 2029-30 and then jumped back to
 * 2025-26 read as out of order. The likeliest year is kept in reach instead by
 * opening the picker scrolled to it: see `SelectField`'s `scrollToValue` and
 * `currentFinancialYear` below.
 */
export function financialYearOptions(yearsBack = 3, yearsAhead = 3): string[] {
  const currentStart = currentFinancialYearStart();

  const options: string[] = [];
  for (let start = currentStart - yearsBack; start <= currentStart + yearsAhead; start += 1) {
    options.push(financialYearLabel(start));
  }
  return options;
}

// A financial year runs April–March, so before April the current one started in
// the previous calendar year.
function currentFinancialYearStart(): number {
  const today = new Date();
  return today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
}

function financialYearLabel(start: number): string {
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Today's financial year, as `2026-27` — where the year pickers open when nothing is picked. */
export function currentFinancialYear(): string {
  return financialYearLabel(currentFinancialYearStart());
}

/**
 * The financial year an ISO date falls in, as `2026-27`. Mirrors
 * `financialYearForDate` on the server, which fills the same column when a
 * ledger row arrives dated but not yeared.
 */
export function financialYearForDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';

  const [year, month] = isoDate.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** The tabs across the top of the project form, in order. */
export const PROJECT_FORM_TABS = [
  { id: 'details', label: 'Project Details' },
  { id: 'budget', label: 'Budget' },
  { id: 'transaction', label: 'Transaction' },
  // Last, and read-only: every figure on it is derived from the two tabs
  // before it, so it is where you go once the budget and the ledger are in.
  { id: 'summary', label: 'Summary' },
] as const;

export type ProjectFormTab = (typeof PROJECT_FORM_TABS)[number]['id'];

/**
 * A stored website is only ever opened as a link, so anything that is not an
 * http(s) URL is dropped: a `javascript:` value saved through the master-data
 * screens would otherwise run when someone clicks through to the scheme.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
