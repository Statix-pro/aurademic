import db from '../../../config/connection.js';

const normalizeText = (value) => String(value || '').trim();

const ENTITY_BENEFICIARY_TYPES = Object.freeze(['Centre', 'Cell', 'Club', 'Professional Body']);

/**
 * Shared budget approval engine.
 *
 * Both BudgetModel and AdminBudgetModel delegate to this single function
 * so approval-flow logic lives in one place.
 *
 * @param {object}  conn                  - DB connection (from withTransaction)
 * @param {object}  proposal              - Full proposal row (must include approval_flow, current_stage, beneficiary_type)
 * @param {object}  opts
 * @param {string}  opts.role             - Stage being processed (e.g. 'level1', 'ithead', 'dof')
 * @param {string}  opts.decision         - 'approved' | 'rejected' | 'returned'
 * @param {string}  [opts.feedback]       - Comment (required for reject/return)
 * @param {number}  opts.approverUserId
 * @param {string}  opts.approverEmail
 */
export async function executeApprovalDecision(conn, proposal, { role, decision, feedback, approverUserId, approverEmail }) {
    const normalizedDecision = normalizeText(decision).toLowerCase();
    const proposalId = proposal.id;

    // --- Dynamic stage validation ---
    const flowStages = normalizeText(proposal.approval_flow).split('_').filter(Boolean);
    if (!flowStages.includes(role)) {
        throw new Error(`Invalid role '${role}' for approval flow '${proposal.approval_flow}'`);
    }

    if (proposal.current_stage !== role) {
        throw new Error(`Stage mismatch: expected ${role}, got ${proposal.current_stage}`);
    }

    // --- Dynamic next-stage computation ---
    let newStatus = decision;
    let nextStage = role;

    const currentIndex = flowStages.indexOf(role);
    const isLastStage = currentIndex >= flowStages.length - 1;
    const dynamicNextStage = isLastStage ? 'completed' : flowStages[currentIndex + 1];
    const requiresPrincipalStage = flowStages.includes('principal');

    if (normalizedDecision === 'approved') {
        newStatus = `${role}_approved`;
        nextStage = dynamicNextStage;

        // AUTO-APPROVAL: When DoF approves, auto-approve principal and finish.
        if (role === 'dof') {
            newStatus = 'completed';
            nextStage = 'completed';
        } else if (isLastStage) {
            newStatus = 'completed';
            nextStage = 'completed';
        }
    } else if (normalizedDecision === 'rejected') {
        newStatus = `${role}_rejected`;
    } else {
        // returned
        newStatus = `${role}_returned`;
        nextStage = role; // Stay on current stage
    }

    // Descriptive role for audit log
    const isEntityBeneficiary = ENTITY_BENEFICIARY_TYPES
        .map((t) => t.toLowerCase())
        .includes(normalizeText(proposal.beneficiary_type).toLowerCase());

    const displayRole = (role === 'level1')
        ? (isEntityBeneficiary ? 'coordinator' : 'hod')
        : role;

    // --- Database writes ---
    await conn.execute(
        `UPDATE budget_proposals
     SET status = ?, current_stage = ?, updated_at = NOW()
     WHERE id = ?`,
        [newStatus, nextStage, proposalId]
    );

    if (normalizedDecision !== 'approved' && !normalizeText(feedback)) {
        throw new Error('Feedback required for reject/return');
    }

    // 1. Actual approval record
    await conn.execute(
        `INSERT INTO budget_proposal_approvals(
      budget_proposal_id, role, approver_user_id, approver_email,
      decision, feedback, allows_edit
    ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [
            proposalId,
            displayRole,
            approverUserId,
            approverEmail || '',
            normalizedDecision,
            feedback || '',
            normalizedDecision === 'returned' ? 1 : 0,
        ]
    );

    // 2. Auto-approve Principal when DoF approves (if Principal is in the flow)
    if (role === 'dof' && normalizedDecision === 'approved' && requiresPrincipalStage) {
        await conn.execute(
            `INSERT INTO budget_proposal_approvals(
        budget_proposal_id, role, approver_user_id, approver_email,
        decision, feedback, allows_edit, decided_at
      ) VALUES(?, 'principal', ?, ?, 'approved', 'Auto-approved after DoF clearance', 0, NOW())`,
            [proposalId, approverUserId, 'system-auto@ksrct.ac.in']
        );
    }

    return { newStatus, nextStage, displayRole };
}

/**
 * Handle "archived" decision separately (same for both modules).
 */
export async function executeArchiveDecision(conn, proposalId, { role, approverUserId, approverEmail, feedback }) {
    const logRole = normalizeText(role).toLowerCase() || 'admin';

    await conn.execute(
        `UPDATE budget_proposals
     SET status = 'archived', current_stage = 'archived', updated_at = NOW()
     WHERE id = ?`,
        [proposalId]
    );

    await conn.execute(
        `INSERT INTO budget_proposal_approvals(
      budget_proposal_id, role, approver_user_id, approver_email,
      decision, feedback, allows_edit
    ) VALUES(?, ?, ?, ?, 'archived', ?, 0)`,
        [
            proposalId,
            logRole,
            approverUserId,
            approverEmail || '',
            feedback || '',
        ]
    );
}
