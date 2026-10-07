import { describe, expect, it } from 'vitest';

import { formatProjectDates } from '../modules/project/projectDates.js';
import {
  disbursementDocumentFieldName,
  documentFieldName,
  manpowerDocumentFieldName,
  normalizeDoi,
  normalizeProjectPayload,
  parseDocumentFieldName,
} from '../modules/project/projectPayload.js';

const validPayload = (overrides = {}) => ({
  title: 'Solar drying of millets',
  investigators: [{ member_type: 'faculty', identity_code: 'EMP001', name: 'A Kumar' }],
  ...overrides,
});

// The curated vocabulary reaches the normalizer from
// `project_budget_head_options` by way of the controller, so the tests that
// pin how a head is stored hand it one of their own.
const budgetHeads = ['Equipment', 'Consumables', 'Overhead Charges', 'Manpower'];

const errorFields = (errors) => errors.map((error) => error.field);

describe('normalizeProjectPayload', () => {
  it('maps a minimal proposal onto research_projects columns', () => {
    const { aggregate, errors } = normalizeProjectPayload(validPayload());

    expect(errors).toEqual([]);
    expect(aggregate.project).toMatchObject({
      driven_by: 'faculty',
      title: 'Solar drying of millets',
      proposal_status: 'draft',
      project_cost: null,
      duration_years: 0,
      collaborators_enabled: 0,
    });
    expect(aggregate.investigators).toHaveLength(1);
  });

  it('requires a title and at least one investigator', () => {
    const { errors } = normalizeProjectPayload({});

    expect(errorFields(errors)).toEqual(expect.arrayContaining(['title', 'investigators']));
  });

  it('parses amounts, counts and dates and rejects malformed ones', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        project_cost: '12,50,000.50',
        duration_years: '2',
        duration_months: '6',
        submitted_on: '2026-04-01',
        result_date: '01-04-2026',
      }),
    );

    expect(aggregate.project.project_cost).toBe(1250000.5);
    expect(aggregate.project.duration_years).toBe(2);
    expect(aggregate.project.duration_months).toBe(6);
    expect(aggregate.project.submitted_on).toBe('2026-04-01');
    expect(errorFields(errors)).toContain('result_date');
  });

  // A project runs at most 10 years, and a months or days figure is the part
  // left over beyond whole years and months — so 12 months and 31 days are the
  // most either can hold. Anything larger is refused by name, not by the
  // generic "whole number" message, which read as if the figure were malformed.
  it('caps the duration at 10 years, 12 months and 31 days', () => {
    const atLimit = normalizeProjectPayload(
      validPayload({ duration_years: '10', duration_months: '12', duration_days: '31' }),
    );
    expect(atLimit.errors).toEqual([]);
    expect(atLimit.aggregate.project).toMatchObject({
      duration_years: 10,
      duration_months: 12,
      duration_days: 31,
    });

    const { errors } = normalizeProjectPayload(
      validPayload({ duration_years: '11', duration_months: '13', duration_days: '32' }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        { field: 'duration_years', message: 'Enter a whole number from 0 to 10.' },
        { field: 'duration_months', message: 'Enter a whole number from 0 to 12.' },
        { field: 'duration_days', message: 'Enter a whole number from 0 to 31.' },
      ]),
    );
  });

  it('rejects negative amounts', () => {
    const { errors } = normalizeProjectPayload(validPayload({ project_cost: '-5' }));

    expect(errorFields(errors)).toContain('project_cost');
  });

  it('accepts the enum spellings the form sends and rejects unknown ones', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        proposal_status: 'Accepted for Evaluation',
        sanction_mode: 'advance_reimbursement',
        project_status: 'Ongoing',
        final_result: 'not selected',
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.project.proposal_status).toBe('accepted_for_evaluation');
    expect(aggregate.project.sanction_mode).toBe('advance_reimbursement');
    expect(aggregate.project.project_status).toBe('ongoing');
    expect(aggregate.project.final_result).toBe('not_selected');

    const rejected = normalizeProjectPayload(validPayload({ project_status: 'archived' }));
    expect(errorFields(rejected.errors)).toContain('project_status');
  });

  it('flags a closing date that precedes the start date', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({ project_start_date: '2026-06-01', project_closing_date: '2026-05-31' }),
    );

    expect(errorFields(errors)).toContain('project_closing_date');
  });

  it('requires the funding agency when a scheme is picked', () => {
    const { errors } = normalizeProjectPayload(validPayload({ scheme_id: 4 }));

    expect(errorFields(errors)).toContain('funding_organization_id');
  });

  it('forces exactly one principal investigator', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        investigators: [
          { member_type: 'faculty', identity_code: 'EMP001', name: 'A Kumar' },
          { member_type: 'faculty', identity_code: 'EMP002', name: 'B Rao', is_principal: true },
          { member_type: 'faculty', identity_code: 'EMP003', name: 'C Devi', is_principal: true },
        ],
      }),
    );

    expect(aggregate.investigators.map((row) => row.is_principal)).toEqual([0, 1, 0]);
    expect(aggregate.investigators.map((row) => row.display_order)).toEqual([0, 1, 2]);
  });

  it('promotes the first investigator when none is flagged', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        investigators: [
          { member_type: 'faculty', identity_code: 'EMP001', name: 'A Kumar' },
          { member_type: 'faculty', identity_code: 'EMP002', name: 'B Rao' },
        ],
      }),
    );

    expect(aggregate.investigators.map((row) => row.is_principal)).toEqual([1, 0]);
  });

  it('demands an ERP id for faculty, a department for students and an organization for external members', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        investigators: [
          { member_type: 'faculty', name: 'No ERP' },
          { member_type: 'student', name: 'No department' },
          { member_type: 'external', name: 'No organization' },
        ],
      }),
    );

    expect(errorFields(errors)).toEqual(
      expect.arrayContaining([
        'investigators[0].identity_code',
        'investigators[1].department',
        'investigators[2].organization',
      ]),
    );
  });

  it('accepts a student row without a register number', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        investigators: [
          {
            member_type: 'student',
            name: 'S Priya',
            department: 'Food Technology',
            organization: 'K.S.Rangasamy College of Technology',
          },
        ],
      }),
    );

    expect(errors).toEqual([]);
  });

  it('keeps a student register number so the row can resolve to an author', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        investigators: [
          {
            member_type: 'student',
            name: 'S Priya',
            department: 'Food Technology',
            identity_code: 'FT2023011',
          },
        ],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.investigators[0].identity_code).toBe('FT2023011');
  });

  it('rejects a malformed investigator email', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        investigators: [
          {
            member_type: 'external',
            name: 'R Shankar',
            organization: 'IIT Madras',
            department: 'Structural Engineering',
            email: 'ravi[at]iitm.ac.in',
          },
        ],
      }),
    );

    expect(errorFields(errors)).toEqual(['investigators[0].email']);
  });

  it('keeps child rows only while their section is enabled', () => {
    const rows = {
      collaborators: [{ organization_name: 'IIT Madras', role: 'Testing' }],
      financial_contributions: [{ organization_name: 'DST', amount: '100' }],
      finance_sharing: [{ organization_name: 'KSRCT', amount: '50' }],
    };

    const disabled = normalizeProjectPayload(validPayload(rows));
    expect(disabled.aggregate.collaborators).toEqual([]);
    expect(disabled.aggregate.financeRows).toEqual([]);

    const enabled = normalizeProjectPayload(
      validPayload({
        ...rows,
        collaborators_enabled: true,
        financial_contribution_enabled: true,
        finance_sharing_enabled: true,
      }),
    );
    expect(enabled.errors).toEqual([]);
    expect(enabled.aggregate.collaborators).toHaveLength(1);
    expect(enabled.aggregate.financeRows.map((row) => row.row_type)).toEqual([
      'contribution',
      'sharing',
    ]);
  });

  it('drops blank repeatable rows instead of failing the save', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        collaborators_enabled: true,
        collaborators: [{ organization_name: 'IIT Madras' }, {}, { city: '' }],
        disbursements: [{}, { financial_year: '2025-26', amount: '100' }],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.collaborators).toHaveLength(1);
    expect(aggregate.disbursements).toHaveLength(1);
    expect(aggregate.disbursements[0].display_order).toBe(0);
  });

  it('reports row errors under the index the form submitted, not the post-filter one', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        collaborators_enabled: true,
        // Row 0 is blank and dropped; the problems are on rows 1 and 2.
        collaborators: [{}, { role: 'Testing partner' }, { role: 'X', contact_email: 'nope' }],
        financial_contribution_enabled: true,
        financial_contributions: [{}, { amount: '500' }, { organization_name: 'DST' }],
      }),
    );

    expect(aggregate.collaborators).toHaveLength(2);
    expect(aggregate.financeRows).toHaveLength(2);
    expect(errorFields(errors)).toEqual(
      expect.arrayContaining([
        'collaborators[1].organization',
        'collaborators[2].contact_email',
        'contribution_rows[1].organization',
        'contribution_rows[2].amount',
      ]),
    );
  });

  it('validates collaborator email and financial year formats', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        collaborators_enabled: true,
        collaborators: [{ organization_name: 'IIT Madras', contact_email: 'not-an-email' }],
        disbursements: [{ financial_year: '2025', amount: '10' }],
      }),
    );

    expect(errorFields(errors)).toEqual(
      expect.arrayContaining(['collaborators[0].contact_email', 'disbursements[0].financial_year']),
    );
  });

  it('stores a finance row that covers all heads, with no head rows beside it', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        financial_contribution_enabled: true,
        financial_contributions: [
          {
            organization_name: 'K.S.Rangasamy College of Technology',
            amount: '500000',
            covers_all_heads: true,
            // Sent anyway: "all" is exclusive, so these must not survive beside
            // the flag, or the row would say two different things.
            heads: [{ budget_head_name: 'Equipment' }, { budget_head_name: 'Travel' }],
          },
        ],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.financeRows[0]).toMatchObject({ covers_all_heads: 1, heads: [] });
  });

  it('leaves the flag off for a row that lists its heads', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        financial_contribution_enabled: true,
        financial_contributions: [
          { organization_name: 'DST', amount: '100', heads: [{ budget_head_name: 'Equipment' }] },
        ],
      }),
    );

    expect(aggregate.financeRows[0]).toMatchObject({
      covers_all_heads: 0,
      heads: [{ budget_head_name: 'Equipment' }],
    });
  });

  it('keeps a row whose only content so far is "all heads"', () => {
    // A row the user has started is not a blank row, so it has to reach the
    // validation below — which then asks for the organization and amount.
    const { errors } = normalizeProjectPayload(
      validPayload({
        financial_contribution_enabled: true,
        financial_contributions: [{ covers_all_heads: true }],
      }),
    );

    expect(errorFields(errors)).toEqual(
      expect.arrayContaining(['contribution_rows[0].organization', 'contribution_rows[0].amount']),
    );
  });

  it('deduplicates budget heads on a finance row', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        financial_contribution_enabled: true,
        financial_contributions: [
          {
            organization_name: 'DST',
            amount: '100',
            heads: [
              { budget_head_name: 'Equipment' },
              { budget_head_name: 'Equipment' },
              { budget_head_name: 'Consumables' },
            ],
          },
        ],
      }),
    );

    expect(aggregate.financeRows[0].heads).toEqual([
      { budget_head_name: 'Equipment' },
      { budget_head_name: 'Consumables' },
    ]);
  });

  it('canonicalizes a finance-row head and keeps one the list has dropped', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        financial_contribution_enabled: true,
        financial_contributions: [
          {
            organization_name: 'DST',
            amount: '100',
            heads: [
              // Case is normalized to the stored spelling.
              { budget_head_name: 'overhead charges' },
              // No longer in the vocabulary, but a row saved under it must not
              // lose it on the next save — the form still shows the chip.
              { budget_head_name: 'Postal Expenses' },
            ],
          },
        ],
      }),
      { budgetHeadNames: budgetHeads },
    );

    expect(aggregate.financeRows[0].heads).toEqual([
      { budget_head_name: 'Overhead Charges' },
      { budget_head_name: 'Postal Expenses' },
    ]);
  });

  it('collects tags and ignores duplicates', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        national_initiatives: ['Make in India', 'Make in India', ''],
        sdgs: ['7. Affordable and Clean Energy'],
      }),
    );

    expect(aggregate.tags).toEqual({
      national_initiative: ['Make in India'],
      sdg: ['7. Affordable and Clean Energy'],
    });
  });

  it('keeps only known document slots in removed_documents', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        // Presentation stays on so its own slot is not added to the list here;
        // that rule has its own test below.
        presentation_enabled: true,
        removed_documents: ['sanction_order', 'not_a_slot'],
      }),
    );

    expect(aggregate.removedDocuments).toEqual(['sanction_order']);
  });

  it('clears presentation fields when the section is switched off', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({ presentation_date: '2026-05-05', presentation_venue: 'DST, New Delhi' }),
    );

    expect(aggregate.project.presentation_enabled).toBe(0);
    expect(aggregate.project.presentation_date).toBeNull();
    expect(aggregate.project.presentation_venue).toBeNull();
  });
});

describe('document field names', () => {
  it('round-trips a project-level slot', () => {
    const fieldName = documentFieldName('sanction_order');

    expect(parseDocumentFieldName(fieldName)).toEqual({
      scope: 'project',
      documentType: 'sanction_order',
    });
  });

  it('round-trips a disbursement slot, including a key with a hyphen', () => {
    const fieldName = disbursementDocumentFieldName('row-17', 'uc_soe');

    expect(parseDocumentFieldName(fieldName)).toEqual({
      scope: 'disbursement',
      rowKey: 'row-17',
      slot: 'uc_soe',
      documentType: 'disbursement_uc_soe',
    });
  });

  it('rejects unknown slots and stray field names', () => {
    expect(parseDocumentFieldName('document__passport')).toBeNull();
    expect(parseDocumentFieldName('disbursement__row-1__payslip')).toBeNull();
    expect(parseDocumentFieldName('payload')).toBeNull();
    expect(parseDocumentFieldName('')).toBeNull();
  });
});

describe('formatProjectDates', () => {
  it('formats a driver Date using its local calendar day', () => {
    // mysql2 builds a DATE as local midnight; JSON would emit the previous day
    // for timezones ahead of UTC.
    const row = formatProjectDates({ submitted_on: new Date(2026, 3, 15) });

    expect(row.submitted_on).toBe('2026-04-15');
  });

  it('passes strings through and nulls out empty or invalid values', () => {
    const row = formatProjectDates({
      submitted_on: '2026-04-15T00:00:00.000Z',
      sanction_date: null,
      result_date: '',
      project_start_date: new Date('nope'),
    });

    expect(row).toMatchObject({
      submitted_on: '2026-04-15',
      sanction_date: null,
      result_date: null,
      project_start_date: null,
    });
  });

  it('leaves columns it does not own alone', () => {
    const createdAt = new Date(2026, 3, 15, 10, 30);
    const row = formatProjectDates({ created_at: createdAt, title: 'X' });

    expect(row.created_at).toBe(createdAt);
    expect(row.title).toBe('X');
  });

  it('formats extra date columns when asked', () => {
    const row = formatProjectDates({ disbursement_date: new Date(2027, 0, 31) }, [
      'disbursement_date',
    ]);

    expect(row.disbursement_date).toBe('2027-01-31');
  });
});

describe('disbursement rows that only carry a document', () => {
  const rowWithOnlyAFile = {
    disbursements: [{ key: 'row-7' }],
  };

  it('drops the row when nothing is attached to it', () => {
    const { aggregate } = normalizeProjectPayload(validPayload(rowWithOnlyAFile));

    expect(aggregate.disbursements).toEqual([]);
  });

  it('keeps the row when a file was uploaded against its key', () => {
    const { aggregate } = normalizeProjectPayload(validPayload(rowWithOnlyAFile), {
      rowKeysWithDocuments: ['row-7'],
    });

    expect(aggregate.disbursements).toHaveLength(1);
    expect(aggregate.disbursements[0].key).toBe('row-7');
  });

  it('keeps a row that only clears one of its documents', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({ disbursements: [{ key: 'row-8', removed_documents: ['uc_soe'] }] }),
    );

    expect(aggregate.disbursements).toHaveLength(1);
    expect(aggregate.disbursements[0].removed_documents).toEqual(['uc_soe']);
  });
});

describe('presentation documents follow the section toggle', () => {
  it('removes the stored presentation file when the section is switched off', () => {
    const { aggregate } = normalizeProjectPayload(validPayload());

    expect(aggregate.project.presentation_enabled).toBe(0);
    expect(aggregate.removedDocuments).toContain('presentation');
  });

  it('keeps it while the section is on', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({ presentation_enabled: true, presentation_venue: 'DST' }),
    );

    expect(aggregate.removedDocuments).not.toContain('presentation');
  });
});

describe('income heads', () => {
  it('keeps the ticked heads, in the card order rather than the order they arrived', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({ income_heads: ['Other Income', 'Grant-in-aid'] }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.incomeHeads).toEqual([
      { income_head_name: 'Grant-in-aid', display_order: 0 },
      { income_head_name: 'Other Income', display_order: 1 },
    ]);
  });

  it('matches a head case-insensitively and drops one outside the vocabulary', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({ income_heads: ['bank interest', 'Grant Received', ''] }),
    );

    // The card is a fixed set of checkboxes, so anything else is a stale
    // request rather than something a user could act on — dropped, not reported.
    expect(errors).toEqual([]);
    expect(aggregate.incomeHeads).toEqual([
      { income_head_name: 'Bank Interest', display_order: 0 },
    ]);
  });

  it('deduplicates a head sent twice', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({ income_heads: ['HI Contribution', 'HI CONTRIBUTION'] }),
    );

    // uq_project_income_heads_name would reject the second row.
    expect(aggregate.incomeHeads).toEqual([
      { income_head_name: 'HI Contribution', display_order: 0 },
    ]);
  });

  it('is empty when the form sends nothing, so nothing is pre-ticked', () => {
    const { aggregate, errors } = normalizeProjectPayload(validPayload());

    expect(errors).toEqual([]);
    expect(aggregate.incomeHeads).toEqual([]);
  });

  it('still accepts a ledger row under a head that was not ticked', () => {
    // Un-ticking only stops a head being offered. A row already filed under it
    // has to stay saveable, or an edit anywhere else on the project would fail.
    const { errors } = normalizeProjectPayload(
      validPayload({
        income_heads: ['Grant-in-aid'],
        transaction_accounts: [
          {
            account_option_id: 17,
            transactions: [
              {
                transaction_date: '2026-05-10',
                head_kind: 'income',
                head_name: 'Bank Interest',
                credit: '4200',
              },
            ],
          },
        ],
      }),
    );

    expect(errors).toEqual([]);
  });
});

describe('budget allotment matrix', () => {
  const matrix = (overrides = {}) =>
    validPayload({
      budget: {
        years: [
          { key: 'y1', financial_year: '2025-26' },
          { key: 'y2', financial_year: '2026-27' },
        ],
        heads: [
          { key: 'h1', budget_head_name: 'Consumables' },
          { key: 'h2', budget_head_name: 'Manpower' },
        ],
        allotments: [
          { head_key: 'h1', year_key: 'y1', amount: '2,50,000' },
          { head_key: 'h2', year_key: 'y2', amount: '400000' },
        ],
        ...overrides,
      },
    });

  it('keeps rows and columns in order and parses the cells between them', () => {
    const { aggregate, errors } = normalizeProjectPayload(matrix());

    expect(errors).toEqual([]);
    expect(aggregate.budget.years).toEqual([
      { key: 'y1', financial_year: '2025-26', display_order: 0 },
      { key: 'y2', financial_year: '2026-27', display_order: 1 },
    ]);
    expect(aggregate.budget.heads.map((row) => row.budget_head_name)).toEqual([
      'Consumables',
      'Manpower',
    ]);
    expect(aggregate.budget.allotments).toEqual([
      { head_key: 'h1', year_key: 'y1', amount: 250000 },
      { head_key: 'h2', year_key: 'y2', amount: 400000 },
    ]);
  });

  it('keeps a year column and a head row that have no amounts yet', () => {
    const { aggregate } = normalizeProjectPayload(matrix({ allotments: [] }));

    expect(aggregate.budget.years).toHaveLength(2);
    expect(aggregate.budget.heads).toHaveLength(2);
    expect(aggregate.budget.allotments).toEqual([]);
  });

  it('drops a column that has no year picked, and the cells under it', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      matrix({
        years: [{ key: 'y1', financial_year: '' }],
        allotments: [{ head_key: 'h1', year_key: 'y1', amount: '1000' }],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.budget.years).toEqual([]);
    expect(aggregate.budget.allotments).toEqual([]);
  });

  it('drops blank cells rather than storing them as zero', () => {
    const { aggregate } = normalizeProjectPayload(
      matrix({ allotments: [{ head_key: 'h1', year_key: 'y1', amount: '' }] }),
    );

    expect(aggregate.budget.allotments).toEqual([]);
  });

  it('rejects a repeated year column and a repeated head row', () => {
    const { errors } = normalizeProjectPayload(
      matrix({
        years: [
          { key: 'y1', financial_year: '2025-26' },
          { key: 'y2', financial_year: '2025-26' },
        ],
        heads: [
          { key: 'h1', budget_head_name: 'Consumables' },
          { key: 'h2', budget_head_name: 'Consumables' },
        ],
      }),
    );

    expect(errorFields(errors)).toEqual(
      expect.arrayContaining(['budget.years[1]', 'budget.heads[1]']),
    );
  });

  it('rejects a malformed financial year', () => {
    const { errors } = normalizeProjectPayload(
      matrix({ years: [{ key: 'y1', financial_year: '2025' }] }),
    );

    expect(errorFields(errors)).toContain('budget.years[0]');
  });

  it('keeps the contributing organization on a head row, and its name snapshot', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      matrix({
        heads: [
          {
            key: 'h1',
            budget_head_name: 'Consumables',
            contribution_organization_id: '7',
            contribution_organization_name: 'Department of Science and Technology',
          },
          { key: 'h2', budget_head_name: 'Manpower' },
        ],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.budget.heads).toEqual([
      {
        key: 'h1',
        budget_head_name: 'Consumables',
        contribution_organization_id: 7,
        contribution_organization_name: 'Department of Science and Technology',
        display_order: 0,
      },
      {
        key: 'h2',
        budget_head_name: 'Manpower',
        contribution_organization_id: null,
        contribution_organization_name: null,
        display_order: 1,
      },
    ]);
  });

  it('drops a row that names a contributor but no head', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      matrix({
        heads: [{ key: 'h1', budget_head_name: '', contribution_organization_id: 7 }],
        allotments: [],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.budget.heads).toEqual([]);
  });

  it('is empty when the form sends no budget at all', () => {
    const { aggregate, errors } = normalizeProjectPayload(validPayload());

    expect(errors).toEqual([]);
    expect(aggregate.budget).toEqual({ years: [], heads: [], allotments: [] });
  });
});

describe('transaction accounts', () => {
  const ledgerRow = (overrides = {}) => ({
    transaction_date: '2026-05-10',
    head_kind: 'expenditure',
    head_name: 'Consumables',
    debit: '5000',
    ...overrides,
  });

  const withLedger = (rows, accountOverrides = {}) =>
    validPayload({
      transaction_accounts: [
        {
          account_option_id: 17,
          account_name: 'KSRCT RPS AICTE',
          transactions: rows,
          ...accountOverrides,
        },
      ],
    });

  it('normalizes a ledger row and orders it', () => {
    const { aggregate, errors } = normalizeProjectPayload(withLedger([ledgerRow()]));

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts).toHaveLength(1);
    expect(aggregate.transactionAccounts[0]).toMatchObject({
      account_option_id: 17,
      display_order: 0,
    });
    expect(aggregate.transactionAccounts[0].transactions[0]).toMatchObject({
      transaction_date: '2026-05-10',
      head_kind: 'expenditure',
      head_name: 'Consumables',
      credit: null,
      debit: 5000,
      display_order: 0,
    });
  });

  it('stores the payment mode lower-cased, whatever case it arrives in', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([ledgerRow({ payment_mode: 'NEFT' }), ledgerRow({ payment_mode: 'Cheque' })]),
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions.map((row) => row.payment_mode)).toEqual([
      'neft',
      'cheque',
    ]);
  });

  it('leaves the payment mode null when the row does not say', () => {
    const { aggregate, errors } = normalizeProjectPayload(withLedger([ledgerRow()]));

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0].payment_mode).toBeNull();
  });

  it('rejects a payment mode outside the list rather than storing it', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([ledgerRow({ payment_mode: 'Bitcoin' })]),
    );

    expect(errorFields(errors)).toContain('transaction_accounts[0].transactions[0].payment_mode');
    expect(aggregate.transactionAccounts[0].transactions[0].payment_mode).toBeNull();
  });

  it('keeps the contributing organization on an income row, with its name snapshot', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([
        ledgerRow({
          head_kind: 'income',
          head_name: 'Grant-in-aid',
          debit: null,
          credit: '250000',
          contribution_organization_id: '7',
          contribution_organization_name: 'Department of Science and Technology',
        }),
      ]),
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0]).toMatchObject({
      head_kind: 'income',
      contribution_organization_id: 7,
      contribution_organization_name: 'Department of Science and Technology',
    });
  });

  it('keeps a reference number on a row that was switched to an income head', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([
        ledgerRow({
          head_kind: 'income',
          head_name: 'Bank Interest',
          debit: null,
          credit: '1000',
          reference_no: 'VCH/2026/41',
          contribution_organization_id: 7,
        }),
      ]),
    );

    // The form hides it rather than clearing it, so the value has to survive
    // the round trip — switching the head back has to bring it with it.
    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0].reference_no).toBe('VCH/2026/41');
  });

  it('fills the financial year from the date when the column was left blank', () => {
    const { aggregate } = normalizeProjectPayload(
      withLedger([ledgerRow({ transaction_date: '2026-03-31' }), ledgerRow()]),
    );

    const [beforeApril, afterApril] = aggregate.transactionAccounts[0].transactions;
    expect(beforeApril.financial_year).toBe('2025-26');
    expect(afterApril.financial_year).toBe('2026-27');
  });

  it('keeps an explicit financial year over the one the date implies', () => {
    const { aggregate } = normalizeProjectPayload(
      withLedger([ledgerRow({ financial_year: '2024-25' })]),
    );

    expect(aggregate.transactionAccounts[0].transactions[0].financial_year).toBe('2024-25');
  });

  it('requires a row to be a credit or a debit, never both and never neither', () => {
    const { errors } = normalizeProjectPayload(
      withLedger([
        ledgerRow({ credit: '100', debit: '200' }),
        ledgerRow({ debit: '', credit: '' }),
        ledgerRow({ debit: '0' }),
      ]),
    );

    expect(errorFields(errors)).toEqual(
      expect.arrayContaining([
        'transaction_accounts[0].transactions[0].amount',
        'transaction_accounts[0].transactions[1].amount',
        'transaction_accounts[0].transactions[2].amount',
      ]),
    );
  });

  it('allows a credit against an expenditure head, for a returned advance', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([ledgerRow({ debit: '', credit: '1200' })]),
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0]).toMatchObject({
      head_kind: 'expenditure',
      credit: 1200,
      debit: null,
    });
  });

  it('stores an income row under its own vocabulary', () => {
    const { aggregate } = normalizeProjectPayload(
      withLedger([
        ledgerRow({
          head_kind: 'income',
          head_name: 'Bank Interest',
          debit: '',
          credit: '90000',
        }),
      ]),
    );

    expect(aggregate.transactionAccounts[0].transactions[0]).toMatchObject({
      head_kind: 'income',
      head_name: 'Bank Interest',
    });
  });

  it('stores an expenditure head in its canonical case', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([ledgerRow({ head_name: 'overhead charges' })]),
      { budgetHeadNames: budgetHeads },
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0].head_name).toBe('Overhead Charges');
  });

  // The vocabulary only settles the case a head is stored in. Without one — a
  // database with no curated heads yet — every head is stored as submitted,
  // which is what an unrecognised name does anyway.
  it('stores a head as submitted when no vocabulary is supplied', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([ledgerRow({ head_name: 'overhead charges' })]),
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0].head_name).toBe('overhead charges');
  });

  // A ledger written under a head the vocabulary has since dropped still has
  // to save, so the name is kept rather than rejected or blanked.
  it('keeps an expenditure head that is no longer offered', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([ledgerRow({ head_name: 'Postal Expenses' })]),
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0].head_name).toBe('Postal Expenses');
  });

  it('rejects an income head that is not in the vocabulary', () => {
    const { errors } = normalizeProjectPayload(
      withLedger([
        ledgerRow({
          head_kind: 'income',
          head_name: 'Bake sale',
          debit: '',
          credit: '500',
        }),
      ]),
    );

    expect(errorFields(errors)).toContain('transaction_accounts[0].transactions[0].head');
  });

  it('requires a date and a head on a row that carries anything', () => {
    const { errors } = normalizeProjectPayload(withLedger([{ debit: '5000' }]));

    expect(errorFields(errors)).toEqual(
      expect.arrayContaining([
        'transaction_accounts[0].transactions[0].transaction_date',
        'transaction_accounts[0].transactions[0].head',
      ]),
    );
  });

  it('drops the untouched block the form keeps on screen', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        transaction_accounts: [{ account_option_id: null, account_name: null, transactions: [{}] }],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts).toEqual([]);
  });

  it('requires an account once the block has transactions', () => {
    const { errors } = normalizeProjectPayload(
      withLedger([ledgerRow()], { account_option_id: null, account_name: null }),
    );

    expect(errorFields(errors)).toContain('transaction_accounts[0].account');
  });

  it('keeps a ledger whose account option was removed, on its name alone', () => {
    // `account_options` rows are removed with ON DELETE SET NULL behind them,
    // which leaves the block holding only its name snapshot. Rejecting that
    // would block every later save of the project.
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([ledgerRow()], { account_option_id: null, account_name: 'Retired SBI account' }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts).toHaveLength(1);
    expect(aggregate.transactionAccounts[0]).toMatchObject({
      account_option_id: null,
      account_name: 'Retired SBI account',
    });
  });

  // DEFAULT 1 on the column is only half the guarantee: the normalizer has to
  // agree, or a caller that does not send the field would write an explicit 0
  // over it and quietly drop the row out of the project's own Actuals.
  it('counts a ledger row toward Actuals when the flag is not sent', () => {
    const { aggregate, errors } = normalizeProjectPayload(withLedger([ledgerRow()]));

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0].counts_as_actual).toBe(1);
  });

  it('keeps a ledger row out of Actuals when the flag is sent false', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      withLedger([ledgerRow({ counts_as_actual: false })]),
    );

    expect(errors).toEqual([]);
    expect(aggregate.transactionAccounts[0].transactions[0].counts_as_actual).toBe(0);
  });

  it('accepts the flag camelCased, as the form sends it', () => {
    const { aggregate } = normalizeProjectPayload(
      withLedger([ledgerRow({ countsAsActual: true }), ledgerRow({ countsAsActual: false })]),
    );

    const [first, second] = aggregate.transactionAccounts[0].transactions;
    expect(first.counts_as_actual).toBe(1);
    expect(second.counts_as_actual).toBe(0);
  });

  it('rejects two name-only ledgers on the same removed account', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        transaction_accounts: [
          { account_option_id: null, account_name: 'Retired SBI', transactions: [ledgerRow()] },
          { account_option_id: null, account_name: 'retired sbi', transactions: [ledgerRow()] },
        ],
      }),
    );

    expect(errorFields(errors)).toContain('transaction_accounts[1].account');
  });

  it('rejects the same account being given two ledgers', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        transaction_accounts: [
          { account_option_id: 17, transactions: [ledgerRow()] },
          { account_option_id: 17, transactions: [ledgerRow()] },
        ],
      }),
    );

    expect(errorFields(errors)).toContain('transaction_accounts[1].account');
  });
});

describe('budget error indices survive blank rows and columns', () => {
  // The form sends its rows and columns unfiltered, blanks included, so that
  // the index in an error path is the index of the cell the user is looking at.
  it('reports the submitted index, not the index after blanks are dropped', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        budget: {
          years: [
            { key: 'y0', financial_year: null },
            { key: 'y1', financial_year: '2025-26' },
            { key: 'y2', financial_year: '2025-26' },
          ],
          heads: [
            { key: 'h0', budget_head_name: null },
            { key: 'h1', budget_head_name: 'Consumables' },
            { key: 'h2', budget_head_name: 'Consumables' },
          ],
          allotments: [],
        },
      }),
    );

    // The duplicates sit at index 2 of what was submitted; after the blank at
    // index 0 is dropped they are at index 1, which is what a re-indexed error
    // would wrongly report.
    expect(errorFields(errors)).toEqual(
      expect.arrayContaining(['budget.years[2]', 'budget.heads[2]']),
    );
    expect(errorFields(errors)).not.toEqual(
      expect.arrayContaining(['budget.years[1]', 'budget.heads[1]']),
    );

    // The blanks themselves are still dropped from what gets stored.
    expect(aggregate.budget.years.map((row) => row.key)).toEqual(['y1', 'y2']);
    expect(aggregate.budget.heads.map((row) => row.key)).toEqual(['h1', 'h2']);
  });

  it('drops an amount whose head row is blank, so the cell has nowhere to go', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        budget: {
          years: [{ key: 'y1', financial_year: '2025-26' }],
          heads: [{ key: 'h0', budget_head_name: null }],
          allotments: [{ head_key: 'h0', year_key: 'y1', amount: '5000' }],
        },
      }),
    );

    expect(aggregate.budget.heads).toEqual([]);
    expect(aggregate.budget.allotments).toEqual([]);
  });
});

describe('the ledger is stored in date order', () => {
  const row = (transaction_date, debit, extra = {}) => ({
    transaction_date,
    head_kind: 'expenditure',
    head_name: 'Consumables',
    debit,
    ...extra,
  });

  const ledger = (rows) =>
    normalizeProjectPayload(
      validPayload({ transaction_accounts: [{ account_option_id: 17, transactions: rows }] }),
    );

  it('reorders rows entered out of sequence, because the running balance reads oldest-first', () => {
    const { aggregate, errors } = ledger([
      row('2026-05-15', '180000'),
      row('2025-06-10', '500'),
      row('2025-12-01', '900'),
    ]);

    expect(errors).toEqual([]);
    expect(
      aggregate.transactionAccounts[0].transactions.map((t) => [
        t.transaction_date,
        t.display_order,
      ]),
    ).toEqual([
      ['2025-06-10', 0],
      ['2025-12-01', 1],
      ['2026-05-15', 2],
    ]);
  });

  it('keeps same-day transactions in the order the user put them in', () => {
    const { aggregate } = ledger([
      row('2025-06-10', '100', { reference_no: 'first' }),
      row('2025-06-10', '200', { reference_no: 'second' }),
      row('2025-06-10', '300', { reference_no: 'third' }),
    ]);

    expect(aggregate.transactionAccounts[0].transactions.map((t) => t.reference_no)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('still points a validation error at the row the user submitted', () => {
    // The offending row is submitted second but sorts first.
    const { errors } = ledger([
      row('2026-05-15', '180000'),
      row('2025-06-10', '100', { credit: '50' }),
    ]);

    expect(errorFields(errors)).toContain('transaction_accounts[0].transactions[1].amount');
    expect(errorFields(errors)).not.toContain('transaction_accounts[0].transactions[0].amount');
  });
});

// The Facility tab saves as one list with the project. These pin which rows it
// keeps, what a kept row must carry, and that the I-STEM ID lives and dies with
// its toggle — an ID left behind by a switched-off toggle would read as a
// listing the facility does not have.
describe('facility rows', () => {
  it('maps a filled row onto project_facilities columns', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        facilities: [
          {
            facility_name: 'FTIR spectrometer',
            facility_type: 'characterization',
            installation_date: '2026-06-15',
            cost: '1250000.50',
            make: 'Bruker',
            model: 'Alpha II',
            serial_no: 'SN-4411',
            stock_register_ref: '12 / 48',
            istem_listed: true,
            istem_id: 'ISTEM-0091',
            supplier_details: 'Bruker India, Chennai',
          },
        ],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.facilities).toEqual([
      {
        facility_name: 'FTIR spectrometer',
        facility_type: 'characterization',
        installation_date: '2026-06-15',
        cost: 1250000.5,
        make: 'Bruker',
        model: 'Alpha II',
        serial_no: 'SN-4411',
        stock_register_ref: '12 / 48',
        istem_listed: 1,
        istem_id: 'ISTEM-0091',
        supplier_details: 'Bruker India, Chennai',
        display_order: 0,
      },
    ]);
  });

  it('accepts the IT Product label spelling and rejects an unknown type', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        facilities: [
          { facility_name: 'Lab server', facility_type: 'IT Product' },
          { facility_name: 'Kiln', facility_type: 'pottery' },
        ],
      }),
    );

    expect(aggregate.facilities[0].facility_type).toBe('it_product');
    expect(errorFields(errors)).toEqual(['facilities[1].facility_type']);
  });

  it('drops blank rows and reports a missing name under the submitted index', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        facilities: [{}, { istem_listed: false, istem_id: 'stale' }, { make: 'Bruker' }],
      }),
    );

    expect(aggregate.facilities).toHaveLength(1);
    expect(aggregate.facilities[0].display_order).toBe(0);
    expect(errorFields(errors)).toEqual(['facilities[2].facility_name']);
  });

  it('requires the I-STEM ID only while the toggle is on, and drops it when off', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        facilities: [
          { facility_name: 'Glovebox', istem_listed: true },
          { facility_name: 'Furnace', istem_listed: false, istem_id: 'ISTEM-7' },
        ],
      }),
    );

    expect(errorFields(errors)).toEqual(['facilities[0].istem_id']);
    expect(aggregate.facilities[1].istem_id).toBeNull();
  });

  it('rejects a malformed installation date and a negative cost', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        facilities: [{ facility_name: 'Drier', installation_date: '15/06/2026', cost: '-5' }],
      }),
    );

    expect(errorFields(errors)).toEqual(
      expect.arrayContaining(['facilities[0].installation_date', 'facilities[0].cost']),
    );
  });
});

// The Manpower tab. Rows are matched by id on save so a profile upload survives
// an edit, which is why the id and key must come through untouched, and why a
// row carrying only its profile is not blank.
describe('manpower rows', () => {
  const person = (overrides = {}) => ({
    role: 'junior_research_fellow',
    name: 'R Priya',
    ...overrides,
  });

  it('maps a filled row, keeping its id and key and reducing the mobile to ten digits', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        manpower: [
          person({
            id: 7,
            key: 'manpower-3',
            qualification: 'M.Sc. Chemistry',
            salary: '37000',
            joining_date: '2026-04-01',
            mobile: '+91 98765-43210',
            email: 'priya@example.com',
            remarks: 'Fellowship via CSIR',
            relieving_date: '2027-03-31',
          }),
        ],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.manpower).toEqual([
      {
        id: 7,
        key: 'manpower-3',
        role: 'junior_research_fellow',
        name: 'R Priya',
        qualification: 'M.Sc. Chemistry',
        salary: 37000,
        joining_date: '2026-04-01',
        mobile: '9876543210',
        email: 'priya@example.com',
        remarks: 'Fellowship via CSIR',
        relieving_date: '2027-03-31',
        removed_documents: [],
        display_order: 0,
      },
    ]);
  });

  it('requires a role and a name on a started row, under the submitted index', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({ manpower: [{}, { qualification: 'B.E.' }, person({ role: 'intern' })] }),
    );

    expect(aggregate.manpower).toHaveLength(2);
    expect(errorFields(errors)).toEqual(
      expect.arrayContaining(['manpower[1].role', 'manpower[1].name', 'manpower[2].role']),
    );
  });

  it('rejects a malformed mobile or email', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({ manpower: [person({ mobile: '98765', email: 'priya@' })] }),
    );

    expect(errorFields(errors)).toEqual(['manpower[0].mobile', 'manpower[0].email']);
  });

  it('rejects a relieving date before the joining date', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        manpower: [person({ joining_date: '2026-04-01', relieving_date: '2026-03-31' })],
      }),
    );

    expect(errorFields(errors)).toEqual(['manpower[0].relieving_date']);
  });

  it('keeps a row whose only content is an uploaded profile', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({ manpower: [{ key: 'manpower-9' }] }),
      { documentRowKeys: { manpower: ['manpower-9'] } },
    );

    expect(aggregate.manpower).toHaveLength(1);
  });

  it('keeps only the profile slot in removed_documents', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({ manpower: [person({ removed_documents: ['profile', 'sanction'] })] }),
    );

    expect(aggregate.manpower[0].removed_documents).toEqual(['profile']);
  });

  it('round-trips the profile field name, including a key with a hyphen', () => {
    const fieldName = manpowerDocumentFieldName('manpower-12', 'profile');

    expect(fieldName).toBe('manpower__manpower-12__profile');
    expect(parseDocumentFieldName(fieldName)).toEqual({
      scope: 'manpower',
      rowKey: 'manpower-12',
      slot: 'profile',
      documentType: 'manpower_profile',
    });
    expect(parseDocumentFieldName('manpower__manpower-12__resume')).toBeNull();
  });
});

// The Outcomes tab. Its rows replaced the six typed counts, which the form must
// no longer overwrite: an update that wrote them from an absent field would zero
// every older project's figures.
describe('outcome rows', () => {
  it('no longer writes the six typed outcome counts, even when they are sent', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({ outcome_journal_articles: '3', outcome_startups: '1' }),
    );

    expect(aggregate.project).not.toHaveProperty('outcome_journal_articles');
    expect(aggregate.project).not.toHaveProperty('outcome_startups');
  });

  it('strips a pasted doi.org link down to the bare DOI', () => {
    expect(normalizeDoi('https://doi.org/10.1016/J.FOO.2024.01.002')).toBe(
      '10.1016/J.FOO.2024.01.002',
    );
    expect(normalizeDoi('http://dx.doi.org/10.1000/abc')).toBe('10.1000/abc');
    expect(normalizeDoi('doi: 10.1000/abc')).toBe('10.1000/abc');
    expect(normalizeDoi('  ')).toBe('');
  });

  it('keeps a publication by DOI or title, and rejects a malformed DOI', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        publications: [
          {
            publication_type: 'journal',
            doi: 'https://doi.org/10.1000/xyz123',
            journal_id: '4',
            title: 'Solar drying',
            venue: 'J. Food Eng.',
            publication_year: '2026',
          },
          {},
          { publication_type: 'conference', title: 'Paper without a DOI yet' },
          { publication_type: 'book_chapter', doi: 'not-a-doi' },
          { venue: 'Somewhere' },
        ],
      }),
    );

    expect(aggregate.publications).toHaveLength(4);
    expect(aggregate.publications[0]).toEqual({
      publication_type: 'journal',
      doi: '10.1000/xyz123',
      journal_id: 4,
      title: 'Solar drying',
      venue: 'J. Food Eng.',
      publication_year: 2026,
      display_order: 0,
    });
    expect(errorFields(errors)).toEqual([
      'publications[3].doi',
      'publications[4].publication_type',
      'publications[4].doi',
    ]);
  });

  it('bounds the publication year', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        publications: [{ publication_type: 'journal', title: 'Old', publication_year: '1850' }],
      }),
    );

    expect(errorFields(errors)).toEqual(['publications[0].publication_year']);
  });

  it('requires an IPR type and a number or title, and a grant on or after filing', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        iprs: [
          { ipr_type: 'Design Patent', ipr_number: '202641000123', status: 'Granted' },
          { status: 'filed' },
          {
            ipr_type: 'patent',
            title: 'Millet drier',
            filing_date: '2026-05-01',
            grant_date: '2026-04-01',
          },
        ],
      }),
    );

    expect(aggregate.iprs[0]).toMatchObject({ ipr_type: 'design_patent', status: 'granted' });
    expect(errorFields(errors)).toEqual([
      'iprs[1].ipr_type',
      'iprs[1].ipr_number',
      'iprs[2].grant_date',
    ]);
  });

  it('keeps a tech transfer by id and key, reads "TRL 6" and bounds the level', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        tech_transfers: [
          { id: 3, key: 'tech-1', category: 'startup', description: 'Spin-off', trl: 'TRL 6' },
          { category: 'product', trl: '2' },
          { description: 'No category' },
        ],
      }),
    );

    expect(aggregate.techTransfers[0]).toEqual({
      id: 3,
      key: 'tech-1',
      category: 'startup',
      description: 'Spin-off',
      trl: 6,
      removed_documents: [],
      display_order: 0,
    });
    expect(errorFields(errors)).toEqual(['tech_transfers[1].trl', 'tech_transfers[2].category']);
  });

  it('requires a candidate name and degree, and keeps a row carrying only its document', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        outcome_candidates: [
          { candidate_name: 'S Arun', degree: 'phd', university: 'Anna University' },
          { university: 'IIT Madras' },
          { key: 'candidate-7' },
        ],
      }),
      { documentRowKeys: { candidate: ['candidate-7'] } },
    );

    expect(aggregate.outcomeCandidates).toHaveLength(3);
    expect(errorFields(errors)).toEqual(
      expect.arrayContaining([
        'outcome_candidates[1].candidate_name',
        'outcome_candidates[1].degree',
        'outcome_candidates[2].candidate_name',
      ]),
    );
  });

  it('parses the tech-transfer and candidate document field names', () => {
    expect(parseDocumentFieldName('tech_transfer__tech-4__document')).toEqual({
      scope: 'tech_transfer',
      rowKey: 'tech-4',
      slot: 'document',
      documentType: 'tech_transfer_document',
    });
    expect(parseDocumentFieldName('candidate__candidate-2__document')).toMatchObject({
      scope: 'candidate',
      documentType: 'candidate_document',
    });
    expect(parseDocumentFieldName('candidate__candidate-2__profile')).toBeNull();
  });
});

// The Documents tab's correspondence log. Each document kind belongs to one
// direction — a sanction order only ever comes in — so a kind filed under the
// other direction is refused rather than stored as a contradiction.
describe('document transaction rows', () => {
  it('maps a row, keeping its id and key', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({
        document_transactions: [
          {
            id: 5,
            key: 'doc-tx-1',
            transaction_date: '2026-07-10',
            direction: 'outward',
            document_kind: 'yearly_progress_report',
            description: 'Courier | DTDC 1234',
          },
        ],
      }),
    );

    expect(errors).toEqual([]);
    expect(aggregate.documentTransactions).toEqual([
      {
        id: 5,
        key: 'doc-tx-1',
        transaction_date: '2026-07-10',
        direction: 'outward',
        document_kind: 'yearly_progress_report',
        description: 'Courier | DTDC 1234',
        removed_documents: [],
        display_order: 0,
      },
    ]);
  });

  it('requires a date, a direction and a document, under the submitted index', () => {
    const { aggregate, errors } = normalizeProjectPayload(
      validPayload({ document_transactions: [{}, { description: 'Mail' }] }),
    );

    expect(aggregate.documentTransactions).toHaveLength(1);
    expect(errorFields(errors)).toEqual([
      'document_transactions[1].transaction_date',
      'document_transactions[1].direction',
      'document_transactions[1].document_kind',
    ]);
  });

  it('refuses a document filed under the other direction', () => {
    const { errors } = normalizeProjectPayload(
      validPayload({
        document_transactions: [
          { transaction_date: '2026-07-10', direction: 'outward', document_kind: 'sanction_order' },
        ],
      }),
    );

    expect(errorFields(errors)).toEqual(['document_transactions[0].document_kind']);
  });

  it('keeps a row whose only content is its file, and parses that file field name', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({ document_transactions: [{ key: 'doc-tx-9' }] }),
      { documentRowKeys: { document_transaction: ['doc-tx-9'] } },
    );

    expect(aggregate.documentTransactions).toHaveLength(1);
    expect(parseDocumentFieldName('document_transaction__doc-tx-9__document')).toEqual({
      scope: 'document_transaction',
      rowKey: 'doc-tx-9',
      slot: 'document',
      documentType: 'document_transaction_file',
    });
  });
});
