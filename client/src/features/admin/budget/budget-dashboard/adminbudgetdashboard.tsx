import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useAuth } from '../../../../contexts/AuthContext';
import { hasPermission, isSuperAdmin } from '../../../../shared/utils/permissionUtils';
import authenticityUtility from '../../../../shared/utils/authenticityUtility';
import AdminBudgetSummary from '../budget-summary/adminbudgetsummary';
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
  proposed: number;
  approved: number;
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
  const [activeTab, setActiveTab] = useState<'budget-head' | 'beneficiary-summary'>('budget-head');
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

    if (roleCodes.some((code) => code.includes('principal'))) {
      return 'principal';
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

  const canAccessBeneficiarySummary = roleKey === 'super_admin' || roleKey === 'dof';

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
            scope: roleKey
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
    roleKey === 'principal' ||
    roleKey === 'admin' ||
    roleKey === 'dof' ||
    roleKey === 'hod' ||
    roleKey === 'coordinator' ||
    roleKey === 'ithead';

  const rupeeSymbol = '\u20B9';
  const getDetailsPanelId = (budgetHead: string) =>
    `adminbudgetdashboard-details-${String(budgetHead || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'unknown'}`;

  const consolidatedTotals = useMemo(
    () =>
      consolidatedRows.reduce(
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
    [consolidatedRows]
  );

  useEffect(() => {
    if (expandedHead && !detailsByHead[expandedHead]) {
      setExpandedHead(null);
    }
  }, [detailsByHead, expandedHead]);

  useEffect(() => {
    if (!canAccessBeneficiarySummary && activeTab === 'beneficiary-summary') {
      setActiveTab('budget-head');
    }
  }, [canAccessBeneficiarySummary, activeTab]);

  return (
    <div className="adminbudgetdashboard-page">
      <div className="adminbudgetdashboard-container">
        {canAccessBeneficiarySummary && (
          <div className="adminbudgetdashboard-tabs-wrap">
            <div className="category-toggle-container adminbudgetdashboard-tab-toggle">
              <button
                type="button"
                className={activeTab === 'budget-head' ? 'active' : ''}
                onClick={() => setActiveTab('budget-head')}
              >
                Budget Head
              </button>
              <button
                type="button"
                className={activeTab === 'beneficiary-summary' ? 'active' : ''}
                onClick={() => setActiveTab('beneficiary-summary')}
              >
                Beneficiary Summary
              </button>
            </div>
          </div>
        )}

        {activeTab === 'budget-head' ? (
          <div className="adminbudgetdashboard-card">
            <div className="adminbudgetdashboard-header">
              <div className="adminbudgetdashboard-header-left">
                <h1 className="adminbudgetdashboard-title">Consolidated Budget</h1>
                <span className="adminbudgetdashboard-role-pill">{userRoleLabel}</span>
              </div>
              <div className="adminbudgetdashboard-header-right">
                <div className="adminbudgetdashboard-filter adminbudgetdashboard-filter--fy">
                  <Form.Select
                    value={financialYear?.value || ''}
                    onChange={(e) => {
                      const option = financialYearOptions.find(opt => opt.value === e.target.value);
                      if (option) setFinancialYear(option);
                    }}
                    className="adminbudgetdashboard-select"
                  >
                    {financialYearOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                <div className="adminbudgetdashboard-filter adminbudgetdashboard-filter--beneficiary">
                  <Form.Select
                    value={beneficiary?.value || 'all'}
                    onChange={(e) => {
                      const option = beneficiaryOptions.find(opt => opt.value === e.target.value);
                      if (option) setBeneficiary(option);
                    }}
                    className="adminbudgetdashboard-select"
                  >
                    {beneficiaryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                <div className="adminbudgetdashboard-filter adminbudgetdashboard-filter--search">
                  <Form.Control
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search Budget ID or Applicant"
                    className="adminbudgetdashboard-search-input"
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
                          <th>Proposed</th>
                          <th>Approved</th>
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
                          >
                            <td>{idx + 1}</td>
                            <td>
                              <button
                                type="button"
                                className="adminbudgetdashboard-row-toggle-btn"
                                onClick={() =>
                                  setExpandedHead((prev) => (prev === row.budgetHead ? null : row.budgetHead))
                                }
                                aria-expanded={expandedHead === row.budgetHead}
                                aria-controls={getDetailsPanelId(row.budgetHead)}
                                aria-label={`Toggle details for ${row.budgetHead}`}
                              >
                                <span>{row.budgetHead}</span>
                              </button>
                            </td>
                            <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(row.proposed)}` : '--'}</td>
                            <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(row.approved)}` : '--'}</td>
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
                            <strong>{canViewAmounts ? `${rupeeSymbol}${formatINR(consolidatedTotals.proposed)}` : '--'}</strong>
                          </td>
                          <td>
                            <strong>{canViewAmounts ? `${rupeeSymbol}${formatINR(consolidatedTotals.approved)}` : '--'}</strong>
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
                <div
                  className="adminbudgetdashboard-detail-section"
                  id={getDetailsPanelId(expandedHead)}
                >
                  <div className="adminbudgetdashboard-detail-title">{expandedHead}</div>
                  {(detailsByHead[expandedHead] || []).length > 0 ? (
                    <div className="adminbudgetdashboard-detail-table-wrapper">
                      <table className="adminbudgetdashboard-detail-table">
                        <thead>
                          <tr>
                            <th>S.No</th>
                            <th>Applicant</th>
                            <th>Sub Head</th>
                            <th>Proposed</th>
                            <th>Approved</th>
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
                              <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(detail.proposedAmount)}` : '--'}</td>
                              <td>{canViewAmounts ? `${rupeeSymbol}${formatINR(detail.approvedAmount)}` : '--'}</td>
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
        ) : (
          <AdminBudgetSummary />
        )}
      </div>
    </div>
  );
};

export default AdminBudgetDashboard;
