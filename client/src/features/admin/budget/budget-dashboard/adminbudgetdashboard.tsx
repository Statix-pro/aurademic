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

const getCurrentFiscalYearOption = (): Option => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // FY starts in February (month 1)
  const fyStart = month >= 1 ? year : year - 1;
  const value = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  return { value, label: `FY ${value}` };
};

const AdminBudgetDashboard: React.FC = () => {
  const { user } = useAuth();
  const [financialYear, setFinancialYear] = useState<Option | null>(getCurrentFiscalYearOption());

  const [beneficiary, setBeneficiary] = useState<Option | null>(ALL_BENEFICIARY_OPTION);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [consolidatedRows, setConsolidatedRows] = useState<ConsolidatedRow[]>([]);
  const [detailsByHead, setDetailsByHead] = useState<Record<string, any[]>>({});
  const [availableBeneficiaryTypes, setAvailableBeneficiaryTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedHead, setExpandedHead] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchText]);

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

  const financialYearOptions: Option[] = useMemo(() => {
    const currentOption = getCurrentFiscalYearOption();
    const currentStart = parseInt(currentOption.value.split('-')[0], 10);
    // Show current year and 2 previous years
    return [currentStart - 2, currentStart - 1, currentStart].map((year) => ({
      value: `${year}-${String(year + 1).slice(2)}`,
      label: `FY ${year}-${String(year + 1).slice(2)}`,
    }));
  }, []);

  const beneficiaryOptions: Option[] = useMemo(() => {
    if (!availableBeneficiaryTypes || availableBeneficiaryTypes.length === 0) {
      return [ALL_BENEFICIARY_OPTION];
    }

    const options = availableBeneficiaryTypes.map((type) => ({
      value: type,
      label: type,
    }));

    return [ALL_BENEFICIARY_OPTION, ...options];
  }, [availableBeneficiaryTypes]);

  useEffect(() => {
    const hasCurrent = beneficiaryOptions.some((option) => option.value === beneficiary?.value);
    if (!hasCurrent) {
      setBeneficiary(ALL_BENEFICIARY_OPTION);
    }
  }, [beneficiary, beneficiaryOptions]);

  const formatINR = (value: number) => Number(value || 0).toLocaleString('en-IN');


  useEffect(() => {
    const fetchConsolidatedData = async () => {
      if (!financialYear?.value) {
        setConsolidatedRows([]);
        setDetailsByHead({});
        return;
      }

      try {
        setLoading(true);
        setError('');

        const fiscalYearNum = Number.parseInt(financialYear.value.split('-')[0], 10);
        const beneficiaryType = beneficiary?.value === 'all' ? '' : beneficiary?.value || '';

        const response: any = await authenticityUtility.get('/adminbudget/consolidation', {
          params: {
            fiscalYear: fiscalYearNum,
            beneficiaryType,
            q: debouncedSearch,
            role: roleKey
          },
        });

        if (response?.data) {
          setConsolidatedRows(response.data.consolidatedRows || []);
          setDetailsByHead(response.data.detailsByHead || {});
          setAvailableBeneficiaryTypes(response.data.availableBeneficiaryTypes || []);
        } else {
          setConsolidatedRows([]);
          setDetailsByHead({});
          setAvailableBeneficiaryTypes([]);
        }

      } catch (fetchError: any) {
        console.error('Failed to fetch consolidated budgets', fetchError);
        setError(fetchError?.response?.data?.message || 'Failed to load consolidated budget data.');
        setConsolidatedRows([]);
        setDetailsByHead({});
      } finally {
        setLoading(false);
      }
    };

    fetchConsolidatedData();
  }, [financialYear?.value, roleKey, beneficiary?.value, debouncedSearch]);

  const canViewAmounts =
    roleKey === 'super_admin' ||
    roleKey === 'dof' ||
    roleKey === 'hod' ||
    roleKey === 'coordinator' ||
    roleKey === 'ithead';

  const rupeeSymbol = '\u20B9';

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