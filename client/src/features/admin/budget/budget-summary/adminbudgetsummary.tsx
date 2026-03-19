import React, { useEffect, useMemo, useState, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import Select from 'react-select';
import { useAuth } from '../../../../contexts/AuthContext';
import { hasPermission, isSuperAdmin } from '../../../../shared/utils/permissionUtils';
import authenticityUtility from '../../../../shared/utils/authenticityUtility';
import './adminbudgetsummary.css';

type Option = {
  value: string;
  label: string;
};

type AdminBudgetLineItem = {
  proposedAmount: number;
  approvedAmount: number;
  expenditure: number;
};

type AdminProposalGroup = {
  id: number;
  proposalRef: string;
  status: string;
  beneficiaryType: string;
  beneficiaryValue?: string;
  createdAt: string;
  applicantName: string;
  items: AdminBudgetLineItem[];
};

type BeneficiarySummaryRow = {
  beneficiaryKey: string;
  beneficiaryLabel: string;
  proposed: number;
  approved: number;
  initial: number;
  additional: number;
  expenditure: number;
  balance: number;
};

const ALL_BENEFICIARY_OPTION: Option = { value: 'all', label: 'All Beneficiary' };
const ALLOWED_STATUSES_BY_ROLE: Record<string, string[]> = {
  dof: ['dof_approved', 'principal_approved', 'completed'],
  super_admin: ['principal_approved', 'completed'],
};

const BENEFICIARY_TYPES = ['Department', 'Centre', 'Cell', 'Club', 'Professional Body'];
const BENEFICIARY_TYPE_TO_ENTITY_API_TYPE: Record<string, string> = {
  Department: 'DEPARTMENT',
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  'Professional Body': 'PROFESSIONAL_BODY',
};

const AdminBudgetSummary: React.FC = () => {
  const { user } = useAuth();
  const [financialYear, setFinancialYear] = useState<Option | null>({
    value: '2026-27',
    label: 'FY 2026-27',
  });
  const [beneficiary, setBeneficiary] = useState<Option | null>(ALL_BENEFICIARY_OPTION);
  const [searchText, setSearchText] = useState('');
  const [proposals, setProposals] = useState<AdminProposalGroup[]>([]);
  const [orgUnitsByType, setOrgUnitsByType] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleKey = useMemo(() => {
    if (isSuperAdmin(user)) {
      return 'super_admin';
    }

    if (hasPermission(user, 'budget.workflow.dof')) {
      return 'dof';
    }

    return 'admin';
  }, [user]);

  const canAccessSummary = roleKey === 'dof' || roleKey === 'super_admin';

  const financialYearOptions: Option[] = [
    { value: '2024-25', label: 'FY 2024-25' },
    { value: '2025-26', label: 'FY 2025-26' },
    { value: '2026-27', label: 'FY 2026-27' },
  ];

  const parseDateSafe = (value?: string) => {
    if (!value) return null;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;
    const normalized = String(value).replace(' ', 'T');
    const fallback = new Date(normalized);
    if (!Number.isNaN(fallback.getTime())) return fallback;
    return null;
  };

  const getInitialCutoffForFY = (fy?: string) => {
    if (!fy) return null;
    const fyStart = Number.parseInt(String(fy).split('-')[0], 10);
    if (!Number.isInteger(fyStart)) return null;
    return new Date(fyStart, 1, 1, 23, 59, 59, 999);
  };

  const isInitialBudgetProposal = (createdAt?: string, fy?: string) => {
    const proposalDate = parseDateSafe(createdAt);
    const cutoff = getInitialCutoffForFY(fy);
    if (!proposalDate) return false;
    if (!cutoff) return true;
    return proposalDate.getTime() <= cutoff.getTime();
  };

  const formatINR = (value: number) => Number(value || 0).toLocaleString('en-IN');

  const resolveRoleEndpoint = (role: string) => {
    switch (role) {
      case 'dof':
        return '/adminbudget/dof';
      case 'super_admin':
      default:
        return '/adminbudget/admin';
    }
  };

  useEffect(() => {
    const fetchSummaryData = async () => {
      if (!financialYear?.value || !canAccessSummary) {
        setProposals([]);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const fiscalYearNum = Number.parseInt(financialYear.value.split('-')[0], 10);
        const response: any = await authenticityUtility.get(resolveRoleEndpoint(roleKey), {
          params: { limit: 100, status: '', fiscalYear: fiscalYearNum },
        });

        const list = Array.isArray(response?.data) ? response.data : [];
        if (!list.length) {
          setProposals([]);
          return;
        }

        const detailPromises = list.map(async (item: any) => {
          try {
            const detail: any = await authenticityUtility.get(`/adminbudget/${item.id}`);
            const master = detail?.data?.master || detail?.data || {};
            const lines = detail?.data?.lines || detail?.data?.items || [];
            const items: AdminBudgetLineItem[] = (Array.isArray(lines) ? lines : []).map((line: any) => {
              const proposedAmount = Number.parseFloat(line.line_total ?? line.lineTotal ?? 0);
              const approvedAmount = Number.parseFloat(line.approved_line_total ?? line.approvedLineTotal ?? 0);

              return {
                proposedAmount: Number.isFinite(proposedAmount) ? proposedAmount : 0,
                approvedAmount: Number.isFinite(approvedAmount) ? approvedAmount : 0,
                expenditure: Number.parseFloat(line.expenditure ?? 0),
              };
            });

            return {
              id: item.id,
              proposalRef: item.proposal_ref || master.proposal_ref || '',
              status: master.status || item.status || '',
              beneficiaryType: item.beneficiary_type || master.beneficiary_type || '',
              beneficiaryValue: item.beneficiary_value || master.beneficiary_value || '',
              createdAt: master.created_at || item.created_date || item.created_at || '',
              applicantName:
                item.applicant_name ||
                master.applicant_name ||
                master.user_name ||
                master.user_email ||
                '',
              items,
            } as AdminProposalGroup;
          } catch (detailError) {
            console.error('Failed to fetch admin budget detail', detailError);
            return null;
          }
        });

        const fullProposals = (await Promise.all(detailPromises)).filter(Boolean) as AdminProposalGroup[];
        setProposals(fullProposals);
      } catch (fetchError: any) {
        console.error('Failed to fetch summary data', fetchError);
        setError(fetchError?.response?.data?.message || 'Failed to load summary data.');
        setProposals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSummaryData();
  }, [canAccessSummary, financialYear?.value, roleKey]);

  useEffect(() => {
    let cancelled = false;

    const normalizeText = (value: string | null | undefined): string =>
      String(value || '').trim();

    const loadOrgUnits = async () => {
      if (!canAccessSummary) {
        if (!cancelled) {
          setOrgUnitsByType({});
        }
        return;
      }

      const toNames = (rows: any[]) =>
        rows
          .map((row: any) => normalizeText(row?.name))
          .filter(Boolean);

      const nextOptions: Record<string, string[]> = {};

      try {
        const json = await authenticityUtility.get('/adminbudget/org-units');
        const grouped = (json as any)?.data?.grouped;

        if (grouped && typeof grouped === 'object') {
          Object.entries(BENEFICIARY_TYPE_TO_ENTITY_API_TYPE).forEach(([beneficiaryKey, apiType]) => {
            const rows = Array.isArray((grouped as Record<string, any[]>)[apiType])
              ? (grouped as Record<string, any[]>)[apiType]
              : [];
            nextOptions[beneficiaryKey] = toNames(rows);
          });
        } else {
          throw new Error('Grouped org-units payload unavailable');
        }
      } catch (bulkError) {
        console.error('Failed to fetch bulk org units, falling back to per-type calls:', bulkError);

        for (const [beneficiaryKey, apiType] of Object.entries(BENEFICIARY_TYPE_TO_ENTITY_API_TYPE)) {
          try {
            const json = await authenticityUtility.get(`/adminbudget/org-units/${apiType}`);
            const rows = Array.isArray((json as any)?.data) ? (json as any).data : [];
            nextOptions[beneficiaryKey] = toNames(rows);
          } catch (error) {
            console.error(`Failed to fetch options for ${beneficiaryKey}:`, error);
            nextOptions[beneficiaryKey] = [];
          }
        }
      }

      if (!cancelled) {
        setOrgUnitsByType(nextOptions);
      }
    };

    loadOrgUnits();

    return () => {
      cancelled = true;
    };
  }, [canAccessSummary]);

  const allowedStatuses = useMemo(
    () => ALLOWED_STATUSES_BY_ROLE[roleKey] || ALLOWED_STATUSES_BY_ROLE.super_admin,
    [roleKey]
  );

  const statusKey = (value?: string) => String(value || '').toLowerCase();
  const isRejectedOrReturnedOrArchived = (status: string) =>
    ['rejected', 'returned', 'archived', 'archive'].some((token) => status.includes(token));

  const approvedProposals = useMemo(() => {
    return proposals.filter((proposal) => allowedStatuses.includes(statusKey(proposal.status)));
  }, [allowedStatuses, proposals]);

  const proposedProposals = useMemo(
    () => proposals.filter((proposal) => !isRejectedOrReturnedOrArchived(statusKey(proposal.status))),
    [proposals]
  );

  const allEntities = useMemo(() => {
    const items: { key: string; label: string; type: string }[] = [];

    BENEFICIARY_TYPES.forEach((type) => {
      const names = Array.isArray(orgUnitsByType[type]) ? orgUnitsByType[type] : [];
      names.forEach((name) => {
        const normalized = String(name || '').trim();
        if (!normalized) return;
        items.push({
          key: `${type.toLowerCase()}::${normalized.toLowerCase()}`,
          label: normalized,
          type: type.toLowerCase(),
        });
      });
    });

    return items.sort((a, b) => a.label.localeCompare(b.label));
  }, [orgUnitsByType]);

  const beneficiaryOptions: Option[] = useMemo(() => {
    if (!canAccessSummary) {
      return [ALL_BENEFICIARY_OPTION];
    }

    return [
      ALL_BENEFICIARY_OPTION,
      { value: 'Department', label: 'Department' },
      { value: 'Centre', label: 'Centre' },
      { value: 'Cell', label: 'Cell' },
      { value: 'Club', label: 'Club' },
      { value: 'Professional Body', label: 'Professional Body' },
    ];
  }, [canAccessSummary]);

  useEffect(() => {
    const hasCurrent = beneficiaryOptions.some((option) => option.value === beneficiary?.value);
    if (!hasCurrent) {
      setBeneficiary(ALL_BENEFICIARY_OPTION);
    }
  }, [beneficiary, beneficiaryOptions]);

  const filteredEntities = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const beneficiaryValue = String(beneficiary?.value || 'all').toLowerCase();

    return allEntities.filter((entity) => {
      const matchesSearch = !query || entity.label.toLowerCase().includes(query);
      const matchesBeneficiary =
        beneficiaryValue === 'all' || entity.type.toLowerCase() === beneficiaryValue;
      return matchesSearch && matchesBeneficiary;
    });
  }, [allEntities, beneficiary?.value, searchText]);

  const beneficiarySummaryRows = useMemo(() => {
    const summaryMap: Record<string, BeneficiarySummaryRow> = {};

    filteredEntities.forEach((entity) => {
      summaryMap[entity.key] = {
        beneficiaryKey: entity.key,
        beneficiaryLabel: entity.label,
        proposed: 0,
        approved: 0,
        initial: 0,
        additional: 0,
        expenditure: 0,
        balance: 0,
      };
    });

    proposedProposals.forEach((proposal) => {
      const type = String(proposal.beneficiaryType || '').trim().toLowerCase();
      const name = String(proposal.beneficiaryValue || '').trim();
      if (!type || !name) return;
      const key = `${type}::${name.toLowerCase()}`;
      if (!summaryMap[key]) return;

      proposal.items.forEach((item) => {
        summaryMap[key].proposed += item.proposedAmount;
      });
    });

    approvedProposals.forEach((proposal) => {
      const type = String(proposal.beneficiaryType || '').trim().toLowerCase();
      const name = String(proposal.beneficiaryValue || '').trim();
      if (!type || !name) return;
      const key = `${type}::${name.toLowerCase()}`;
      if (!summaryMap[key]) return;

      const isInitial = isInitialBudgetProposal(proposal.createdAt, financialYear?.value || '');
      proposal.items.forEach((item) => {
        summaryMap[key].approved += item.approvedAmount;
        if (isInitial) {
          summaryMap[key].initial += item.approvedAmount;
        } else {
          summaryMap[key].additional += item.approvedAmount;
        }
        summaryMap[key].expenditure += item.expenditure || 0;
      });
    });

    return Object.values(summaryMap).map((row) => ({
      ...row,
      balance: row.initial + row.additional - row.expenditure,
    }));
  }, [approvedProposals, filteredEntities, financialYear?.value, proposedProposals]);

  const summaryTotals = useMemo(
    () =>
      beneficiarySummaryRows.reduce(
        (acc, row) => ({
          proposed: acc.proposed + row.proposed,
          approved: acc.approved + row.approved,
          initial: acc.initial + row.initial,
          additional: acc.additional + row.additional,
          expenditure: acc.expenditure + row.expenditure,
          balance: acc.balance + row.balance,
        }),
        { proposed: 0, approved: 0, initial: 0, additional: 0, expenditure: 0, balance: 0 }
      ),
    [beneficiarySummaryRows]
  );

  const rupeeSymbol = '\u20B9';

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '42px',
      height: '42px',
      borderRadius: '12px',
      border: '1px solid rgba(15, 23, 42, 0.18)',
      boxShadow: state.isFocused
        ? '0 0 0 4px rgba(0, 105, 171, 0.15), 0 10px 22px rgba(2, 6, 23, 0.08)'
        : '0 6px 18px rgba(2, 6, 23, 0.06)',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      paddingLeft: '4px',
      paddingRight: '4px',
      '&:hover': {
        borderColor: '#0069ab',
      },
    }),
    valueContainer: (base: any) => ({
      ...base,
      padding: '0 12px',
      height: '42px',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: '#0f172a',
      fontSize: '0.95rem',
      fontWeight: 500,
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#0f172a',
      fontSize: '0.95rem',
      fontWeight: 500,
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base: any) => ({
      ...base,
      color: '#0f172a',
      paddingRight: '8px',
    }),
    menu: (base: any) => ({
      ...base,
      borderRadius: '10px',
      overflow: 'hidden',
      marginTop: '4px',
      boxShadow: '0 8px 22px rgba(15, 23, 42, 0.14)',
      border: '1px solid rgba(15, 23, 42, 0.14)',
      zIndex: 9999,
    }),
    menuList: (base: any) => ({
      ...base,
      paddingTop: 0,
      paddingBottom: 0,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected ? '#2a6fd6' : state.isFocused ? '#eef4ff' : '#fff',
      color: state.isSelected ? '#fff' : '#111827',
      fontSize: '0.95rem',
      padding: '12px 18px',
      cursor: 'pointer',
    }),
  };
const runningIndexRef = useRef(0);
useEffect(() => {
  runningIndexRef.current = 0;
}, [beneficiarySummaryRows]);

  return (
    <div className="adminbudgetsummary-page">
      <div className="adminbudgetsummary-container">
        {canAccessSummary && (
          <div className="adminbudget-tabs">
            <NavLink
              to="/admin/budgetdashboard"
              className={({ isActive }) =>
                `adminbudget-tab${isActive ? ' is-active' : ''}`
              }
            >
              Budget Head
            </NavLink>
            <NavLink
              to="/admin/budgetsummary"
              className={({ isActive }) =>
                `adminbudget-tab${isActive ? ' is-active' : ''}`
              }
            >
              Beneficiary Summary
            </NavLink>
          </div>
        )}

        <div className="adminbudgetsummary-card">
          <div className="adminbudgetsummary-header">
            <div className="adminbudgetsummary-header-left">
              <h1 className="adminbudgetsummary-title">Consolidated Summary</h1>
              <span className="adminbudgetsummary-role-pill">
                {roleKey === 'super_admin' ? 'Super Admin' : roleKey.toUpperCase()}
              </span>
            </div>
            <div className="adminbudgetsummary-header-right">
              <div className="adminbudgetsummary-filter adminbudgetsummary-filter--fy">
                <Select
                  value={financialYear}
                  onChange={(option) => setFinancialYear(option)}
                  options={financialYearOptions}
                  styles={selectStyles}
                  isSearchable={false}
                />
              </div>

              <div className="adminbudgetsummary-filter adminbudgetsummary-filter--beneficiary">
                <Select
                  value={beneficiary}
                  onChange={(option) => setBeneficiary(option)}
                  options={beneficiaryOptions}
                  styles={selectStyles}
                  placeholder="All Beneficiary"
                  isClearable={false}
                  isSearchable={false}
                />
              </div>

              <div className="adminbudgetsummary-filter adminbudgetsummary-filter--search">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search Budget ID or Applicant"
                  className="adminbudgetsummary-search"
                />
              </div>
            </div>
          </div>

          <div className="adminbudgetsummary-body">
            {!canAccessSummary && (
              <div className="adminbudgetsummary-state adminbudgetsummary-state--error">
                You do not have access to this summary.
              </div>
            )}
            {canAccessSummary && loading && <div className="adminbudgetsummary-state">Loading...</div>}
            {canAccessSummary && !loading && error && (
              <div className="adminbudgetsummary-state adminbudgetsummary-state--error">{error}</div>
            )}
        {canAccessSummary && !loading && !error && (
  <>
    {(() => {
      const allTypeRows: { type: string; rows: BeneficiarySummaryRow[] }[] = [];
      BENEFICIARY_TYPES.forEach((type) => {
        const typeRows = beneficiarySummaryRows
          .filter((row) => row.beneficiaryKey.startsWith(type.toLowerCase()))
          .sort((a, b) => a.beneficiaryLabel.localeCompare(b.beneficiaryLabel));
        if (typeRows.length > 0) {
          allTypeRows.push({ type, rows: typeRows });
        }
      });

      let globalIndex = 0;

      return (
        <div className="adminbudgetsummary-table-section">
          {allTypeRows.map(({ type, rows }) => (
            <div key={type} className="adminbudgetsummary-type-section">
              <div className="adminbudgetsummary-type-header">
                <h3>{type} ({rows.length})</h3>
              </div>
              <div className="adminbudgetsummary-table-wrapper">
                <table className="adminbudgetsummary-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Beneficiary</th>
                      <th>Proposed</th>
                      <th>Approved</th>
                      <th>Initial</th>
                      <th>Additional</th>
                      <th>Expenditure</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      globalIndex += 1;
                      return (
                        <tr key={row.beneficiaryKey}>
                          <td>{globalIndex}</td>
                          <td>{row.beneficiaryLabel}</td>
                          <td>{rupeeSymbol}{formatINR(row.proposed)}</td>
                          <td>{rupeeSymbol}{formatINR(row.approved)}</td>
                          <td>{rupeeSymbol}{formatINR(row.initial)}</td>
                          <td>{rupeeSymbol}{formatINR(row.additional)}</td>
                          <td>{rupeeSymbol}{formatINR(row.expenditure)}</td>
                          <td>{rupeeSymbol}{formatINR(row.balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Type Subtotal */}
                  <tfoot>
                    <tr className="adminbudgetsummary-type-total-row">
                      <td></td>
                      <td ><strong>{type} Total</strong></td>
                      <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.proposed, 0))}</strong></td>
                      <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.approved, 0))}</strong></td>
                      <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.initial, 0))}</strong></td>
                      <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.additional, 0))}</strong></td>
                      <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.expenditure, 0))}</strong></td>
                      <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.balance, 0))}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
          {/* Grand Total */}
          {allTypeRows.length > 0 && (
            
              <table className="adminbudgetsummary-grand-table">
                <tbody>
                  <tr>
                    <td></td>
                    <td ><strong>GRAND TOTAL</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.proposed)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.approved)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.initial)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.additional)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.expenditure)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.balance)}</strong></td>
                  </tr>
                </tbody>
              </table>
           
          )}
        </div>
      );
    })()}
  </>
)}


          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBudgetSummary;
