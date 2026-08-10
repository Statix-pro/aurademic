import { describe, expect, it } from 'vitest';

import {
  buildDateRangeCondition,
  normalizeDateOnly,
  normalizeDateRange,
} from '../modules/shared/dateRangeFilter.js';

describe('normalizeDateOnly', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(normalizeDateOnly('2026-08-10')).toBe('2026-08-10');
    expect(normalizeDateOnly('  2026-04-01  ')).toBe('2026-04-01');
  });

  it('rejects anything it cannot filter on safely', () => {
    expect(normalizeDateOnly('')).toBeNull();
    expect(normalizeDateOnly(null)).toBeNull();
    expect(normalizeDateOnly('10-08-2026')).toBeNull();
    expect(normalizeDateOnly('2026-08-10T12:00:00Z')).toBeNull();
    expect(normalizeDateOnly("2026-08-10' OR 1=1--")).toBeNull();
  });

  it('rejects real-looking but impossible dates instead of rolling them forward', () => {
    expect(normalizeDateOnly('2026-02-31')).toBeNull();
    expect(normalizeDateOnly('2026-13-01')).toBeNull();
  });
});

describe('normalizeDateRange', () => {
  it('swaps reversed bounds so a back-to-front range still works', () => {
    expect(normalizeDateRange({ dateFrom: '2026-08-10', dateTo: '2026-04-01' })).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2026-08-10',
    });
  });

  it('keeps a single usable bound and drops an invalid partner', () => {
    expect(normalizeDateRange({ dateFrom: '2026-04-01', dateTo: 'nonsense' })).toEqual({
      dateFrom: '2026-04-01',
      dateTo: null,
    });
  });
});

describe('buildDateRangeCondition', () => {
  const column = 'COALESCE(fr.request_date, DATE(fr.created_at))';

  it('emits no condition when neither bound is usable', () => {
    expect(buildDateRangeCondition(column, {})).toEqual({ sql: '', params: [] });
    expect(buildDateRangeCondition(column, { dateFrom: 'bad', dateTo: '' })).toEqual({
      sql: '',
      params: [],
    });
  });

  it('emits an inclusive BETWEEN for a full range', () => {
    expect(
      buildDateRangeCondition(column, { dateFrom: '2026-04-01', dateTo: '2026-08-10' }),
    ).toEqual({
      sql: `${column} BETWEEN ? AND ?`,
      params: ['2026-04-01', '2026-08-10'],
    });
  });

  it('emits an open-ended comparison for a single bound', () => {
    expect(buildDateRangeCondition(column, { dateFrom: '2026-04-01' })).toEqual({
      sql: `${column} >= ?`,
      params: ['2026-04-01'],
    });
    expect(buildDateRangeCondition(column, { dateTo: '2026-08-10' })).toEqual({
      sql: `${column} <= ?`,
      params: ['2026-08-10'],
    });
  });

  it('never inlines a value into the SQL, so a bound cannot carry an injection', () => {
    const { sql, params } = buildDateRangeCondition(column, {
      dateFrom: '2026-04-01',
      dateTo: "2026-08-10'; DROP TABLE finance_requests;--",
    });

    expect(sql).toBe(`${column} >= ?`);
    expect(params).toEqual(['2026-04-01']);
    expect(sql).not.toContain('DROP');
  });
});
