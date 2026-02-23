import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../../../../shared/components/layout/navbar/navbar';
import authenticityUtility from '../../../../shared/utils/authenticityUtility';
import './adminbudget.css';

type StageState =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'not_required'
  | 'unassigned';

interface StageCell {
  state: StageState | string;
  decision?: string | null;
  approverName?: string | null;
  approverEmail?: string | null;
  decidedAt?: string | null;
  isAuto?: boolean;
}

interface SuperAdminFlowRow {
  proposalId: number;
  proposalRef: string;
  facultyName?: string | null;
  requesterEmail?: string | null;
  department?: string | null;
  beneficiaryType?: string;
  beneficiaryValue?: string | null;
  status: string;
  currentStage: string;
  level1_route_type?: 'department_hod' | 'entity_contact' | null;
  level1_assignee_email?: string | null;
  level1_assignment_status?: 'assigned' | 'unassigned';
  hod: StageCell;
  financeAdmin: StageCell;
  principal: StageCell;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const DEFAULT_PAGINATION: PaginationMeta = {
  total: 0,
  page: 1,
  limit: 20,
  pages: 1,
};

const getCurrentFY = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

const STAGE_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
  not_required: 'Not Required',
  unassigned: 'Unassigned',
};

const AdminBudget: React.FC = () => {
  const [rows, setRows] = useState<SuperAdminFlowRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<PaginationMeta>(DEFAULT_PAGINATION);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [fiscalYear, setFiscalYear] = useState<number>(getCurrentFY());

  const fiscalYearOptions = useMemo(() => {
    const currentFY = getCurrentFY();
    return [currentFY, currentFY - 1, currentFY - 2];
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = (await authenticityUtility.get('/budget/superadmin/flow', {
        params: {
          page,
          limit: pagination.limit,
          q: search.trim() || undefined,
          department: department.trim() || undefined,
          status: status || undefined,
          fiscalYear,
        },
      })) as {
        success?: boolean;
        data?: SuperAdminFlowRow[];
        pagination?: PaginationMeta;
        message?: string;
      };

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to load super admin budget flow data');
      }

      setRows(Array.isArray(response.data) ? response.data : []);
      setPagination(response.pagination || DEFAULT_PAGINATION);
    } catch (err: any) {
      console.error('Super admin budget flow fetch failed:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load budget flow dashboard');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [department, fiscalYear, page, pagination.limit, search, status]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onApplyFilters = () => {
    if (page === 1) {
      fetchDashboard();
      return;
    }

    setPage(1);
  };

  const renderStageCell = (
    stage: StageCell,
    row?: Pick<SuperAdminFlowRow, 'level1_route_type' | 'level1_assignment_status'>
  ) => {
    const stateKey = (stage?.state || 'pending').toString().toLowerCase();
    const badgeLabel = STAGE_LABEL[stateKey] || stateKey.replace('_', ' ');
    const approverText = stage.approverName || stage.approverEmail || '';
    const isLevel1Unassigned =
      stateKey === 'unassigned' || row?.level1_assignment_status === 'unassigned';

    return (
      <div className="budget-admin-stage-cell">
        <span className={`budget-admin-stage-badge budget-admin-stage-${stateKey}`}>
          {isLevel1Unassigned ? 'Unassigned' : badgeLabel}
        </span>
        {approverText ? <div className="budget-admin-stage-meta">{approverText}</div> : null}
        {stage.decidedAt ? <div className="budget-admin-stage-time">{stage.decidedAt}</div> : null}
        {stage.isAuto ? <div className="budget-admin-stage-auto">Auto</div> : null}
      </div>
    );
  };

  const statusOptions = [
    '',
    'submitted',
    'hod_approved',
    'hod_rejected',
    'hod_returned',
    'dof_approved',
    'dof_rejected',
    'dof_returned',
    'principal_approved',
    'principal_rejected',
    'completed',
  ];

  return (
    <>
      <Navbar />
      <section className="budget-admin-page">
        <div className="budget-admin-shell">
          <div className="budget-admin-header">
            <h2>Budget Workflow - Super Admin</h2>
          </div>

          <div className="budget-admin-filters">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search proposal, faculty, beneficiary"
            />
            <input
              type="text"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Department"
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? option : 'All Statuses'}
                </option>
              ))}
            </select>
            <select
              value={fiscalYear}
              onChange={(event) => setFiscalYear(Number(event.target.value))}
            >
              {fiscalYearOptions.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}-{String(fy + 1).slice(-2)}
                </option>
              ))}
            </select>
            <button type="button" onClick={onApplyFilters}>
              Apply
            </button>
          </div>

          {loading && <div className="budget-admin-state">Loading...</div>}
          {error && <div className="budget-admin-state budget-admin-error">{error}</div>}

          {!loading && !error && (
            <div className="budget-admin-table-wrap">
              <table className="budget-admin-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Faculty Name</th>
                    <th>Dept</th>
                    <th>Level 1 (HOD)</th>
                    <th>Level 2 (Finance Admin)</th>
                    <th>Level 3 (Principal)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.proposalId}>
                      <td>{(page - 1) * pagination.limit + index + 1}</td>
                      <td>
                        <div className="budget-admin-primary">
                          {row.facultyName || row.requesterEmail || '-'}
                        </div>
                        <div className="budget-admin-secondary">
                          {row.proposalRef} | {row.beneficiaryType}
                          {row.beneficiaryValue ? ` - ${row.beneficiaryValue}` : ''}
                        </div>
                      </td>
                      <td>{row.department || '-'}</td>
                      <td>{renderStageCell(row.hod, row)}</td>
                      <td>{renderStageCell(row.financeAdmin)}</td>
                      <td>{renderStageCell(row.principal)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="budget-admin-empty">
                        No budget workflow rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="budget-admin-pagination">
            <button type="button" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page <= 1}>
              Previous
            </button>
            <span>
              Page {pagination.page || page} of {Math.max(pagination.pages || 1, 1)}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, Math.max(pagination.pages || 1, 1)))}
              disabled={page >= Math.max(pagination.pages || 1, 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
};

export default AdminBudget;
