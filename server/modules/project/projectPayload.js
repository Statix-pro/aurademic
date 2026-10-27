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

import { SCHEME_PROJECT_TYPES, schemeHasDomain } from '../shared/schemeVocabulary.js';

export const DRIVEN_BY_VALUES = ['faculty', 'student'];

/**
 * The `research_projects.project_type` enum, picked when a project is added.
 * The same list a scheme's type is drawn from, so it is defined once.
 */
export const PROJECT_TYPES = SCHEME_PROJECT_TYPES;

/** The `research_projects.level` enum, asked of an Event or Fellowship. */
export const LEVELS = ['international', 'national'];

/**
 * Which of Research Type and Level a project type asks for. An Event or a
 * Fellowship is classed by level instead of research type, and a Travel Grant
 * by neither.
 */
const ASKS_RESEARCH_TYPE = ['research_project'];
const ASKS_LEVEL = ['event', 'fellowship'];

/**
 * The project statuses that have a closing date. An ongoing project has not
 * closed, so the form hides the date until the status is one of these.
 */
const HAS_CLOSING_DATE = ['completed', 'closed'];

export const MEMBER_TYPES = ['faculty', 'student', 'external'];

export const PROPOSAL_STATUSES = [
  'draft',
  'submitted',
  'accepted_for_evaluation',
  'shortlisted',
  'shortlisted_for_presentation',
  'result_announced',
];

/** The `research_projects.research_type` enum, offered on Proposal Details. */
export const RESEARCH_TYPES = ['basic', 'applied', 'experimental', 'statistical', 'not_applicable'];

/** The `research_projects.funding_source` enum, offered on Call for Details. */
export const FUNDING_SOURCES = [
  'central_government',
  'state_government',
  'public_sector_industry',
  'private_sector_industry',
  'startup',
  'higher_education',
  'other',
];

export const SUBMISSION_MODES = ['online', 'offline', 'email', 'portal', 'post'];

export const RESULT_MODES = ['email', 'website', 'letter', 'portal', 'phone'];

export const FINAL_RESULTS = ['selected', 'not_selected'];

export const SANCTION_MODES = ['installment', 'advance', 'reimbursement', 'advance_reimbursement'];

/** The `research_projects.grant_credited_to` enum, offered on the Transaction tab. */
export const GRANT_CREDIT_TARGETS = ['pfms', 'institution_account', 'individual_account'];

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

/** Document slots that hang off a single manpower row. */
export const MANPOWER_DOCUMENT_TYPES = ['manpower_profile'];

/** Document slots that hang off an Outcomes-tab row. */
export const OUTCOME_DOCUMENT_TYPES = ['tech_transfer_document', 'candidate_document'];

/** The scanned copy on a Documents-tab row. */
export const DOCUMENT_TRANSACTION_DOCUMENT_TYPES = ['document_transaction_file'];

export const DOCUMENT_TYPES = [
  ...PROJECT_DOCUMENT_TYPES,
  ...DISBURSEMENT_DOCUMENT_TYPES,
  ...MANPOWER_DOCUMENT_TYPES,
  ...OUTCOME_DOCUMENT_TYPES,
  ...DOCUMENT_TRANSACTION_DOCUMENT_TYPES,
];

/**
 * Short slot names used inside a disbursement row (`row.documents.sanction`)
 * mapped to the stored `document_type`.
 */
export const DISBURSEMENT_SLOTS = {
  sanction: 'disbursement_sanction',
  uc_soe: 'disbursement_uc_soe',
  report: 'disbursement_report',
};

/** Short slot names used inside a manpower row, mapped to the stored `document_type`. */
export const MANPOWER_SLOTS = {
  profile: 'manpower_profile',
};

export const TECH_TRANSFER_SLOTS = {
  document: 'tech_transfer_document',
};

export const CANDIDATE_SLOTS = {
  document: 'candidate_document',
};

export const DOCUMENT_TRANSACTION_SLOTS = {
  document: 'document_transaction_file',
};

/**
 * Every kind of row that carries its own documents, by the scope name its
 * multipart fields start with (`<scope>__<rowKey>__<slot>`). The model reads
 * the same scope names to find the row each file belongs to.
 */
export const ROW_DOCUMENT_SCOPES = {
  disbursement: DISBURSEMENT_SLOTS,
  manpower: MANPOWER_SLOTS,
  tech_transfer: TECH_TRANSFER_SLOTS,
  candidate: CANDIDATE_SLOTS,
  document_transaction: DOCUMENT_TRANSACTION_SLOTS,
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
  manpower_profile: 'project-manpower-profile',
  tech_transfer_document: 'project-tech-transfer',
  candidate_document: 'project-outcome-candidate',
  document_transaction_file: 'project-document-transaction',
};

/** Which side of the Transaction Summary a ledger row is counted on. */
export const TRANSACTION_HEAD_KINDS = ['expenditure', 'income'];

/**
 * How the money moved, matching the `payment_mode` enum. Stored lower-cased —
 * `toEnum` normalizes to it — so the column holds one form of each mode however
 * the client spells it; the form renders the labels (NEFT, DD, PFMS).
 */
export const TRANSACTION_PAYMENT_MODES = ['neft', 'rtgs', 'dd', 'cheque', 'upi', 'cash', 'pfms'];

/**
 * The income side of the ledger: the four ways money reaches a project account,
 * which is a closed list rather than institution data — unlike the expenditure
 * heads below, which an administrator curates. Validated here, so a ledger row
 * can only be filed under one of them.
 *
 * Which of the four apply is a per-project choice, stored in
 * `project_income_heads` — see `normalizeIncomeHeads`. That narrows what the
 * form offers; this list stays the bound on what can be stored, so un-ticking a
 * head never makes a ledger row already filed under it unsaveable.
 */
export const PROJECT_INCOME_HEADS = [
  'Grant-in-aid',
  'Bank Interest',
  'HI Contribution',
  'Other Income',
];

/**
 * Resolves a submitted head to the name it is stored under, matched
 * case-insensitively so a name that only differs in case is not saved as a
 * second head on the same project. Returns '' for anything outside the
 * vocabulary.
 *
 * The vocabulary is `project_budget_head_options`, curated in the admin and
 * passed in by the caller — the heads a funding agency recognises, which is a
 * different list from the institution's own `budget_heads` catalog
 * (migrations/20260908_project_budget_heads_by_name.sql explains why). With no
 * vocabulary to match against, every head is stored exactly as submitted, which
 * is what an unrecognised name does anyway.
 */
export function budgetHeadCanonicalizer(budgetHeadNames = []) {
  const names = Array.isArray(budgetHeadNames) ? budgetHeadNames.filter(Boolean) : [];

  return (value) => {
    const name = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!name) return '';
    return names.find((head) => String(head).toLowerCase() === name) || '';
  };
}

/**
 * What kind of facility a Facility-tab row records, matching the
 * `project_facilities.facility_type` enum. A closed list the form offers as
 * fixed options; the form renders the labels (Characterization, IT Product).
 */
export const FACILITY_TYPES = [
  'synthesis',
  'manufacturing',
  'characterization',
  'analysis',
  'software',
  'it_product',
];

/**
 * The role a Manpower-tab row is employed in, matching the
 * `project_manpower.role` enum. A closed list the form offers as fixed options.
 */
export const MANPOWER_ROLES = [
  'project_associate',
  'research_associate',
  'senior_research_fellow',
  'junior_research_fellow',
  'field_investigator',
  'field_worker',
  'lab_technician',
];

/**
 * The Outcomes tab's closed lists, each matching its column's enum. The form
 * offers them as fixed options and renders the labels.
 */
export const PUBLICATION_TYPES = ['journal', 'conference', 'book_chapter'];

export const IPR_TYPES = [
  'patent',
  'copyright',
  'design_patent',
  'trademark',
  'geographical_indication',
];

export const IPR_STATUSES = ['filed', 'published', 'granted', 'rejected', 'expired'];

export const TECH_TRANSFER_CATEGORIES = [
  'startup',
  'prototype',
  'product',
  'process',
  'service',
  'theory',
  'variety',
];

/** The Technology Readiness Levels the form offers; 1 and 2 are not a transfer yet. */
export const MIN_TRL = 3;
export const MAX_TRL = 9;

export const CANDIDATE_DEGREES = ['me_mtech', 'phd', 'pdf'];

/**
 * The Documents tab's correspondence log: which documents can come in from the
 * agency and which go out to it. Each kind belongs to one direction, and a row
 * is refused when its kind is filed under the other.
 */
export const DOCUMENT_TRANSACTION_KINDS = {
  inward: ['sanction_order', 'query'],
  outward: [
    'acknowledgement',
    'yearly_progress_report',
    'revised_uc',
    'clarification',
    'final_report_submission',
  ],
};

export const DOCUMENT_TRANSACTION_DIRECTIONS = Object.keys(DOCUMENT_TRANSACTION_KINDS);

const ALL_DOCUMENT_TRANSACTION_KINDS = Object.values(DOCUMENT_TRANSACTION_KINDS).flat();

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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\d{10}$/;
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;
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
 * A flag whose column default is not 0, read so that an absent field keeps that
 * default instead of reading as unchecked. `toBoolean` alone cannot do this: it
 * answers 0 for everything it does not recognise, so a caller that simply does
 * not send the field would switch it off on every row it touches.
 */
export function toBooleanWithDefault(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback ? 1 : 0;
  return toBoolean(value);
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
  if (!Number.isInteger(count) || count < 0) {
    errors.push({ field, message: 'Enter a whole number of 0 or more.' });
    return 0;
  }
  // Said by name: a figure that is only too large is not malformed, and the
  // message above reads as if it were.
  if (count > max) {
    errors.push({ field, message: `Enter a whole number from 0 to ${max}.` });
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

/**
 * A value from one of the admin-curated lists (`project_vocabulary_options`),
 * stored in its curated case when the list has it, so `artificial
 * intelligence` and `Artificial Intelligence` are one domain. A value the list
 * does not have is kept as submitted, trimmed and bounded, the way a retired
 * budget head is: the list is edited in the admin, and a project that holds
 * a since-renamed entry must still save. Null when empty.
 */
export function toCuratedLabel(value, curated = []) {
  const text = trimmed(value).slice(0, 255);
  if (!text) return null;
  return curated.find((entry) => entry.toLowerCase() === text.toLowerCase()) ?? text;
}

/**
 * The Indian financial year (April–March) an ISO date falls in, as `2026-27`.
 * Used to fill a ledger row's year when the form left the column blank, so the
 * Transaction Summary can still group the row.
 */
export function financialYearForDate(isoDate) {
  const text = trimmed(isoDate);
  if (!ISO_DATE.test(text)) return null;

  const [year, month] = text.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
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
        // Directory picks; the model fills the linked fields from the directory itself.
        directory_organization_id: toId(
          row?.directory_organization_id ?? row?.directoryOrganizationId,
        ),
        city: toNullableString(row?.city, 150),
        has_active_mou: toBoolean(row?.has_active_mou ?? row?.hasActiveMou),
        directory_resource_person_id: toId(
          row?.directory_resource_person_id ?? row?.directoryResourcePersonId,
        ),
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
      .filter(
        (row) =>
          row.organization_id ||
          row.organization_name ||
          row.directory_organization_id ||
          row.role ||
          row.contact_name ||
          row.directory_resource_person_id,
      )
      // sourceIndex stays on the row: the directory fill runs in the save transaction and
      // keys its errors the same way. replaceCollaborators writes named columns only.
      .map((row, index) => {
        const field = `collaborators[${row.sourceIndex}]`;
        if (!row.organization_id && !row.organization_name && !row.directory_organization_id) {
          errors.push({
            field: `${field}.organization`,
            message: 'Enter the collaborating organization.',
          });
        }
        if (row.contact_email && !EMAIL_PATTERN.test(row.contact_email)) {
          errors.push({ field: `${field}.contact_email`, message: 'Enter a valid email address.' });
        }
        return { ...row, display_order: index };
      })
  );
}

function normalizeBudgetHeads(raw, canonicalBudgetHead) {
  const rows = Array.isArray(raw) ? raw : [];
  const seen = new Set();

  return rows.reduce((heads, head) => {
    const submitted = typeof head === 'object' ? (head?.budget_head_name ?? head?.name) : head;
    // A head still in the vocabulary is stored in its canonical case; one that
    // is no longer offered is kept as submitted, the same way the allotment
    // matrix keeps its retired heads. Dropping it would delete a head the
    // form still shows on the row, on a save that never mentioned it.
    const name = canonicalBudgetHead(submitted) || toNullableString(submitted, 255);
    if (!name) return heads;

    // The junction table is unique on (row, head), so duplicates are dropped
    // here rather than surfacing as a save error.
    const key = name.toLowerCase();
    if (seen.has(key)) return heads;
    seen.add(key);

    heads.push({ budget_head_name: name });
    return heads;
  }, []);
}

function normalizeFinanceRows(raw, rowType, enabled, errors, canonicalBudgetHead) {
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
    .map((row, index) => {
      const coversAllHeads = toBoolean(row?.covers_all_heads ?? row?.coversAllHeads);

      return {
        row_type: rowType,
        organization_id: toId(row?.organization_id ?? row?.organizationId),
        organization_name: toNullableString(row?.organization_name ?? row?.organizationName, 255),
        amount: toAmount(row?.amount, `${rowType}_rows[${index}].amount`, errors),
        covers_all_heads: coversAllHeads,
        // "All" is the absence of a restriction, so it cannot sit beside a list
        // of specific heads: a row claiming both would be read one way by
        // anything that trusts the flag and another by anything that reads the
        // list. The flag wins, and any heads sent with it are dropped.
        heads: coversAllHeads
          ? []
          : normalizeBudgetHeads(row?.heads ?? row?.budget_heads, canonicalBudgetHead),
        // The form keys its inline errors by the index it rendered the row at,
        // so validation below must report the submitted index and not the one
        // left after blank rows are dropped. `toAmount` above already uses it.
        sourceIndex: index,
      };
    })
    .filter(
      (row) =>
        row.organization_id ||
        row.organization_name ||
        row.amount ||
        row.covers_all_heads ||
        row.heads.length,
    )
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
 * The income heads this project declares as applicable — the ticks on the
 * Income Heads card, which decide what the ledger's head picker offers and what
 * the Transaction Summary lists on its income side.
 *
 * Stored by name and deduplicated case-insensitively, like the budget-head
 * rows. A name outside the vocabulary is dropped rather than reported: the card
 * is a fixed set of checkboxes, so anything else is a stale or hand-made
 * request rather than something a user can act on.
 */
function normalizeIncomeHeads(raw) {
  const submitted = Array.isArray(raw) ? raw : [];
  const seen = new Set();

  return (
    submitted
      .map((value) => {
        const name = trimmed(typeof value === 'object' ? (value?.income_head_name ?? '') : value);
        return PROJECT_INCOME_HEADS.find((head) => head.toLowerCase() === name.toLowerCase()) ?? '';
      })
      .filter((name) => {
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      // Kept in the card's own order rather than the order they arrived in, so
      // the Transaction Summary reads the same way on every project.
      .sort(
        (left, right) => PROJECT_INCOME_HEADS.indexOf(left) - PROJECT_INCOME_HEADS.indexOf(right),
      )
      .map((name, index) => ({ income_head_name: name, display_order: index }))
  );
}

/**
 * The Budget Allotment matrix: financial-year columns, budget-head rows, and
 * the allotted amount at each intersection.
 *
 * Columns and rows are stored even when nothing has been typed under them,
 * because both are editor state the form has to reload; an empty *cell*, by
 * contrast, is dropped, since a missing cell and a blank one mean the same
 * thing. The three lists are stitched together by client-supplied `key`s, which
 * the model swaps for the ids it inserts.
 */
function normalizeBudgetAllotment(raw, errors, canonicalBudgetHead) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const yearRows = Array.isArray(source.years) ? source.years : [];
  if (yearRows.length > MAX_BUDGET_YEARS) {
    errors.push({
      field: 'budget.years',
      message: `At most ${MAX_BUDGET_YEARS} financial year columns are supported.`,
    });
  }

  const seenYears = new Set();
  const years = yearRows
    .slice(0, MAX_BUDGET_YEARS)
    .map((row, index) => ({
      key: toNullableString(row?.key, 64) || `year-${index}`,
      financial_year: toNullableString(row?.financial_year ?? row?.financialYear, 9),
      sourceIndex: index,
    }))
    // A column whose year has not been picked yet cannot be stored — there is
    // nothing to identify it by.
    .filter((row) => row.financial_year)
    .map(({ sourceIndex, ...row }) => {
      if (!FINANCIAL_YEAR.test(row.financial_year)) {
        errors.push({ field: `budget.years[${sourceIndex}]`, message: 'Use the 2025-26 format.' });
      }
      // A repeated year would collide on uq_project_budget_years, and its
      // amounts would be indistinguishable from the first column's.
      if (seenYears.has(row.financial_year)) {
        errors.push({
          field: `budget.years[${sourceIndex}]`,
          message: 'This financial year already has a column.',
        });
      }
      seenYears.add(row.financial_year);
      return row;
    })
    .map((row, index) => ({ ...row, display_order: index }));

  const headRows = Array.isArray(source.heads) ? source.heads : [];
  if (headRows.length > MAX_BUDGET_HEAD_ROWS) {
    errors.push({
      field: 'budget.heads',
      message: `At most ${MAX_BUDGET_HEAD_ROWS} budget head rows are supported.`,
    });
  }

  const seenHeads = new Set();
  const heads = headRows
    .slice(0, MAX_BUDGET_HEAD_ROWS)
    .map((row, index) => {
      const submitted = row?.budget_head_name ?? row?.budgetHeadName;
      const name = canonicalBudgetHead(submitted);
      // A head the vocabulary no longer offers is kept rather than dropped:
      // the row belongs to a budget that was already sanctioned under it, and
      // discarding it here would silently delete its allotments.
      const stored = name || toNullableString(submitted, 255);
      return {
        key: toNullableString(row?.key, 64) || `head-${index}`,
        budget_head_name: stored,
        // Who the money under this head comes from. Optional — a project that
        // never splits its budget by contributor leaves it empty — and stored
        // with a name snapshot beside the id the same way a finance row is.
        contribution_organization_id: toId(
          row?.contribution_organization_id ?? row?.contributionOrganizationId,
        ),
        contribution_organization_name: toNullableString(
          row?.contribution_organization_name ?? row?.contributionOrganizationName,
          255,
        ),
        sourceIndex: index,
      };
    })
    .filter((row) => row.budget_head_name)
    .map(({ sourceIndex, ...row }) => {
      const identity = row.budget_head_name.toLowerCase();
      if (seenHeads.has(identity)) {
        errors.push({
          field: `budget.heads[${sourceIndex}]`,
          message: 'This budget head already has a row.',
        });
      }
      seenHeads.add(identity);
      return row;
    })
    .map((row, index) => ({ ...row, display_order: index }));

  const yearKeys = new Set(years.map((row) => row.key));
  const headKeys = new Set(heads.map((row) => row.key));
  const seenCells = new Set();

  const allotments = (Array.isArray(source.allotments) ? source.allotments : [])
    .map((cell, index) => ({
      head_key: toNullableString(cell?.head_key ?? cell?.headKey, 64),
      year_key: toNullableString(cell?.year_key ?? cell?.yearKey, 64),
      amount: toAmount(cell?.amount, `budget.allotments[${index}].amount`, errors),
    }))
    // Cells left blank, and cells whose row or column was removed in the same
    // edit, have nothing to attach to.
    .filter(
      (cell) => cell.amount !== null && headKeys.has(cell.head_key) && yearKeys.has(cell.year_key),
    )
    .filter((cell) => {
      const identity = `${cell.head_key}|${cell.year_key}`;
      if (seenCells.has(identity)) return false;
      seenCells.add(identity);
      return true;
    });

  return { years, heads, allotments };
}

/**
 * One account's ledger rows. Both directions are accepted against either kind
 * of head — a returned advance is a credit against an expenditure head — so the
 * only rule here is that a row is a credit *or* a debit, never both and never
 * neither.
 */
function normalizeTransactions(raw, fieldPrefix, errors, canonicalBudgetHead) {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length > MAX_TRANSACTIONS_PER_ACCOUNT) {
    errors.push({
      field: `${fieldPrefix}.transactions`,
      message: `At most ${MAX_TRANSACTIONS_PER_ACCOUNT} transactions per account are supported.`,
    });
  }

  return (
    rows
      .slice(0, MAX_TRANSACTIONS_PER_ACCOUNT)
      .map((row, index) => {
        const field = `${fieldPrefix}.transactions[${index}]`;

        const headKind = toEnum(
          row?.head_kind ?? row?.headKind,
          TRANSACTION_HEAD_KINDS,
          `${field}.head_kind`,
          errors,
          { fallback: 'expenditure' },
        );
        const transactionDate = toDate(
          row?.transaction_date ?? row?.transactionDate,
          `${field}.transaction_date`,
          errors,
        );

        let financialYear = toNullableString(row?.financial_year ?? row?.financialYear, 9);
        if (financialYear && !FINANCIAL_YEAR.test(financialYear)) {
          errors.push({ field: `${field}.financial_year`, message: 'Use the 2025-26 format.' });
          financialYear = null;
        }
        // The summary groups by year, so a row that was dated but not yeared
        // still lands in the right column.
        if (!financialYear) financialYear = financialYearForDate(transactionDate);

        return {
          financial_year: financialYear,
          transaction_date: transactionDate,
          head_kind: headKind,
          // Defaults to counted, matching the column, so a ledger saved by a
          // caller that does not know about this field keeps every row in the
          // Actuals figures rather than quietly dropping out of them.
          counts_as_actual: toBooleanWithDefault(
            row?.counts_as_actual ?? row?.countsAsActual,
            true,
          ),
          // Expenditure heads are stored by name. A name still in the
          // vocabulary is stored in its canonical case so the summary groups it
          // with its allotment row; one that is no longer offered is kept as
          // submitted, since a ledger written under a head the list has since
          // dropped must still save.
          head_name:
            headKind === 'expenditure'
              ? canonicalBudgetHead(row?.head_name ?? row?.headName) ||
                toNullableString(row?.head_name ?? row?.headName, 255)
              : toNullableString(row?.head_name ?? row?.headName, 255),
          particulars: toNullableString(row?.particulars, 500),
          reference_no: toNullableString(row?.reference_no ?? row?.referenceNo, 150),
          payment_mode: toEnum(
            row?.payment_mode ?? row?.paymentMode,
            TRANSACTION_PAYMENT_MODES,
            `${field}.payment_mode`,
            errors,
          ),
          // Who a receipt came from. Offered on income rows only, where it
          // takes the place of the reference number, but stored on every row —
          // a head switched between the two kinds hides the field it no longer
          // uses rather than destroying what was typed into it.
          contribution_organization_id: toId(
            row?.contribution_organization_id ?? row?.contributionOrganizationId,
          ),
          contribution_organization_name: toNullableString(
            row?.contribution_organization_name ?? row?.contributionOrganizationName,
            255,
          ),
          credit: toAmount(row?.credit, `${field}.credit`, errors),
          debit: toAmount(row?.debit, `${field}.debit`, errors),
          sourceIndex: index,
        };
      })
      .filter(
        (row) =>
          row.transaction_date ||
          row.head_name ||
          row.particulars ||
          row.reference_no ||
          row.payment_mode ||
          row.contribution_organization_id ||
          row.contribution_organization_name ||
          row.credit !== null ||
          row.debit !== null,
      )
      // `display_order` is the ledger's order, and the running balance the form
      // draws from it only means anything read oldest-first — so the stored order
      // is chronological whatever order the rows arrived in. `sort` is stable, so
      // two transactions on the same day keep the order the user chose, and
      // `sourceIndex` below still points errors back at the row they came from.
      .sort((left, right) => {
        if (!left.transaction_date) return right.transaction_date ? 1 : 0;
        if (!right.transaction_date) return -1;
        return left.transaction_date.localeCompare(right.transaction_date);
      })
      .map(({ sourceIndex, ...row }, index) => {
        const field = `${fieldPrefix}.transactions[${sourceIndex}]`;

        if (!row.transaction_date) {
          errors.push({ field: `${field}.transaction_date`, message: 'Enter the date.' });
        }
        if (!row.head_name) {
          errors.push({ field: `${field}.head`, message: 'Select a budget head.' });
        }
        if (
          row.head_kind === 'income' &&
          row.head_name &&
          !PROJECT_INCOME_HEADS.includes(row.head_name)
        ) {
          errors.push({ field: `${field}.head`, message: 'Select an income head from the list.' });
        }

        // Zero is the same as nothing in these columns, so it must not satisfy
        // the either/or rule below or survive into the stored row.
        const hasCredit = row.credit !== null && row.credit > 0;
        const hasDebit = row.debit !== null && row.debit > 0;
        if (hasCredit === hasDebit) {
          errors.push({
            field: `${field}.amount`,
            message: hasCredit
              ? 'A transaction is either a credit or a debit, not both.'
              : 'Enter a credit or a debit amount.',
          });
        }

        return {
          ...row,
          credit: hasCredit ? row.credit : null,
          debit: hasDebit ? row.debit : null,
          display_order: index,
        };
      })
  );
}

/** One "Transaction Account" block: the account itself plus its ledger. */
function normalizeTransactionAccounts(raw, errors, canonicalBudgetHead) {
  const accountRows = Array.isArray(raw) ? raw : [];
  if (accountRows.length > MAX_TRANSACTION_ACCOUNTS) {
    errors.push({
      field: 'transaction_accounts',
      message: `At most ${MAX_TRANSACTION_ACCOUNTS} transaction accounts are supported.`,
    });
  }

  const seenAccounts = new Set();

  return (
    accountRows
      .slice(0, MAX_TRANSACTION_ACCOUNTS)
      .map((account, index) => ({
        account_option_id: toId(account?.account_option_id ?? account?.accountOptionId),
        account_name: toNullableString(account?.account_name ?? account?.accountName, 255),
        transactions: normalizeTransactions(
          account?.transactions,
          `transaction_accounts[${index}]`,
          errors,
          canonicalBudgetHead,
        ),
        sourceIndex: index,
      }))
      // The untouched block the form always keeps on screen is not something to
      // store.
      .filter(
        (account) =>
          account.account_option_id || account.account_name || account.transactions.length > 0,
      )
      .map(({ sourceIndex, ...account }, index) => {
        // An account is identified by its option id, or — once that option has
        // been removed and `ON DELETE SET NULL` has cleared the id — by the
        // name snapshot the block kept. Demanding the id would make a ledger
        // whose account is gone unsavable, blocking every later edit to the
        // project, so a named block stands on its own name here just as a
        // budget head row does in `normalizeBudgetAllotment`.
        if (!account.account_option_id && !account.account_name) {
          errors.push({
            field: `transaction_accounts[${sourceIndex}].account`,
            message: 'Select a transaction account.',
          });
        } else {
          // Two blocks on one account would split a single ledger into two
          // running balances, and collide on uq_project_transaction_accounts.
          const identity = account.account_option_id
            ? `id:${account.account_option_id}`
            : `name:${account.account_name.toLowerCase()}`;
          if (seenAccounts.has(identity)) {
            errors.push({
              field: `transaction_accounts[${sourceIndex}].account`,
              message: 'This account already has a ledger on this project.',
            });
          } else {
            seenAccounts.add(identity);
          }
        }

        return { ...account, display_order: index };
      })
  );
}

function normalizeFacilities(raw, errors) {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length > MAX_FACILITIES) {
    errors.push({
      field: 'facilities',
      message: `A project can have at most ${MAX_FACILITIES} facilities.`,
    });
  }

  return (
    rows
      .slice(0, MAX_FACILITIES)
      .map((row, index) => {
        const field = `facilities[${index}]`;
        const istemListed = toBoolean(row?.istem_listed ?? row?.istemListed);

        return {
          facility_name: toNullableString(row?.facility_name ?? row?.facilityName, 255),
          facility_type: toEnum(
            row?.facility_type ?? row?.facilityType,
            FACILITY_TYPES,
            `${field}.facility_type`,
            errors,
          ),
          installation_date: toDate(
            row?.installation_date ?? row?.installationDate,
            `${field}.installation_date`,
            errors,
          ),
          cost: toAmount(row?.cost, `${field}.cost`, errors),
          make: toNullableString(row?.make, 150),
          model: toNullableString(row?.model, 150),
          serial_no: toNullableString(row?.serial_no ?? row?.serialNo, 150),
          stock_register_ref: toNullableString(
            row?.stock_register_ref ?? row?.stockRegisterRef,
            150,
          ),
          istem_listed: istemListed,
          // The ID belongs to the listing: switching the toggle off says the
          // facility is not on I-STEM, so an ID typed before that is not kept.
          istem_id: istemListed ? toNullableString(row?.istem_id ?? row?.istemId, 100) : null,
          supplier_name: toNullableString(row?.supplier_name ?? row?.supplierName, 255),
          supplier_address: toNullableString(row?.supplier_address ?? row?.supplierAddress, 500),
          contact_person: toNullableString(row?.contact_person ?? row?.contactPerson, 150),
          contact_designation: toNullableString(
            row?.contact_designation ?? row?.contactDesignation,
            150,
          ),
          contact_mobile: toMobile(row?.contact_mobile ?? row?.contactMobile),
          contact_email: toNullableString(row?.contact_email ?? row?.contactEmail, 255),
          // The form keys its inline errors by the index it rendered the row at,
          // so validation below must report the submitted index and not the one
          // left after blank rows are dropped.
          sourceIndex: index,
        };
      })
      // A row the user added but never filled in is dropped instead of failing the save.
      .filter(({ sourceIndex: _sourceIndex, ...row }) =>
        Object.values(row).some((value) => value !== null && value !== 0),
      )
      .map(({ sourceIndex, ...row }, index) => {
        const field = `facilities[${sourceIndex}]`;
        if (!row.facility_name) {
          errors.push({ field: `${field}.facility_name`, message: 'Facility name is required.' });
        }
        if (row.istem_listed && !row.istem_id) {
          errors.push({ field: `${field}.istem_id`, message: 'Enter the I-STEM ID.' });
        }
        if (row.contact_mobile && !MOBILE_PATTERN.test(row.contact_mobile)) {
          errors.push({
            field: `${field}.contact_mobile`,
            message: 'Enter a 10-digit mobile number.',
          });
        }
        if (row.contact_email && !EMAIL_PATTERN.test(row.contact_email)) {
          errors.push({ field: `${field}.contact_email`, message: 'Enter a valid email address.' });
        }
        return { ...row, display_order: index };
      })
  );
}

/**
 * A mobile number as the office writes it — spaces, hyphens and a +91 prefix
 * allowed — reduced to its ten digits. Anything that is not ten digits once
 * those are stripped is returned as typed, for the caller to reject.
 */
function toMobile(value) {
  const text = trimmed(value);
  if (!text) return null;
  const digits = text.replace(/[\s-]/g, '').replace(/^\+91/, '');
  return MOBILE_PATTERN.test(digits) ? digits : text.slice(0, 20);
}

/**
 * @param {Set<string>} keysWithDocuments row keys that carry an uploaded file in
 *   this request, so a row whose only content so far is its profile is not
 *   dropped as blank and the file keeps a row to attach to.
 */
function normalizeManpower(raw, errors, keysWithDocuments = new Set()) {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length > MAX_MANPOWER) {
    errors.push({
      field: 'manpower',
      message: `A project can have at most ${MAX_MANPOWER} manpower rows.`,
    });
  }

  return rows
    .slice(0, MAX_MANPOWER)
    .map((row, index) => {
      const field = `manpower[${index}]`;

      return {
        // Existing row id, so an update keeps the row (and the profile that
        // hangs off it) instead of recreating it.
        id: toId(row?.id),
        // Stable client-side key: names the file field for this row's profile.
        key: toNullableString(row?.key, 64) || `row-${index}`,
        role: toEnum(row?.role, MANPOWER_ROLES, `${field}.role`, errors),
        name: toNullableString(row?.name, 255),
        qualification: toNullableString(row?.qualification, 255),
        salary: toAmount(row?.salary, `${field}.salary`, errors),
        joining_date: toDate(
          row?.joining_date ?? row?.joiningDate,
          `${field}.joining_date`,
          errors,
        ),
        mobile: toMobile(row?.mobile),
        email: toNullableString(row?.email, 255),
        remarks: toNullableString(row?.remarks, 1000),
        relieving_date: toDate(
          row?.relieving_date ?? row?.relievingDate,
          `${field}.relieving_date`,
          errors,
        ),
        removed_documents: toStringArray(row?.removed_documents ?? row?.removedDocuments).filter(
          (slot) => Object.hasOwn(MANPOWER_SLOTS, slot),
        ),
        // The form keys its inline errors by the index it rendered the row at,
        // so validation below must report the submitted index and not the one
        // left after blank rows are dropped.
        sourceIndex: index,
      };
    })
    .filter(
      (row) =>
        row.id ||
        row.role ||
        row.name ||
        row.qualification ||
        row.salary ||
        row.joining_date ||
        row.mobile ||
        row.email ||
        row.remarks ||
        row.relieving_date ||
        keysWithDocuments.has(row.key),
    )
    .map(({ sourceIndex, ...row }, index) => {
      const field = `manpower[${sourceIndex}]`;
      if (!row.role) errors.push({ field: `${field}.role`, message: 'Select a role.' });
      if (!row.name) errors.push({ field: `${field}.name`, message: 'Name is required.' });
      if (row.mobile && !MOBILE_PATTERN.test(row.mobile)) {
        errors.push({ field: `${field}.mobile`, message: 'Enter a 10-digit mobile number.' });
      }
      if (row.email && !EMAIL_PATTERN.test(row.email)) {
        errors.push({ field: `${field}.email`, message: 'Enter a valid email address.' });
      }
      if (row.joining_date && row.relieving_date && row.relieving_date < row.joining_date) {
        errors.push({
          field: `${field}.relieving_date`,
          message: 'Date of relieving cannot be before the date of joining.',
        });
      }
      return { ...row, display_order: index };
    });
}

/**
 * A DOI as people paste it — bare, as a doi.org link, or with a `doi:` prefix —
 * reduced to the bare `10.xxxx/...` form it is stored and matched in. Returns ''
 * for an empty value; anything else is returned stripped but unchecked, for the
 * caller to validate against `isValidDoi`.
 */
export function normalizeDoi(value) {
  return trimmed(value)
    .replace(/^(https?:\/\/)?(dx\.|www\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

export function isValidDoi(doi) {
  return DOI_PATTERN.test(doi);
}

/** A four-digit year from 1900 to next year, or null; anything else is reported. */
function toYear(value, field, errors) {
  const text = trimmed(value);
  if (!text) return null;
  const year = Number(text);
  const latest = new Date().getFullYear() + 1;
  if (!Number.isInteger(year) || year < 1900 || year > latest) {
    errors.push({ field, message: `Enter a year from 1900 to ${latest}.` });
    return null;
  }
  return year;
}

function capRows(raw, field, label, errors) {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length > MAX_OUTCOME_ROWS) {
    errors.push({ field, message: `At most ${MAX_OUTCOME_ROWS} ${label} are supported.` });
  }
  return rows.slice(0, MAX_OUTCOME_ROWS);
}

function normalizePublications(raw, errors) {
  return (
    capRows(raw, 'publications', 'publications', errors)
      .map((row, index) => {
        const field = `publications[${index}]`;
        return {
          publication_type: toEnum(
            row?.publication_type ?? row?.publicationType,
            PUBLICATION_TYPES,
            `${field}.publication_type`,
            errors,
          ),
          doi: toNullableString(normalizeDoi(row?.doi), 255),
          journal_id: toId(row?.journal_id ?? row?.journalId),
          title: toNullableString(row?.title, 500),
          venue: toNullableString(row?.venue, 255),
          publication_year: toYear(
            row?.publication_year ?? row?.publicationYear,
            `${field}.publication_year`,
            errors,
          ),
          // The form keys its inline errors by the index it rendered the row
          // at, so validation below reports the submitted index.
          sourceIndex: index,
        };
      })
      // A row the user added but never filled in is dropped instead of failing the save.
      .filter(({ sourceIndex: _sourceIndex, ...row }) =>
        Object.values(row).some((value) => value !== null),
      )
      .map(({ sourceIndex, ...row }, index) => {
        const field = `publications[${sourceIndex}]`;
        if (!row.publication_type) {
          errors.push({ field: `${field}.publication_type`, message: 'Select a type.' });
        }
        if (!row.doi && !row.title) {
          errors.push({ field: `${field}.doi`, message: 'Enter the DOI or the title.' });
        }
        if (row.doi && !isValidDoi(row.doi)) {
          errors.push({ field: `${field}.doi`, message: 'Enter a DOI such as 10.1000/xyz123.' });
        }
        return { ...row, display_order: index };
      })
  );
}

function normalizeIprs(raw, errors) {
  return capRows(raw, 'iprs', 'IPRs', errors)
    .map((row, index) => {
      const field = `iprs[${index}]`;
      return {
        ipr_type: toEnum(row?.ipr_type ?? row?.iprType, IPR_TYPES, `${field}.ipr_type`, errors),
        ipr_number: toNullableString(row?.ipr_number ?? row?.iprNumber, 100),
        status: toEnum(row?.status, IPR_STATUSES, `${field}.status`, errors),
        title: toNullableString(row?.title, 500),
        filing_date: toDate(row?.filing_date ?? row?.filingDate, `${field}.filing_date`, errors),
        grant_date: toDate(row?.grant_date ?? row?.grantDate, `${field}.grant_date`, errors),
        sourceIndex: index,
      };
    })
    .filter(({ sourceIndex: _sourceIndex, ...row }) =>
      Object.values(row).some((value) => value !== null),
    )
    .map(({ sourceIndex, ...row }, index) => {
      const field = `iprs[${sourceIndex}]`;
      if (!row.ipr_type) errors.push({ field: `${field}.ipr_type`, message: 'Select a type.' });
      if (!row.ipr_number && !row.title) {
        errors.push({
          field: `${field}.ipr_number`,
          message: 'Enter the IPR number or the title.',
        });
      }
      if (row.filing_date && row.grant_date && row.grant_date < row.filing_date) {
        errors.push({
          field: `${field}.grant_date`,
          message: 'Grant date cannot be before the filing date.',
        });
      }
      return { ...row, display_order: index };
    });
}

/** A Technology Readiness Level from `MIN_TRL` to `MAX_TRL`, or null. */
function toTrl(value, field, errors) {
  const text = trimmed(value).replace(/^trl\s*/i, '');
  if (!text) return null;
  const level = Number(text);
  if (!Number.isInteger(level) || level < MIN_TRL || level > MAX_TRL) {
    errors.push({ field, message: `Select a TRL from ${MIN_TRL} to ${MAX_TRL}.` });
    return null;
  }
  return level;
}

/**
 * @param {Set<string>} keysWithDocuments row keys that carry an uploaded file in
 *   this request, so a row whose only content so far is its document is kept.
 */
function normalizeTechTransfers(raw, errors, keysWithDocuments = new Set()) {
  return capRows(raw, 'tech_transfers', 'technology transfers', errors)
    .map((row, index) => {
      const field = `tech_transfers[${index}]`;
      return {
        // Existing row id and stable client key, so an update keeps the row and
        // the document that hangs off it.
        id: toId(row?.id),
        key: toNullableString(row?.key, 64) || `row-${index}`,
        category: toEnum(row?.category, TECH_TRANSFER_CATEGORIES, `${field}.category`, errors),
        description: toNullableString(row?.description, 1000),
        trl: toTrl(row?.trl, `${field}.trl`, errors),
        removed_documents: toStringArray(row?.removed_documents ?? row?.removedDocuments).filter(
          (slot) => Object.hasOwn(TECH_TRANSFER_SLOTS, slot),
        ),
        sourceIndex: index,
      };
    })
    .filter(
      (row) =>
        row.id || row.category || row.description || row.trl || keysWithDocuments.has(row.key),
    )
    .map(({ sourceIndex, ...row }, index) => {
      if (!row.category) {
        errors.push({
          field: `tech_transfers[${sourceIndex}].category`,
          message: 'Select a category.',
        });
      }
      return { ...row, display_order: index };
    });
}

/** @param {Set<string>} keysWithDocuments as for `normalizeTechTransfers`. */
function normalizeOutcomeCandidates(raw, errors, keysWithDocuments = new Set()) {
  return capRows(raw, 'outcome_candidates', 'candidates', errors)
    .map((row, index) => {
      const field = `outcome_candidates[${index}]`;
      return {
        id: toId(row?.id),
        key: toNullableString(row?.key, 64) || `row-${index}`,
        candidate_name: toNullableString(row?.candidate_name ?? row?.candidateName, 255),
        degree: toEnum(row?.degree, CANDIDATE_DEGREES, `${field}.degree`, errors),
        university: toNullableString(row?.university, 255),
        removed_documents: toStringArray(row?.removed_documents ?? row?.removedDocuments).filter(
          (slot) => Object.hasOwn(CANDIDATE_SLOTS, slot),
        ),
        sourceIndex: index,
      };
    })
    .filter(
      (row) =>
        row.id ||
        row.candidate_name ||
        row.degree ||
        row.university ||
        keysWithDocuments.has(row.key),
    )
    .map(({ sourceIndex, ...row }, index) => {
      const field = `outcome_candidates[${sourceIndex}]`;
      if (!row.candidate_name) {
        errors.push({ field: `${field}.candidate_name`, message: 'Candidate name is required.' });
      }
      if (!row.degree) errors.push({ field: `${field}.degree`, message: 'Select a degree.' });
      return { ...row, display_order: index };
    });
}

/** @param {Set<string>} keysWithDocuments as for `normalizeTechTransfers`. */
function normalizeDocumentTransactions(raw, errors, keysWithDocuments = new Set()) {
  return capRows(raw, 'document_transactions', 'document transactions', errors)
    .map((row, index) => {
      const field = `document_transactions[${index}]`;
      return {
        id: toId(row?.id),
        key: toNullableString(row?.key, 64) || `row-${index}`,
        transaction_date: toDate(
          row?.transaction_date ?? row?.transactionDate,
          `${field}.transaction_date`,
          errors,
        ),
        direction: toEnum(
          row?.direction,
          DOCUMENT_TRANSACTION_DIRECTIONS,
          `${field}.direction`,
          errors,
        ),
        document_kind: toEnum(
          row?.document_kind ?? row?.documentKind,
          ALL_DOCUMENT_TRANSACTION_KINDS,
          `${field}.document_kind`,
          errors,
        ),
        description: toNullableString(row?.description, 500),
        removed_documents: toStringArray(row?.removed_documents ?? row?.removedDocuments).filter(
          (slot) => Object.hasOwn(DOCUMENT_TRANSACTION_SLOTS, slot),
        ),
        sourceIndex: index,
      };
    })
    .filter(
      (row) =>
        row.id ||
        row.transaction_date ||
        row.direction ||
        row.document_kind ||
        row.description ||
        keysWithDocuments.has(row.key),
    )
    .map(({ sourceIndex, ...row }, index) => {
      const field = `document_transactions[${sourceIndex}]`;
      if (!row.transaction_date) {
        errors.push({ field: `${field}.transaction_date`, message: 'Enter the date.' });
      }
      if (!row.direction) {
        errors.push({ field: `${field}.direction`, message: 'Select inward or outward.' });
      }
      if (!row.document_kind) {
        errors.push({ field: `${field}.document_kind`, message: 'Select the document.' });
      } else if (
        row.direction &&
        !DOCUMENT_TRANSACTION_KINDS[row.direction].includes(row.document_kind)
      ) {
        errors.push({
          field: `${field}.document_kind`,
          message: `This document is not an ${row.direction} one.`,
        });
      }
      return { ...row, display_order: index };
    });
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
 * @param {Record<string, string[]>} [options.documentRowKeys] the same for the
 *   other row kinds that carry documents, keyed by their `ROW_DOCUMENT_SCOPES`
 *   scope: `manpower`, `tech_transfer`, `candidate`, `document_transaction`.
 * @param {string[]} [options.budgetHeadNames] the curated budget head
 *   vocabulary, from `project_budget_head_options`. Heads are stored by name,
 *   so this only settles the case a submitted head is stored in; a name the
 *   list does not offer is kept as submitted either way.
 */
export function normalizeProjectPayload(
  input = {},
  {
    rowKeysWithDocuments = [],
    documentRowKeys = {},
    budgetHeadNames = [],
    vocabulary = { nationalInitiatives: [], domains: [] },
  } = {},
) {
  const errors = [];
  const body = input && typeof input === 'object' ? input : {};
  const canonicalBudgetHead = budgetHeadCanonicalizer(budgetHeadNames);

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

  const projectType = toEnum(
    body.project_type ?? body.projectType,
    PROJECT_TYPES,
    'project_type',
    errors,
    { fallback: 'research_project' },
  );

  const projectStatus = toEnum(
    body.project_status ?? body.projectStatus,
    PROJECT_STATUSES,
    'project_status',
    errors,
  );

  const project = {
    driven_by: toEnum(body.driven_by ?? body.drivenBy, DRIVEN_BY_VALUES, 'driven_by', errors, {
      fallback: 'faculty',
    }),
    project_type: projectType,
    title,
    project_cost: toAmount(body.project_cost ?? body.projectCost, 'project_cost', errors),
    duration_years: toCount(
      body.duration_years ?? body.durationYears,
      'duration_years',
      errors,
      10,
    ),
    duration_months: toCount(
      body.duration_months ?? body.durationMonths,
      'duration_months',
      errors,
      12,
    ),
    duration_days: toCount(body.duration_days ?? body.durationDays, 'duration_days', errors, 31),
    // Each is kept only for the types that ask it: a value the form no longer
    // shows — left in state after the type was changed — is not saved as if
    // it still described the project.
    research_type: ASKS_RESEARCH_TYPE.includes(projectType)
      ? toEnum(body.research_type ?? body.researchType, RESEARCH_TYPES, 'research_type', errors)
      : null,
    level: ASKS_LEVEL.includes(projectType) ? toEnum(body.level, LEVELS, 'level', errors) : null,

    funding_organization_id: toId(body.funding_organization_id ?? body.fundingOrganizationId),
    funding_source: toEnum(
      body.funding_source ?? body.fundingSource,
      FUNDING_SOURCES,
      'funding_source',
      errors,
    ),
    // The project's own domain, not its scheme's: projects under one scheme
    // can work in different domains. A travel grant has none.
    domain: schemeHasDomain(projectType) ? toCuratedLabel(body.domain, vocabulary.domains) : null,
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
    grant_credited_to: toEnum(
      body.grant_credited_to ?? body.grantCreditedTo,
      GRANT_CREDIT_TARGETS,
      'grant_credited_to',
      errors,
    ),

    project_start_date: toDate(
      body.project_start_date ?? body.projectStartDate,
      'project_start_date',
      errors,
    ),
    // Like research type and level: a date left in state after the status
    // went back to Ongoing is hidden on the form, so it is not saved either.
    project_closing_date: HAS_CLOSING_DATE.includes(projectStatus)
      ? toDate(body.project_closing_date ?? body.projectClosingDate, 'project_closing_date', errors)
      : null,
    project_status: projectStatus,

    // The six typed outcome counts are no longer written from the form: the
    // Outcomes tab's rows are the record now. Leaving the columns out of the
    // aggregate (and out of `PROJECT_COLUMNS`) keeps the counts already stored
    // on older projects exactly as they are.

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
      // `project_tags` is unique on the value under a case-insensitive
      // collation, so two casings of one initiative are kept once — in the
      // curated case when the list has it — rather than failing the save.
      national_initiative: [
        ...new Map(
          toStringArray(body.national_initiatives ?? body.nationalInitiatives)
            .map((value) => toCuratedLabel(value, vocabulary.nationalInitiatives))
            .filter(Boolean)
            .map((value) => [value.toLowerCase(), value]),
        ).values(),
      ],
      sdg: toStringArray(body.sdgs).map((value) => value.slice(0, 255)),
    },
    collaborators: normalizeCollaborators(body.collaborators, collaboratorsEnabled, errors),
    financeRows: [
      ...normalizeFinanceRows(
        body.financial_contributions ?? body.financialContributions,
        'contribution',
        financialContributionEnabled,
        errors,
        canonicalBudgetHead,
      ),
      ...normalizeFinanceRows(
        body.finance_sharing ?? body.financeSharing,
        'sharing',
        financeSharingEnabled,
        errors,
        canonicalBudgetHead,
      ),
    ],
    disbursements: normalizeDisbursements(
      body.disbursements,
      errors,
      new Set(rowKeysWithDocuments),
    ),
    incomeHeads: normalizeIncomeHeads(body.income_heads ?? body.incomeHeads),
    budget: normalizeBudgetAllotment(body.budget, errors, canonicalBudgetHead),
    transactionAccounts: normalizeTransactionAccounts(
      body.transaction_accounts ?? body.transactionAccounts,
      errors,
      canonicalBudgetHead,
    ),
    facilities: normalizeFacilities(body.facilities, errors),
    manpower: normalizeManpower(body.manpower, errors, new Set(documentRowKeys.manpower ?? [])),
    publications: normalizePublications(body.publications, errors),
    iprs: normalizeIprs(body.iprs, errors),
    techTransfers: normalizeTechTransfers(
      body.tech_transfers ?? body.techTransfers,
      errors,
      new Set(documentRowKeys.tech_transfer ?? []),
    ),
    outcomeCandidates: normalizeOutcomeCandidates(
      body.outcome_candidates ?? body.outcomeCandidates,
      errors,
      new Set(documentRowKeys.candidate ?? []),
    ),
    documentTransactions: normalizeDocumentTransactions(
      body.document_transactions ?? body.documentTransactions,
      errors,
      new Set(documentRowKeys.document_transaction ?? []),
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

/** Field name for a slot on a row: `<scope>__<rowKey>__<slot>`. */
export function rowDocumentFieldName(scope, rowKey, slot) {
  return `${scope}__${rowKey}__${slot}`;
}

export function disbursementDocumentFieldName(rowKey, slot) {
  return rowDocumentFieldName('disbursement', rowKey, slot);
}

export function manpowerDocumentFieldName(rowKey, slot) {
  return rowDocumentFieldName('manpower', rowKey, slot);
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

  for (const [scope, slots] of Object.entries(ROW_DOCUMENT_SCOPES)) {
    const prefix = `${scope}__`;
    if (!name.startsWith(prefix)) continue;

    // The key sits between the prefix and the last separator, so a key that
    // itself contains `__` still parses.
    const rest = name.slice(prefix.length);
    const separator = rest.lastIndexOf('__');
    if (separator <= 0) return null;

    const rowKey = rest.slice(0, separator);
    const slot = rest.slice(separator + 2);
    return Object.hasOwn(slots, slot) ? { scope, rowKey, slot, documentType: slots[slot] } : null;
  }

  return null;
}
