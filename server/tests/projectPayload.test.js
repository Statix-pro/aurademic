import { describe, expect, it } from 'vitest';

import { formatProjectDates } from '../modules/project/projectDates.js';
import {
  disbursementDocumentFieldName,
  documentFieldName,
  normalizeProjectPayload,
  parseDocumentFieldName,
} from '../modules/project/projectPayload.js';

const validPayload = (overrides = {}) => ({
  title: 'Solar drying of millets',
  investigators: [{ member_type: 'faculty', identity_code: 'EMP001', name: 'A Kumar' }],
  ...overrides,
});

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
      outcome_iprs: 0,
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
        outcome_journal_articles: '3',
      }),
    );

    expect(aggregate.project.project_cost).toBe(1250000.5);
    expect(aggregate.project.duration_years).toBe(2);
    expect(aggregate.project.duration_months).toBe(6);
    expect(aggregate.project.submitted_on).toBe('2026-04-01');
    expect(aggregate.project.outcome_journal_articles).toBe(3);
    expect(errorFields(errors)).toContain('result_date');
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

  it('deduplicates budget heads on a finance row', () => {
    const { aggregate } = normalizeProjectPayload(
      validPayload({
        financial_contribution_enabled: true,
        financial_contributions: [
          {
            organization_name: 'DST',
            amount: '100',
            heads: [
              { budget_head_id: 3, budget_head_name: 'Equipment' },
              { budget_head_id: 3, budget_head_name: 'Equipment' },
              { budget_head_id: 4, budget_head_name: 'Consumables' },
            ],
          },
        ],
      }),
    );

    expect(aggregate.financeRows[0].heads).toEqual([
      { budget_head_id: 3, budget_head_name: 'Equipment' },
      { budget_head_id: 4, budget_head_name: 'Consumables' },
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
