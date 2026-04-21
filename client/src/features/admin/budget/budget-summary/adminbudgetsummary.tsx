import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useAuth } from '../../../../contexts/AuthContext';
import { hasPermission, isSuperAdmin } from '../../../../shared/utils/permissionUtils';
import authenticityUtility from '../../../../shared/utils/authenticityUtility';
import { ChevronUp, ChevronDown } from 'lucide-react';
import './adminbudgetsummary.css';

type Option = {
  value: string;
  label: string;
};

type AdminProposalGroup = {
  id: number;
  beneficiaryType: string;
  departmentName?: string;
  departmentId?: number | null;
  beneficiaryEntityId?: number | null;
  beneficiaryLabel?: string;
  proposedAmount: number;
  approvedAmount: number;
  initialAmount: number;
  additionalAmount: number;
  expenditureAmount: number;
  balanceAmount: number;
};

type BeneficiarySummaryRow = {
  beneficiaryKey: string;
  beneficiaryLabel: string;
  beneficiaryTypeKey: string;
  beneficiaryTypeLabel: string;
  proposed: number;
  approved: number;
  initial: number;
  additional: number;
  expenditure: number;
  balance: number;
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

type MasterBeneficiary = {
  key: string;
  beneficiaryLabel: string;
  beneficiaryTypeKey: string;
  beneficiaryTypeLabel: string;
};

const getCurrentFiscalYearOption = (): Option => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const fyStart = month >= 1 ? year : year - 1;
  const value = `${fyStart}-${String(fyStart + 1).slice(2)}`;
  return { value, label: `FY ${value}` };
};

const AdminBudgetSummary: React.FC = () => {
  const { user } = useAuth();
  const [financialYear, setFinancialYear] = useState<Option | null>(getCurrentFiscalYearOption());
  const [searchText, setSearchText] = useState('');
  const [proposals, setProposals] = useState<AdminProposalGroup[]>([]);
  const [masterBeneficiaries, setMasterBeneficiaries] = useState<MasterBeneficiary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAllExpanded, setIsAllExpanded] = useState(true);
  const [expandedByType, setExpandedByType] = useState<Record<string, boolean>>({});

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

  const canAccessSummary = roleKey === 'super_admin' || roleKey === 'dof';

  const userRoleLabel = useMemo(() => {
    switch (roleKey) {
      case 'super_admin':
        return 'Super Admin';
      case 'principal':
        return 'Principal';
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
    const currentStart = Number.parseInt(currentOption.value.split('-')[0], 10);
    return [currentStart - 2, currentStart - 1, currentStart].map((year) => ({
      value: `${year}-${String(year + 1).slice(2)}`,
      label: `FY ${year}-${String(year + 1).slice(2)}`,
    }));
  }, []);

  const formatINR = (value: number) => Number(value || 0).toLocaleString('en-IN');

  useEffect(() => {
    const fetchMasterBeneficiaries = async () => {
      if (!canAccessSummary) {
        setMasterBeneficiaries([]);
        return;
      }

      try {
        const response: any = await authenticityUtility.get('/adminbudget/org-units');
        const grouped = response?.data?.grouped;
        const allRows = Array.isArray(response?.data?.all) ? response.data.all : [];
        const sourceRows =
          grouped && typeof grouped === 'object'
            ? Object.values(grouped).flatMap((rows: any) => (Array.isArray(rows) ? rows : []))
            : allRows;

        const rows = Array.isArray(sourceRows) ? sourceRows : [];
        const next: MasterBeneficiary[] = [];
        const seen = new Set<string>();

        rows.forEach((unit: any) => {
          const rawType = String(unit?.type_code || '').trim().toUpperCase();
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
  }, [canAccessSummary]);

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
        const response: any = await authenticityUtility.get('/adminbudget/annual-summary', {
          params: { fiscalYear: fiscalYearNum, scope: roleKey, q: '' },
        });

        if (response?.success === false) {
          throw new Error(response?.message || 'Failed to fetch annual summary rows');
        }

        const fullList = Array.isArray(response?.data) ? response.data : [];

        if (!fullList.length) {
          setProposals([]);
          return;
        }

        const fullProposals = fullList.map((item: any) => {
          const proposedAmount = Number.parseFloat(item.proposed_total_amount ?? 0);
          const approvedAmount = Number.parseFloat(item.approved_total_amount ?? 0);
          const initialAmount = Number.parseFloat(item.initial_total_amount ?? 0);
          const additionalAmount = Number.parseFloat(item.additional_total_amount ?? 0);
          const expenditureAmount = Number.parseFloat(item.expenditure_total_amount ?? 0);
          const balanceAmount = Number.parseFloat(item.balance_total_amount ?? (initialAmount + additionalAmount - expenditureAmount));

          return {
            id: Number(item.id),
            beneficiaryType: item.beneficiary_type || '',
            departmentName: item.department || '',
            departmentId: Number.isInteger(Number(item.department_id)) ? Number(item.department_id) : null,
            beneficiaryEntityId: Number.isInteger(Number(item.beneficiary_entity_id))
              ? Number(item.beneficiary_entity_id)
              : null,
            beneficiaryLabel: item.beneficiary_label || '',
            proposedAmount: Number.isFinite(proposedAmount) ? proposedAmount : 0,
            approvedAmount: Number.isFinite(approvedAmount) ? approvedAmount : 0,
            initialAmount: Number.isFinite(initialAmount) ? initialAmount : 0,
            additionalAmount: Number.isFinite(additionalAmount) ? additionalAmount : 0,
            expenditureAmount: Number.isFinite(expenditureAmount) ? expenditureAmount : 0,
            balanceAmount: Number.isFinite(balanceAmount) ? balanceAmount : 0,
          } as AdminProposalGroup;
        });
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

  const approvedProposals = proposals;
  const proposedProposals = proposals;

  const normalizeText = (value?: string) => String(value || '').trim();
  const titleCase = (value: string) => {
    const raw = normalizeText(value);
    if (!raw) return 'Unknown';
    return raw
      .toLowerCase()
      .split(' ')
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
      .join(' ');
  };

  const beneficiarySummaryRows = useMemo(() => {
    const summaryMap: Record<string, BeneficiarySummaryRow> = {};
    const query = normalizeText(searchText).toLowerCase();
    const isProposalSearchMatch = (proposal: AdminProposalGroup, label: string) => {
      if (!query) return true;
      const proposalId = String(proposal?.id ?? '').toLowerCase();
      const beneficiaryLabel = normalizeText(label).toLowerCase();
      return (
        proposalId.includes(query)
        || beneficiaryLabel.includes(query)
      );
    };

    const ensureRow = (key: string, label: string, typeKey: string, typeLabel: string) => {
      if (!summaryMap[key]) {
        summaryMap[key] = {
          beneficiaryKey: key,
          beneficiaryLabel: label,
          beneficiaryTypeKey: typeKey,
          beneficiaryTypeLabel: typeLabel,
          proposed: 0,
          approved: 0,
          initial: 0,
          additional: 0,
          expenditure: 0,
          balance: 0,
        };
      }
    };

    const resolveBeneficiaryMeta = (proposal: AdminProposalGroup) => {
      const proposalType = normalizeText(proposal.beneficiaryType).toLowerCase();
      const isFacultyOrStaff = proposalType === 'faculty' || proposalType === 'staff';
      const rawType = normalizeText(proposal.beneficiaryType);
      const typeLabel = isFacultyOrStaff || proposalType === 'department'
        ? 'Department'
        : (rawType ? titleCase(rawType) : 'Unknown');
      const typeKey = typeLabel.toLowerCase();

      const beneficiaryId = isFacultyOrStaff || typeKey === 'department'
        ? Number(proposal.departmentId || 0)
        : Number(proposal.beneficiaryEntityId || 0);

      const label = normalizeText(proposal.beneficiaryLabel)
        || (isFacultyOrStaff
          ? normalizeText(proposal.departmentName)
          : '')
        || `Unknown ${titleCase(typeLabel)}`;

      const key = beneficiaryId > 0
        ? `${typeKey}::${beneficiaryId}`
        : `${typeKey}::${label.toLowerCase()}`;

      return { key, typeKey, typeLabel, label };
    };

    masterBeneficiaries.forEach((master) => {
      const labelMatch = !query || master.beneficiaryLabel.toLowerCase().includes(query);
      if (!labelMatch) return;
      ensureRow(
        master.key,
        master.beneficiaryLabel,
        master.beneficiaryTypeKey,
        master.beneficiaryTypeLabel
      );
    });

    proposedProposals.forEach((proposal) => {
      const { key, typeKey, typeLabel, label } = resolveBeneficiaryMeta(proposal);
      if (!isProposalSearchMatch(proposal, label)) return;
      ensureRow(key, label, typeKey, typeLabel);
      summaryMap[key].proposed += Number(proposal.proposedAmount || 0);
      summaryMap[key].initial += Number(proposal.initialAmount || 0);
      summaryMap[key].additional += Number(proposal.additionalAmount || 0);
      summaryMap[key].expenditure += Number(proposal.expenditureAmount || 0);
      summaryMap[key].balance += Number(proposal.balanceAmount || 0);
    });

    approvedProposals.forEach((proposal) => {
      const { key, typeKey, typeLabel, label } = resolveBeneficiaryMeta(proposal);
      if (!isProposalSearchMatch(proposal, label)) return;
      ensureRow(key, label, typeKey, typeLabel);
      const approvedAmount = Number(proposal.approvedAmount || 0);
      summaryMap[key].approved += approvedAmount;
    });
    return Object.values(summaryMap);
  }, [approvedProposals, proposedProposals, searchText, masterBeneficiaries]);

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

  const allTypeRows = useMemo(() => {
    const grouped = new Map<string, BeneficiarySummaryRow[]>();
    beneficiarySummaryRows.forEach((row) => {
      const typeLabel = row.beneficiaryTypeLabel || 'Unknown';
      if (!grouped.has(typeLabel)) {
        grouped.set(typeLabel, []);
      }
      grouped.get(typeLabel)!.push(row);
    });
    const preferredTypes = BENEFICIARY_TYPES.map((type) => ({
      type,
      rows: (grouped.get(type) || []).sort((a, b) => a.beneficiaryLabel.localeCompare(b.beneficiaryLabel)),
    }));
    const remainingTypes = [...grouped.entries()]
      .filter(([type]) => !BENEFICIARY_TYPES.includes(type))
      .map(([type, rows]) => ({
        type,
        rows: rows.sort((a, b) => a.beneficiaryLabel.localeCompare(b.beneficiaryLabel)),
      }))
      .sort((a, b) => a.type.localeCompare(b.type));

    return [...preferredTypes, ...remainingTypes];
  }, [beneficiarySummaryRows]);

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

  const rupeeSymbol = '\u20B9';

  return (
    <div className="adminbudgetsummary-page">
      <div className="adminbudgetsummary-container">
        <div className="adminbudgetsummary-card">
          <div className="adminbudgetsummary-header">
            <div className="adminbudgetsummary-header-left">
              <h1 className="adminbudgetsummary-title">Consolidated Summary</h1>
              <span className="adminbudgetsummary-role-pill">
                {userRoleLabel}
              </span>
            </div>
            <div className="adminbudgetsummary-header-right">
              <div className="adminbudgetsummary-filter adminbudgetsummary-filter--fy">
                <Form.Select
                  value={financialYear?.value || ''}
                  onChange={(e) => {
                    const selected = financialYearOptions.find((option) => option.value === e.target.value) || null;
                    setFinancialYear(selected);
                  }}
                  className="adminbudgetsummary-select"
                >
                  {financialYearOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </div>

              <div className="adminbudgetsummary-filter adminbudgetsummary-filter--collapse">
                <button
                  type="button"
                  className="adminbudgetsummary-toggle-btn"
                  onClick={toggleAllSections}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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

              <div className="adminbudgetsummary-filter adminbudgetsummary-filter--search">
                <Form.Control
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
          <div className="adminbudgetsummary-table-section">
            {(() => {
              let globalIndex = 0;
              return allTypeRows.map(({ type, rows }) => {
                const isExpanded = expandedByType[type] ?? isAllExpanded;
                return (
                  <div key={type} className="adminbudgetsummary-type-section">
                    <div className="adminbudgetsummary-type-header">
                      <h3>{type} ({rows.length})</h3>
                      <button
                        type="button"
                        className="adminbudgetsummary-section-toggle-btn"
                        onClick={() => toggleSection(type)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
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
                    <div className="adminbudgetsummary-table-wrapper">
                      <table className="adminbudgetsummary-table">
                        {isExpanded && (
                          <thead>
                            <tr>
                              <th>S.No</th>
                              <th>Beneficiary</th>
                              <th>Initial</th>
                              <th>Additional</th>
                              <th>Proposed</th>
                              <th>Approved</th>
                              <th>Expenditure</th>
                              <th>Balance</th>
                            </tr>
                          </thead>
                        )}
                        {isExpanded && (
                          <tbody>
                            {rows.map((row) => {
                              globalIndex += 1;
                              return (
                                <tr key={row.beneficiaryKey}>
                                  <td>{globalIndex}</td>
                                  <td>{row.beneficiaryLabel}</td>
                                  <td>{rupeeSymbol}{formatINR(row.initial)}</td>
                                  <td>{rupeeSymbol}{formatINR(row.additional)}</td>
                                  <td>{rupeeSymbol}{formatINR(row.proposed)}</td>
                                  <td>{rupeeSymbol}{formatINR(row.approved)}</td>
                                  <td>{rupeeSymbol}{formatINR(row.expenditure)}</td>
                                  <td>{rupeeSymbol}{formatINR(row.balance)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        )}
                        <tfoot>
                          <tr className="adminbudgetsummary-type-total-row">
                            <td></td>
                            <td><strong>{type} Total</strong></td>
                            <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.initial, 0))}</strong></td>
                            <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.additional, 0))}</strong></td>
                            <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.proposed, 0))}</strong></td>
                            <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.approved, 0))}</strong></td>
                            <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.expenditure, 0))}</strong></td>
                            <td><strong>{rupeeSymbol}{formatINR(rows.reduce((sum, r) => sum + r.balance, 0))}</strong></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              });
            })()}
            {allTypeRows.length > 0 && (
              <table className="adminbudgetsummary-grand-table">
                <tbody>
                  <tr>
                    <td></td>
                    <td><strong>GRAND TOTAL</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.initial)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.additional)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.proposed)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.approved)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.expenditure)}</strong></td>
                    <td><strong>{rupeeSymbol}{formatINR(summaryTotals.balance)}</strong></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}


          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBudgetSummary;
