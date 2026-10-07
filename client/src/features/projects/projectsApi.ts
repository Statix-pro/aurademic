/**
 * API layer for the research-project form.
 *
 * A project is saved in one request: a `payload` JSON part carrying the whole
 * aggregate plus one file part per document slot. This module owns the wire
 * format — the snake_case field names and the `document__*` /
 * `disbursement__<key>__<slot>` part names the server parses.
 */

import { DISBURSEMENT_SLOTS, MANPOWER_SLOTS, OUTCOME_DOCUMENT_SLOTS } from './constants';
import { PROJECT_DOCUMENT_TYPES, allotmentKey } from './projectFormState';
import authenticityUtility from '../../shared/utils/authenticityUtility';

import type {
  DocumentSlotState,
  DoiLookupResult,
  EmployeeSearchResult,
  FinanceRow,
  ProjectFieldError,
  ProjectFormState,
  ProjectLookups,
  ProjectOrganization,
  ProjectScheme,
} from './types';

/** An API rejection carrying per-field messages the form can render inline. */
export class ProjectSaveError extends Error {
  fieldErrors: ProjectFieldError[];

  constructor(message: string, fieldErrors: ProjectFieldError[] = []) {
    super(message);
    this.name = 'ProjectSaveError';
    this.fieldErrors = fieldErrors;
  }
}

// The response interceptor unwraps `response.data`, so calls resolve to the
// API envelope itself.
interface Envelope<T> {
  success?: boolean;
  status?: string;
  message?: string;
  data?: T;
  errors?: ProjectFieldError[];
}

const nullableNumber = (value: string): number | null => {
  const trimmed = value.trim().replace(/,/g, '');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const count = (value: string): number => {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const financeRowPayload = (row: FinanceRow) => ({
  organization_id: row.organizationId,
  organization_name: row.organizationName || null,
  amount: nullableNumber(row.amount),
  covers_all_heads: row.coversAllHeads,
  heads: row.coversAllHeads ? [] : row.heads.map((name) => ({ budget_head_name: name })),
});

/** Slots whose stored file the user cleared without picking a replacement. */
const clearedSlots = <T extends string>(
  documents: Record<T, DocumentSlotState>,
  slots: readonly T[],
): T[] => slots.filter((slot) => documents[slot].removed && !documents[slot].file);

export function buildProjectPayload(form: ProjectFormState) {
  return {
    driven_by: form.drivenBy,

    title: form.title.trim(),
    project_cost: nullableNumber(form.projectCost),
    duration_years: count(form.durationYears),
    duration_months: count(form.durationMonths),
    duration_days: count(form.durationDays),
    national_initiatives: form.nationalInitiatives,
    sdgs: form.sdgs,

    funding_organization_id: form.fundingOrganizationId,
    scheme_id: form.schemeId,

    collaborators_enabled: form.collaboratorsEnabled,
    financial_contribution_enabled: form.financialContributionEnabled,
    finance_sharing_enabled: form.financeSharingEnabled,
    presentation_enabled: form.presentationEnabled,

    investigators: form.investigators.map((row) => ({
      member_type: row.memberType,
      identity_code: row.identityCode || null,
      name: row.name.trim(),
      department: row.department || null,
      organization: row.organization || null,
      country: row.country || null,
      email: row.email || null,
      is_principal: row.isPrincipal,
    })),

    collaborators: form.collaborators.map((row) => ({
      category: row.category || null,
      // `project_collaborators.role` is one column, and every screen that reads
      // a project back renders it as written, so the picks travel joined.
      role: row.roles.join(', ') || null,
      organization_id: row.organizationId,
      organization_name: row.organizationName || null,
      city: row.city || null,
      has_active_mou: row.hasActiveMou,
      contact_name: row.contactName || null,
      contact_designation: row.contactDesignation || null,
      contact_email: row.contactEmail || null,
    })),

    financial_contributions: form.financialContributions.map(financeRowPayload),
    finance_sharing: form.financeSharing.map(financeRowPayload),

    submitted_on: form.submittedOn || null,
    submission_mode: form.submissionMode || null,
    reference_number: form.referenceNumber || null,
    cfrd_copy_submitted: form.cfrdCopySubmitted,
    cfrd_copy_submitted_on: form.cfrdCopySubmittedOn || null,
    proposal_status: form.proposalStatus,

    presentation_date: form.presentationDate || null,
    presentation_venue: form.presentationVenue || null,
    presentation_panelists: form.presentationPanelists || null,

    result_mode: form.resultMode || null,
    result_date: form.resultDate || null,
    final_result: form.finalResult || null,

    sanction_date: form.sanctionDate || null,
    sanction_reference_no: form.sanctionReferenceNo || null,
    sanction_mode: form.sanctionMode || null,

    disbursements: form.disbursements.map((row) => ({
      id: row.id,
      key: row.key,
      financial_year: row.financialYear || null,
      organization_id: row.organizationId,
      organization_name: row.organizationName || null,
      amount: nullableNumber(row.amount),
      disbursement_date: row.disbursementDate || null,
      removed_documents: clearedSlots(row.documents, DISBURSEMENT_SLOTS),
    })),

    project_start_date: form.projectStartDate || null,
    project_closing_date: form.projectClosingDate || null,
    project_status: form.projectStatus || null,

    // The six typed outcome counts are not sent: the Outcomes tab's rows
    // replaced them, and the server keeps the counts older projects stored.

    income_heads: form.incomeHeads,

    // The allotment matrix travels as its three parts — columns, rows and the
    // amounts between them — stitched together by the form's own row keys,
    // which the server swaps for the ids it inserts.
    budget: {
      // Blank rows and columns are sent as they stand rather than filtered out
      // here: the server drops them itself, and sending the form's own indices
      // is what lets a validation error come back pointing at the right cell.
      years: form.budgetYears.map((column) => ({
        key: column.key,
        financial_year: column.financialYear || null,
      })),
      heads: form.budgetRows.map((row) => ({
        key: row.key,
        budget_head_name: row.budgetHeadName || null,
        contribution_organization_id: row.contributionOrganizationId,
        contribution_organization_name: row.contributionOrganizationName || null,
      })),
      allotments: form.budgetRows
        .flatMap((row) =>
          form.budgetYears.map((column) => ({
            head_key: row.key,
            year_key: column.key,
            amount: nullableNumber(form.budgetAllotments[allotmentKey(row.key, column.key)] ?? ''),
          })),
        )
        .filter((cell) => cell.amount !== null),
    },

    transaction_accounts: form.transactionAccounts.map((account) => ({
      account_option_id: account.accountOptionId,
      account_name: account.accountName || null,
      transactions: account.transactions.map((row) => ({
        financial_year: row.financialYear || null,
        transaction_date: row.transactionDate || null,
        head_kind: row.headKind,
        head_name: row.headName || null,
        particulars: row.particulars || null,
        reference_no: row.referenceNo || null,
        payment_mode: row.paymentMode || null,
        contribution_organization_id: row.contributionOrganizationId,
        contribution_organization_name: row.contributionOrganizationName || null,
        credit: nullableNumber(row.credit),
        debit: nullableNumber(row.debit),
        counts_as_actual: row.countsAsActual,
      })),
    })),

    // Blank rows are sent as they stand, like the ledger's: the server drops
    // them, and keeping the form's indices keeps its errors on the right row.
    facilities: form.facilities.map((row) => ({
      facility_name: row.facilityName || null,
      facility_type: row.facilityType || null,
      installation_date: row.installationDate || null,
      cost: nullableNumber(row.cost),
      make: row.make || null,
      model: row.model || null,
      serial_no: row.serialNo || null,
      stock_register_ref: row.stockRegisterRef || null,
      istem_listed: row.istemListed,
      istem_id: row.istemListed ? row.istemId || null : null,
      supplier_details: row.supplierDetails || null,
    })),

    // Sent with their ids and keys like the disbursements: the id keeps a row's
    // stored profile attached across edits, and the key names its file part.
    manpower: form.manpower.map((row) => ({
      id: row.id,
      key: row.key,
      role: row.role || null,
      name: row.name || null,
      qualification: row.qualification || null,
      salary: nullableNumber(row.salary),
      joining_date: row.joiningDate || null,
      mobile: row.mobile || null,
      email: row.email || null,
      remarks: row.remarks || null,
      relieving_date: row.relievingDate || null,
      removed_documents: clearedSlots(row.documents, MANPOWER_SLOTS),
    })),

    publications: form.publications.map((row) => ({
      publication_type: row.publicationType || null,
      doi: row.doi || null,
      journal_id: row.journalId,
      title: row.title || null,
      venue: row.venue || null,
      publication_year: row.publicationYear || null,
    })),

    iprs: form.iprs.map((row) => ({
      ipr_type: row.iprType || null,
      ipr_number: row.iprNumber || null,
      status: row.status || null,
      title: row.title || null,
      filing_date: row.filingDate || null,
      grant_date: row.grantDate || null,
    })),

    // Sent with ids and keys, like the manpower rows, so each row's stored
    // document stays attached and its file part can be named.
    tech_transfers: form.techTransfers.map((row) => ({
      id: row.id,
      key: row.key,
      category: row.category || null,
      description: row.description || null,
      trl: row.trl || null,
      removed_documents: clearedSlots(row.documents, OUTCOME_DOCUMENT_SLOTS),
    })),

    outcome_candidates: form.outcomeCandidates.map((row) => ({
      id: row.id,
      key: row.key,
      candidate_name: row.candidateName || null,
      degree: row.degree || null,
      university: row.university || null,
      removed_documents: clearedSlots(row.documents, OUTCOME_DOCUMENT_SLOTS),
    })),

    document_transactions: form.documentTransactions.map((row) => ({
      id: row.id,
      key: row.key,
      transaction_date: row.transactionDate || null,
      direction: row.direction || null,
      document_kind: row.documentKind || null,
      description: row.description || null,
      removed_documents: clearedSlots(row.documents, OUTCOME_DOCUMENT_SLOTS),
    })),

    removed_documents: clearedSlots(form.documents, PROJECT_DOCUMENT_TYPES),

    remarks: form.remarks || null,
  };
}

export function buildProjectFormData(form: ProjectFormState): FormData {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(buildProjectPayload(form)));

  PROJECT_DOCUMENT_TYPES.forEach((documentType) => {
    const slot = form.documents[documentType];
    if (slot.file) formData.append(`document__${documentType}`, slot.file);
  });

  form.disbursements.forEach((row) => {
    DISBURSEMENT_SLOTS.forEach((slot) => {
      const document = row.documents[slot];
      if (document.file) formData.append(`disbursement__${row.key}__${slot}`, document.file);
    });
  });

  form.manpower.forEach((row) => {
    MANPOWER_SLOTS.forEach((slot) => {
      const document = row.documents[slot];
      if (document.file) formData.append(`manpower__${row.key}__${slot}`, document.file);
    });
  });

  form.techTransfers.forEach((row) => {
    OUTCOME_DOCUMENT_SLOTS.forEach((slot) => {
      const document = row.documents[slot];
      if (document.file) formData.append(`tech_transfer__${row.key}__${slot}`, document.file);
    });
  });

  form.outcomeCandidates.forEach((row) => {
    OUTCOME_DOCUMENT_SLOTS.forEach((slot) => {
      const document = row.documents[slot];
      if (document.file) formData.append(`candidate__${row.key}__${slot}`, document.file);
    });
  });

  form.documentTransactions.forEach((row) => {
    OUTCOME_DOCUMENT_SLOTS.forEach((slot) => {
      const document = row.documents[slot];
      if (document.file) {
        formData.append(`document_transaction__${row.key}__${slot}`, document.file);
      }
    });
  });

  return formData;
}

/** Normalizes an axios rejection into a `ProjectSaveError`. */
function toSaveError(error: unknown, fallback: string): ProjectSaveError {
  const response = (error as { response?: { data?: Envelope<unknown> } })?.response;
  const body = response?.data;

  return new ProjectSaveError(
    body?.message || (error as Error)?.message || fallback,
    body?.errors ?? [],
  );
}

const projectsApi = {
  async fetchLookups(): Promise<ProjectLookups> {
    const response = (await authenticityUtility.get(
      '/project-lookups',
    )) as unknown as Envelope<ProjectLookups>;

    return {
      organizations: response.data?.organizations ?? [],
      schemes: response.data?.schemes ?? [],
      departments: response.data?.departments ?? [],
      accounts: response.data?.accounts ?? [],
      budgetHeads: response.data?.budgetHeads ?? [],
    };
  },

  async searchOrganizations(query: string, fundingOnly = false): Promise<ProjectOrganization[]> {
    const response = (await authenticityUtility.get('/project-options/organizations', {
      params: { query, fundingOnly },
    })) as unknown as Envelope<ProjectOrganization[]>;

    return response.data ?? [];
  },

  async fetchSchemes(organizationId: number): Promise<ProjectScheme[]> {
    const response = (await authenticityUtility.get('/project-options/schemes', {
      params: { organizationId },
    })) as unknown as Envelope<ProjectScheme[]>;

    return response.data ?? [];
  },

  /**
   * Publication details for a DOI, for the Outcomes tab's Fetch button. Rejects
   * with the server's message — "not found" and "could not reach the DOI
   * service" read differently to the user.
   */
  async lookupDoi(doi: string): Promise<DoiLookupResult> {
    try {
      const response = (await authenticityUtility.get('/project-options/doi', {
        params: { doi },
      })) as unknown as Envelope<DoiLookupResult>;
      if (!response.data) throw new Error('No publication was found for this DOI.');
      return response.data;
    } catch (error) {
      throw toSaveError(error, 'Failed to look up the DOI.');
    }
  },

  /** Faculty lookup for the investigator rows, shared with the journal form. */
  async searchFaculty(query: string): Promise<EmployeeSearchResult[]> {
    const response = (await authenticityUtility.get('/authors/search', {
      params: { query },
    })) as unknown as EmployeeSearchResult[];

    return Array.isArray(response) ? response : [];
  },

  async fetchProject(projectId: string | number): Promise<any> {
    const response = (await authenticityUtility.get(
      `/projects/${projectId}`,
    )) as unknown as Envelope<any>;

    if (!response.data) {
      throw new ProjectSaveError(response.message || 'The project could not be loaded.');
    }
    return response.data;
  },

  async saveProject(projectId: string | number | null, form: ProjectFormState): Promise<any> {
    const formData = buildProjectFormData(form);

    try {
      const response = (projectId
        ? await authenticityUtility.put(`/projects/${projectId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        : await authenticityUtility.post('/projects', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })) as unknown as Envelope<unknown>;

      if (!response.data) {
        throw new ProjectSaveError(response.message || 'The project could not be saved.');
      }
      return response.data;
    } catch (error) {
      if (error instanceof ProjectSaveError) throw error;
      throw toSaveError(error, 'The project could not be saved.');
    }
  },

  async deleteProject(projectId: string | number): Promise<void> {
    await authenticityUtility.delete(`/projects/${projectId}`);
  },

  async createRequest(request: {
    request_type: 'organization' | 'scheme';
    name: string;
    organization_id?: number | null;
    organization_name?: string;
    domain?: string;
    category?: string;
    website?: string;
  }): Promise<void> {
    try {
      await authenticityUtility.post('/project-requests', request);
    } catch (error) {
      throw toSaveError(error, 'The request could not be submitted.');
    }
  },

  /** Absolute URL for a stored document path. */
  fileUrl(filePath: string): string {
    if (!filePath) return '#';
    // getBaseURL() already drops the `/api` suffix; uploads are served from the
    // server root at `/uploads`.
    const baseUrl = authenticityUtility.getBaseURL().replace(/\/$/, '');
    return `${baseUrl}/${filePath.replace(/^\/+/, '')}`;
  },
};

export default projectsApi;
