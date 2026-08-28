/**
 * Form state factories and the server → state mapping for the project form.
 *
 * Keeping this out of the components means the form can be created empty, be
 * hydrated from a saved project, and be diffed in tests without rendering.
 */

import { DEFAULT_COUNTRY, DISBURSEMENT_SLOTS, HOST_ORGANIZATION_NAME } from './constants';

import type {
  CollaboratorRow,
  DisbursementRow,
  DisbursementSlot,
  DocumentSlotState,
  FinanceRow,
  InvestigatorRow,
  MemberType,
  ProjectDocumentType,
  ProjectFormState,
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
    isPrimary: false,
    ...overrides,
  };
}

export function createCollaboratorRow(): CollaboratorRow {
  return {
    key: nextRowKey('collaborator'),
    category: '',
    role: '',
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
    heads: [],
    amount: '',
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
    investigators: [createInvestigatorRow({ isPrincipal: true, isPrimary: true })],

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
    ? project.investigators.map((row: any, index: number) =>
        createInvestigatorRow({
          memberType: (row.member_type ?? 'faculty') as MemberType,
          identityCode: text(row.identity_code),
          name: text(row.name),
          department: text(row.department),
          organization: text(row.organization),
          country: text(row.country),
          email: text(row.email),
          // The PI is whoever the saved display order puts first, matching the
          // form where the role follows the row's position.
          isPrincipal: index === 0,
          isPrimary: flag(row.is_primary),
        }),
      )
    : [];

  // A project saved before the corresponding-investigator flag existed has no
  // chosen row, so the PI stands in until someone picks another.
  if (investigators.length > 0 && !investigators.some((row) => row.isPrimary)) {
    investigators[0] = { ...investigators[0], isPrimary: true };
  }

  const collaborators: CollaboratorRow[] = Array.isArray(project?.collaborators)
    ? project.collaborators.map((row: any) => ({
        ...createCollaboratorRow(),
        category: text(row.category),
        role: text(row.role),
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
          heads: Array.isArray(row.heads)
            ? row.heads.map((head: any) => ({
                id: head.budget_head_id ?? null,
                name: text(head.budget_head_name),
              }))
            : [],
        }))
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

/** Sums the amount column of a finance table, ignoring blank rows. */
export function sumAmounts(rows: Array<{ amount: string }>): number {
  return rows.reduce((total, row) => {
    const amount = Number(String(row.amount).replace(/,/g, ''));
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
}

export { PROJECT_DOCUMENT_TYPES };
