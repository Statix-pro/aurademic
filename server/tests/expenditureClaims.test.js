import { describe, expect, it } from 'vitest';

import { resolveAdvanceUsageAmount } from '../modules/shared/expenditureClaims.js';

/**
 * Both inputs are aggregates over a card's requests. The old rule was
 * `settlement > 0 ? settlement : advance`, which assumed any settlement accounted for every
 * advance on the card and so erased advances that were still outstanding.
 */
describe('resolveAdvanceUsageAmount', () => {
  it('counts every advance when nothing has been settled', () => {
    expect(resolveAdvanceUsageAmount(200000, 0)).toBe(200000);
  });

  it('counts a fully settled advance once, not twice', () => {
    expect(resolveAdvanceUsageAmount(100000, 100000)).toBe(100000);
  });

  // The regression: two advances, one settled. The unsettled one must not disappear.
  it('keeps the outstanding advance when only some advances are settled', () => {
    expect(resolveAdvanceUsageAmount(200000, 100000)).toBe(200000);
  });

  it('follows the settlement when more was spent than advanced', () => {
    expect(resolveAdvanceUsageAmount(100000, 120000)).toBe(120000);
  });

  it('handles a settlement with no advance behind it', () => {
    expect(resolveAdvanceUsageAmount(0, 100000)).toBe(100000);
  });

  it('treats missing and non-numeric amounts as zero', () => {
    expect(resolveAdvanceUsageAmount(null, undefined)).toBe(0);
    expect(resolveAdvanceUsageAmount('abc', 0)).toBe(0);
  });

  it('reads string amounts as the driver returns them', () => {
    expect(resolveAdvanceUsageAmount('200000.00', '100000.00')).toBe(200000);
  });

  it('rounds to paise rather than carrying float error', () => {
    expect(resolveAdvanceUsageAmount(0.1 + 0.2, 0)).toBe(0.3);
  });
});
