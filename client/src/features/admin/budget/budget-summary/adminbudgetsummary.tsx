import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useAuth } from '../../../../contexts/AuthContext';
import { hasPermission, isSuperAdmin } from '../../../../shared/utils/permissionUtils';
import authenticityUtility from '../../../../shared/utils/authenticityUtility';
import './adminbudgetsummary.css';

type Option = {
  value: string;
  label: string;
};

type AdminProposalGroup = {
  id: number;
  proposalRef: string;
  status: string;
  beneficiaryType: string;
  beneficiaryValue?: string;
  departmentName?: string;
  createdAt: string;
  applicantName: string;
  proposedAmount: number;
  approvedAmount: number;
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

const DEFAULT_APPROVED_STATUSES = ['principal_approved', 'completed'];

const BENEFICIARY_TYPES = ['Department', 'Centre', 'Cell', 'Club', 'Professional Body'];
const BENEFICIARY_TYPE_TO_ENTITY_API_TYPE: Record<string, string> = {
  Department: 'DEPARTMENT',
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  'Professional Body': 'PROFESSIONAL_BODY',
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
  const [orgUnitsByType, setOrgUnitsByType] = useState<Record<string, string[]>>({});
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

  const canAccessSummary =
    roleKey === 'super_admin' ||
    roleKey === 'principal' ||
    roleKey === 'admin' ||
    roleKey === 'dof' ||
    roleKey === 'hod' ||
    roleKey === 'coordinator' ||
    roleKey === 'ithead';

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
        const endpoint = '/adminbudget/admin';
        const pageSize = 100;
        const fullList: any[] = [];
        let page = 1;

        while (true) {
          const response: any = await authenticityUtility.get(endpoint, {
            params: { page, limit: pageSize, status: '', fiscalYear: fiscalYearNum, scope: roleKey },
          });

          if (response?.success === false) {
            throw new Error(response?.message || 'Failed to fetch admin budgets');
          }

          const pageRows = Array.isArray(response?.data) ? response.data : [];
          if (pageRows.length === 0) {
            break;
          }

          fullList.push(...pageRows);

          const pagination = response?.pagination || {};
          const totalPages = Number(pagination.pages || pagination.totalPages || pagination.total_pages || 0);
          if (Number.isInteger(totalPages) && totalPages > 0) {
            if (page >= totalPages) break;
            page += 1;
            continue;
          }

          if (pageRows.length < pageSize) {
            break;
          }

          page += 1;
        }

        if (!fullList.length) {
          setProposals([]);
          return;
        }

        const fullProposals = fullList.map((item: any) => {
          const proposedAmount = Number.parseFloat(item.total_amount ?? 0);
          const approvedAmount = Number.parseFloat(item.approved_total_amount ?? 0);

          return {
            id: Number(item.id),
            proposalRef: item.proposal_ref || '',
            status: item.status || '',
            beneficiaryType: item.beneficiary_type || '',
            beneficiaryValue: item.beneficiary_value || '',
            departmentName: item.department || '',
            createdAt: item.created_date || item.created_at || '',
            applicantName:
              item.applicant_name ||
              item.user_name ||
              item.user_email ||
              '',
            proposedAmount: Number.isFinite(proposedAmount) ? proposedAmount : 0,
            approvedAmount: Number.isFinite(approvedAmount) ? approvedAmount : 0,
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

  const allowedStatuses = useMemo(() => {
    if (roleKey === 'hod' || roleKey === 'coordinator') {
      return ['level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed'];
    }
    if (roleKey === 'ithead') {
      return ['ithead_approved', 'dof_approved', 'principal_approved', 'completed'];
    }
    if (roleKey === 'dof') {
      return ['dof_approved', 'principal_approved', 'completed'];
    }
    return DEFAULT_APPROVED_STATUSES;
  }, [roleKey]);

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

  const orgUnitLabelMap = useMemo(() => {
    const labelMap = new Map<string, string>();
    for (const [type, names] of Object.entries(orgUnitsByType)) {
      const typeKey = normalizeText(type).toLowerCase();
      for (const name of Array.isArray(names) ? names : []) {
        const normalizedName = normalizeText(name);
        if (!normalizedName) continue;
        labelMap.set(`${typeKey}::${normalizedName.toLowerCase()}`, normalizedName);
      }
    }
    return labelMap;
  }, [orgUnitsByType]);

  const beneficiarySummaryRows = useMemo(() => {
    const summaryMap: Record<string, BeneficiarySummaryRow> = {};
    const query = normalizeText(searchText).toLowerCase();
    const isMetadataSearchMatch = (label: string) => !query || normalizeText(label).toLowerCase().includes(query);
    const isProposalSearchMatch = (proposal: AdminProposalGroup, label: string) => {
      if (!query) return true;
      const proposalRef = normalizeText(proposal.proposalRef).toLowerCase();
      const applicantName = normalizeText(proposal.applicantName).toLowerCase();
      const proposalId = String(proposal?.id ?? '').toLowerCase();
      const beneficiaryLabel = normalizeText(label).toLowerCase();
      return (
        proposalRef.includes(query)
        || applicantName.includes(query)
        || proposalId.includes(query)
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

    // Seed every known org-unit so entities with no requests still appear as zero rows.
    Object.entries(orgUnitsByType).forEach(([typeLabel, names]) => {
      const normalizedTypeLabel = normalizeText(typeLabel) || 'Unknown';
      const typeKey = normalizedTypeLabel.toLowerCase();

      (Array.isArray(names) ? names : []).forEach((name) => {
        const normalizedName = normalizeText(name);
        if (!normalizedName) return;
        if (!isMetadataSearchMatch(normalizedName)) return;
        const key = `${typeKey}::${normalizedName.toLowerCase()}`;
        ensureRow(key, normalizedName, typeKey, normalizedTypeLabel);
      });
    });

    const resolveBeneficiaryMeta = (proposal: AdminProposalGroup) => {
      const proposalType = normalizeText(proposal.beneficiaryType).toLowerCase();
      const isFacultyOrStaff = proposalType === 'faculty' || proposalType === 'staff';
      const rawType = isFacultyOrStaff ? 'Department' : normalizeText(proposal.beneficiaryType);
      const rawName = isFacultyOrStaff
        ? normalizeText(proposal.departmentName) || normalizeText(proposal.beneficiaryValue)
        : normalizeText(proposal.beneficiaryValue);
      const typeKey = (rawType || 'Unknown').toLowerCase();
      const typeLabel = rawType || 'Unknown';
      const normalizedName = rawName.toLowerCase();
      const key = rawName ? `${typeKey}::${normalizedName}` : `${typeKey}::__unknown__`;
      const labelFromMetadata = rawName ? orgUnitLabelMap.get(`${typeKey}::${normalizedName}`) : null;
      const fallbackLabel = rawName || `Unknown ${titleCase(typeLabel)}`;
      const label = labelFromMetadata || fallbackLabel;

      return { key, typeKey, typeLabel, label };
    };

    proposedProposals.forEach((proposal) => {
      const { key, typeKey, typeLabel, label } = resolveBeneficiaryMeta(proposal);
      if (!isProposalSearchMatch(proposal, label)) return;
      ensureRow(key, label, typeKey, typeLabel);
      summaryMap[key].proposed += Number(proposal.proposedAmount || 0);
    });

    approvedProposals.forEach((proposal) => {
      const { key, typeKey, typeLabel, label } = resolveBeneficiaryMeta(proposal);
      if (!isProposalSearchMatch(proposal, label)) return;
      ensureRow(key, label, typeKey, typeLabel);

      const isInitial = isInitialBudgetProposal(proposal.createdAt, financialYear?.value || '');
      const approvedAmount = Number(proposal.approvedAmount || 0);
      summaryMap[key].approved += approvedAmount;
      if (isInitial) {
        summaryMap[key].initial += approvedAmount;
      } else {
        summaryMap[key].additional += approvedAmount;
      }
    });

    return Object.values(summaryMap).map((row) => ({
      ...row,
      balance: row.initial + row.additional - row.expenditure,
    }));
  }, [approvedProposals, financialYear?.value, orgUnitLabelMap, orgUnitsByType, proposedProposals, searchText]);

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
    const preferredOrder = BENEFICIARY_TYPES.map((type) => type.toLowerCase());
    return [...grouped.entries()]
      .map(([type, rows]) => ({
        type,
        rows: rows.sort((a, b) => a.beneficiaryLabel.localeCompare(b.beneficiaryLabel)),
      }))
      .sort((a, b) => {
        const aIdx = preferredOrder.indexOf(a.type.toLowerCase());
        const bIdx = preferredOrder.indexOf(b.type.toLowerCase());
        const aRank = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx;
        const bRank = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx;
        if (aRank !== bRank) return aRank - bRank;
        return a.type.localeCompare(b.type);
      });
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

              <div className="adminbudgetsummary-filter adminbudgetsummary-filter--beneficiary">
                <button
                  type="button"
                  className="adminbudgetsummary-toggle-btn"
                  onClick={toggleAllSections}
                >
                  {isAllExpanded ? 'Collapse All' : 'Expand All'}
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
                      >
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                    <div className="adminbudgetsummary-table-wrapper">
                      <table className="adminbudgetsummary-table">
                        {isExpanded && (
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
                        )}
                        {isExpanded && (
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
                        )}
                        <tfoot>
                          <tr className="adminbudgetsummary-type-total-row">
                            <td></td>
                            <td><strong>{type} Total</strong></td>
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
                );
              });
            })()}
            {allTypeRows.length > 0 && (
              <table className="adminbudgetsummary-grand-table">
                <tbody>
                  <tr>
                    <td></td>
                    <td><strong>GRAND TOTAL</strong></td>
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
        )}


          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBudgetSummary;
