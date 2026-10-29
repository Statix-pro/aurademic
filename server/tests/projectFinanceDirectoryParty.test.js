import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { execute: vi.fn(), query: vi.fn(), getConnection: vi.fn() },
}));

const db = (await import('../config/connection.js')).default;
const { default: projectModel, ProjectValidationError } =
  await import('../modules/project/projectModel.js');
const { normalizeProjectPayload } = await import('../modules/project/projectPayload.js');

const DIRECTORY_NAME = 'PSG College of Arts and Science';

const payload = (overrides = {}) => ({
  title: 'Solar drying of millets',
  investigators: [{ member_type: 'faculty', identity_code: 'EMP001', name: 'A Kumar' }],
  collaborators_enabled: true,
  collaborators: [
    { directory_organization_id: 5, organization_name: 'Typed by the client', role: 'Partner' },
  ],
  ...overrides,
});

const withContribution = (financeRow) =>
  payload({ financial_contribution_enabled: true, financial_contributions: [financeRow] });

// Every Finance tab picker naming directory organization `id` under a name the client made up.
const everyPicker = (id) => ({
  financial_contribution_enabled: true,
  financial_contributions: [{ directory_organization_id: id, organization_name: 'x', amount: 1 }],
  finance_sharing_enabled: true,
  finance_sharing: [{ directory_organization_id: id, organization_name: 'x', amount: 2 }],
  budget: {
    years: [{ key: 'y1', financial_year: '2025-26' }],
    heads: [
      {
        key: 'h1',
        budget_head_name: 'Consumables',
        contribution_directory_organization_id: id,
        contribution_organization_name: 'x',
      },
    ],
    allotments: [],
  },
  transaction_accounts: [
    {
      account_option_id: 17,
      account_name: 'KSRCT RPS AICTE',
      transactions: [
        {
          transaction_date: '2026-05-10',
          head_kind: 'income',
          head_name: 'Grant-in-aid',
          credit: '250000',
          contribution_directory_organization_id: id,
          contribution_organization_name: 'x',
        },
      ],
    },
  ],
  disbursements: [
    {
      financial_year: '2025-26',
      directory_organization_id: id,
      organization_name: 'x',
      amount: '100',
    },
  ],
});

// Answers the directory lookups by their SQL and records every other statement, so the test
// reads what the save wrote. `storedLinks` are the directory links the project's finance
// tables held before this save.
const connectionFor = ({ storedLinks = [] } = {}) => {
  const statements = [];
  const connection = {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    query: vi.fn(async (sql, params) => {
      statements.push({ sql, params });
      if (/AS id, .* AS name/s.test(sql)) return [storedLinks];
      if (/FROM organizations/.test(sql))
        return [[{ id: 5, name: DIRECTORY_NAME, city: 'Coimbatore', is_active: 1 }]];
      if (/FROM (master_employees|authors)/.test(sql)) return [[{ id: 1 }]];
      if (/^\s*(SELECT|DELETE)/i.test(sql)) return [[]];
      return [{ insertId: 1, affectedRows: 1 }];
    }),
  };
  db.getConnection.mockResolvedValue(connection);
  return { connection, statements };
};

const save = async (body, options) => {
  const { aggregate, errors } = normalizeProjectPayload(body);
  expect(errors).toEqual([]);
  const recorded = connectionFor(options);
  const result = await projectModel
    .saveProject({ projectId: 3, aggregate, userId: 4 })
    .catch((error) => error);
  return { ...recorded, result };
};

const insertInto = (statements, table) =>
  statements.filter(({ sql }) => new RegExp(`INSERT INTO ${table}\\b`).test(sql));

describe('finance parties naming a directory collaborator', () => {
  // A collaborator picked from the Organization directory has no project_organizations
  // entry; a Financial Contribution row names it by directory id, under the directory's name.
  it('stores the directory id and the directory name, not the client one', async () => {
    const { statements } = await save(
      withContribution({ directory_organization_id: 5, organization_name: 'Made up', amount: 1 }),
    );

    const [insert] = insertInto(statements, 'project_finance_rows');
    expect(insert.params.slice(1, 6)).toEqual(['contribution', null, DIRECTORY_NAME, 5, 1]);
  });

  // The budget head's contributor, a receipt's contributor and a disbursement's releasing
  // organization offer the same parties as the two finance tables, so a partner who puts
  // money in can be followed from the plan through the allotment to the ledger.
  it('links every Finance tab picker to the collaborator, under its directory name', async () => {
    const { statements, result } = await save(payload(everyPicker(5)));
    expect(result).toEqual({ projectId: 3, staleFilePaths: [] });

    const financeRows = insertInto(statements, 'project_finance_rows');
    expect(financeRows.map(({ params }) => params.slice(2, 5))).toEqual([
      [null, DIRECTORY_NAME, 5],
      [null, DIRECTORY_NAME, 5],
    ]);
    const [head] = insertInto(statements, 'project_budget_heads');
    expect(head.params.slice(2, 5)).toEqual([null, DIRECTORY_NAME, 5]);
    const [ledger] = insertInto(statements, 'project_transactions');
    expect(ledger.params[0][0].slice(9, 12)).toEqual([null, DIRECTORY_NAME, 5]);
    const [disbursement] = insertInto(statements, 'project_grant_disbursements');
    expect(disbursement.params.slice(2, 5)).toEqual([null, DIRECTORY_NAME, 5]);
  });

  // Without the check, a row could name any directory entry -- another user's Pending one
  // included -- and its name would be copied into the project.
  it('refuses a directory organization the project never linked, at each picker', async () => {
    const { connection, result } = await save(payload(everyPicker(99)));

    expect(result).toBeInstanceOf(ProjectValidationError);
    expect(result.errors.map((error) => error.field)).toEqual([
      'contribution_rows[0].organization',
      'sharing_rows[0].organization',
      'budget.heads[0].contribution_organization',
      'transaction_accounts[0].transactions[0].contribution_organization',
      'disbursements[0].organization',
    ]);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  // A receipt recorded against a partner who has since left the project is still history:
  // the project must keep saving, and the receipt keeps the name it was recorded under. This
  // is the same leniency a master organization no longer offered gets on its row.
  it('keeps a link the project already held after the collaborator is removed', async () => {
    const { statements, result } = await save(payload({ collaborators: [], ...everyPicker(42) }), {
      storedLinks: [{ id: 42, name: 'Anna University (as recorded)' }],
    });

    expect(result).toEqual({ projectId: 3, staleFilePaths: [] });
    const [ledger] = insertInto(statements, 'project_transactions');
    expect(ledger.params[0][0].slice(9, 12)).toEqual([null, 'Anna University (as recorded)', 42]);
  });

  // A row names one organization: a master id sent beside the directory id is dropped.
  it('keeps only the directory link when both ids are sent', () => {
    const { aggregate } = normalizeProjectPayload(
      payload({
        ...everyPicker(5),
        financial_contributions: [{ directory_organization_id: 5, organization_id: 1, amount: 1 }],
        disbursements: [{ directory_organization_id: 5, organization_id: 1, amount: '1' }],
      }),
    );

    expect(aggregate.financeRows[0]).toMatchObject({
      directory_organization_id: 5,
      organization_id: null,
    });
    expect(aggregate.disbursements[0]).toMatchObject({
      directory_organization_id: 5,
      organization_id: null,
    });
  });

  it('leaves a master organization row as it was', async () => {
    const { statements } = await save(
      withContribution({
        organization_id: 1,
        organization_name: 'K.S.Rangasamy College',
        amount: 10,
      }),
    );

    const [insert] = insertInto(statements, 'project_finance_rows');
    expect(insert.params.slice(2, 5)).toEqual([1, 'K.S.Rangasamy College', null]);
  });
});
