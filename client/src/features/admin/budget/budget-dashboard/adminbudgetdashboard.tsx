import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';

import { useAuth } from '../../../../contexts/AuthContext';
import authenticityUtility from '../../../../shared/utils/authenticityUtility';
import { hasPermission, isSuperAdmin } from '../../../../shared/utils/permissionUtils';
import AdminBudgetSummary from '../budget-summary/adminbudgetsummary';
import './adminbudgetdashboard.css';

type Option = {
  value: string;
  label: string;
  category?: 'Type' | 'Entity';
  id?: number | string;
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

  // Shared styles for react-select components to ensure UI consistency
  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '42px',
      borderRadius: '12px',
      borderColor: state.isFocused ? '#0069ab' : 'rgba(15, 23, 42, 0.18)',
      background: 'rgba(255, 255, 255, 0.92)',
      boxShadow: state.isFocused
        ? '0 0 0 4px rgba(0, 105, 171, 0.15), 0 10px 22px rgba(2, 6, 23, 0.08)'
        : '0 6px 18px rgba(2, 6, 23, 0.06)',
      borderWidth: '1px',
      fontFamily: 'inherit',
      fontSize: '0.95rem',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      '&:hover': {
        borderColor: state.isFocused ? '#0069ab' : 'rgba(15, 23, 42, 0.3)',
      },
    }),
    // Light grey, and hidden while disabled, like every placeholder (index.css).
    placeholder: (base: any, state: any) => ({
      ...base,
      color: state.isDisabled ? 'transparent' : 'var(--placeholder-color)',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: '#0f172a',
    }),
    menu: (base: any) => ({
      ...base,
      borderRadius: '12px',
      marginTop: '0px',
      overflow: 'hidden',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      zIndex: 999,
      border: '1px solid #eef2f6',
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected ? '#0069ab' : state.isFocused ? '#f1f5f9' : 'transparent',
      color: state.isSelected ? '#ffffff' : '#1e293b',
      padding: '10px 15px',
      fontSize: '0.9rem',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#0069ab',
      },
    }),
    groupHeading: (base: any) => ({
      ...base,
      fontSize: '0.72rem',
      fontWeight: 800,
      textTransform: 'uppercase',
      color: '#475569',
      backgroundColor: '#f1f5f9',
      padding: '8px 12px',
      margin: '0',
      borderBottom: '1px solid #e2e8f0',
      letterSpacing: '0.05em',
    }),
  };

  const [beneficiary, setBeneficiary] = useState<Option | null>(ALL_BENEFICIARY_OPTION);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [consolidatedRows, setConsolidatedRows] = useState<ConsolidatedRow[]>([]);
  const [detailsByHead, setDetailsByHead] = useState<Record<string, any[]>>({});
  const [availableBeneficiaryTypes, setAvailableBeneficiaryTypes] = useState<string[]>([]);
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedHead, setExpandedHead] = useState<string | null>(null);
  const [detailSubHeadFilter, setDetailSubHeadFilter] = useState('');

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

    if (
      roleCodes.some((code) => code.includes('dof')) ||
      hasPermission(user, 'budget.workflow.dof')
    ) {
      return 'dof';
    }

    if (roleCodes.some((code) => code.includes('coordinator'))) {
      return 'coordinator';
    }

    if (
      roleCodes.some(
        (code) => code.includes('ithead') || code.includes('it-head') || code.includes('it_head'),
      )
    ) {
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

  useEffect(() => {
    const fetchOrgUnits = async () => {
      try {
        const response: any = await authenticityUtility.get('/adminbudget/org-units');
        const units = response?.data?.data?.all || response?.data?.all || [];
        setOrgUnits(units);
      } catch (err) {
        console.error('Failed to fetch org units', err);
      }
    };
    fetchOrgUnits();
  }, []);

  const beneficiaryOptions: any[] = useMemo(() => {
    // Basic types if needed
    const typeOptions = availableBeneficiaryTypes.map((type) => ({
      value: type,
      label: type,
      category: 'Type',
    }));

    // Specific entities
    const entityGroups: Record<string, any[]> = {};
    orgUnits.forEach((unit) => {
      const type = unit.type_name || 'Other';
      if (!entityGroups[type]) entityGroups[type] = [];
      entityGroups[type].push({
        value: unit.name,
        label: unit.name,
        id: unit.id,
        category: 'Entity',
      });
    });

    // Role-based filtering
    if (roleKey === 'hod') {
      const userDepts = Array.isArray(user?.entity_roles)
        ? user.entity_roles
            .filter((er: any) => er.role_code === 'hod' && er.entity_type === 'DEPARTMENT')
            .map((er: any) => er.entity_name)
        : [];

      const filteredDepts = (entityGroups['Department'] || []).filter((opt) =>
        userDepts.includes(opt.value),
      );
      return [ALL_BENEFICIARY_OPTION, ...filteredDepts];
    }

    if (roleKey === 'coordinator') {
      const userEntities = Array.isArray(user?.entity_roles)
        ? user.entity_roles
            .filter((er: any) => er.role_code === 'coordinator')
            .map((er: any) => er.entity_name)
        : [];

      const allEntities = Object.values(entityGroups).flat();
      const filteredEntities = allEntities.filter((opt) => userEntities.includes(opt.value));
      return [ALL_BENEFICIARY_OPTION, ...filteredEntities];
    }

    // Super Admin / DoF / Principal / Admin - show everything grouped
    const groupedOptions = Object.keys(entityGroups)
      .sort()
      .map((group) => ({
        label: group,
        options: entityGroups[group].sort((a, b) => a.label.localeCompare(b.label)),
      }));

    return [ALL_BENEFICIARY_OPTION, ...groupedOptions];
  }, [availableBeneficiaryTypes, orgUnits, roleKey, user]);

  useEffect(() => {
    // Check if current beneficiary value exists in any of the options (flattens groups)
    const allOptions: Option[] = [];
    beneficiaryOptions.forEach((opt) => {
      if (opt.options) {
        allOptions.push(...opt.options);
      } else {
        allOptions.push(opt);
      }
    });

    const hasCurrent = allOptions.some((option) => option.value === beneficiary?.value);
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
        const beneficiaryType = beneficiary?.category === 'Type' ? beneficiary.value : '';
        const beneficiaryValue = beneficiary?.category === 'Entity' ? beneficiary.value : '';

        const response: any = await authenticityUtility.get('/adminbudget/consolidation', {
          params: {
            fiscalYear: fiscalYearNum,
            beneficiaryType,
            beneficiaryValue,
            q: debouncedSearch,
            scope: roleKey,
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
    `adminbudgetdashboard-details-${
      String(budgetHead || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'unknown'
    }`;
  const toggleBudgetHead = (budgetHead: string) => {
    setExpandedHead((prev) => (prev === budgetHead ? null : budgetHead));
  };

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
        { proposed: 0, approved: 0, initial: 0, additional: 0, expenditure: 0, balance: 0 },
      ),
    [consolidatedRows],
  );

  useEffect(() => {
    if (expandedHead && !detailsByHead[expandedHead]) {
      setExpandedHead(null);
    }
  }, [detailsByHead, expandedHead]);

  useEffect(() => {
    setDetailSubHeadFilter('');
  }, [expandedHead]);

  const filteredDetailsForExpandedHead = useMemo(() => {
    if (!expandedHead) return [];
    const rows = detailsByHead[expandedHead] || [];
    const query = detailSubHeadFilter.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((detail) =>
      String(detail?.subHead || '')
        .toLowerCase()
        .includes(query),
    );
  }, [detailsByHead, expandedHead, detailSubHeadFilter]);

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
                  <Select
                    options={financialYearOptions}
                    value={financialYear}
                    onChange={(option) => setFinancialYear(option as Option | null)}
                    styles={selectStyles}
                    isSearchable={false}
                    placeholder="Financial Year"
                    className="adminbudgetdashboard-react-select-container"
                  />
                </div>

                <div
                  className="adminbudgetdashboard-filter adminbudgetdashboard-filter--beneficiary"
                  style={{ minWidth: '240px' }}
                >
                  <Select
                    options={beneficiaryOptions}
                    value={beneficiary}
                    onChange={(option) => setBeneficiary(option)}
                    isSearchable
                    placeholder="Search Beneficiary..."
                    className="adminbudgetdashboard-react-select-container"
                    classNamePrefix="react-select"
                    styles={selectStyles}
                  />
                </div>

                <div className="adminbudgetdashboard-filter adminbudgetdashboard-filter--search">
                  <Form.Control
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
              {!loading && error && (
                <div className="adminbudgetdashboard-state adminbudgetdashboard-state--error">
                  {error}
                </div>
              )}

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
                          <th>Proposed</th>
                          <th>Approved</th>
                          <th>Expenditure</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedRows.map((row, idx) => {
                          const isSelected = expandedHead === row.budgetHead;
                          return (
                            <tr
                              key={`${row.budgetHead}-${idx}`}
                              className={`adminbudgetdashboard-row-clickable${isSelected ? ' adminbudgetdashboard-row-selected' : ''}`}
                              onClick={() => toggleBudgetHead(row.budgetHead)}
                              aria-selected={isSelected}
                            >
                              <td>{idx + 1}</td>
                              <td>
                                <button
                                  type="button"
                                  className="adminbudgetdashboard-row-toggle-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleBudgetHead(row.budgetHead);
                                  }}
                                  aria-expanded={isSelected}
                                  aria-controls={getDetailsPanelId(row.budgetHead)}
                                  aria-label={`Toggle details for ${row.budgetHead}`}
                                >
                                  <span>{row.budgetHead}</span>
                                </button>
                              </td>
                              <td>
                                {canViewAmounts ? `${rupeeSymbol}${formatINR(row.initial)}` : '--'}
                              </td>
                              <td>
                                {canViewAmounts
                                  ? `${rupeeSymbol}${formatINR(row.additional)}`
                                  : '--'}
                              </td>
                              <td>
                                {canViewAmounts ? `${rupeeSymbol}${formatINR(row.proposed)}` : '--'}
                              </td>
                              <td>
                                {canViewAmounts ? `${rupeeSymbol}${formatINR(row.approved)}` : '--'}
                              </td>
                              <td>
                                {canViewAmounts
                                  ? `${rupeeSymbol}${formatINR(row.expenditure)}`
                                  : '--'}
                              </td>
                              <td>
                                {canViewAmounts ? `${rupeeSymbol}${formatINR(row.balance)}` : '--'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="adminbudgetdashboard-total-row">
                          <td></td>
                          <td>
                            <strong>Total</strong>
                          </td>
                          <td>
                            <strong>
                              {canViewAmounts
                                ? `${rupeeSymbol}${formatINR(consolidatedTotals.initial)}`
                                : '--'}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {canViewAmounts
                                ? `${rupeeSymbol}${formatINR(consolidatedTotals.additional)}`
                                : '--'}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {canViewAmounts
                                ? `${rupeeSymbol}${formatINR(consolidatedTotals.proposed)}`
                                : '--'}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {canViewAmounts
                                ? `${rupeeSymbol}${formatINR(consolidatedTotals.approved)}`
                                : '--'}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {canViewAmounts
                                ? `${rupeeSymbol}${formatINR(consolidatedTotals.expenditure)}`
                                : '--'}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {canViewAmounts
                                ? `${rupeeSymbol}${formatINR(consolidatedTotals.balance)}`
                                : '--'}
                            </strong>
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
                  <div className="adminbudgetdashboard-detail-header">
                    <div className="adminbudgetdashboard-detail-title">{expandedHead}</div>
                    <input
                      type="text"
                      value={detailSubHeadFilter}
                      onChange={(event) => setDetailSubHeadFilter(event.target.value)}
                      className="adminbudgetdashboard-detail-filter-input"
                      placeholder="Filter by sub head..."
                    />
                  </div>
                  {(detailsByHead[expandedHead] || []).length > 0 ? (
                    <div className="adminbudgetdashboard-detail-table-wrapper">
                      <table className="adminbudgetdashboard-detail-table">
                        <thead>
                          <tr>
                            <th>Proposal ID</th>
                            <th>Applicant</th>
                            <th>Sub Head</th>
                            <th>Initial</th>
                            <th>Additional</th>
                            <th>Proposed</th>
                            <th>Approved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDetailsForExpandedHead.map((detail, index) => (
                            <tr key={`${expandedHead}-${detail.proposalId}-${index}`}>
                              <td style={{ fontWeight: 600, color: '#0069ab' }}>
                                {detail.proposalRef}
                              </td>
                              <td>{detail.applicantName}</td>
                              <td>{detail.subHead}</td>
                              <td>
                                {canViewAmounts
                                  ? `${rupeeSymbol}${formatINR(detail.initialAmount)}`
                                  : '--'}
                              </td>
                              <td>
                                {canViewAmounts
                                  ? `${rupeeSymbol}${formatINR(detail.additionalAmount)}`
                                  : '--'}
                              </td>
                              <td>
                                {canViewAmounts
                                  ? `${rupeeSymbol}${formatINR(detail.proposedAmount)}`
                                  : '--'}
                              </td>
                              <td>
                                {canViewAmounts
                                  ? `${rupeeSymbol}${formatINR(detail.approvedAmount)}`
                                  : '--'}
                              </td>
                            </tr>
                          ))}
                          {filteredDetailsForExpandedHead.length === 0 && (
                            <tr>
                              <td colSpan={7} className="adminbudgetdashboard-detail-empty">
                                No matching sub head found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="adminbudgetdashboard-state">
                      No approved proposals found for this budget head.
                    </div>
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
