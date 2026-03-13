/**
 * Budget Shared Utilities & Constants
 *
 * Single source of truth for all budget-related constants, normalizers,
 * and pure helper functions shared between budget/ and adminbudget/ modules.
 */

// =====================================================
// CONSTANTS
// =====================================================

export const VALID_MONTHS = Object.freeze([
    'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar',
]);

export const APPROVAL_FLOW = Object.freeze({
    level1: { approve: 'level1_approved', reject: 'level1_rejected', returned: 'level1_returned', next: 'dof' },
    ithead: { approve: 'ithead_approved', reject: 'ithead_rejected', returned: 'ithead_returned', next: 'dof' },
    dof: { approve: 'dof_approved', reject: 'dof_rejected', returned: 'dof_returned', next: 'principal' },
    principal: { approve: 'principal_approved', reject: 'principal_rejected', next: 'completed' },
});

export const EDITABLE_STATES = Object.freeze([
    'draft', 'submitted', 're_submitted',
    'level1_returned', 'ithead_returned', 'dof_returned', 'principal_returned',
]);

export const ENTITY_TYPE_BY_BENEFICIARY = Object.freeze({
    Centre: 'CENTRE',
    Cell: 'CELL',
    Club: 'CLUB',
    'Professional Body': 'PROFESSIONAL_BODY',
    ProfessionalBodies: 'PROFESSIONAL_BODY',
    'Professional Bodies': 'PROFESSIONAL_BODY',
});

export const ENTITY_BENEFICIARY_TYPES = Object.freeze([
    'Centre', 'Cell', 'Club', 'Professional Body',
]);

export const LEVEL1_ROUTE_TYPE = Object.freeze({
    departmentHod: 'department_hod',
    entityContact: 'entity_contact',
});

export const LEVEL1_ASSIGNMENT_STATUS = Object.freeze({
    assigned: 'assigned',
    unassigned: 'unassigned',
});

export const WORKFLOW_STAGES = Object.freeze(['level1', 'ithead', 'dof', 'principal']);

export const VALID_BENEFICIARY_TYPES = Object.freeze([
    'Faculty', 'Staff', 'Department',
    'Centre', 'Cell', 'Club',
    'Institution', 'Professional Body', 'Professional Bodies', 'ProfessionalBodies',
]);

export const MUTABLE_ENTITY_TYPES = Object.freeze(new Set(['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY']));

// =====================================================
// NORMALIZERS
// =====================================================

export const normalizeText = (value) => String(value || '').trim();

export const normalizeBeneficiaryType = (beneficiaryType) => {
    const normalized = normalizeText(beneficiaryType);

    if (normalized === 'Professional Bodies' || normalized === 'ProfessionalBodies') {
        return 'Professional Body';
    }

    return normalized;
};

export const normalizeEntityTypeCode = (value) => {
    const raw = normalizeText(value)
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z_]/g, '');

    if (!raw) {
        return '';
    }

    if (raw === 'PROF_BODY' || raw === 'PROFESSIONALBODIES' || raw === 'PROFESSIONAL_BODYS') {
        return 'PROFESSIONAL_BODY';
    }

    return raw;
};

export const normalizeBudgetRole = (value) => {
    const role = normalizeText(value).toLowerCase();

    if (role === 'faculty' || role === '') {
        return 'user';
    }

    return role;
};

// =====================================================
// HELPERS
// =====================================================

export const isEntityBeneficiaryType = (beneficiaryType) => {
    return ENTITY_BENEFICIARY_TYPES.includes(normalizeBeneficiaryType(beneficiaryType));
};

export const beneficiaryTypeToEntityTypeCode = (beneficiaryType) => {
    return ENTITY_TYPE_BY_BENEFICIARY[normalizeBeneficiaryType(beneficiaryType)] || null;
};

export const formatApprovalFlowString = ({ requiresLevel1, requiresIthead, requiresDof, requiresPrincipal }) => {
    const stages = [];

    if (requiresLevel1) stages.push('level1');
    if (requiresIthead) stages.push('ithead');
    if (requiresDof) stages.push('dof');
    if (requiresPrincipal) stages.push('principal');

    return stages.length > 0 ? stages.join('_') : 'dof_principal';
};

export const getCurrentFinancialYear = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

export const getDefaultFreezeCutoffDate = (fiscalYear) => {
    const fy = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
    return `${fy}-02-01`;
};

export const groupAllocationsByLine = (allocations) => {
    const grouped = {};

    for (const allocation of allocations) {
        if (!grouped[allocation.line_id]) {
            grouped[allocation.line_id] = {};
        }

        grouped[allocation.line_id][allocation.month] = Number(allocation.amount);
    }

    return grouped;
};

export const resolveLevel1AssignmentStatus = ({ routeType, assigneeEmail } = {}) => {
    if (routeType === LEVEL1_ROUTE_TYPE.entityContact && !normalizeText(assigneeEmail)) {
        return LEVEL1_ASSIGNMENT_STATUS.unassigned;
    }

    return LEVEL1_ASSIGNMENT_STATUS.assigned;
};

export const resolveLevel1Route = (proposalOrPayload = {}) => {
    const beneficiaryType = normalizeBeneficiaryType(proposalOrPayload?.beneficiary_type);
    const parsedDepartmentId = Number(proposalOrPayload?.department_id);
    const parsedEntityId = Number(proposalOrPayload?.beneficiary_entity_id);
    const departmentId =
        Number.isInteger(parsedDepartmentId) && parsedDepartmentId > 0 ? parsedDepartmentId : null;
    const entityId = Number.isInteger(parsedEntityId) && parsedEntityId > 0 ? parsedEntityId : null;

    if (isEntityBeneficiaryType(beneficiaryType)) {
        return {
            routeType: LEVEL1_ROUTE_TYPE.entityContact,
            departmentId: null,
            entityId,
        };
    }

    if (['Faculty', 'Staff', 'Department'].includes(beneficiaryType)) {
        return {
            routeType: LEVEL1_ROUTE_TYPE.departmentHod,
            departmentId,
            entityId: null,
        };
    }

    return {
        routeType: null,
        departmentId,
        entityId,
    };
};

export const resolveStageLabel = (stageKey, proposal = {}) => {
    const key = normalizeText(stageKey).toLowerCase();
    const beneficiaryType = normalizeText(proposal?.beneficiary_type);

    if (key === 'level1') {
        if (['Faculty', 'Staff', 'Department'].includes(beneficiaryType)) {
            return 'HOD';
        }
        if (isEntityBeneficiaryType(beneficiaryType)) {
            return 'Coordinator';
        }
        return 'Level-1';
    }

    if (key === 'ithead') return 'IT Head';
    if (key === 'dof') return 'Finance';
    if (key === 'principal') return 'Principal';
    if (key === 'completed') return 'Completed';

    return stageKey;
};
