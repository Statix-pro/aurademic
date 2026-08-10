/**
 * expenditureReportController.js
 *
 * Request handlers for the Expenditure Report. Each one resolves the caller's reporting
 * scope from req.user, hands the query params to the model and returns the standard
 * { success, data } envelope.
 */

import * as ExpenditureReportModel from './expenditureReportModel.js';

const normalizeText = (value) => String(value || '').trim();

/**
 * Scope is derived from the authenticated user only — never from a query param. The budget
 * report accepts a `scope` override because its controller re-authorizes it; here there is
 * no such check, so accepting one would let any caller ask for institution-wide figures.
 */
const resolveScope = (req) =>
  ExpenditureReportModel.resolveReportScope({
    userId: req.user?.id,
    roles: Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role].filter(Boolean),
    permissions: Array.isArray(req.user?.permissions) ? req.user.permissions : [],
    isSuperAdmin: Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin),
  });

const readFilters = (req, scope) => ({
  fiscalYear: req.query.fiscalYear,
  dateFrom: req.query.dateFrom,
  dateTo: req.query.dateTo,
  beneficiaryType: normalizeText(req.query.beneficiaryType),
  beneficiaryValue: normalizeText(req.query.beneficiaryValue),
  q: normalizeText(req.query.q),
  scope,
});

const handleError = (res, error, message) => {
  console.error(`${message}:`, error);
  return res.status(500).json({ success: false, message, error: message });
};

export async function getConsolidation(req, res) {
  try {
    const scope = await resolveScope(req);
    const data = await ExpenditureReportModel.getExpenditureConsolidation(readFilters(req, scope));

    // scopeType sits beside `data`, not inside it, on all three endpoints — it describes the
    // request, not the rows, and the client reads it from one place.
    return res.json({ success: true, data, scopeType: scope.scopeType });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch expenditure consolidation');
  }
}

export async function getBeneficiarySummary(req, res) {
  try {
    const scope = await resolveScope(req);
    const rows = await ExpenditureReportModel.getExpenditureBeneficiarySummary(
      readFilters(req, scope),
    );

    return res.json({
      success: true,
      data: rows,
      count: rows.length,
      scopeType: scope.scopeType,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch expenditure beneficiary summary');
  }
}

export async function getMonthlyBreakdown(req, res) {
  try {
    const scope = await resolveScope(req);
    const data = await ExpenditureReportModel.getExpenditureMonthlyBreakdown(
      readFilters(req, scope),
    );

    return res.json({ success: true, data, scopeType: scope.scopeType });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch expenditure monthly breakdown');
  }
}
