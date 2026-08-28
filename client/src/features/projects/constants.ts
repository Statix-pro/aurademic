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

/** Matches the server-side document check advertised on every upload control. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_ACCEPT = 'application/pdf';

export const MEMBER_TYPE_OPTIONS = [
  { value: 'faculty', label: 'Faculty' },
  { value: 'student', label: 'Student' },
  { value: 'external', label: 'External' },
] as const;

export const COLLABORATOR_CATEGORIES = [
  'Academic',
  'Industry',
  'Government',
  'Research Laboratory',
  'NGO',
  'International',
  'Other',
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
 * Indian financial years for the disbursement dropdown: a window around the
 * current year, so past tranches and next year's release are both selectable.
 */
export function financialYearOptions(yearsBack = 10, yearsAhead = 3): string[] {
  const today = new Date();
  // A financial year runs April–March, so before April the current one started
  // in the previous calendar year.
  const currentStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;

  const options: string[] = [];
  for (let start = currentStart + yearsAhead; start >= currentStart - yearsBack; start -= 1) {
    options.push(`${start}-${String((start + 1) % 100).padStart(2, '0')}`);
  }
  return options;
}
