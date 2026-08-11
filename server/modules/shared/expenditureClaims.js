/**
 * Shared money rules for expenditure claims raised against a finance card.
 *
 * Kept out of expenditureModel.js so the finance module can use them without importing that
 * model — the model is mocked wholesale in the test suite.
 */

const toMoney = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

/**
 * The advance a settlement request discharges, as a scalar SQL expression.
 *
 * `expenditure_settlement_rows` records both sides on one row: `advance_amount` is the advance
 * being settled and `settlement_amount` is what was actually spent. Summing the former is what
 * lets `resolveAdvanceUsageAmount` tell a settled advance from one still outstanding.
 *
 * A scalar subquery rather than a join, so it can be summed per request without the settlement
 * rows multiplying the request rows around it.
 *
 * Lives beside the JS rule that consumes it: the two encode one definition and have to change
 * together.
 *
 * @param {string} alias - table alias for expenditure_requests.
 */
export function buildSettledAdvanceExpr(alias = 'er') {
  return `(
    SELECT COALESCE(SUM(settled_sr.advance_amount), 0)
      FROM expenditure_settlement_rows settled_sr
     WHERE settled_sr.expenditure_id = ${alias}.id
  )`;
}

/**
 * How much of a card's advance/settlement flow counts as claimed.
 *
 * A settlement discharges the advance it settles, so the two must not simply be added. Two
 * scalar rules were tried and both are provably wrong, because a card can hold several advances
 * in different states at once:
 *
 *   `settlement > 0 ? settlement : advance` assumed one settlement accounted for EVERY advance.
 *     Two ₹1,00,000 advances with only the first settled reported ₹1,00,000, losing the advance
 *     still outstanding.
 *
 *   `max(advance, settlement)` fixed that but broke settling for less than was advanced: an
 *     advance of ₹1,00,000 settled at ₹80,000 (₹20,000 handed back) reported ₹1,00,000. It also
 *     still failed when an over-settlement and an unsettled advance coexisted — two ₹1,00,000
 *     advances where the first settles at ₹1,20,000 gave ₹2,00,000, not ₹2,20,000.
 *
 * Neither can work: (advance, settlement) alone cannot say WHICH advances were settled. So the
 * caller also passes `settledAdvanceAmount`, the advance recorded on the settlement rows
 * themselves (`expenditure_settlement_rows.advance_amount`), which is exactly that missing fact:
 *
 *   claimed = settlement + (advance still unsettled)
 *
 * @param {object} amounts
 * @param {number} amounts.advanceAmount        Sum of advances raised on the card.
 * @param {number} amounts.settlementAmount     Sum of settlements raised on the card.
 * @param {number} [amounts.settledAdvanceAmount] Advance discharged by those settlements.
 * @returns {number}
 */
export function resolveAdvanceUsageAmount({
  advanceAmount,
  settlementAmount,
  settledAdvanceAmount,
} = {}) {
  const advance = toMoney(advanceAmount);
  const settlement = toMoney(settlementAmount);
  const recordedSettledAdvance = toMoney(settledAdvanceAmount);

  // Clamped to the advance actually raised, so a data anomaly cannot push the outstanding
  // amount negative and quietly reduce what the card reports as claimed.
  const settledAdvance =
    recordedSettledAdvance > 0
      ? Math.min(recordedSettledAdvance, advance)
      : // FALLBACK: settlement rows created before `advance_amount` was populated do not say
        // which advance they discharged. Treating the settlement as discharging every advance
        // is the pre-existing behaviour and, crucially, cannot double-count; assuming none was
        // discharged would add the advance and its own settlement together.
        // Remove once every settlement row records the advance it settles:
        //   SELECT COUNT(*) FROM expenditure_settlement_rows WHERE advance_amount IS NULL;
        settlement > 0
        ? advance
        : 0;

  const outstandingAdvance = Math.max(toMoney(advance - settledAdvance), 0);
  return toMoney(settlement + outstandingAdvance);
}
