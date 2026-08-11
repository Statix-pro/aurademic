import { describe, expect, it } from 'vitest';

import {
  buildSettledAdvanceExpr,
  resolveAdvanceUsageAmount,
} from '../modules/shared/expenditureClaims.js';

/**
 * `settledAdvanceAmount` is the advance recorded on the settlement rows themselves, which is
 * what says WHICH advances a settlement discharged. Two scalar rules were tried before it was
 * passed in, and the cases below are the counterexamples that killed each of them.
 */
describe('resolveAdvanceUsageAmount', () => {
  it('counts every advance when nothing has been settled', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 200000,
        settlementAmount: 0,
        settledAdvanceAmount: 0,
      }),
    ).toBe(200000);
  });

  it('counts a fully settled advance once, not twice', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 100000,
        settlementAmount: 100000,
        settledAdvanceAmount: 100000,
      }),
    ).toBe(100000);
  });

  // Killed `settlement > 0 ? settlement : advance`, which reported 100000 and lost the advance
  // that was still outstanding.
  it('keeps the outstanding advance when only some advances are settled', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 200000,
        settlementAmount: 100000,
        settledAdvanceAmount: 100000,
      }),
    ).toBe(200000);
  });

  // Killed `max(advance, settlement)`, which reported 100000 for money that was handed back.
  it('follows the settlement when less was spent than advanced', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 100000,
        settlementAmount: 80000,
        settledAdvanceAmount: 100000,
      }),
    ).toBe(80000);
  });

  it('follows the settlement when more was spent than advanced', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 100000,
        settlementAmount: 120000,
        settledAdvanceAmount: 100000,
      }),
    ).toBe(120000);
  });

  // Also killed `max`: an over-settlement and an unsettled advance on one card. `max` absorbed
  // the overspend into the outstanding advance and reported 200000.
  it('adds an over-settlement to an advance that is still outstanding', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 200000,
        settlementAmount: 120000,
        settledAdvanceAmount: 100000,
      }),
    ).toBe(220000);
  });

  it('handles a settlement with no advance behind it', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 0,
        settlementAmount: 100000,
        settledAdvanceAmount: 0,
      }),
    ).toBe(100000);
  });

  it('never lets a recorded settled advance exceeding the advance reduce the total', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 100000,
        settlementAmount: 100000,
        settledAdvanceAmount: 500000,
      }),
    ).toBe(100000);
  });

  // FALLBACK path: settlement rows predating `advance_amount` cannot say what they discharged.
  // Assuming they discharged everything is the old behaviour and cannot double-count.
  it('treats a settlement with no recorded advance as discharging the advances', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: 100000,
        settlementAmount: 100000,
        settledAdvanceAmount: 0,
      }),
    ).toBe(100000);
  });

  it('treats missing and non-numeric amounts as zero', () => {
    expect(resolveAdvanceUsageAmount()).toBe(0);
    expect(resolveAdvanceUsageAmount({ advanceAmount: null, settlementAmount: undefined })).toBe(0);
    expect(resolveAdvanceUsageAmount({ advanceAmount: 'abc', settlementAmount: 0 })).toBe(0);
  });

  it('reads string amounts as the driver returns them', () => {
    expect(
      resolveAdvanceUsageAmount({
        advanceAmount: '200000.00',
        settlementAmount: '120000.00',
        settledAdvanceAmount: '100000.00',
      }),
    ).toBe(220000);
  });

  it('rounds to paise rather than carrying float error', () => {
    expect(resolveAdvanceUsageAmount({ advanceAmount: 0.1 + 0.2, settlementAmount: 0 })).toBe(0.3);
  });
});

describe('buildSettledAdvanceExpr', () => {
  it('sums the advance recorded on the settlement rows for one request', () => {
    const sql = buildSettledAdvanceExpr('er').replace(/\s+/g, ' ');

    expect(sql).toContain('SUM(settled_sr.advance_amount)');
    expect(sql).toContain('FROM expenditure_settlement_rows settled_sr');
    expect(sql).toContain('WHERE settled_sr.expenditure_id = er.id');
  });

  it('honours the caller alias so it can be embedded in any request query', () => {
    expect(buildSettledAdvanceExpr('ex_req')).toContain('settled_sr.expenditure_id = ex_req.id');
  });
});
