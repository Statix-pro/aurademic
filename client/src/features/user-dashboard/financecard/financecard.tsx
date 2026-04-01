// client/src/features/user-dashboard/financecard/financecard.tsx
import React, { useEffect, useState } from 'react';
import './financecard.css';
import { Eye, Edit2, Briefcase, Clock, RotateCcw, XCircle, CheckCircle, Archive, Search, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import authenticityUtility from '../../../shared/utils/authenticityUtility';


interface FinanceCardItem {
  id: number;
  applicant_name: string;
  beneficiary_type: string;
  primary_head: string;
  budget_tag?: string;
  amount?: number;
  proposed_amount?: number | string | null;
  total_budget?: number | string | null;
  overall_status: string;
  workflow_status?: string;
  created_at: string;
  updated_at?: string;
  beneficiary_name?: string;
  beneficiary_value?: string;
  workflow_state?: {
    status: string;
    currentStage: string;
    isEditableByApplicant?: boolean;
  };
}

interface FinanceStatusUpdate {
  id: number;
  stage?: string | null;
  role?: string | null;
  status?: string | null;
  decision?: string | null;
  comment?: string | null;
  created_at?: string | null;
  user_name?: string | null;
  actor_role?: string | null;
}

const FinanceCard: React.FC = () => {
  const [data, setData] = useState<FinanceCardItem[]>([]);
  const [filteredData, setFilteredData] = useState<FinanceCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return String(month >= 4 ? year : year - 1);
  });
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [activeInfoId, setActiveInfoId] = useState<number | null>(null);
  const [loadingInfoId, setLoadingInfoId] = useState<number | null>(null);
  const [showFinanceStatusDetail, setShowFinanceStatusDetail] = useState<Record<number, boolean>>({});
  const [statusUpdatesById, setStatusUpdatesById] = useState<Record<number, FinanceStatusUpdate[]>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [data, selectedStatus, selectedFiscalYear, selectedBeneficiary, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, selectedFiscalYear, selectedBeneficiary, searchTerm, pageSize]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveInfoId(null);
      }
    };

    if (activeInfoId !== null) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeInfoId]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await authenticityUtility.get('/finance-requests?mine=true') as {
        status: string;
        data?: FinanceCardItem[];
      };
      setData(res.data || []);
    } catch (err) {
      console.error('Finance dashboard error', err);
    } finally {
      setLoading(false);
    }
  };

  const getFiscalYear = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return month >= 4 ? year : year - 1;
  };

  const getCurrentFiscalYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return String(month >= 4 ? year : year - 1);
  };

  const formatFiscalYearLabel = (startYear: string) =>
    `FY ${startYear}-${String(Number(startYear) + 1).slice(-2)}`;

  const getNormalizedStatus = (item: FinanceCardItem) => {
    const status = (item.workflow_state?.status || item.overall_status || '').toLowerCase();
    if (status === 'archived' || status === 'archive') return 'archived';
    if (status === 'returned') return 'returned';
    if (status === 'rejected') return 'rejected';
    if (status === 'completed' || status === 'approved') return 'approved';
    return 'pending';
  };

  const getFinanceTimelineState = (item: FinanceCardItem, stage: string) => {
    const normalizedStatus = getNormalizedStatus(item);
    const workflowStatus = String(item.workflow_state?.status || item.workflow_status || item.overall_status || '').toLowerCase();
    const currentStage = String(item.workflow_state?.currentStage || workflowStatus || '').toLowerCase();
    const stages = ['hod', 'dof', 'principal'];
    const stageIndex = stages.indexOf(stage);
    const currentIndex = stages.indexOf(currentStage);

    if (normalizedStatus === 'approved') {
      return 'completed';
    }

    if (normalizedStatus === 'rejected') {
      if (currentIndex >= 0 && stageIndex < currentIndex) return 'completed';
      if (currentIndex >= 0 && stageIndex === currentIndex) return 'rejected';
      if (currentIndex < 0 && stageIndex === 0) return 'rejected';
      return 'pending';
    }

    if (normalizedStatus === 'returned') {
      if (currentIndex >= 0 && stageIndex < currentIndex) return 'completed';
      if (currentIndex >= 0 && stageIndex === currentIndex) return 'current';
      if (currentIndex < 0 && stageIndex === 0) return 'current';
      return 'pending';
    }

    if (currentIndex >= 0 && stageIndex < currentIndex) return 'completed';
    if (currentIndex >= 0 && stageIndex === currentIndex) return 'current';
    if (currentIndex < 0 && stageIndex === 0) return 'current';
    return 'pending';
  };

  const getFinanceStatusLabel = (item: FinanceCardItem) => {
    const normalizedStatus = getNormalizedStatus(item);
    if (normalizedStatus === 'approved') return 'Approved';
    if (normalizedStatus === 'rejected') return 'Rejected';
    if (normalizedStatus === 'returned') return 'Returned';
    if (normalizedStatus === 'archived') return 'Archive';
    return 'Pending';
  };

  const getDisplayAmount = (item: FinanceCardItem) => {
    const rawAmount = item.amount ?? item.proposed_amount ?? item.total_budget ?? 0;
    const parsedAmount = Number(rawAmount);
    return Number.isFinite(parsedAmount) ? parsedAmount : 0;
  };

  const formatLabel = (value?: string | null) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '-';
    return normalized
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProposalRef = (item: FinanceCardItem) =>
    `#F-${new Date(item.created_at).getFullYear()}-${String(item.id).padStart(4, '0')}`;

  const buildFinanceLogEvents = (item: FinanceCardItem, updates: FinanceStatusUpdate[]) => {
    if (!updates.length) {
      return [{
        key: `created-${item.id}`,
        badge: 'SUBMITTED',
        title: 'Proposal created',
        actorLabel: 'Submitted By',
        actorValue: item.applicant_name,
        actorBadge: '',
        timestamp: item.created_at,
      }];
    }

    return updates.map((update, index) => {
      const decision = String(update.decision || update.status || '').toLowerCase();
      const stage = formatLabel(update.stage || update.role);
      const actorValue = update.user_name || update.actor_role || 'Workflow';
      const isSubmitted = index === 0 || decision.includes('submitted');
      const isReturned = decision.includes('returned');
      const isRejected = decision.includes('rejected');
      const isApproved = decision.includes('approved') || decision.includes('completed');

      let badge = 'UPDATED';
      let title = 'Proposal edited';
      let actorLabel = 'Updated By';

      if (isSubmitted) {
        badge = 'SUBMITTED';
        title = 'Proposal created';
        actorLabel = 'Submitted By';
      } else if (isReturned) {
        badge = 'RETURNED';
        title = 'Proposal returned';
      } else if (isRejected) {
        badge = 'REJECTED';
        title = 'Proposal rejected';
      } else if (isApproved) {
        badge = 'APPROVED';
        title = 'Proposal approved';
      }

      return {
        key: `${update.id}-${index}`,
        badge,
        title,
        actorLabel,
        actorValue,
        actorBadge: stage !== '-' ? stage : '',
        timestamp: update.created_at || item.created_at,
      };
    });
  };

  const fetchStatusUpdates = async (requestId: number) => {
    if (statusUpdatesById[requestId]) return;

    try {
      setLoadingInfoId(requestId);
      const response = await authenticityUtility.get(`/finance-requests/${requestId}/status-updates`) as {
        status: string;
        data?: FinanceStatusUpdate[];
      };

      setStatusUpdatesById((prev) => ({
        ...prev,
        [requestId]: response.status === 'success' ? (response.data || []) : [],
      }));
    } catch (error) {
      console.error('Failed to fetch finance status updates', error);
      setStatusUpdatesById((prev) => ({
        ...prev,
        [requestId]: [],
      }));
    } finally {
      setLoadingInfoId((prev) => (prev === requestId ? null : prev));
    }
  };

  const handleInfoClick = async (requestId: number) => {
    if (activeInfoId === requestId) {
      setActiveInfoId(null);
      return;
    }

    setActiveInfoId(requestId);
    await fetchStatusUpdates(requestId);
  };

  const handleViewClick = (requestId: number) => {
    navigate(`/finance/${requestId}`);
  };

  const canEditRequest = (item: FinanceCardItem) => {
    const workflowStatus = String(item.workflow_state?.status || item.workflow_status || '').toLowerCase();
    const normalizedStatus = getNormalizedStatus(item);

    return Boolean(item.workflow_state?.isEditableByApplicant) ||
      normalizedStatus === 'pending' ||
      normalizedStatus === 'returned' ||
      ['submitted', 'resubmitted', 're_submitted', 'returned'].includes(workflowStatus);
  };

  const handleEditClick = (item: FinanceCardItem) => {
    if (!canEditRequest(item)) return;
    navigate(`/finance/${item.id}/edit`);
  };

  const applyFilters = () => {
    let result = [...data];

    if (selectedStatus !== 'all') {
      result = result.filter(item => getNormalizedStatus(item) === selectedStatus);
    }

    if (selectedFiscalYear !== 'all') {
      result = result.filter(item => getFiscalYear(item.created_at).toString() === selectedFiscalYear);
    }

    if (selectedBeneficiary !== 'all') {
      result = result.filter(item => item.beneficiary_type === selectedBeneficiary);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => 
        (item.applicant_name?.toLowerCase() || '').includes(lowerSearch) ||
        (item.primary_head?.toLowerCase() || '').includes(lowerSearch)
      );
    }

    setFilteredData(result);
  };

  const stats = {
    total: data.length,
    pending: data.filter(item => getNormalizedStatus(item) === 'pending').length,
    returned: data.filter(item => getNormalizedStatus(item) === 'returned').length,
    rejected: data.filter(item => getNormalizedStatus(item) === 'rejected').length,
    approved: data.filter(item => getNormalizedStatus(item) === 'approved').length,
    archived: data.filter(item => getNormalizedStatus(item) === 'archived').length,
  };

  const statCards = [
    { key: 'all', label: 'Total', count: stats.total, icon: Briefcase },
    { key: 'pending', label: 'Pending', count: stats.pending, icon: Clock },
    { key: 'returned', label: 'Return', count: stats.returned, icon: RotateCcw },
    { key: 'rejected', label: 'Reject', count: stats.rejected, icon: XCircle },
    { key: 'approved', label: 'Approved', count: stats.approved, icon: CheckCircle },
    { key: 'archived', label: 'Archive', count: stats.archived, icon: Archive },
  ] as const;

  const currentFiscalYear = getCurrentFiscalYear();
  const fiscalYears = Array.from(
    new Set(data.map((item) => getFiscalYear(item.created_at).toString()).filter(Boolean))
  )
    .concat(currentFiscalYear)
    .filter((fy, index, array) => array.indexOf(fy) === index)
    .sort()
    .reverse();
  const beneficiaryTypes = Array.from(
    new Set(
      data
        .map((item) => item.beneficiary_type?.trim())
        .filter((type): type is string => Boolean(type))
    )
  ).sort();
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = filteredData.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredData.length);
  const paginatedData = filteredData.slice(pageStartIndex, pageEndIndex);
  const activeInfoItem = activeInfoId !== null ? data.find((item) => item.id === activeInfoId) ?? null : null;
  const activeStatusUpdates = activeInfoId !== null ? statusUpdatesById[activeInfoId] || [] : [];
  const activeLogEvents = activeInfoItem ? buildFinanceLogEvents(activeInfoItem, activeStatusUpdates) : [];
  const fiscalYearOptions = [
    ...fiscalYears.map((fy) => ({
      value: fy,
      label: formatFiscalYearLabel(fy),
    })),
    { value: 'all', label: 'All Years' },
  ];
  const beneficiaryTypeOptions = [
    { value: 'all', label: 'All Beneficiaries' },
    ...beneficiaryTypes.map((type) => ({
      value: type,
      label: type,
    })),
  ];
  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '46px',
      height: '46px',
      borderRadius: '12px',
      borderColor: state.isFocused ? '#0069ab' : '#d7dee8',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 105, 171, 0.12)' : 'none',
      backgroundColor: '#ffffff',
      fontSize: '0.95rem',
      cursor: 'pointer',
      '&:hover': {
        borderColor: '#c7d6e4',
      },
    }),
    valueContainer: (base: any) => ({
      ...base,
      padding: '0 14px',
    }),
    input: (base: any) => ({
      ...base,
      margin: 0,
      padding: 0,
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#334155',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: '#334155',
    }),
    indicatorsContainer: (base: any) => ({
      ...base,
      height: '44px',
    }),
    dropdownIndicator: (base: any, state: any) => ({
      ...base,
      color: state.isFocused ? '#0069ab' : '#708299',
      padding: '0 14px',
      transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 0.18s ease',
      '&:hover': {
        color: '#0069ab',
      },
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    menu: (base: any) => ({
      ...base,
      borderRadius: '12px',
      overflow: 'hidden',
      zIndex: 20,
      boxShadow: '0 14px 30px rgba(15, 23, 42, 0.12)',
    }),
    option: (base: any, state: any) => ({
      ...base,
      padding: '10px 14px',
      backgroundColor: state.isSelected
        ? '#0069ab'
        : state.isFocused
          ? 'rgba(0, 105, 171, 0.08)'
          : '#fff',
      color: state.isSelected ? '#fff' : '#334155',
      cursor: 'pointer',
    }),
  } as const;

  return (
    <>
      <section className="financecard-page">
        <div className="financecard-container">
          <div className="financecard-card">
            {/* HEADER & FILTERS */}
            <div className="financecard-header-single">
              <div className="header-left-section">
                <h5 className="financecard-title">Finance Requests</h5>
              </div>

              <div className="header-right-section">
                <div className="search-box">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search applicant or primary head..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && <XCircle size={16} className="clear-icon" onClick={() => setSearchTerm('')} />}
                </div>

                <div className="filter-group">
                  <div className="filter-item">
                    <Select
                      value={
                        fiscalYearOptions.find((option) => option.value === (selectedFiscalYear || currentFiscalYear)) ||
                        fiscalYearOptions.find((option) => option.value === currentFiscalYear) ||
                        fiscalYearOptions[0]
                      }
                      onChange={(option: any) => setSelectedFiscalYear(option?.value || currentFiscalYear)}
                      options={fiscalYearOptions}
                      isSearchable={false}
                      isClearable={false}
                      placeholder={formatFiscalYearLabel(currentFiscalYear)}
                      menuPlacement="auto"
                      styles={selectStyles}
                    />
                  </div>
                  <div className="filter-item">
                    <Select
                      value={beneficiaryTypeOptions.find((option) => option.value === selectedBeneficiary) || beneficiaryTypeOptions[0]}
                      onChange={(option: any) => setSelectedBeneficiary(option?.value || 'all')}
                      options={beneficiaryTypeOptions}
                      isSearchable={false}
                      isClearable={false}
                      placeholder="All Types"
                      menuPlacement="auto"
                      styles={selectStyles}
                    />
                  </div>
                </div>

                <button className="financecard-add-btn" onClick={() => navigate('/finance/new')}>
                  Add +
                </button>
              </div>
            </div>

            {/* STATS BAR */}
            <div className="financecard-stats-row-inside">
              {statCards.map(({ key, label, count, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={`stats-card ${selectedStatus === key ? 'active' : ''}`}
                  onClick={() => setSelectedStatus(key)}
                >
                  <div className="stats-icon-box">
                    <Icon size={20} />
                  </div>
                  <div className="stats-content">
                    <span className="stats-name">{label}</span>
                    <span className="stats-count">{count}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* CONTENT */}
            <div className="financecard-body">
              {loading && (
                <div className="financecard-state">Loading finance requests...</div>
              )}

              {!loading && filteredData.length === 0 && (
                <div className="financecard-state" style={{ padding: '60px 20px', fontSize: '15px' }}>
                  No finance requests found
                </div>
              )}

              {!loading && filteredData.length > 0 && (
                <div className="financecard-list-container">
                  {paginatedData.map((item) => {
                    const status = getNormalizedStatus(item);
                    const canEdit = canEditRequest(item);
                    const isStatusExpanded = Boolean(showFinanceStatusDetail[item.id]);
                    return (
                      <div key={item.id} className="financecard-item-card">
                        <div className="card-row-top">
                          <div className="card-header-left">
                            <span className="card-id-pill">#F-{new Date(item.created_at).getFullYear()}-{String(item.id).padStart(4, '0')}</span>
                            <span className="card-applicant-name">{item.applicant_name}</span>
                            <span className="card-category-tag">{item.budget_tag || item.beneficiary_type}</span>
                          </div>
                          
                          <div className="card-header-right">
                            <div className="card-amount-box">
                              <span className="amount-label">Proposed</span>
                              <span className="amount-value">Rs {getDisplayAmount(item).toLocaleString()}</span>
                            </div>
                            <div className="card-actions-main">
                              <button
                                type="button"
                                className="icon-btn-subtle financecard-info-trigger"
                                title="Info"
                                onClick={() => handleInfoClick(item.id)}
                              >
                                <Info size={18} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn-subtle"
                                title="View"
                                onClick={() => handleViewClick(item.id)}
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn-subtle"
                                title={canEdit ? 'Edit' : 'Edit unavailable in current status'}
                                onClick={() => handleEditClick(item)}
                                disabled={!canEdit}
                              >
                                <Edit2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="card-row-bottom">
                          <div className="card-row-middle">
                            <span className="beneficiary-label">Beneficiary :</span>
                            <span className="beneficiary-value">{item.beneficiary_name || item.beneficiary_value || item.applicant_name}</span>
                          </div>
                          <div className="card-footer-right">
                            <button
                              type="button"
                              className={`status-pill-solid status-${status} finance-status-pill ${isStatusExpanded ? 'finance-status-pill--active' : ''}`}
                              onClick={() => setShowFinanceStatusDetail((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))}
                              aria-expanded={isStatusExpanded}
                              aria-label={`Toggle workflow timeline for ${item.applicant_name}`}
                            >
                              {getFinanceStatusLabel(item)}
                            </button>
                            {isStatusExpanded && (
                              <div className="finance-status-detail-line">
                                {['hod', 'dof', 'principal'].map((stage, stageIndex, array) => {
                                  const stageState = getFinanceTimelineState(item, stage);
                                  return (
                                    <React.Fragment key={stage}>
                                      <div
                                        className={`finance-status-line-circle finance-status-circle-${stageState}`}
                                        title={stage.toUpperCase()}
                                      />
                                      {stageIndex < array.length - 1 && (
                                        <div className={`finance-status-line-connector finance-status-line-connector--${stageState}`} />
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!loading && filteredData.length > 0 && (
                <div className="financecard-pagination">
                  <div className="financecard-pagination-left">
                    <label className="financecard-pagination-label" htmlFor="financecard-page-size">
                      Rows per page
                    </label>
                    <select
                      id="financecard-page-size"
                      className="financecard-page-size"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="financecard-pagination-count">
                      {pageStartIndex + 1}-{pageEndIndex} of {filteredData.length}
                    </span>
                  </div>

                  <div className="financecard-pagination-right">
                    <button
                      type="button"
                      className="financecard-page-btn"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <span className="financecard-page-indicator">
                      Page {safeCurrentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="financecard-page-btn"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      {activeInfoItem && (
        <div className="financecard-log-overlay" onClick={() => setActiveInfoId(null)}>
          <div className="financecard-log-modal" onClick={(event) => event.stopPropagation()}>
            <div className="financecard-log-header">Submission Logs</div>
            <div className="financecard-log-body financecard-log-body-modal">
              <div className="financecard-log-summary">
                <div className="financecard-log-summary-row">
                  <span className="financecard-log-label">Proposal:</span>
                  <span className="financecard-log-value">{getProposalRef(activeInfoItem)}</span>
                </div>
                <div className="financecard-log-summary-row">
                  <span className="financecard-log-label">Last Edited:</span>
                  <span className="financecard-log-value">{formatDateTime(activeInfoItem.updated_at || activeInfoItem.created_at)}</span>
                </div>
              </div>

              <div className="financecard-log-timeline">
                {loadingInfoId === activeInfoItem.id ? (
                  <div className="financecard-log-empty">Loading updates...</div>
                ) : (
                  activeLogEvents.map((event) => (
                    <div key={event.key} className="financecard-log-entry financecard-log-entry-modal">
                      <div className="financecard-log-entry-top">
                        <div className="financecard-log-entry-title">
                          <span className={`financecard-log-badge financecard-log-badge--${event.badge.toLowerCase()}`}>
                            {event.badge}
                          </span>
                          <span className="financecard-log-title-text">{event.title}</span>
                        </div>
                        {event.actorBadge && (
                          <span className="financecard-log-stage-pill">★ {event.actorBadge}</span>
                        )}
                      </div>
                      <div className="financecard-log-actor-line">
                        <strong>{event.actorLabel}:</strong> {event.actorValue}
                      </div>
                      <div className="financecard-log-date financecard-log-date-right">
                        {formatDateTime(event.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="financecard-log-footer">
                <button
                  type="button"
                  className="financecard-log-close-btn"
                  onClick={() => setActiveInfoId(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FinanceCard;
