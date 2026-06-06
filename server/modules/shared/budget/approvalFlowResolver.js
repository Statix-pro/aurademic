/**
 * Shared Approval Flow Resolver
 *
 * Logic to resolve the required approval stages for a budget proposal
 * based on beneficiary type, entity type, and tags (e.g., IT Head stage).
 */

import { normalizeBeneficiaryType, normalizeText, isEntityBeneficiaryType } from './budgetUtils.js';
import db from '../../../config/connection.js';

const parseJsonFlow = (rawFlow) => {
  if (!rawFlow) return [];

  if (Array.isArray(rawFlow)) {
    return rawFlow.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean);
  }

  if (typeof rawFlow === 'string') {
    try {
      const parsed = JSON.parse(rawFlow);
      if (Array.isArray(parsed)) {
        return parsed.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
};

/**
 * Resolves the configuration for the approval flow.
 *
 * @param {string} beneficiaryType - Typo of beneficiary (Faculty, Department, Centre, etc.)
 * @param {string|null} entityTypeCode - Code for entity type if applicable
 * @param {object} conn - Database connection
 * @param {object} options - Additional options including budgetTag
 * @returns {Promise<object>} Resolved flow configuration
 */
export async function resolveApprovalFlow(
  beneficiaryType,
  entityTypeCode = null,
  conn = db,
  { budgetTag = '' } = {},
) {
  const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);

  if (!normalizedBeneficiaryType) {
    return { requiresLevel1: 0, requiresIthead: 0, requiresDof: 1, requiresPrincipal: 1 };
  }

  const normalizedEntityTypeCode = normalizeText(entityTypeCode).toUpperCase() || null;

  const [rows] = await conn.execute(
    `SELECT flow
         FROM approval_flow_config
         WHERE is_active = 1
           AND LOWER(TRIM(module_key)) IN ('budget', '*')
           AND LOWER(TRIM(beneficiary_type)) IN (LOWER(TRIM(?)), '*')
           AND (
             (? IS NULL AND entity_type_code IS NULL)
             OR (? IS NOT NULL AND (
               UPPER(TRIM(entity_type_code)) = ?
               OR entity_type_code IS NULL
             ))
           )
         ORDER BY
           CASE WHEN LOWER(TRIM(beneficiary_type)) = LOWER(TRIM(?)) THEN 0 ELSE 1 END,
           CASE
             WHEN ? IS NOT NULL AND UPPER(TRIM(entity_type_code)) = ? THEN 0
             WHEN entity_type_code IS NULL THEN 1
             ELSE 2
           END
         LIMIT 1`,
    [
      normalizedBeneficiaryType,
      normalizedEntityTypeCode,
      normalizedEntityTypeCode,
      normalizedEntityTypeCode,
      normalizedBeneficiaryType,
      normalizedEntityTypeCode,
      normalizedEntityTypeCode,
    ],
  );

  const resolvedStages = rows.length > 0 ? parseJsonFlow(rows[0].flow) : [];

  const resolvedFlow =
    resolvedStages.length > 0
      ? {
          requiresLevel1: resolvedStages.includes('level1') ? 1 : 0,
          requiresIthead: resolvedStages.includes('ithead') ? 1 : 0,
          requiresDof: resolvedStages.includes('dof') ? 1 : 0,
          requiresPrincipal: resolvedStages.includes('principal') ? 1 : 0,
        }
      : ['Faculty', 'Staff', 'Department'].includes(normalizedBeneficiaryType)
        ? { requiresLevel1: 1, requiresIthead: 0, requiresDof: 1, requiresPrincipal: 1 }
        : { requiresLevel1: 0, requiresIthead: 0, requiresDof: 1, requiresPrincipal: 1 };

  // Entity beneficiaries must always pass through Level 1 before DoF/Principal.
  if (isEntityBeneficiaryType(normalizedBeneficiaryType)) {
    resolvedFlow.requiresLevel1 = 1;
  }

  // Tag-based IT Head stage injection
  const normalizedTag = normalizeText(budgetTag).toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalizedTag === 'it infrastructure') {
    resolvedFlow.requiresIthead = 1;
  }

  return resolvedFlow;
}
