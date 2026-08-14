/**
 * Who "owns" a finance request, for the purpose of showing it to a user and letting them
 * raise expenditure against it.
 *
 * A request has TWO people on it and they are frequently not the same person:
 *
 *   `created_by`  — the login that submitted the form. Departments routinely submit from a
 *                   shared office/HOD account (hodchemistry@, training@, alumni@, office@ …).
 *   `employee_id` — the applicant the request is FOR, whose linked login is
 *                   `master_employees.user_id`.
 *
 * The finance list has always accepted either, so an applicant sees a request a shared account
 * submitted in their name. The expenditure module checked `created_by` alone, so that same
 * applicant could see the approved request under Finance and then find nothing under
 * Expenditure — and any attempt to claim against it was refused as "Access denied". At the time
 * this was written 61 approved production requests were in exactly that state.
 *
 * Both sides now build the rule from here so the two pages cannot drift apart again.
 */

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * SQL predicate matching rows a user owns, as creator OR as the applicant.
 *
 * Takes TWO placeholders — bind with `buildFinanceOwnerParams`, and keep the pair in the
 * same position in the params array that the condition occupies in the statement.
 *
 * Works for any table carrying both `created_by` and `employee_id`, which covers
 * `finance_requests` and `expenditure_requests`. The inner alias is derived from the outer
 * one so the predicate can appear twice in a single statement without colliding.
 *
 * @param {string} alias - table alias, e.g. 'fr', 'fr_req', 'er'.
 */
export function buildFinanceOwnerCondition(alias = 'fr') {
  const ownerAlias = `me_owner_${alias}`;
  return `(
    ${alias}.created_by = ?
    OR EXISTS (
      SELECT 1
        FROM master_employees ${ownerAlias}
       WHERE ${ownerAlias}.id = ${alias}.employee_id
         AND ${ownerAlias}.user_id = ?
    )
  )`;
}

/**
 * The two bind values `buildFinanceOwnerCondition` expects, in order.
 *
 * @param {number|string} userId
 * @returns {number[]}
 */
export function buildFinanceOwnerParams(userId) {
  const uid = toPositiveInt(userId);
  return [uid, uid];
}

/**
 * In-JS counterpart of the predicate, for the permission checks that already hold the row.
 *
 * `applicant_user_id` is `master_employees.user_id` for the row's `employee_id`; it is null
 * when the applicant has never logged in, in which case only the creator owns the request.
 *
 * @param {{created_by?: number, applicant_user_id?: number|null}} row
 * @param {number|string} userId
 * @returns {boolean}
 */
export function isFinanceRequestOwner(row, userId) {
  const uid = toPositiveInt(userId);
  if (!uid || !row) return false;

  return uid === toPositiveInt(row.created_by) || uid === toPositiveInt(row.applicant_user_id);
}
