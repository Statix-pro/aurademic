/**
 * Event Approval Workflow Engine
 * Sequence: DRAFT -> HOD_PENDING -> IQAC_PENDING -> PRINCIPAL_PENDING -> APPROVED / PUBLISHED
 * Rejection: Current Step -> DRAFT (Needs Correction)
 */

export const WORKFLOW_STAGES = {
  DRAFT: 'draft',
  HOD_PENDING: 'hod_pending',
  IQAC_PENDING: 'iqac_pending',
  PRINCIPAL_PENDING: 'principal_pending',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  RETURN: 'return',
};

export const APPROVER_ROLES = {
  HOD: 'HOD',
  IQAC: 'IQAC',
  PRINCIPAL: 'Principal',
  ADMIN: 'Admin',
};

const STAGE_APPROVER_ROLES = {
  [WORKFLOW_STAGES.HOD_PENDING]: ['hod', 'HOD', 'head_of_department', 'admin', 'super_admin'],
  [WORKFLOW_STAGES.IQAC_PENDING]: ['iqac', 'IQAC', 'admin', 'super_admin'],
  [WORKFLOW_STAGES.PRINCIPAL_PENDING]: ['principal', 'Principal', 'admin', 'super_admin'],
};

export const STAGE_DISPLAY_LABELS = {
  [WORKFLOW_STAGES.DRAFT]: 'Draft',
  [WORKFLOW_STAGES.HOD_PENDING]: 'Pending HOD Approval',
  [WORKFLOW_STAGES.IQAC_PENDING]: 'Pending IQAC Approval',
  [WORKFLOW_STAGES.PRINCIPAL_PENDING]: 'Pending Principal Approval',
  [WORKFLOW_STAGES.APPROVED]: 'Approved',
  [WORKFLOW_STAGES.PUBLISHED]: 'Published',
  [WORKFLOW_STAGES.RETURN]: 'Needs Correction',
};

export const getNextStage = (currentStage) => {
  switch (currentStage) {
    case WORKFLOW_STAGES.DRAFT:
    case WORKFLOW_STAGES.RETURN:
      return WORKFLOW_STAGES.HOD_PENDING;
    case WORKFLOW_STAGES.HOD_PENDING:
      return WORKFLOW_STAGES.IQAC_PENDING;
    case WORKFLOW_STAGES.IQAC_PENDING:
      return WORKFLOW_STAGES.PRINCIPAL_PENDING;
    case WORKFLOW_STAGES.PRINCIPAL_PENDING:
      return WORKFLOW_STAGES.APPROVED;
    default:
      return currentStage;
  }
};

export const getRequiredApproverRole = (stage) => {
  switch (stage) {
    case WORKFLOW_STAGES.HOD_PENDING:
      return 'HOD';
    case WORKFLOW_STAGES.IQAC_PENDING:
      return 'IQAC';
    case WORKFLOW_STAGES.PRINCIPAL_PENDING:
      return 'Principal';
    case WORKFLOW_STAGES.APPROVED:
    case WORKFLOW_STAGES.PUBLISHED:
      return 'None';
    default:
      return 'Creator';
  }
};

export const canUserApproveStage = (user, currentStage) => {
  if (!user) return false;
  if (user.isAdmin || user.isSuperAdmin || user.is_admin || user.is_super_admin) {
    return true;
  }

  const allowedRoles = STAGE_APPROVER_ROLES[currentStage];
  if (!allowedRoles || allowedRoles.length === 0) {
    return false;
  }

  const rawUserRoles = [];
  if (user.role) rawUserRoles.push(user.role);
  if (Array.isArray(user.roles)) rawUserRoles.push(...user.roles);
  if (Array.isArray(user.user_roles)) rawUserRoles.push(...user.user_roles);
  if (Array.isArray(user.user_entity_roles)) rawUserRoles.push(...user.user_entity_roles);
  if (Array.isArray(user.permissions)) rawUserRoles.push(...user.permissions);

  const normalizedUserRoles = rawUserRoles.map((r) =>
    String(typeof r === 'object' ? r.role_code || r.code || r.name || r.role || r : r || '')
      .trim()
      .toLowerCase(),
  );

  const designation = String(user.designation || user.designation_name || '').toLowerCase();
  const title = String(user.title || user.job_title || '').toLowerCase();

  const isHod =
    Boolean(user.is_hod) ||
    Boolean(user.isHod) ||
    Number(user.is_hod) === 1 ||
    normalizedUserRoles.some(
      (r) => r === 'hod' || r === 'head_of_department' || r.includes('hod') || r.includes('head'),
    ) ||
    designation.includes('hod') ||
    designation.includes('head') ||
    title.includes('hod') ||
    title.includes('head');

  if (isHod) {
    normalizedUserRoles.push('hod', 'head_of_department', 'head');
  }

  const isIqac =
    Boolean(user.is_iqac) ||
    Boolean(user.isIqac) ||
    normalizedUserRoles.some((r) => r.includes('iqac')) ||
    designation.includes('iqac') ||
    title.includes('iqac');

  if (isIqac) {
    normalizedUserRoles.push('iqac');
  }

  const isPrincipal =
    Boolean(user.is_principal) ||
    Boolean(user.isPrincipal) ||
    normalizedUserRoles.some((r) => r.includes('principal')) ||
    designation.includes('principal') ||
    title.includes('principal');

  if (isPrincipal) {
    normalizedUserRoles.push('principal');
  }

  return allowedRoles.some((allowed) =>
    normalizedUserRoles.some((uRole) => uRole.includes(allowed.toLowerCase())),
  );
};

export const parseWorkflowState = (rawState) => {
  if (!rawState) {
    return {
      status: WORKFLOW_STAGES.DRAFT,
      currentStage: WORKFLOW_STAGES.DRAFT,
      currentApproverRole: 'Creator',
    };
  }

  try {
    const parsed = typeof rawState === 'string' ? JSON.parse(rawState) : rawState;
    const status = parsed.status || parsed.currentStage || WORKFLOW_STAGES.DRAFT;
    return {
      status,
      currentStage: status,
      currentApproverRole: getRequiredApproverRole(status),
      submittedAt: parsed.submittedAt || null,
      approvedAt: parsed.approvedAt || null,
      returnedFrom: parsed.returnedFrom || null,
    };
  } catch (_) {
    return {
      status: WORKFLOW_STAGES.DRAFT,
      currentStage: WORKFLOW_STAGES.DRAFT,
      currentApproverRole: 'Creator',
    };
  }
};
