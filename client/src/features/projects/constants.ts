/**
 * Option lists and labels for the research-project form.
 *
 * These are stable national/UN vocabularies rather than institution data, so
 * they live in code next to the form (as the journal form does for SDGs)
 * instead of in a master table an admin would have to seed.
 */

import type {
  DisbursementSlot,
  ManpowerSlot,
  OutcomeDocumentSlot,
  ProjectDocumentType,
  ProposalStatus,
} from './types';

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
export const MAX_FACILITIES = 50;
export const MAX_MANPOWER = 50;
/** Per table on the Outcomes tab. */
export const MAX_OUTCOME_ROWS = 100;

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

/** What a Facility-tab row records, valued to match `project_facilities.facility_type`. */
export const FACILITY_TYPE_OPTIONS = [
  { value: 'synthesis', label: 'Synthesis' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'characterization', label: 'Characterization' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'software', label: 'Software' },
  { value: 'it_product', label: 'IT Product' },
];

/** The role a Manpower-tab row is employed in, valued to match `project_manpower.role`. */
export const MANPOWER_ROLE_OPTIONS = [
  { value: 'project_associate', label: 'Project Associate' },
  { value: 'research_associate', label: 'Research Associate' },
  { value: 'senior_research_fellow', label: 'Senior Research Fellow' },
  { value: 'junior_research_fellow', label: 'Junior Research Fellow' },
  { value: 'field_investigator', label: 'Field Investigator' },
  { value: 'field_worker', label: 'Field Worker' },
  { value: 'lab_technician', label: 'Lab Technician' },
];

/*
 * The Outcomes tab's closed lists, valued to match their columns' enums
 * (`project_publications.publication_type` and the rest).
 */
export const PUBLICATION_TYPE_OPTIONS = [
  { value: 'journal', label: 'Journal' },
  { value: 'conference', label: 'Conference' },
  { value: 'book_chapter', label: 'Book Chapter' },
];

export const IPR_TYPE_OPTIONS = [
  { value: 'patent', label: 'Patent' },
  { value: 'copyright', label: 'Copyright' },
  { value: 'design_patent', label: 'Design Patent' },
  { value: 'trademark', label: 'Trademark' },
  { value: 'geographical_indication', label: 'Geographical Indication' },
];

export const IPR_STATUS_OPTIONS = [
  { value: 'filed', label: 'Filed' },
  { value: 'published', label: 'Published' },
  { value: 'granted', label: 'Granted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

export const TECH_TRANSFER_CATEGORY_OPTIONS = [
  { value: 'startup', label: 'Start-up' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'product', label: 'Product' },
  { value: 'process', label: 'Process' },
  { value: 'service', label: 'Service' },
  { value: 'theory', label: 'Theory' },
  { value: 'variety', label: 'Variety' },
];

/** TRL 3 to 9; below 3 there is nothing to transfer yet. */
export const TRL_OPTIONS = [3, 4, 5, 6, 7, 8, 9].map((level) => ({
  value: String(level),
  label: `TRL ${level}`,
}));

export const CANDIDATE_DEGREE_OPTIONS = [
  { value: 'me_mtech', label: 'M.E./ M.Tech.' },
  { value: 'phd', label: 'Ph.D.' },
  { value: 'pdf', label: 'PDF' },
];

export const DOCUMENT_TRANSACTION_DIRECTION_OPTIONS = [
  { value: 'inward', label: 'Inward' },
  { value: 'outward', label: 'Outward' },
];

/**
 * The documents a project exchanges with its agency, filed under the direction
 * they travel in — the server refuses a kind under the other one. The `group`
 * is what the dropdown heads each list with.
 */
export const DOCUMENT_TRANSACTION_KIND_OPTIONS = [
  { value: 'sanction_order', label: 'Sanction Order', group: 'Inward', direction: 'inward' },
  { value: 'query', label: 'Query', group: 'Inward', direction: 'inward' },
  { value: 'acknowledgement', label: 'Acknowledgement', group: 'Outward', direction: 'outward' },
  {
    value: 'yearly_progress_report',
    label: 'Yearly Progress Report',
    group: 'Outward',
    direction: 'outward',
  },
  { value: 'revised_uc', label: 'Revised UC', group: 'Outward', direction: 'outward' },
  { value: 'clarification', label: 'Clarification', group: 'Outward', direction: 'outward' },
  {
    value: 'final_report_submission',
    label: 'Final Report Submission',
    group: 'Outward',
    direction: 'outward',
  },
];

/**
 * The kinds of grant a project can be, valued to match
 * `research_projects.project_type`. The icon is the Font Awesome class the
 * Select Project Type dialog shows on each tile.
 */
export const PROJECT_TYPE_OPTIONS = [
  { value: 'research_project', label: 'Research Project', icon: 'fa-flask' },
  { value: 'event', label: 'Event', icon: 'fa-calendar-days' },
  { value: 'travel_grant', label: 'Travel Grant', icon: 'fa-plane-departure' },
  { value: 'fellowship', label: 'Fellowship', icon: 'fa-user-graduate' },
];

export const DEFAULT_PROJECT_TYPE = 'research_project';

/**
 * The type a new project starts as, from the `?type=` the dialog navigates
 * with. Anything not on the list — a hand-edited URL, an old bookmark —
 * starts as a research project rather than as a value the save would refuse.
 */
export function projectTypeFromParam(value: string | null): string {
  return PROJECT_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as string)
    : DEFAULT_PROJECT_TYPE;
}

/** Proposal Details' research type, valued to match `research_projects.research_type`. */
export const RESEARCH_TYPE_OPTIONS = [
  { value: 'basic', label: 'Basic Research' },
  { value: 'applied', label: 'Applied Research' },
  { value: 'experimental', label: 'Experimental Research' },
  { value: 'statistical', label: 'Statistical Research' },
  { value: 'not_applicable', label: 'Not Applicable' },
];

/** Call for Details' funding source, valued to match `research_projects.funding_source`. */
export const FUNDING_SOURCE_OPTIONS = [
  { value: 'central_government', label: 'Central Government' },
  { value: 'state_government', label: 'State Government' },
  { value: 'public_sector_industry', label: 'Public Sector Industry' },
  { value: 'private_sector_industry', label: 'Private Sector Industry' },
  { value: 'startup', label: 'Start-up' },
  { value: 'higher_education', label: 'Higher Education Institution' },
  { value: 'other', label: 'Other' },
];

/** An Event or Fellowship's level, valued to match `research_projects.level`. */
export const LEVEL_OPTIONS = [
  { value: 'international', label: 'International' },
  { value: 'national', label: 'National' },
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

/** Where the grant-in-aid lands, valued to match `research_projects.grant_credited_to`. */
export const GRANT_CREDITED_TO_OPTIONS = [
  { value: 'pfms', label: 'PFMS' },
  { value: 'institution_account', label: 'Institution Account' },
  { value: 'individual_account', label: 'Individual Account' },
];

export const PROJECT_STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

/**
 * Only a completed or closed project has a closing date; the field is hidden
 * otherwise. The server applies the same rule (`projectPayload.js`).
 */
export const statusHasClosingDate = (status: string): boolean =>
  status === 'completed' || status === 'closed';

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

/** Mirrors `MANPOWER_SLOTS` on the server; the file part is `manpower__<key>__<slot>`. */
export const MANPOWER_SLOTS: ManpowerSlot[] = ['profile'];

/**
 * The one upload on a row that carries a single document. Mirrors
 * `TECH_TRANSFER_SLOTS`, `CANDIDATE_SLOTS` and `DOCUMENT_TRANSACTION_SLOTS` on
 * the server; the file part is `<scope>__<key>__document`.
 */
export const OUTCOME_DOCUMENT_SLOTS: OutcomeDocumentSlot[] = ['document'];

/** LEGACY: labels for the six typed counts older projects still show. */
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
  // Budget, Transaction and Summary, as sub-tabs: a "Summary" of its own up
  // here read as a summary of the whole project rather than of its money.
  { id: 'finance', label: 'Finance' },
  { id: 'facility', label: 'Facility' },
  { id: 'manpower', label: 'Manpower' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'documents', label: 'Documents' },
] as const;

export type ProjectFormTab = (typeof PROJECT_FORM_TABS)[number]['id'];

/**
 * The Finance tab's sub-tabs, in the order the money is entered: the budget is
 * allotted, the ledger records what moved against it, and the summary — read
 * only, every figure derived from the other two — sets one against the other.
 */
export const FINANCE_SECTIONS = [
  { id: 'budget', label: 'Budget' },
  { id: 'transaction', label: 'Transaction' },
  { id: 'summary', label: 'Summary' },
] as const;

export type FinanceSection = (typeof FINANCE_SECTIONS)[number]['id'];

interface ProjectTypeRules {
  /** Proposal Details asks the research type. */
  asksResearchType: boolean;
  /** Proposal Details asks the level, in the research type's place. */
  asksLevel: boolean;
  /** A project (and a scheme) of this type has a domain, picked in Call for Details. */
  schemeHasDomain: boolean;
  /** Tabs this type does not need — hidden while they hold nothing. */
  tabsNotRequired: ProjectFormTab[];
}

/**
 * What each project type asks for. The server applies the same research type
 * and level rule (`projectPayload.js`) and the same domain rule
 * (`schemeVocabulary.js`).
 */
export const PROJECT_TYPE_RULES: Record<string, ProjectTypeRules> = {
  research_project: {
    asksResearchType: true,
    asksLevel: false,
    schemeHasDomain: true,
    tabsNotRequired: [],
  },
  event: {
    asksResearchType: false,
    asksLevel: true,
    schemeHasDomain: true,
    tabsNotRequired: ['facility', 'manpower', 'outcomes'],
  },
  travel_grant: {
    asksResearchType: false,
    asksLevel: false,
    schemeHasDomain: false,
    tabsNotRequired: ['facility', 'manpower'],
  },
  fellowship: {
    asksResearchType: false,
    asksLevel: true,
    schemeHasDomain: true,
    tabsNotRequired: ['manpower'],
  },
};

/** The rules for a stored type, falling back to a research project's. */
export const projectTypeRules = (projectType: string): ProjectTypeRules =>
  PROJECT_TYPE_RULES[projectType] ?? PROJECT_TYPE_RULES[DEFAULT_PROJECT_TYPE];

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
