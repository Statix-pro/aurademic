/**
 * Shared Approval Flow Resolver
 *
 * Logic to resolve the required approval stages for a budget proposal
 * based on beneficiary type, entity type, and tags (e.g., IT Head stage).
 */

import db from '../../../config/connection.js';
import { normalizeBeneficiaryType, normalizeText, isEntityBeneficiaryType } from './budgetUtils.js';

/**
 * Resolves the configuration for the approval flow.
 *
 * @param {string} beneficiaryType - Typo of beneficiary (Faculty, Department, Centre, etc.)
 * @param {string|null} entityTypeCode - Code for entity type if applicable
 * @param {object} conn - Database connection
 * @param {object} options - Additional options including budgetTag
 * @returns {Promise<object>} Resolved flow configuration
 */
export async function resolveApprovalFlow(beneficiaryType, entityTypeCode = null, conn = db, { budgetTag = '' } = {}) {
    const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);

    if (!normalizedBeneficiaryType) {
        return { requiresLevel1: 0, requiresIthead: 0, requiresDof: 1, requiresPrincipal: 1 };
    }

    const [rows] = entityTypeCode
        ? await conn.execute(
            `SELECT requires_level1, requires_dof, requires_principal
         FROM approval_flow_config
         WHERE beneficiary_type = ?
      AND entity_type_code = ?
        AND module IN ('BUDGET', 'BOTH')
           AND is_active = 1
         LIMIT 1`,
            [normalizedBeneficiaryType, entityTypeCode]
        )
        : await conn.execute(
            `SELECT requires_level1, requires_dof, requires_principal
         FROM approval_flow_config
         WHERE beneficiary_type = ?
      AND entity_type_code IS NULL
           AND module IN ('BUDGET', 'BOTH')
           AND is_active = 1
         LIMIT 1`,
            [normalizedBeneficiaryType]
        );

    const resolvedFlow = rows.length > 0
        ? {
            requiresLevel1: Number(rows[0].requires_level1) ? 1 : 0,
            requiresIthead: 0,
            requiresDof: Number(rows[0].requires_dof) ? 1 : 0,
            requiresPrincipal: Number(rows[0].requires_principal) ? 1 : 0,
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
