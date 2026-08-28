/**
 * Normalization and validation for the research-project aggregate.
 *
 * The redesigned form saves the whole project in one request, so the shape that
 * arrives is a nested object rather than a flat row. This module turns that
 * client shape into the exact column values the model writes, and reports every
 * problem at once instead of failing on the first one — the form renders the
 * list against its own fields.
 *
 * Kept free of database and filesystem access so it can be unit tested.
 */

export const DRIVEN_BY_VALUES = ['faculty', 'student'];

export const MEMBER_TYPES = ['faculty', 'student', 'external'];

export const PROPOSAL_STATUSES = [
  'draft',
  'submitted',
  'accepted_for_evaluation',
  'shortlisted',
  'shortlisted_for_presentation',
  'result_announced',
];

export const SUBMISSION_MODES = ['online', 'offline', 'email', 'portal', 'post'];

export const RESULT_MODES = ['email', 'website', 'letter', 'portal', 'phone'];

export const FINAL_RESULTS = ['selected', 'not_selected'];

export const SANCTION_MODES = ['installment', 'advance', 'reimbursement', 'advance_reimbursement'];

export const PROJECT_STATUSES = ['ongoing', 'completed', 'closed'];

export const TAG_TYPES = ['national_initiative', 'sdg'];

export const FINANCE_ROW_TYPES = ['contribution', 'sharing'];

/** Document slots that hang off the project itself. */
export const PROJECT_DOCUMENT_TYPES = [
  'presentation',
  'sanction_order',
  'project_report',
  'utilization_certificate_soe',
  'bill_copies',
  'bank_statement',
];

/** Document slots that hang off a single grant-disbursement row. */
export const DISBURSEMENT_DOCUMENT_TYPES = [
  'disbursement_sanction',
  'disbursement_uc_soe',
  'disbursement_report',
];

export const DOCUMENT_TYPES = [...PROJECT_DOCUMENT_TYPES, ...DISBURSEMENT_DOCUMENT_TYPES];

/**
 * Short slot names used inside a disbursement row (`row.documents.sanction`)
 * mapped to the stored `document_type`.
 */
export const DISBURSEMENT_SLOTS = {
  sanction: 'disbursement_sanction',
  uc_soe: 'disbursement_uc_soe',
  report: 'disbursement_report',
};

/** Directory under `uploads/` each document type is stored in. */
export const DOCUMENT_UPLOAD_DIRS = {
  presentation: 'project-presentation',
  sanction_order: 'sanctionOrder',
  project_report: 'projectReport',
  utilization_certificate_soe: 'ucAndSoE',
  bill_copies: 'project-bill-copies',
  bank_statement: 'bankStatement',
  disbursement_sanction: 'sanctionLetter',
  disbursement_uc_soe: 'ucAndSoE',
  disbursement_report: 'projectReport',
};

export const MAX_INVESTIGATORS = 15;
export const MAX_COLLABORATORS = 20;
export const MAX_FINANCE_ROWS = 30;
export const MAX_DISBURSEMENTS = 30;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FINANCIAL_YEAR = /^\d{4}-\d{2}$/;

const trimmed = (value) => (value === null || value === undefined ? '' : String(value).trim());

/** Empty string, `null` and `undefined` all collapse to a NULL column. */
export function toNullableString(value, maxLength) {
  const text = trimmed(value);
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
}

/** Accepts booleans, 0/1, and the "true"/"false"/"yes"/"no" strings forms send. */
export function toBoolean(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  const text = trimmed(value).toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on' ? 1 : 0;
}

/**
 * Date inputs post `YYYY-MM-DD`; a cleared input posts `''`. Anything that is
 * neither is reported rather than silently dropped, because a bad date usually
 * means a client bug and a NULL would look like "not filled yet".
 */
export function toDate(value, field, errors) {
  const text = trimmed(value);
  if (!text) return null;

  const candidate = ISO_DATE.test(text) ? text : '';
  if (!candidate || Number.isNaN(new Date(`${candidate}T00:00:00Z`).getTime())) {
    errors.push({ field, message: 'Enter a valid date.' });
    return null;
  }
  return candidate;
}

export function toAmount(value, field, errors) {
  const text = trimmed(value).replace(/,/g, '');
  if (!text) return null;

  const amount = Number(text);
  if (!Number.isFinite(amount)) {
    errors.push({ field, message: 'Enter a valid amount.' });
    return null;
  }
  if (amount < 0) {
    errors.push({ field, message: 'Amount cannot be negative.' });
    return null;
  }
  return Math.round(amount * 100) / 100;
}

export function toCount(value, field, errors, max = 100000) {
  const text = trimmed(value);
  if (!text) return 0;

  const count = Number(text);
  if (!Number.isInteger(count) || count < 0 || count > max) {
    errors.push({ field, message: 'Enter a whole number of 0 or more.' });
    return 0;
  }
  return count;
}

export function toId(value) {
  const text = trimmed(value);
  if (!text) return null;
  const id = Number(text);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Enum columns reject unknown values with a MySQL warning (or an error under
 * strict mode), so unknown input is surfaced as a validation error instead.
 */
export function toEnum(value, allowed, field, errors, { fallback = null } = {}) {
  const text = trimmed(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!text) return fallback;
  if (!allowed.includes(text)) {
    errors.push({ field, message: `Unsupported value "${value}".` });
    return fallback;
  }
  return text;
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => trimmed(item)).filter(Boolean))];
  }
  const text = trimmed(value);
  return text ? [text] : [];
}

function normalizeInvestigators(raw, errors) {
  const rows = Array.isArray(raw) ? raw : [];

  if (rows.length === 0) {
    errors.push({ field: 'investigators', message: 'Add at least one investigator.' });
    return [];
  }
  if (rows.length > MAX_INVESTIGATORS) {
    errors.push({
      field: 'investigators',
      message: `A project can have at most ${MAX_INVESTIGATORS} investigators.`,
    });
  }

  const investigators = rows.slice(0, MAX_INVESTIGATORS).map((row, index) => {
    const field = `investigators[${index}]`;
    const memberType = toEnum(
      row?.member_type ?? row?.memberType,
      MEMBER_TYPES,
      `${field}.member_type`,
      errors,
      {
        fallback: 'faculty',
      },
    );

    const investigator = {
      member_type: memberType,
      // The faculty ERP id / student register number the row was picked with.
      // The model resolves it to an `authors` row; it is not stored directly.
      identity_code: toNullableString(
        row?.identity_code ?? row?.author_id ?? row?.register_no,
        255,
      ),
      name: toNullableString(row?.name, 255),
      department: toNullableString(row?.department, 255),
      organization: toNullableString(row?.organization, 255),
      country: toNullableString(row?.country, 100),
      email: toNullableString(row?.email, 255),
      is_principal: toBoolean(row?.is_principal ?? row?.isPrincipal),
      // The chosen corresponding investigator, independent of the PI, which the
      // row order decides.
      is_primary: toBoolean(row?.is_primary ?? row?.isPrimary),
      display_order: index,
    };

    if (!investigator.name) {
      errors.push({ field: `${field}.name`, message: 'Investigator name is required.' });
    }
    // Faculty must resolve to an employee record — that link is what puts the
    // project on their dashboard. Student rows are stored inline (the form
    // captures a name and department, not a register number), so they only need
    // an identity code when a caller supplies one.
    if (memberType === 'faculty' && !investigator.identity_code) {
      errors.push({
        field: `${field}.identity_code`,
        message: 'Select a faculty member from the search results.',
      });
    }
    if (memberType === 'student' && !investigator.department) {
      errors.push({
        field: `${field}.department`,
        message: 'Select the student’s department.',
      });
    }
    if (memberType === 'external' && !investigator.organization) {
      errors.push({
        field: `${field}.organization`,
        message: 'Organization is required for an external investigator.',
      });
    }
    if (investigator.email && !EMAIL_PATTERN.test(investigator.email)) {
      errors.push({ field: `${field}.email`, message: 'Enter a valid email address.' });
    }

    return investigator;
  });

  // Exactly one PI: honour the first flagged row, and fall back to the first row
  // so a project is never stored without one.
  const principalIndex = investigators.findIndex((row) => row.is_principal);
  const resolvedPrincipal = principalIndex === -1 ? 0 : principalIndex;
  investigators.forEach((row, index) => {
    row.is_principal = index === resolvedPrincipal ? 1 : 0;
  });

  // Exactly one corresponding investigator too; unchosen falls back to the PI.
  const primaryIndex = investigators.findIndex((row) => row.is_primary);
  const resolvedPrimary = primaryIndex === -1 ? resolvedPrincipal : primaryIndex;
  investigators.forEach((row, index) => {
    row.is_primary = index === resolvedPrimary ? 1 : 0;
  });

  return investigators;
}

function normalizeCollaborators(raw, enabled, errors) {
  if (!enabled) return [];

  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length > MAX_COLLABORATORS) {
    errors.push({
      field: 'collaborators',
      message: `A project can have at most ${MAX_COLLABORATORS} collaborators.`,
    });
  }

  return (
    rows
      .slice(0, MAX_COLLABORATORS)
      .map((row, index) => ({
        category: toNullableString(row?.category, 100),
        role: toNullableString(row?.role, 255),
        organization_id: toId(row?.organization_id ?? row?.organizationId),
        organization_name: toNullableString(row?.organization_name ?? row?.organizationName, 255),
        city: toNullableString(row?.city, 150),
        has_active_mou: toBoolean(row?.has_active_mou ?? row?.hasActiveMou),
        contact_name: toNullableString(row?.contact_name ?? row?.contactName, 255),
        contact_designation: toNullableString(
          row?.contact_designation ?? row?.contactDesignation,
          150,
        ),
        contact_email: toNullableString(row?.contact_email ?? row?.contactEmail, 255),
        // The form keys its inline errors by the index it rendered the row at,
        // so validation below must report the submitted index and not the one
        // left after blank rows are dropped.
        sourceIndex: index,
        display_order: index,
      }))
      // A row the user added but never filled in is dropped instead of failing the save.
      .filter((row) => row.organization_id || row.organization_name || row.role || row.contact_name)
      .map(({ sourceIndex, ...row }, index) => {
        const field = `collaborators[${sourceIndex}]`;
        if (!row.organization_id && !row.organization_name) {
          errors.push({
            field: `${field}.organization`,
            message: 'Select a collaborating organization.',
          });
        }
        if (row.contact_email && !EMAIL_PATTERN.test(row.contact_email)) {
          errors.push({ field: `${field}.contact_email`, message: 'Enter a valid email address.' });
        }
        return { ...row, display_order: index };
      })
  );
}

function normalizeBudgetHeads(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const seen = new Set();

  return rows.reduce((heads, head) => {
    const id = toId(typeof head === 'object' ? (head?.budget_head_id ?? head?.id) : head);
    const name = toNullableString(
      typeof head === 'object' ? (head?.budget_head_name ?? head?.name) : '',
      255,
    );
    if (!id && !name) return heads;

    // The junction table is unique on (row, head), so duplicates are dropped
    // here rather than surfacing as a save error.
    const key = id ? `id:${id}` : `name:${name.toLowerCase()}`;
    if (seen.has(key)) return heads;
    seen.add(key);

    heads.push({ budget_head_id: id, budget_head_name: name });
    return heads;
  }, []);
}

function normalizeFinanceRows(raw, rowType, enabled, errors) {
  if (!enabled) return [];

  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length > MAX_FINANCE_ROWS) {
    errors.push({
      field: `${rowType}_rows`,
      message: `At most ${MAX_FINANCE_ROWS} rows are supported.`,
    });
  }

  return rows
    .slice(0, MAX_FINANCE_ROWS)
    .map((row, index) => ({
      row_type: rowType,
      organization_id: toId(row?.organization_id ?? row?.organizationId),
      organization_name: toNullableString(row?.organization_name ?? row?.organizationName, 255),
      amount: toAmount(row?.amount, `${rowType}_rows[${index}].amount`, errors),
      heads: normalizeBudgetHeads(row?.heads ?? row?.budget_heads),
      // The form keys its inline errors by the index it rendered the row at, so
      // validation below must report the submitted index and not the one left
      // after blank rows are dropped. `toAmount` above already uses it.
      sourceIndex: index,
    }))
    .filter((row) => row.organization_id || row.organization_name || row.amount || row.heads.length)
    .map(({ sourceIndex, ...row }, index) => {
      if (!row.organization_id && !row.organization_name) {
        errors.push({
          field: `${rowType}_rows[${sourceIndex}].organization`,
          message: 'Select an organization.',
        });
      }
      if (row.amount === null) {
        errors.push({
          field: `${rowType}_rows[${sourceIndex}].amount`,
          message: 'Enter an amount.',
        });
      }
      return { ...row, display_order: index };
    });
}

/**
 * @param {Set<string>} keysWithDocuments row keys that carry an uploaded file in
 *   this request. A row whose only content is a document is not a blank row, so
 *   it must survive the blank-row filter below — otherwise the file it belongs
 *   to has no row to attach to and is discarded.
 */
function normalizeDisbursements(raw, errors, keysWithDocuments = new Set()) {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length > MAX_DISBURSEMENTS) {
    errors.push({
      field: 'disbursements',
      message: `At most ${MAX_DISBURSEMENTS} disbursements are supported.`,
    });
  }

  return rows
    .slice(0, MAX_DISBURSEMENTS)
    .map((row, index) => {
      const field = `disbursements[${index}]`;
      const financialYear = toNullableString(row?.financial_year ?? row?.financialYear, 9);
      if (financialYear && !FINANCIAL_YEAR.test(financialYear)) {
        errors.push({ field: `${field}.financial_year`, message: 'Use the 2025-26 format.' });
      }

      return {
        // Existing row id, so an update keeps the row (and the document rows
        // that hang off it) instead of recreating it.
        id: toId(row?.id),
        // Stable client-side key: names the file fields for this row's documents
        // and links `removed_documents` entries back to it.
        key: toNullableString(row?.key, 64) || `row-${index}`,
        financial_year: financialYear,
        organization_id: toId(row?.organization_id ?? row?.organizationId),
        organization_name: toNullableString(row?.organization_name ?? row?.organizationName, 255),
        amount: toAmount(row?.amount, `${field}.amount`, errors),
        disbursement_date: toDate(
          row?.disbursement_date ?? row?.disbursementDate,
          `${field}.disbursement_date`,
          errors,
        ),
        removed_documents: toStringArray(row?.removed_documents ?? row?.removedDocuments).filter(
          (slot) => Object.hasOwn(DISBURSEMENT_SLOTS, slot),
        ),
        display_order: index,
      };
    })
    .filter(
      (row) =>
        row.id ||
        row.financial_year ||
        row.organization_id ||
        row.organization_name ||
        row.amount ||
        row.disbursement_date ||
        row.removed_documents.length > 0 ||
        keysWithDocuments.has(row.key),
    )
    .map((row, index) => ({ ...row, display_order: index }));
}

/**
 * Turns the request body into `{ project, investigators, tags, ... }` plus the
 * list of validation errors. `project` maps 1:1 onto `research_projects`
 * columns so the model can insert it without further translation.
 */
/**
 * @param {object} input request payload
 * @param {object} [options]
 * @param {string[]} [options.rowKeysWithDocuments] disbursement row keys that
 *   have a file attached in this request, so those rows are not mistaken for
 *   blank ones.
 */
export function normalizeProjectPayload(input = {}, { rowKeysWithDocuments = [] } = {}) {
  const errors = [];
  const body = input && typeof input === 'object' ? input : {};

  const collaboratorsEnabled = toBoolean(body.collaborators_enabled ?? body.collaboratorsEnabled);
  const financialContributionEnabled = toBoolean(
    body.financial_contribution_enabled ?? body.financialContributionEnabled,
  );
  const financeSharingEnabled = toBoolean(
    body.finance_sharing_enabled ?? body.financeSharingEnabled,
  );
  const presentationEnabled = toBoolean(body.presentation_enabled ?? body.presentationEnabled);

  const title = toNullableString(body.title, 500);
  if (!title) {
    errors.push({ field: 'title', message: 'Title is required.' });
  }

  const project = {
    driven_by: toEnum(body.driven_by ?? body.drivenBy, DRIVEN_BY_VALUES, 'driven_by', errors, {
      fallback: 'faculty',
    }),
    title,
    project_cost: toAmount(body.project_cost ?? body.projectCost, 'project_cost', errors),
    duration_years: toCount(
      body.duration_years ?? body.durationYears,
      'duration_years',
      errors,
      50,
    ),
    duration_months: toCount(
      body.duration_months ?? body.durationMonths,
      'duration_months',
      errors,
      11,
    ),
    duration_days: toCount(body.duration_days ?? body.durationDays, 'duration_days', errors, 30),

    funding_organization_id: toId(body.funding_organization_id ?? body.fundingOrganizationId),
    scheme_id: toId(body.scheme_id ?? body.schemeId),

    collaborators_enabled: collaboratorsEnabled,
    financial_contribution_enabled: financialContributionEnabled,
    finance_sharing_enabled: financeSharingEnabled,
    presentation_enabled: presentationEnabled,

    submitted_on: toDate(body.submitted_on ?? body.submittedOn, 'submitted_on', errors),
    submission_mode: toEnum(
      body.submission_mode ?? body.submissionMode,
      SUBMISSION_MODES,
      'submission_mode',
      errors,
    ),
    reference_number: toNullableString(body.reference_number ?? body.referenceNumber, 150),
    cfrd_copy_submitted: toBoolean(body.cfrd_copy_submitted ?? body.cfrdCopySubmitted),
    cfrd_copy_submitted_on: toDate(
      body.cfrd_copy_submitted_on ?? body.cfrdCopySubmittedOn,
      'cfrd_copy_submitted_on',
      errors,
    ),
    proposal_status: toEnum(
      body.proposal_status ?? body.proposalStatus,
      PROPOSAL_STATUSES,
      'proposal_status',
      errors,
      { fallback: 'draft' },
    ),

    presentation_date: presentationEnabled
      ? toDate(body.presentation_date ?? body.presentationDate, 'presentation_date', errors)
      : null,
    presentation_venue: presentationEnabled
      ? toNullableString(body.presentation_venue ?? body.presentationVenue, 255)
      : null,
    presentation_panelists: presentationEnabled
      ? toNullableString(body.presentation_panelists ?? body.presentationPanelists, 1000)
      : null,

    result_mode: toEnum(body.result_mode ?? body.resultMode, RESULT_MODES, 'result_mode', errors),
    result_date: toDate(body.result_date ?? body.resultDate, 'result_date', errors),
    final_result: toEnum(
      body.final_result ?? body.finalResult,
      FINAL_RESULTS,
      'final_result',
      errors,
    ),

    sanction_date: toDate(body.sanction_date ?? body.sanctionDate, 'sanction_date', errors),
    sanction_reference_no: toNullableString(
      body.sanction_reference_no ?? body.sanctionReferenceNo,
      150,
    ),
    sanction_mode: toEnum(
      body.sanction_mode ?? body.sanctionMode,
      SANCTION_MODES,
      'sanction_mode',
      errors,
    ),

    project_start_date: toDate(
      body.project_start_date ?? body.projectStartDate,
      'project_start_date',
      errors,
    ),
    project_closing_date: toDate(
      body.project_closing_date ?? body.projectClosingDate,
      'project_closing_date',
      errors,
    ),
    project_status: toEnum(
      body.project_status ?? body.projectStatus,
      PROJECT_STATUSES,
      'project_status',
      errors,
    ),

    outcome_journal_articles: toCount(
      body.outcome_journal_articles ?? body.outcomeJournalArticles,
      'outcome_journal_articles',
      errors,
    ),
    outcome_conferences: toCount(
      body.outcome_conferences ?? body.outcomeConferences,
      'outcome_conferences',
      errors,
    ),
    outcome_iprs: toCount(body.outcome_iprs ?? body.outcomeIprs, 'outcome_iprs', errors),
    outcome_products: toCount(
      body.outcome_products ?? body.outcomeProducts,
      'outcome_products',
      errors,
    ),
    outcome_tech_transfers: toCount(
      body.outcome_tech_transfers ?? body.outcomeTechTransfers,
      'outcome_tech_transfers',
      errors,
    ),
    outcome_startups: toCount(
      body.outcome_startups ?? body.outcomeStartups,
      'outcome_startups',
      errors,
    ),

    remarks: toNullableString(body.remarks),
  };

  if (
    project.project_start_date &&
    project.project_closing_date &&
    project.project_closing_date < project.project_start_date
  ) {
    errors.push({
      field: 'project_closing_date',
      message: 'Closing date cannot be before the start date.',
    });
  }

  if (project.scheme_id && !project.funding_organization_id) {
    errors.push({
      field: 'funding_organization_id',
      message: 'Select the funding agency the scheme belongs to.',
    });
  }

  const aggregate = {
    project,
    investigators: normalizeInvestigators(body.investigators, errors),
    tags: {
      national_initiative: toStringArray(body.national_initiatives ?? body.nationalInitiatives).map(
        (value) => value.slice(0, 255),
      ),
      sdg: toStringArray(body.sdgs).map((value) => value.slice(0, 255)),
    },
    collaborators: normalizeCollaborators(body.collaborators, collaboratorsEnabled, errors),
    financeRows: [
      ...normalizeFinanceRows(
        body.financial_contributions ?? body.financialContributions,
        'contribution',
        financialContributionEnabled,
        errors,
      ),
      ...normalizeFinanceRows(
        body.finance_sharing ?? body.financeSharing,
        'sharing',
        financeSharingEnabled,
        errors,
      ),
    ],
    disbursements: normalizeDisbursements(
      body.disbursements,
      errors,
      new Set(rowKeysWithDocuments),
    ),
    // Project-level document slots the user cleared. Files themselves arrive as
    // multipart parts and are handled by the controller. Slots that are neither
    // cleared nor re-uploaded keep whatever is already stored.
    removedDocuments: [
      ...toStringArray(body.removed_documents ?? body.removedDocuments).filter((type) =>
        PROJECT_DOCUMENT_TYPES.includes(type),
      ),
      // Switching the Presentation section off says no presentation happened,
      // which clears its fields — its file goes with them rather than being
      // left behind with nothing pointing at it.
      ...(presentationEnabled ? [] : ['presentation']),
    ],
  };

  return { aggregate, errors };
}

/**
 * Field name a multipart file part must use for a given slot. Mirrored by the
 * client so both sides agree without a shared runtime.
 */
export function documentFieldName(documentType) {
  return `document__${documentType}`;
}

export function disbursementDocumentFieldName(rowKey, slot) {
  return `disbursement__${rowKey}__${slot}`;
}

/** Parses a multipart field name back into the slot it targets. */
export function parseDocumentFieldName(fieldName) {
  const name = trimmed(fieldName);

  if (name.startsWith('document__')) {
    const documentType = name.slice('document__'.length);
    return PROJECT_DOCUMENT_TYPES.includes(documentType)
      ? { scope: 'project', documentType }
      : null;
  }

  if (name.startsWith('disbursement__')) {
    const rest = name.slice('disbursement__'.length);
    const separator = rest.lastIndexOf('__');
    if (separator <= 0) return null;

    const rowKey = rest.slice(0, separator);
    const slot = rest.slice(separator + 2);
    return Object.hasOwn(DISBURSEMENT_SLOTS, slot)
      ? { scope: 'disbursement', rowKey, slot, documentType: DISBURSEMENT_SLOTS[slot] }
      : null;
  }

  return null;
}
