// modules/budget/budgetModel.js - PRODUCTION v13.0 (Feb 17, 2026 - FINAL UPGRADE)
// FIXED: Department Flow matches Faculty + Principal Auto-Approval Logic

import db from '../../config/connection.js';

const VALID_MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

const APPROVAL_FLOW = {
  hod: { approve: 'hod_approved', reject: 'hod_rejected', returned: 'hod_returned', next: 'dof' },
  dof: { approve: 'dof_approved', reject: 'dof_rejected', returned: 'dof_returned', next: 'principal' },
  principal: { approve: 'principal_approved', reject: 'principal_rejected', next: 'completed' }
};

const EDITABLE_STATES = ['draft', 'hod_returned', 'dof_returned'];

class BudgetModel {
  /* =====================================================
     0. CONSTANTS & HELPERS
  ===================================================== */
  static getCurrentFinancialYear() {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  }

  static groupAllocationsByLine(allocations) {
    const grouped = {};
    for (const alloc of allocations) {
      if (!grouped[alloc.line_id]) grouped[alloc.line_id] = {};
      grouped[alloc.line_id][alloc.month] = Number(alloc.amount);
    }
    return grouped;
  }

  /* =====================================================
     1. UTILITY: Transaction Wrapper
  ===================================================== */
  static async withTransaction(callback) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      console.error('BudgetModel Transaction Error:', error);
      throw new Error(`Transaction failed: ${error.message}`);
    } finally {
      conn.release();
    }
  }

  /* =====================================================
     1.5. DYNAMIC APPROVAL FLOW RESOLVER (FORCE FIXED)
  ===================================================== */
  static async resolveApprovalFlow(beneficiaryType, orgUnitTypeCode = null) {
    // 🛡️ 1. FORCE CHECK: If Faculty OR Department, ALWAYS require HOD
    // Flow: HoD -> DoF -> Principal (Auto)
    if (['Faculty', 'Department'].includes(beneficiaryType)) {
      return { requiresHod: 1, requiresDof: 1, requiresPrincipal: 1 };
    }

    // 2. Default fallback for others (Centre, Cell, Club, etc.)
    // Flow: DoF -> Principal (Auto)
    return { requiresHod: 0, requiresDof: 1, requiresPrincipal: 1 };
  }

  /* =====================================================
     2. CREATE FULL PROPOSAL (FIXED TOTAL & FLOW)
  ===================================================== */
  static async create(payload) {
    return this.withTransaction(async (conn) => {
      // ✅ 1. CALCULATE TOTAL (Fixes 0.00 issue)
      const calculatedTotal = (payload.lines || []).reduce((sum, line) => {
        const amount = Number(line.unit_amount) || 0;
        const qty = Number(line.quantity) || 1;
        return sum + (amount * qty);
      }, 0);

      const fyYear = payload.fiscal_year || this.getCurrentFinancialYear();
      
      await conn.execute(
        'INSERT IGNORE INTO budget_proposal_refs (ref_year, ref_sequence, proposal_id, proposal_ref) VALUES (?, 0, NULL, NULL)',
        [fyYear]
      );

      const [seq] = await conn.execute(
        `SELECT COALESCE(MAX(ref_sequence), 0) + 1 as next_seq 
         FROM budget_proposal_refs WHERE ref_year = ?`,
        [fyYear]
      );
      const sequence = seq[0].next_seq;
      const proposalRef = `#B-${fyYear}-${sequence.toString().padStart(4, '0')}`;

      let orgUnitId = null;
      let orgUnitTypeCode = null;

      if (['Department','Centre','Cell','Club','Professional Body'].includes(payload.beneficiary_type)) {
        const [orgUnit] = await conn.execute(
          `SELECT ou.id, out_type.code as type_code
           FROM org_units ou
           JOIN org_unit_types out_type ON ou.org_unit_type_id = out_type.id
           WHERE ou.name = ? LIMIT 1`,
          [payload.beneficiary_value]
        );
        if (orgUnit[0]) {
          orgUnitId = orgUnit[0].id;
          orgUnitTypeCode = orgUnit[0].type_code;
        }
      }

      // ✅ 2. Resolve Flow
      const flow = await this.resolveApprovalFlow(payload.beneficiary_type, orgUnitTypeCode);
      
      // ✅ 3. Determine Initial Stage based on Flow
      const initialStage = flow.requiresHod ? 'hod' : 'dof';
      const approvalFlowString = flow.requiresHod ? 'hod_dof_principal' : 'dof_principal';

      const [proposalResult] = await conn.execute(
        `INSERT INTO budget_proposals (
          proposal_ref, fiscal_year, employee_id, user_id, user_email,
          request_date, beneficiary_type, beneficiary_value, org_unit_id,
          department, proposal_description, total_amount, approval_flow,
          status, current_stage, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, NOW())`,
        [
          proposalRef, 
          fyYear, 
          payload.employee_id || payload.user_id, 
          payload.user_id, 
          payload.user_email || '',
          payload.request_date, 
          payload.beneficiary_type, 
          payload.beneficiary_value, 
          orgUnitId,
          payload.department || null, 
          payload.proposal_description || null,
          calculatedTotal, 
          approvalFlowString, 
          initialStage
        ]
      );
      const proposalId = proposalResult.insertId;

      await conn.execute(
        `INSERT INTO budget_proposal_refs (proposal_id, ref_year, ref_sequence, proposal_ref) 
         VALUES (?, ?, ?, ?)`,
        [proposalId, fyYear, sequence, proposalRef]
      );

      if (payload.lines && Array.isArray(payload.lines)) {
        for (const line of payload.lines) {
          const lineId = await this.#insertBudgetLine(proposalId, line, conn);
          if (line.month_allocations) {
            for (const [month, amount] of Object.entries(line.month_allocations)) {
              if (VALID_MONTHS.includes(month)) {
                await this.#insertMonthAllocation(lineId, month, amount, conn);
              }
            }
          }
        }
      }

      return { 
        proposalId, 
        proposalRef, 
        fyYear, 
        requiresHod: flow.requiresHod,
        initialStage,
        approvalFlow: approvalFlowString 
      };
    });
  }

  /* =====================================================
     3. GET FULL PROPOSAL
  ===================================================== */
  static async getFull(proposalId) {
    const master = await this.getBudgetById(proposalId);
    if (!master) return null;

    const [lines] = await db.execute(
      `SELECT * FROM budget_proposal_lines WHERE budget_proposal_id = ? ORDER BY id`,
      [proposalId]
    );

    const [allocations] = await db.execute(
      `SELECT 
        l.id as line_id, m.month, m.amount, l.budget_head, l.sub_head
       FROM budget_proposal_lines l
       JOIN budget_line_month_allocations m ON l.id = m.budget_line_id
       WHERE l.budget_proposal_id = ?
       ORDER BY l.id, FIELD(m.month, ${VALID_MONTHS.map(m => `'${m}'`).join(',')})`,
      [proposalId]
    );

    const [approvals] = await db.execute(
      `SELECT *, DATE_FORMAT(decided_at, '%Y-%m-%d %H:%i') as decided_at_formatted
       FROM budget_proposal_approvals WHERE budget_proposal_id = ? ORDER BY decided_at`,
      [proposalId]
    );

    return {
      master,
      lines,
      allocations: this.groupAllocationsByLine(allocations),
      approvals
    };
  }

  /* =====================================================
     4. UPDATE PROPOSAL (Draft/Returned Only)
  ===================================================== */
  static async update(proposalId, payload) {
    const proposal = await this.getBudgetById(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (!EDITABLE_STATES.includes(proposal.status)) {
      throw new Error(`Cannot edit ${proposal.status} proposals`);
    }

    return this.withTransaction(async (conn) => {
      let orgUnitId = null;
      let orgUnitTypeCode = null;

      if (['Department','Centre','Cell','Club','Professional Body'].includes(payload.beneficiary_type)) {
        const [orgUnit] = await conn.execute(
          `SELECT ou.id, out_type.code as type_code
           FROM org_units ou
           JOIN org_unit_types out_type ON ou.org_unit_type_id = out_type.id
           WHERE ou.name = ? LIMIT 1`,
          [payload.beneficiary_value]
        );
        if (orgUnit[0]) {
          orgUnitId = orgUnit[0].id;
          orgUnitTypeCode = orgUnit[0].type_code;
        }
      }

      // Re-calculate Total on Update
      const calculatedTotal = (payload.lines || []).reduce((sum, line) => {
        const amount = Number(line.unit_amount) || 0;
        const qty = Number(line.quantity) || 1;
        return sum + (amount * qty);
      }, 0);

      await conn.execute(
        `UPDATE budget_proposals SET 
          beneficiary_type=?, beneficiary_value=?, org_unit_id=?, department=?,
          proposal_description=?, total_amount=?, updated_at=NOW()
         WHERE id=?`,
        [
          payload.beneficiary_type, 
          payload.beneficiary_value || null, 
          orgUnitId,
          payload.department || null, 
          payload.proposal_description || null,
          calculatedTotal, 
          proposalId
        ]
      );

      await conn.execute(
        `DELETE m FROM budget_line_month_allocations m 
         JOIN budget_proposal_lines l ON m.budget_line_id=l.id 
         WHERE l.budget_proposal_id=?`, 
        [proposalId]
      );
      await conn.execute(
        'DELETE FROM budget_proposal_lines WHERE budget_proposal_id=?', 
        [proposalId]
      );

      if (payload.lines && Array.isArray(payload.lines)) {
        for (const line of payload.lines) {
          const lineId = await this.#insertBudgetLine(proposalId, line, conn);
          if (line.month_allocations) {
            for (const [month, amount] of Object.entries(line.month_allocations)) {
              if (VALID_MONTHS.includes(month)) {
                await this.#insertMonthAllocation(lineId, month, amount, conn);
              }
            }
          }
        }
      }
    });
  }

  /* =====================================================
     4.5. DELETE PROPOSAL (New Feature)
  ===================================================== */
  static async delete(proposalId) {
    return this.withTransaction(async (conn) => {
      await conn.execute(
        `DELETE m FROM budget_line_month_allocations m 
         JOIN budget_proposal_lines l ON m.budget_line_id = l.id 
         WHERE l.budget_proposal_id = ?`,
        [proposalId]
      );

      await conn.execute(
        'DELETE FROM budget_proposal_lines WHERE budget_proposal_id = ?',
        [proposalId]
      );

      await conn.execute(
        'DELETE FROM budget_proposal_approvals WHERE budget_proposal_id = ?',
        [proposalId]
      );

      await conn.execute(
        'DELETE FROM budget_proposal_refs WHERE proposal_id = ?',
        [proposalId]
      );

      const [result] = await conn.execute(
        'DELETE FROM budget_proposals WHERE id = ?',
        [proposalId]
      );

      return result.affectedRows > 0;
    });
  }

  /* =====================================================
     5. APPROVAL PROCESS (UPDATED: Auto-Approve Principal)
  ===================================================== */
  static async processApproval(proposalId, { role, decision, feedback, approverUserId, approverEmail }) {
    if (!['hod', 'dof', 'principal'].includes(role)) {
      throw new Error('Invalid role');
    }
    if (!['approved', 'rejected', 'returned'].includes(decision)) {
      throw new Error('Invalid decision');
    }

    const proposal = await this.getBudgetById(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.current_stage !== role) {
      throw new Error(`Stage mismatch: expected ${role}, got ${proposal.current_stage}`);
    }

    // Determine Status Logic
    let newStatus = decision; 
    let nextStage = role; // Default stay on same role if returned/rejected

    // Calculate Standard Flow first
    const flow = APPROVAL_FLOW[role];
    if (decision === 'approved') {
        newStatus = flow.approve;
        nextStage = flow.next;
    } else if (decision === 'rejected') {
        newStatus = flow.reject;
    } else if (decision === 'returned') {
        newStatus = flow.returned;
        nextStage = role; // Stays at current level usually, or goes back to 'user'
    }

    // 🚀 AUTO-APPROVAL OVERRIDE
    // If DoF approves -> Automatically marks Principal as Approved -> Completed
    if (role === 'dof' && decision === 'approved') {
        newStatus = 'principal_approved'; // Skip 'dof_approved' status, jump to end
        nextStage = 'completed';
    } else if (role === 'principal' && decision === 'approved') {
        // Just in case manual principal approval is still called
        newStatus = 'principal_approved';
        nextStage = 'completed';
    }

    return this.withTransaction(async (conn) => {
      // 1. Update Proposal Status
      await conn.execute(
        `UPDATE budget_proposals SET status=?, current_stage=?, updated_at=NOW() WHERE id=?`,
        [newStatus, nextStage, proposalId]
      );

      if (decision !== 'approved' && !feedback?.trim()) {
        throw new Error('Feedback required for reject/return');
      }

      // 2. Insert Audit Entry for the Current Approver (e.g. DoF)
      await conn.execute(
        `INSERT INTO budget_proposal_approvals (
          budget_proposal_id, role, approver_user_id, approver_email,
          decision, feedback, allows_edit
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          proposalId, role, approverUserId, approverEmail || '',
          decision, feedback || '', decision === 'returned' ? 1 : 0
        ]
      );

      // 🚀 3. INSERT AUTO-APPROVAL ENTRY FOR PRINCIPAL
      // So history shows complete chain
      if (role === 'dof' && decision === 'approved') {
         await conn.execute(
            `INSERT INTO budget_proposal_approvals (
              budget_proposal_id, role, approver_user_id, approver_email,
              decision, feedback, allows_edit, decided_at
            ) VALUES (?, 'principal', ?, ?, 'approved', 'Auto-approved after DoF clearance', 0, NOW())`,
            [
              proposalId, 
              approverUserId, // Attributed to DoF user ID or could be 0/system
              'system-auto@ksrct.ac.in'
            ]
         );
      }
    });
  }

  /* =====================================================
     6. DASHBOARD: User/HOD/DoF/Principal Lists
  ===================================================== */
  static async listBudgets({ userId, userEmail, department, role, page = 1, limit = 10, status, fiscalYear }) {
    const pPage = Number.parseInt(page, 10) || 1;
    const pLimit = Number.parseInt(limit, 10) || 10;
    const pOffset = (pPage - 1) * pLimit;
    const currentFY = Number.parseInt(fiscalYear, 10) || this.getCurrentFinancialYear();

    let sql = `
      SELECT SQL_CALC_FOUND_ROWS
        bp.id, bp.proposal_ref, bp.fiscal_year, bp.employee_id, bp.user_id,
        DATE_FORMAT(bp.request_date, '%Y-%m-%d') as request_date,
        bp.beneficiary_type, bp.beneficiary_value, bp.department,
        bp.proposal_description, bp.total_amount, bp.status,
        bp.current_stage, bp.approval_flow,
        DATE_FORMAT(bp.created_at, '%Y-%m-%d %H:%i') as created_date,
        ou.name as org_unit_name, ou.short_code as org_unit_code,
        out_type.name as org_unit_type, out_type.code as org_unit_type_code,
        COUNT(DISTINCT bpl.id) as line_count,
        COUNT(DISTINCT bpa.id) as approval_count
      FROM budget_proposals bp
      LEFT JOIN org_units ou ON bp.org_unit_id = ou.id
      LEFT JOIN org_unit_types out_type ON ou.org_unit_type_id = out_type.id
      LEFT JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      LEFT JOIN budget_proposal_approvals bpa ON bp.id = bpa.budget_proposal_id
    `;

    const where = [`bp.fiscal_year = ?`];
    const params = [Number(currentFY)];
    const safeRole = String(role || '').toLowerCase().trim();

    switch (safeRole) {
      case 'user': {
        where.push('(bp.user_id = ? OR bp.user_email = ?)');
        params.push(Number(userId), String(userEmail || '').trim());
        break;
      }
      case 'hod': {
        where.push('bp.department = ?');
        where.push('bp.current_stage = "hod"');
        params.push(String(department || '').trim());
        break;
      }
      case 'dof': {
        where.push('bp.current_stage IN ("dof", "principal")');
        break;
      }
      case 'principal': {
        // Principal sees items waiting for them (if any manual ones exist) 
        // OR completed items if they filter by status
        where.push('(bp.current_stage = "principal" OR bp.status LIKE "principal_%")');
        break;
      }
      default: {
        where.push('(bp.user_id = ? OR bp.user_email = ?)');
        params.push(Number(userId), String(userEmail || '').trim());
      }
    }

    if (status) {
      where.push('bp.status = ?');
      params.push(String(status).trim());
    }

    sql += ` WHERE ${where.join(' AND ')}
             GROUP BY bp.id
             ORDER BY bp.created_at DESC
             LIMIT ? OFFSET ?`;

    params.push(Number(pLimit), Number(pOffset));

    const [rows] = await db.query(sql, params);
    const [total] = await db.query('SELECT FOUND_ROWS() as total');

    return {
      budgets: rows,
      pagination: {
        total: Number(total[0].total),
        page: pPage,
        limit: pLimit,
        pages: Math.ceil(Number(total[0].total) / pLimit)
      }
    };
  }

  /* =====================================================
     7. DASHBOARD AGGREGATES
  ===================================================== */
  static async dashboardAggregates({ department, role, fiscalYear }) {
    const currentFY = fiscalYear || this.getCurrentFinancialYear();
    const params = [currentFY], where = ['bp.fiscal_year = ?'];
    
    if (role === 'hod') {
      where.push('bp.department = ?'); 
      params.push(department);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const approvedSql = `
      SELECT bpl.budget_head, SUM(bpl.line_total) as amount
      FROM budget_proposals bp
      JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      ${whereClause}
      AND bp.status IN ('dof_approved', 'principal_approved', 'completed')
      GROUP BY bpl.budget_head
    `;

    const pendingSql = `
      SELECT bpl.budget_head, SUM(bpl.line_total) as amount
      FROM budget_proposals bp
      JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      ${whereClause}
      AND bp.status IN ('submitted', 'hod_approved')
      GROUP BY bpl.budget_head
    `;

    const [approved, pending] = await Promise.all([
      db.execute(approvedSql, params),
      db.execute(pendingSql, params)
    ]);

    return {
      approved: approved[0],
      pending: pending[0],
      summary: {
        totalApproved: approved[0].reduce((sum, r) => sum + Number(r.amount), 0),
        totalPending: pending[0].reduce((sum, r) => sum + Number(r.amount), 0)
      }
    };
  }

  /* =====================================================
     8. ORG UNIT HELPERS
  ===================================================== */
  static async getOrgUnitsByType(typeCode) {
    const [rows] = await db.execute(
      `SELECT ou.id, ou.name, ou.short_code, ou.is_active,
              out_type.code as type_code, out_type.name as type_name
       FROM org_units ou
       JOIN org_unit_types out_type ON ou.org_unit_type_id = out_type.id
       WHERE out_type.code = ? AND ou.is_active = 1
       ORDER BY ou.name`,
      [typeCode]
    );
    return rows;
  }

  static async getAllOrgUnits() {
    const [rows] = await db.execute(
      `SELECT ou.id, ou.name, ou.short_code, ou.is_active,
              out_type.code as type_code, out_type.name as type_name
       FROM org_units ou
       JOIN org_unit_types out_type ON ou.org_unit_type_id = out_type.id
       WHERE ou.is_active = 1
       ORDER BY out_type.name, ou.name`
    );
    return rows;
  }

  static async getOrgUnitEmails(orgUnitId) {
    const [rows] = await db.execute(
      `SELECT id, role, email, is_primary
       FROM org_unit_emails
       WHERE org_unit_id = ?
       ORDER BY is_primary DESC, role`,
      [orgUnitId]
    );
    return rows;
  }

  /* =====================================================
     9. PRIVATE HELPERS
  ===================================================== */
  static async #insertBudgetLine(proposalId, line, conn) {
    const [result] = await conn.execute(
      `INSERT INTO budget_proposal_lines (
        budget_proposal_id, budget_head, sub_head, unit_amount,
        quantity, line_total, line_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        proposalId, 
        line.budget_head, 
        line.sub_head || '',
        Number(line.unit_amount) || 0, 
        Number(line.quantity) || 1,
        (Number(line.unit_amount) || 0) * (Number(line.quantity) || 1),
        line.line_description || ''
      ]
    );
    return result.insertId;
  }

  static async #insertMonthAllocation(lineId, month, amount, conn) {
    await conn.execute(
      'INSERT INTO budget_line_month_allocations (budget_line_id, month, amount) VALUES (?, ?, ?)',
      [lineId, month, Number(amount) || 0]
    );
  }

  /* =====================================================
     10. getBudgetById (Simple Master)
  ===================================================== */
  static async getBudgetById(proposalId) {
    const [rows] = await db.execute(
      `SELECT bp.*, 
              DATE_FORMAT(bp.request_date, '%Y-%m-%d') as request_date,
              ou.name as org_unit_name, ou.short_code as org_unit_code,
              out_type.name as org_unit_type, out_type.code as org_unit_type_code
       FROM budget_proposals bp
       LEFT JOIN org_units ou ON bp.org_unit_id = ou.id
       LEFT JOIN org_unit_types out_type ON ou.org_unit_type_id = out_type.id
       WHERE bp.id = ?`,
      [proposalId]
    );
    return rows[0] || null;
  }

  /* =====================================================
     11. VALIDATION HELPERS
  ===================================================== */
  static async validateUserAccess(proposalId, userId, userEmail, role, department) {
    const proposal = await this.getBudgetById(proposalId);
    if (!proposal) return false;

    const uid = Number(userId);
    const pid = Number(proposal.user_id);
    
    const rawRole = role ? String(role).toLowerCase().trim() : '';
    const normalizedRole = (rawRole === '' || rawRole === 'faculty') ? 'user' : rawRole;

    console.log('DEBUG MODEL ACCESS:', { uid, pid, normalizedRole, userEmail });

    const emailMatch =
      proposal.user_email &&
      userEmail &&
      String(proposal.user_email).toLowerCase().trim() === String(userEmail).toLowerCase().trim();

    switch (normalizedRole) {
      case 'user':
        return pid === uid || emailMatch;

      case 'hod':
        return (
          !!proposal.department &&
          !!department &&
          String(proposal.department).toLowerCase() === String(department).toLowerCase()
        );

      case 'dof':
      case 'principal':
        return true;

      default:
        if (pid === uid || emailMatch) return true;
        return false;
    }
  }

  /* =====================================================
     12. APPROVAL FLOW CONFIG MANAGEMENT
  ===================================================== */
  static async getApprovalFlowConfigs() {
    const [rows] = await db.execute(
      `SELECT afc.*, out_type.name as org_unit_type_name
       FROM approval_flow_config afc
       LEFT JOIN org_unit_types out_type ON afc.org_unit_type_code = out_type.code
       WHERE afc.is_active = 1
       ORDER BY afc.beneficiary_type, out_type.name`
    );
    return rows;
  }

  static async updateApprovalFlowConfig(id, { requiresHod, requiresDof, requiresPrincipal }) {
    const [result] = await db.execute(
      `UPDATE approval_flow_config 
       SET requires_hod=?, requires_dof=?, requires_principal=?, updated_at=NOW()
       WHERE id=?`,
      [requiresHod, requiresDof, requiresPrincipal, id]
    );
    return result.affectedRows > 0;
  }

  /* =====================================================
     13. STATISTICS & REPORTING
  ===================================================== */
  static async getBudgetStatsByFY(fiscalYear) {
    const fy = fiscalYear || this.getCurrentFinancialYear();
    
    const [stats] = await db.execute(
      `SELECT 
        COUNT(DISTINCT bp.id) as total_proposals,
        SUM(bp.total_amount) as total_amount,
        COUNT(DISTINCT CASE WHEN bp.status LIKE '%_approved' THEN bp.id END) as approved_count,
        SUM(CASE WHEN bp.status LIKE '%_approved' THEN bp.total_amount ELSE 0 END) as approved_amount,
        COUNT(DISTINCT CASE WHEN bp.status = 'submitted' THEN bp.id END) as pending_count,
        SUM(CASE WHEN bp.status = 'submitted' THEN bp.total_amount ELSE 0 END) as pending_amount,
        COUNT(DISTINCT CASE WHEN bp.status LIKE '%_rejected' THEN bp.id END) as rejected_count
       FROM budget_proposals bp
       WHERE bp.fiscal_year = ?`,
      [fy]
    );

    const [byDept] = await db.execute(
      `SELECT 
        bp.department,
        COUNT(*) as proposal_count,
        SUM(bp.total_amount) as total_amount
       FROM budget_proposals bp
       WHERE bp.fiscal_year = ? AND bp.department IS NOT NULL
       GROUP BY bp.department
       ORDER BY total_amount DESC`,
      [fy]
    );

    const [byBeneficiary] = await db.execute(
      `SELECT 
        bp.beneficiary_type,
        COUNT(*) as proposal_count,
        SUM(bp.total_amount) as total_amount
       FROM budget_proposals bp
       WHERE bp.fiscal_year = ?
       GROUP BY bp.beneficiary_type
       ORDER BY proposal_count DESC`,
      [fy]
    );

    return {
      overall: stats[0],
      byDepartment: byDept,
      byBeneficiaryType: byBeneficiary
    };
  }

  /* =====================================================
     14. MONTH-WISE ALLOCATION REPORT
  ===================================================== */
  static async getMonthlyAllocations(proposalId) {
    const [allocations] = await db.execute(
      `SELECT 
        m.month,
        SUM(m.amount) as total_amount,
        COUNT(DISTINCT l.id) as line_count
       FROM budget_line_month_allocations m
       JOIN budget_proposal_lines l ON m.budget_line_id = l.id
       WHERE l.budget_proposal_id = ?
       GROUP BY m.month
       ORDER BY FIELD(m.month, ${VALID_MONTHS.map(m => `'${m}'`).join(',')})`,
      [proposalId]
    );
    return allocations;
  }

  /* =====================================================
     15. EXPORT DATA
  ===================================================== */
  static async getProposalDataForExport(proposalId) {
    const master = await this.getBudgetById(proposalId);
    if (!master) return null;

    const [lines] = await db.execute(
      `SELECT 
        bpl.*,
        GROUP_CONCAT(
          CONCAT(m.month, ':', m.amount) 
          ORDER BY FIELD(m.month, ${VALID_MONTHS.map(m => `'${m}'`).join(',')})
          SEPARATOR '|'
        ) as month_allocations_str
       FROM budget_proposal_lines bpl
       LEFT JOIN budget_line_month_allocations m ON bpl.id = m.budget_line_id
       WHERE bpl.budget_proposal_id = ?
       GROUP BY bpl.id`,
      [proposalId]
    );

    const [approvals] = await db.execute(
      `SELECT role, decision, feedback, approver_email,
              DATE_FORMAT(decided_at, '%Y-%m-%d %H:%i:%s') as decided_at
       FROM budget_proposal_approvals
       WHERE budget_proposal_id = ?
       ORDER BY decided_at`,
      [proposalId]
    );

    return {
      master,
      lines,
      approvals
    };
  }
}

export default BudgetModel;
