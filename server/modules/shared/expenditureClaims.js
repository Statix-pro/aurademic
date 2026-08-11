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
 * How much of the advance flow counts as used, given a settlement supersedes the advance it
 * settles.
 *
 * Both inputs are AGGREGATES over a card's requests, which is why this is a max and not a
 * choice between the two. The rule used to be `settlement > 0 ? settlement : advance`, which
 * assumed any settlement accounted for every advance on the card. With two ₹1,00,000 advances
 * where only one has been settled, that returned ₹1,00,000 and the still-outstanding advance
 * vanished from the total — understating what had been claimed and leaving a fully claimed card
 * looking active.
 *
 * A max keeps every case right:
 *   nothing settled     (200000, 0)      -> 200000  both advances outstanding
 *   fully settled       (100000, 100000) -> 100000  counted once, not twice
 *   partly settled      (200000, 100000) -> 200000  100000 settled + 100000 outstanding
 *   over-settled        (100000, 120000) -> 120000  more was spent than advanced
 *   settled, no advance (0, 100000)      -> 100000
 *
 * @param {number} advanceAmount     Sum of advance amounts on the card.
 * @param {number} settlementAmount  Sum of settlement amounts on the card.
 * @returns {number}
 */
export function resolveAdvanceUsageAmount(advanceAmount, settlementAmount) {
  return toMoney(Math.max(toMoney(advanceAmount), toMoney(settlementAmount)));
}
