import { ChevronUp, ChevronDown } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';

import { useAuth } from '../../../../contexts/AuthContext';
import authenticityUtility from '../../../../shared/utils/authenticityUtility';
import { isSuperAdmin } from '../../../../shared/utils/permissionUtils';
import './adminpendingdashboard.css';

type Option = {
  value: string;
  label: string;
  category?: 'Type' | 'Entity';
  id?: number | string;
};

const ALL_BENEFICIARY_OPTION: Option = { value: 'all', label: 'All Beneficiary' };

type PendingCountRow = {
  beneficiary_type: string;
  department_id: number | null;
  beneficiary_entity_id: number | null;
  beneficiary_label: string;
  hod: number;
  hod_amount: number;
  dof: number;
  dof_amount: number;
  principal: number;
  principal_amount: number;
  chairman: number;
  chairman_amount: number;
};

type MasterBeneficiary = {
  key: string;
  beneficiaryLabel: string;
  beneficiaryTypeKey: string;
  beneficiaryTypeLabel: string;
};

const BENEFICIARY_TYPES = ['Department', 'Centre', 'Cell', 'Club', 'Section', 'Professional Body'];
const ENTITY_TYPE_TO_LABEL: Record<string, string> = {
  DEPARTMENT: 'Department',
  CENTRE: 'Centre',
  CELL: 'Cell',
  CLUB: 'Club',
  SECTION: 'Section',
  PROFESSIONAL_BODY: 'Professional Body',
  PROF_BODY: 'Professional Body',
};

const getCurrentFiscalYearOption = (): Option => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const fyStart = month >= 1 ? year : year - 1;
  const value = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  return { value, label: `FY ${value}` };
};

interface AdminPendingDashboardProps {
  type: 'finance' | 'budget' | 'expenditure';
  selectStyles: any;
}

const AdminPendingDashboard: React.FC<AdminPendingDashboardProps> = ({ type, selectStyles }) => {
  const { user } = useAuth();
  const rupeeSymbol = '\u20B9';
  const formatINR = (value: number) => Number(value || 0).toLocaleString('en-IN');

  const renderCellContent = (count: number, amount: number) => {
    if (count === 0) {
      return <span style={{ color: '#94a3b8' }}>0</span>;
    }
    return (
      <div className="pending-cell-content">
        <span className="pending-count" style={{ fontWeight: 600 }}>{count}</span>
        <span className="pending-amount" style={{ display: 'block', fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
          {rupeeSymbol}{formatINR(amount)}
        </span>
      </div>
    );
  };

  const [financialYear, setFinancialYear] = useState<Option | null>(getCurrentFiscalYearOption());
  const [beneficiary, setBeneficiary] = useState<Option | null>(ALL_BENEFICIARY_OPTION);
  const [searchText, setSearchText] = useState('');
  const [pendingData, setPendingData] = useState<PendingCountRow[]>([]);
  const [masterBeneficiaries, setMasterBeneficiaries] = useState<MasterBeneficiary[]>([]);
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAllExpanded, setIsAllExpanded] = useState(true);
  const [expandedByType, setExpandedByType] = useState<Record<string, boolean>>({});

  const roleKey = useMemo(() => {
    if (isSuperAdmin(user)) return 'super_admin';
    const roleCodes = Array.isArray(user?.roles)
      ? user.roles.map((r: any) => String(r?.role_code || r?.role_name || r).toLowerCase())
      : [];
    if (roleCodes.some((code) => code.includes('principal'))) return 'principal';
    if (roleCodes.some((code) => code.includes('dof'))) return 'dof';
    return 'admin';
  }, [user]);

  const userRoleLabel = useMemo(() => {
    switch (roleKey) {
      case 'super_admin':
        return 'Super Admin';
      case 'principal':
        return 'Principal';
      case 'dof':
        return 'DOF';
      default:
        return 'Admin';
    }
  }, [roleKey]);

  const financialYearOptions: Option[] = useMemo(() => {
    const currentOption = getCurrentFiscalYearOption();
    const currentStart = Number.parseInt(currentOption.value.split('-')[0], 10);
    return [currentStart - 2, currentStart - 1, currentStart].map((year) => ({
      value: `${year}-${String(year + 1).slice(2)}`,
      label: `FY ${year}-${String(year + 1).slice(2)}`,
    }));
  }, []);

  // Fetch Master Beneficiary Units
  useEffect(() => {
    const fetchMasterBeneficiaries = async () => {
      try {
        const response: any = await authenticityUtility.get('/adminbudget/org-units');
        const allRows = Array.isArray(response?.data?.all) ? response.data.all : [];
        const sourceRows =
          response?.data?.grouped && typeof response.data.grouped === 'object'
            ? Object.values(response.data.grouped).flat()
            : allRows;

        const rows = Array.isArray(sourceRows) ? sourceRows : [];
        setOrgUnits(rows);

        const next: MasterBeneficiary[] = [];
        const seen = new Set<string>();

        rows.forEach((unit: any) => {
          const rawType = String(unit?.type_code || '')
            .trim()
            .toUpperCase();
          const mappedTypeLabel = ENTITY_TYPE_TO_LABEL[rawType];
          if (!mappedTypeLabel || !BENEFICIARY_TYPES.includes(mappedTypeLabel)) return;

          const id = Number(unit?.id);
          if (!Number.isInteger(id) || id <= 0) return;

          const label = String(unit?.name || '').trim();
          if (!label) return;

          const typeKey = mappedTypeLabel.toLowerCase();
          const key = `${typeKey}::${id}`;
          if (seen.has(key)) return;
          seen.add(key);

          next.push({
            key,
            beneficiaryLabel: label,
            beneficiaryTypeKey: typeKey,
            beneficiaryTypeLabel: mappedTypeLabel,
          });
        });

        next.sort((a, b) => {
          const aType = BENEFICIARY_TYPES.indexOf(a.beneficiaryTypeLabel);
          const bType = BENEFICIARY_TYPES.indexOf(b.beneficiaryTypeLabel);
          if (aType !== bType) return aType - bType;
          return a.beneficiaryLabel.localeCompare(b.beneficiaryLabel);
        });

        setMasterBeneficiaries(next);
      } catch (fetchError) {
        console.error('Failed to fetch master beneficiary units', fetchError);
        setMasterBeneficiaries([]);
      }
    };

    fetchMasterBeneficiaries();
  }, []);

  // Fetch Pending Status Counts Data
  useEffect(() => {
    const fetchPendingCounts = async () => {
      if (!financialYear?.value) {
        setPendingData([]);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const fiscalYearNum = Number.parseInt(financialYear.value.split('-')[0], 10);
        const response: any = await authenticityUtility.get('/adminbudget/pending-status', {
          params: { fiscalYear: fiscalYearNum, type },
        });

        if (response?.success === false) {
          throw new Error(response?.message || 'Failed to fetch pending status data');
        }

        const data = Array.isArray(response?.data) ? response.data : [];
        setPendingData(data);
      } catch (err: any) {
        console.error('Failed to fetch pending counts data', err);
        setError(err?.response?.data?.message || 'Failed to load pending status counts.');
        setPendingData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingCounts();
  }, [financialYear?.value, type]);

  // Beneficiary Dropdown Filter Options
  const beneficiaryOptions: any[] = useMemo(() => {
    const entityGroups: Record<string, any[]> = {};
    orgUnits.forEach((unit) => {
      const unitTypeRaw = String(unit.type_code || '').toUpperCase();
      const type = ENTITY_TYPE_TO_LABEL[unitTypeRaw] || 'Other';
      if (!entityGroups[type]) entityGroups[type] = [];
      entityGroups[type].push({
        value: unit.name,
        label: unit.name,
        id: unit.id,
        category: 'Entity',
      });
    });

    const groupedOptions = Object.keys(entityGroups)
      .sort()
      .map((group) => ({
        label: group,
        options: entityGroups[group].sort((a, b) => a.label.localeCompare(b.label)),
      }));

    return [ALL_BENEFICIARY_OPTION, ...groupedOptions];
  }, [orgUnits]);

  // Map Pending counts to master list and filter/group
  const matchedPendingRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const isSearchMatch = (label: string) => {
      if (!query) return true;
      return label.toLowerCase().includes(query);
    };

    const isBeneficiaryMatch = (label: string) => {
      if (!beneficiary || beneficiary.value === 'all') return true;
      return label.toLowerCase() === beneficiary.value.toLowerCase();
    };

    // Index pending data by unique key for fast O(1) lookups
    const pendingMap = new Map<string, PendingCountRow>();
    pendingData.forEach((row) => {
      const typeKey = String(row.beneficiary_type || '').toLowerCase();
      const id = typeKey === 'department' ? row.department_id : row.beneficiary_entity_id;
      const key = id ? `${typeKey}::${id}` : `${typeKey}::${String(row.beneficiary_label || '').toLowerCase()}`;
      pendingMap.set(key, row);
    });

    return masterBeneficiaries
      .map((master) => {
        const match = pendingMap.get(master.key);
        return {
          ...master,
          hod: match ? Number(match.hod || 0) : 0,
          hod_amount: match ? Number(match.hod_amount || 0) : 0,
          dof: match ? Number(match.dof || 0) : 0,
          dof_amount: match ? Number(match.dof_amount || 0) : 0,
          principal: match ? Number(match.principal || 0) : 0,
          principal_amount: match ? Number(match.principal_amount || 0) : 0,
          chairman: match ? Number(match.chairman || 0) : 0,
          chairman_amount: match ? Number(match.chairman_amount || 0) : 0,
        };
      })
      .filter((row) => isSearchMatch(row.beneficiaryLabel) && isBeneficiaryMatch(row.beneficiaryLabel));
  }, [masterBeneficiaries, pendingData, searchText, beneficiary]);

  const allTypeRows = useMemo(() => {
    const grouped = new Map<string, any[]>();
    matchedPendingRows.forEach((row) => {
      const typeLabel = row.beneficiaryTypeLabel || 'Unknown';
      if (!grouped.has(typeLabel)) {
        grouped.set(typeLabel, []);
      }
      grouped.get(typeLabel)!.push(row);
    });

    return BENEFICIARY_TYPES.map((type) => ({
      type,
      rows: (grouped.get(type) || []).sort((a, b) =>
        a.beneficiaryLabel.localeCompare(b.beneficiaryLabel),
      ),
    })).filter((group) => group.rows.length > 0);
  }, [matchedPendingRows]);

  useEffect(() => {
    if (allTypeRows.length === 0) return;
    setExpandedByType((prev) => {
      const next: Record<string, boolean> = {};
      allTypeRows.forEach(({ type }) => {
        next[type] = prev[type] ?? isAllExpanded;
      });
      return next;
    });
  }, [allTypeRows, isAllExpanded]);

  const toggleAllSections = () => {
    const nextExpanded = !isAllExpanded;
    setIsAllExpanded(nextExpanded);
    const nextMap: Record<string, boolean> = {};
    allTypeRows.forEach(({ type }) => {
      nextMap[type] = nextExpanded;
    });
    setExpandedByType(nextMap);
  };

  const toggleSection = (type: string) => {
    setExpandedByType((prev) => {
      const next = { ...prev, [type]: !(prev[type] ?? isAllExpanded) };
      const allExpandedNow = allTypeRows.every(({ type: t }) => next[t]);
      setIsAllExpanded(allExpandedNow);
      return next;
    });
  };

  return (
    <div className="adminpendingdashboard-page">
      <div className="adminpendingdashboard-card">
        <div className="adminpendingdashboard-header">
          <div className="adminpendingdashboard-header-left">
            <h1 className="adminpendingdashboard-title">Pending Status</h1>
            <span className="adminpendingdashboard-role-pill">{userRoleLabel}</span>
          </div>
          <div className="adminpendingdashboard-header-right">
            <div className="adminpendingdashboard-filter adminpendingdashboard-filter--fy">
              <Form.Select
                value={financialYear?.value || ''}
                onChange={(e) => {
                  const selected =
                    financialYearOptions.find((option) => option.value === e.target.value) ||
                    null;
                  setFinancialYear(selected);
                }}
                className="adminpendingdashboard-select"
              >
                {financialYearOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="adminpendingdashboard-filter adminpendingdashboard-filter--beneficiary" style={{ minWidth: '240px' }}>
              <Select
                options={beneficiaryOptions}
                value={beneficiary}
                onChange={(option) => setBeneficiary(option)}
                isSearchable
                placeholder="Search Beneficiary..."
                className="adminpendingdashboard-react-select-container"
                classNamePrefix="react-select"
                styles={selectStyles}
              />
            </div>

            <div className="adminpendingdashboard-filter adminpendingdashboard-filter--collapse">
              <button
                type="button"
                className="adminpendingdashboard-toggle-btn"
                onClick={toggleAllSections}
              >
                {isAllExpanded ? (
                  <>
                    <ChevronUp size={18} /> Collapse All
                  </>
                ) : (
                  <>
                    <ChevronDown size={18} /> Expand All
                  </>
                )}
              </button>
            </div>

            <div className="adminpendingdashboard-filter adminpendingdashboard-filter--search">
              <Form.Control
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search Budget ID or Applicant"
                className="adminpendingdashboard-search"
              />
            </div>
          </div>
        </div>

        <div className="adminpendingdashboard-body">
          {loading && <div className="adminpendingdashboard-state">Loading...</div>}
          {!loading && error && (
            <div className="adminpendingdashboard-state adminpendingdashboard-state--error">
              {error}
            </div>
          )}

          {!loading && !error && allTypeRows.length > 0 && (
            <div className="adminpendingdashboard-table-section">
              {allTypeRows.map(({ type: groupType, rows }) => {
                const isExpanded = expandedByType[groupType] ?? isAllExpanded;
                return (
                  <div key={groupType} className="adminpendingdashboard-type-section">
                    <div className="adminpendingdashboard-type-header">
                      <h3>
                        {groupType} ({rows.length})
                      </h3>
                      <button
                        type="button"
                        className="adminpendingdashboard-section-toggle-btn"
                        onClick={() => toggleSection(groupType)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={16} /> Collapse
                          </>
                        ) : (
                          <>
                            <ChevronDown size={16} /> Expand
                          </>
                        )}
                      </button>
                    </div>

                    <div className="adminpendingdashboard-table-wrapper">
                      <table className="adminpendingdashboard-table">
                        {isExpanded && (
                          <thead>
                            <tr>
                              <th>S.No</th>
                              <th>Beneficiary</th>
                              <th>Hod</th>
                              <th>Dof</th>
                              <th>Principal</th>
                              <th>Chairman</th>
                            </tr>
                          </thead>
                        )}
                        {isExpanded && (
                          <tbody>
                            {rows.map((row, idx) => (
                              <tr key={row.key}>
                                <td>{idx + 1}</td>
                                <td>{row.beneficiaryLabel}</td>
                                <td>{renderCellContent(row.hod, row.hod_amount)}</td>
                                <td>{renderCellContent(row.dof, row.dof_amount)}</td>
                                <td>{renderCellContent(row.principal, row.principal_amount)}</td>
                                <td>{renderCellContent(row.chairman, row.chairman_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        )}
                        <tfoot>
                          <tr className="adminpendingdashboard-type-total-row">
                            <td></td>
                            <td>
                              <strong>Total</strong>
                            </td>
                            <td>
                              <strong>
                                {renderCellContent(
                                  rows.reduce((sum, r) => sum + r.hod, 0),
                                  rows.reduce((sum, r) => sum + r.hod_amount, 0),
                                )}
                              </strong>
                            </td>
                            <td>
                              <strong>
                                {renderCellContent(
                                  rows.reduce((sum, r) => sum + r.dof, 0),
                                  rows.reduce((sum, r) => sum + r.dof_amount, 0),
                                )}
                              </strong>
                            </td>
                            <td>
                              <strong>
                                {renderCellContent(
                                  rows.reduce((sum, r) => sum + r.principal, 0),
                                  rows.reduce((sum, r) => sum + r.principal_amount, 0),
                                )}
                              </strong>
                            </td>
                            <td>
                              <strong>
                                {renderCellContent(
                                  rows.reduce((sum, r) => sum + r.chairman, 0),
                                  rows.reduce((sum, r) => sum + r.chairman_amount, 0),
                                )}
                              </strong>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !error && allTypeRows.length === 0 && (
            <div className="adminpendingdashboard-state">No pending status data found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPendingDashboard;
