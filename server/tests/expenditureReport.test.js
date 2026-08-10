import { beforeEach, describe, expect, it, vi } from 'vitest';

import db from '../config/connection.js';
import {
  buildReportFilters,
  resolveReportScope,
} from '../modules/expenditureReport/expenditureReportModel.js';

vi.mock('../config/connection.js', () => {
  return {
    default: {
      getConnection: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    },
  };
});

/** Placeholder count, so a fragment's params can be checked against its own `?`s. */
const countPlaceholders = (sql) => (sql.match(/\?/g) || []).length;

const globalScope = { scopeType: 'global', departmentIds: [], entityIds: [], userId: 7 };

describe('buildReportFilters', () => {
  it('always excludes deleted, rejected and archived requests', () => {
    const { whereSql } = buildReportFilters({ scope: globalScope });

    expect(whereSql).toMatch(/^WHERE /);
    expect(whereSql).toContain("'deleted', 'rejected', 'archived'");
  });

  it('emits exactly one param per placeholder', () => {
    const { whereSql, params } = buildReportFilters({
      fiscalYear: 2026,
      dateFrom: '2026-04-01',
      dateTo: '2026-06-30',
      beneficiaryType: 'Department',
      beneficiaryValue: 'Computer Science',
      q: 'EX-2026',
      scope: globalScope,
    });

    expect(countPlaceholders(whereSql)).toBe(params.length);
  });

  it('takes five copies of the fiscal year, matching the shared FY fragment', () => {
    const { params } = buildReportFilters({ fiscalYear: 2026, scope: globalScope });

    expect(params).toEqual([2026, 2026, 2026, 2026, 2026]);
  });

  it('ignores a non-numeric fiscal year rather than filtering on garbage', () => {
    const { whereSql, params } = buildReportFilters({ fiscalYear: 'all', scope: globalScope });

    expect(whereSql).not.toContain('fiscal_year');
    expect(params).toEqual([]);
  });

  it('applies a date window with BETWEEN when both bounds are given', () => {
    const { whereSql, params } = buildReportFilters({
      dateFrom: '2026-04-01',
      dateTo: '2026-06-30',
      scope: globalScope,
    });

    expect(whereSql).toContain('BETWEEN ? AND ?');
    expect(params).toEqual(['2026-04-01', '2026-06-30']);
  });

  it('swaps reversed bounds so a back-to-front range still returns the intended window', () => {
    const { params, dateFrom, dateTo } = buildReportFilters({
      dateFrom: '2026-06-30',
      dateTo: '2026-04-01',
      scope: globalScope,
    });

    expect(params).toEqual(['2026-04-01', '2026-06-30']);
    expect({ dateFrom, dateTo }).toEqual({ dateFrom: '2026-04-01', dateTo: '2026-06-30' });
  });

  it('drops an unparseable date instead of erroring or matching nothing', () => {
    const { whereSql, params } = buildReportFilters({
      dateFrom: "2026-04-01' OR 1=1--",
      scope: globalScope,
    });

    expect(whereSql).not.toContain('request_date, DATE(er.created_at)) >=');
    expect(params).toEqual([]);
  });

  it('combines a fiscal year and a date window, which is how the Month period mode works', () => {
    const { whereSql, params } = buildReportFilters({
      fiscalYear: 2026,
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      scope: globalScope,
    });

    expect(whereSql).toContain('fiscal_year');
    expect(whereSql).toContain('BETWEEN ? AND ?');
    expect(params).toEqual([2026, 2026, 2026, 2026, 2026, '2026-05-01', '2026-05-31']);
  });

  it('adds no scope predicate for a global scope', () => {
    const { whereSql } = buildReportFilters({ scope: globalScope });

    expect(whereSql).not.toContain('er.department_id IN');
    expect(whereSql).not.toContain('er.beneficiary_entity_id IN');
    expect(whereSql).not.toContain('er.created_by');
  });

  it('narrows a department scope to its assigned departments', () => {
    const { whereSql, params } = buildReportFilters({
      scope: { scopeType: 'department', departmentIds: [3, 9], entityIds: [], userId: 7 },
    });

    expect(whereSql).toContain('er.department_id IN (?)');
    expect(params).toEqual([[3, 9]]);
  });

  it('narrows an entity scope to its assigned entities', () => {
    const { whereSql, params } = buildReportFilters({
      scope: { scopeType: 'entity', departmentIds: [], entityIds: [12], userId: 7 },
    });

    expect(whereSql).toContain('er.beneficiary_entity_id IN (?)');
    expect(params).toEqual([[12]]);
  });

  it('restricts an own scope to the caller, never to everything', () => {
    const { whereSql, params } = buildReportFilters({
      scope: { scopeType: 'own', departmentIds: [], entityIds: [], userId: 7 },
    });

    expect(whereSql).toContain('er.created_by = ?');
    expect(params).toEqual([7]);
  });

  it('returns nothing when a scope resolves to no assignment at all', () => {
    expect(
      buildReportFilters({
        scope: { scopeType: 'department', departmentIds: [], entityIds: [], userId: 7 },
      }).whereSql,
    ).toContain('1 = 0');

    expect(
      buildReportFilters({
        scope: { scopeType: 'own', departmentIds: [], entityIds: [], userId: null },
      }).whereSql,
    ).toContain('1 = 0');
  });

  it('falls back to own-records-only when no scope is supplied', () => {
    // A caller that forgets to pass a scope must not accidentally get the institution.
    expect(buildReportFilters({}).whereSql).toContain('1 = 0');
  });
});

describe('resolveReportScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gives finance-level roles the whole institution without hitting the database', async () => {
    for (const role of ['super_admin', 'admin', 'finance_admin', 'dof', 'principal', 'chairman']) {
      const scope = await resolveReportScope({ userId: 7, roles: [role] });
      expect(scope.scopeType).toBe('global');
    }

    const superAdminFlag = await resolveReportScope({ userId: 7, roles: [], isSuperAdmin: true });
    expect(superAdminFlag.scopeType).toBe('global');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('treats finance_admin as the DOF, since there is no dof role_code in this system', async () => {
    // The roles table ships super_admin, admin, hod, finance_admin, principal, coordinator,
    // it_head, user and chairman — no `dof`. Keying only on a `dof` role code would deny the
    // Director of Finance their own report.
    const scope = await resolveReportScope({
      userId: 7,
      roles: ['finance_admin', 'it_head', 'user'],
    });

    expect(scope.scopeType).toBe('global');
  });

  it('grants global scope on the workflow permission even when the role code is unknown', async () => {
    const scope = await resolveReportScope({
      userId: 7,
      roles: ['some_custom_finance_role'],
      permissions: ['expenditure.workflow.dof'],
    });

    expect(scope.scopeType).toBe('global');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('does not grant global scope on an unrelated expenditure permission', async () => {
    const scope = await resolveReportScope({
      userId: 7,
      roles: ['user'],
      permissions: ['expenditure.workflow.level1', 'expenditure.create'],
    });

    expect(scope.scopeType).toBe('own');
  });

  it('scopes an HOD to the departments they are assigned to', async () => {
    db.query.mockResolvedValue([
      [
        { entity_id: 3, entity_type: 'DEPARTMENT' },
        { entity_id: 9, entity_type: 'DEPARTMENT' },
        { entity_id: 12, entity_type: 'CENTRE' },
      ],
    ]);

    const scope = await resolveReportScope({ userId: 7, roles: ['hod'] });

    expect(scope.scopeType).toBe('department');
    expect(scope.departmentIds).toEqual([3, 9]);
  });

  it('scopes a coordinator to their non-department entities', async () => {
    db.query.mockResolvedValue([
      [
        { entity_id: 12, entity_type: 'CENTRE' },
        { entity_id: 15, entity_type: 'CLUB' },
      ],
    ]);

    const scope = await resolveReportScope({ userId: 7, roles: ['coordinator'] });

    expect(scope.scopeType).toBe('entity');
    expect(scope.entityIds).toEqual([12, 15]);
  });

  it('drops an approver with no assignment to their own requests', async () => {
    db.query.mockResolvedValue([[]]);

    const scope = await resolveReportScope({ userId: 7, roles: ['hod'] });

    expect(scope.scopeType).toBe('own');
    expect(scope.userId).toBe(7);
  });

  it('fails closed for an unrecognised role', async () => {
    // The point of this test: adding a new role to the system must never silently grant
    // institution-wide visibility of spend.
    const scope = await resolveReportScope({ userId: 7, roles: ['some_new_role'] });

    expect(scope.scopeType).toBe('own');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('fails closed when there is no user id', async () => {
    const scope = await resolveReportScope({ userId: null, roles: ['hod'] });

    expect(scope.scopeType).toBe('own');
    expect(scope.userId).toBeNull();
  });
});
