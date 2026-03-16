import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { useAuth } from '../../../../contexts/AuthContext';
import { hasPermission, isSuperAdmin } from '../../../../shared/utils/permissionUtils';
import authenticityUtility from '../../../../shared/utils/authenticityUtility';
import './adminbudgetdashboard.css';

type Option = {
  value: string;
  label: string;
};

type AdminBudgetLineItem = {
  budgetHead: string;
  subHead: string;
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

type ConsolidatedRow = {
  budgetHead: string;
  initial: number;
  additional: number;
  expenditure: number;
  balance: number;
};

const ALL_BENEFICIARY_OPTION: Option = { value: 'all', label: 'All Beneficiary' };

const AdminBudgetDashboard: React.FC = () => {
  const { user } = useAuth();
  const [financialYear, setFinancialYear] = useState<Option | null>({
    value: '2026-27',
    label: 'FY 2026-27',
  });

  const [beneficiary, setBeneficiary] = useState<Option | null>(ALL_BENEFICIARY_OPTION);
  const [searchText, setSearchText] = useState('');
  const [proposals, setProposals] = useState<AdminProposalGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedHead, setExpandedHead] = useState<string | null>(null);

  const roleKey = useMemo(() => {
    const roleCodes = Array.isArray(user?.roles)
      ? user.roles
          .map((role: any) => {
            if (!role) return '';
            if (typeof role === 'string') return role;
            return role.role_code || role.role_name || '';
          })
          .map((role) => String(role).toLowerCase())
      : [];

    if (isSuperAdmin(user)) {
      return 'super_admin';
    }

    if (roleCodes.some((code) => code.includes('dof')) || hasPermission(user, 'budget.workflow.dof')) {
      return 'dof';
    }

    if (roleCodes.some((code) => code.includes('coordinator'))) {
      return 'coordinator';
    }

    if (roleCodes.some((code) => code.includes('ithead') || code.includes('it-head') || code.includes('it_head'))) {
      return 'ithead';
    }

    if (roleCodes.some((code) => code.includes('hod') || code.includes('head'))) {
      return 'hod';
    }

    if (hasPermission(user, 'budget.workflow.ithead')) {
      return 'ithead';
    }

    if (hasPermission(user, 'budget.workflow.level1')) {
      return 'hod';
    }

    return 'admin';
  }, [user]);

  const userRoleLabel = useMemo(() => {
    switch (roleKey) {
      case 'super_admin':
        return 'Super Admin';
      case 'dof':
        return 'DOF';
      case 'coordinator':
        return 'Coordinator';
      case 'ithead':
        return 'IT Head';
      case 'hod':
        return 'HOD';
      default:
        return 'Admin';
    }
  }, [roleKey]);

  const financialYearOptions: Option[] = [
    { value: '2024-25', label: 'FY 2024-25' },
    { value: '2025-26', label: 'FY 2025-26' },
    { value: '2026-27', label: 'FY 2026-27' },
  ];

  const beneficiaryOptions: Option[] = useMemo(() => {
    const statusKey = (value?: string) => String(value || '').toLowerCase();
    const allowedStatusesByRole: Record<string, string[]> = {
      hod: ['level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed'],
      coordinator: ['level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed'],
      ithead: ['ithead_approved', 'dof_approved', 'principal_approved', 'completed'],
      dof: ['dof_approved', 'principal_approved', 'completed'],
      admin: ['principal_approved', 'completed'],
      super_admin: ['principal_approved', 'completed'],
    };
    const allowedStatuses = allowedStatusesByRole[roleKey] || allowedStatusesByRole.admin;
    const approvedProposals = proposals.filter((proposal) =>
      allowedStatuses.includes(statusKey(proposal.status))
    );

    if (roleKey === 'dof' || roleKey === 'super_admin') {
      const seen = new Set<string>();
      const entityOrder = ['Department', 'Centre', 'Cell', 'Club', 'Professional Body', 'Institution'];
      const entitySet = new Set(entityOrder.map((item) => item.toLowerCase()));
      const entityOptions: Option[] = [];

      approvedProposals.forEach((proposal) => {
        const type = String(proposal.beneficiaryType || '').trim();
        const value = String(proposal.beneficiaryValue || '').trim();
        if (!type || !value) return;
        if (!entitySet.has(type.toLowerCase())) return;
        const key = `${type.toLowerCase()}::${value.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        entityOptions.push({
          value: `${type}::${value}`,
          label: value,
        });
      });

      entityOptions.sort((a, b) => a.label.localeCompare(b.label));

      return [
        ALL_BENEFICIARY_OPTION,
        { value: 'Faculty', label: 'Faculty' },
        ...entityOptions,
      ];
    }

    const allOptions: Option[] = [
      ALL_BENEFICIARY_OPTION,
      { value: 'Faculty', label: 'Faculty' },
      { value: 'Department', label: 'Department' },
      { value: 'Centre', label: 'Centre' },
      { value: 'Cell', label: 'Cell' },
      { value: 'Club', label: 'Club' },
      { value: 'Professional Body', label: 'Professional Body' },
      { value: 'Institution', label: 'Institution' },
    ];

    if (roleKey === 'hod') {
      return [
        ALL_BENEFICIARY_OPTION,
        { value: 'Faculty', label: 'Faculty' },
        { value: 'Department', label: 'Department' },
      ];
    }

    if (roleKey === 'coordinator') {
      return [
        ALL_BENEFICIARY_OPTION,
        { value: 'Cell', label: 'Cell' },
        { value: 'Centre', label: 'Centre' },
        { value: 'Club', label: 'Club' },
        { value: 'Professional Body', label: 'Professional Body' },
      ];
    }

    return allOptions;
  }, [roleKey, proposals]);

  useEffect(() => {
    const hasCurrent = beneficiaryOptions.some((option) => option.value === beneficiary?.value);
    if (!hasCurrent) {
      setBeneficiary(ALL_BENEFICIARY_OPTION);
    }
  }, [beneficiary, beneficiaryOptions]);

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
      case 'hod':
        return '/adminbudget/hod';
      case 'coordinator':
        return '/adminbudget/coordinator';
      case 'ithead':
        return '/adminbudget/ithead';
      case 'dof':
        return '/adminbudget/dof';
      case 'super_admin':
      case 'admin':
      default:
        return '/adminbudget/admin';
    }
  };

  useEffect(() => {
    const fetchConsolidatedData = async () => {
      if (!financialYear?.value) {
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
            const items: AdminBudgetLineItem[] = (Array.isArray(lines) ? lines : []).map(
              (line: any) => ({
                budgetHead: line.budget_head || line.budgetHead || 'Unknown',
                subHead: line.sub_head || line.subHead || '-',
                approvedAmount: Number.parseFloat(
                  line.approved_line_total ?? line.approvedLineTotal ?? line.line_total ?? line.lineTotal ?? 0
                ),
                expenditure: Number.parseFloat(line.expenditure ?? 0),
              })
            );

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
        console.error('Failed to fetch consolidated budgets', fetchError);
        setError(fetchError?.response?.data?.message || 'Failed to load consolidated budget data.');
        setProposals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchConsolidatedData();
  }, [financialYear?.value, roleKey]);

  const filteredProposals = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const beneficiaryValue = String(beneficiary?.value || 'all').toLowerCase();
    const hasEntityFilter =
      (roleKey === 'dof' || roleKey === 'super_admin') && beneficiaryValue.includes('::');
    const [filterType, filterName] = hasEntityFilter ? beneficiaryValue.split('::') : ['', ''];

    return proposals.filter((proposal) => {
      const matchesSearch =
        !query ||
        proposal.proposalRef.toLowerCase().includes(query) ||
        proposal.applicantName.toLowerCase().includes(query);

      const proposalType = String(proposal.beneficiaryType || '').toLowerCase();
      const proposalValue = String(proposal.beneficiaryValue || '').toLowerCase();

      const matchesBeneficiary =
        beneficiaryValue === 'all' ||
        (hasEntityFilter && proposalType === filterType && proposalValue === filterName) ||
        (!hasEntityFilter && proposalType === beneficiaryValue);

      return matchesSearch && matchesBeneficiary;
    });
  }, [beneficiary?.value, proposals, roleKey, searchText]);

  const canViewAmounts =
    roleKey === 'super_admin' ||
    roleKey === 'dof' ||
    roleKey === 'hod' ||
    roleKey === 'coordinator' ||
    roleKey === 'ithead';

  const rupeeSymbol = '\u20B9';

  const { consolidatedRows, detailsByHead } = useMemo(() => {
    const statusKey = (value?: string) => String(value || '').toLowerCase();
    const allowedStatusesByRole: Record<string, string[]> = {
      hod: ['level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed'],
      coordinator: ['level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed'],
      ithead: ['ithead_approved', 'dof_approved', 'principal_approved', 'completed'],
      dof: ['dof_approved', 'principal_approved', 'completed'],
      admin: ['principal_approved', 'completed'],
      super_admin: ['principal_approved', 'completed'],
    };

    const allowedStatuses = allowedStatusesByRole[roleKey] || allowedStatusesByRole.admin;

    const approvedProposals = filteredProposals.filter((proposal) =>
      allowedStatuses.includes(statusKey(proposal.status))
    );
    const consolidationMap: Record<string, ConsolidatedRow> = {};
    const detailMap: Record<
      string,
      {
        proposalId: number;
        applicantName: string;
        subHead: string;
        initialAmount: number;
        additionalAmount: number;
      }[]
    > = {};

    approvedProposals.forEach((proposal) => {
      const isInitial = isInitialBudgetProposal(proposal.createdAt, financialYear?.value || '');
      proposal.items.forEach((item) => {
        if (!consolidationMap[item.budgetHead]) {
          consolidationMap[item.budgetHead] = {
            budgetHead: item.budgetHead,
            initial: 0,
            additional: 0,
            expenditure: 0,
            balance: 0,
          };
        }

        if (isInitial) {
          consolidationMap[item.budgetHead].initial += item.approvedAmount;
        } else {
          consolidationMap[item.budgetHead].additional += item.approvedAmount;
        }

        consolidationMap[item.budgetHead].expenditure += item.expenditure || 0;

        if (!detailMap[item.budgetHead]) {
          detailMap[item.budgetHead] = [];
        }

        detailMap[item.budgetHead].push({
          proposalId: proposal.id,
          applicantName: proposal.applicantName || 'Unknown',
          subHead: item.subHead || '-',
          initialAmount: isInitial ? item.approvedAmount : 0,
          additionalAmount: isInitial ? 0 : item.approvedAmount,
        });
      });
    });

    return {
      consolidatedRows: Object.values(consolidationMap).map((row) => ({
        ...row,
        balance: row.initial + row.additional - row.expenditure,
      })),
      detailsByHead: detailMap,
    };
  }, [filteredProposals, financialYear?.value, roleKey]);

  const consolidatedTotals = useMemo(
    () =>
      consolidatedRows.reduce(
        (acc, row) => ({
          initial: acc.initial + row.initial,
          additional: acc.additional + row.additional,
          expenditure: acc.expenditure + row.expenditure,
          balance: acc.balance + row.balance,
        }),
        { initial: 0, additional: 0, expenditure: 0, balance: 0 }
      ),
    [consolidatedRows]
  );

  useEffect(() => {
    if (expandedHead && !detailsByHead[expandedHead]) {
      setExpandedHead(null);
    }
  }, [detailsByHead, expandedHead]);

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

  return (
    <div className="adminbudgetdashboard-page">
      <div className="adminbudgetdashboard-container">
        <div className="adminbudgetdashboard-card">
          <div className="adminbudgetdashboard-header">
            <div className="adminbudgetdashboard-header-left">
              <h1 className="adminbudgetdashboard-title">Consolidated Budget</h1>
              <span className="adminbudgetdashboard-role-pill">{userRoleLabel}</span>
            </div>
            <div className="adminbudgetdashboard-header-right">
              <div className="adminbudgetdashboard-filter adminbudgetdashboard-filter--fy">
                <Select
                  value={financialYear}
                  onChange={(option) => setFinancialYear(option)}
                  options={financialYearOptions}
                  styles={selectStyles}
                  isSearchable={false}
                />
              </div>

              <div className="adminbudgetdashboard-filter adminbudgetdashboard-filter--beneficiary">
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

              <div className="adminbudgetdashboard-filter adminbudgetdashboard-filter--search">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search Budget ID or Applicant"
                  className="adminbudgetdashboard-search"
                />
              </div>
            </div>
          </div>

          <div className="adminbudgetdashboard-body">
          {loading && <div className="adminbudgetdashboard-state">Loading...</div>}
          {!loading && error && <div className="adminbudgetdashboard-state adminbudgetdashboard-state--error">{error}</div>}

          {!loading && !error && consolidatedRows.length > 0 && (
            <div className="adminbudgetdashboard-table-section">
              <div className="adminbudgetdashboard-table-wrapper">
                <table className="adminbudgetdashboard-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Budget Head</th>
                      <th>Initial</th>
                      <th>Additional</th>
                      <th>Expenditure</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedRows.map((row, idx) => (
                      <tr
                        key={`${row.budgetHead}-${idx}`}
                        className="adminbudgetdashboard-row-clickable"
                        onClick={() =>
                          setExpandedHead((prev) => (prev === row.budgetHead ? null : row.budgetHead))
                        }
                      >
                        <td>{idx + 1}</td>
                        <td>{row.budgetHead}</td>
                        <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(row.initial)}` : '--'}</td>
                        <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(row.additional)}` : '--'}</td>
                        <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(row.expenditure)}` : '--'}</td>
                        <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(row.balance)}` : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="adminbudgetdashboard-total-row">
                      <td></td>
                      <td>
                        <strong>Total</strong>
                      </td>
                      <td>
                        <strong>{canViewAmounts ? `${rupeeSymbol}${formatINR(consolidatedTotals.initial)}` : '--'}</strong>
                      </td>
                      <td>
                        <strong>{canViewAmounts ? `${rupeeSymbol}${formatINR(consolidatedTotals.additional)}` : '--'}</strong>
                      </td>
                      <td>
                        <strong>{canViewAmounts ? `${rupeeSymbol}${formatINR(consolidatedTotals.expenditure)}` : '--'}</strong>
                      </td>
                      <td>
                        <strong>{canViewAmounts ? `${rupeeSymbol}${formatINR(consolidatedTotals.balance)}` : '--'}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {!loading && !error && expandedHead && (
            <div className="adminbudgetdashboard-detail-section">
              <div className="adminbudgetdashboard-detail-title">{expandedHead}</div>
              {(detailsByHead[expandedHead] || []).length > 0 ? (
                <div className="adminbudgetdashboard-detail-table-wrapper">
                  <table className="adminbudgetdashboard-detail-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Applicant</th>
                        <th>Sub Head</th>
                        <th>Initial</th>
                        <th>Additional</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailsByHead[expandedHead] || []).map((detail, index) => (
                        <tr key={`${expandedHead}-${detail.proposalId}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{detail.applicantName}</td>
                          <td>{detail.subHead}</td>
                          <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(detail.initialAmount)}` : '--'}</td>
                          <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(detail.additionalAmount)}` : '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="adminbudgetdashboard-state">No approved proposals found for this budget head.</div>
              )}
            </div>
          )}

          {!loading && !error && consolidatedRows.length === 0 && (
            <div className="adminbudgetdashboard-state">No consolidated budget data found.</div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBudgetDashboard;