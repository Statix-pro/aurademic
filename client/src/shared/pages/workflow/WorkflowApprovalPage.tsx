import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Clock, RotateCcw, XCircle, Eye, Info, Edit2, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import authenticityUtility from '../../utils/authenticityUtility';
import {
  WorkflowApprovalModuleConfig,
  WorkflowDecision,
  WorkflowMeta,
  WorkflowQueueResult,
  WorkflowTimelineItem,
} from '../../workflow/workflowApprovalTypes';
import './WorkflowApprovalPage.css';

const DEFAULT_DECISIONS: WorkflowDecision[] = ['approved', 'returned', 'rejected'];
const DEFAULT_FEEDBACK_REQUIRED: WorkflowDecision[] = ['returned', 'rejected'];

const BENEFICIARY_OPTIONS = [
  "All Beneficiary",
  "Faculty",
  "Staff",
  "Department",
  "Centre",
  "Cell",
  "Club",
  "Professional Body",
  "Institution",
  "Association",
];

// Map beneficiary type to tag
const getTagFromBeneficiary = (beneficiaryType: string): string => {
  if (!beneficiaryType) return '';
  
  const type = beneficiaryType.toLowerCase().trim();
  
  if (type === 'faculty' || type === 'staff') {
    return 'Skilling';
  }
  if (type === 'association') {
    return 'Association';
  }
  if (type === 'department') {
    return 'Association'; // Change this to whatever tag you want for Department
  }
  if (type === 'centre' || type === 'cell' || type === 'club' || type === 'professional body' || type === 'institution') {
    return 'Essentials';
  }
  
  return '';
};

const formatStageLabel = (stage: string, labels: Record<string, string> = {}) => {
  const normalized = String(stage || '').trim().toLowerCase();
  if (!normalized) return '-';

  if (labels[normalized]) {
    return labels[normalized];
  }

  return normalized
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const defaultQueueMapper = (response: any): WorkflowQueueResult => ({
  items: Array.isArray(response?.data) ? response.data : [],
  total: Number(response?.pagination?.total || 0),
  page: Number(response?.pagination?.page || 1),
  limit: Number(response?.pagination?.limit || 20),
});

const defaultTimelineMapper = (response: any): WorkflowTimelineItem[] =>
  Array.isArray(response?.data) ? response.data : [];

const formatProposalRef = (record: Record<string, any>) => {
  const createdAt = record?.created_at ? new Date(record.created_at) : null;
  const year = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.getFullYear()
    : new Date().getFullYear();
  const id = Number(record?.id);
  if (!Number.isFinite(id)) return '-';
  return `#F-${year}-${String(id).padStart(4, '0')}`;
};

interface WorkflowApprovalPageProps {
  config: WorkflowApprovalModuleConfig;
}

const WorkflowApprovalPage: React.FC<WorkflowApprovalPageProps> = ({ config }) => {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<WorkflowMeta | null>(null);
  const [activeStage, setActiveStage] = useState<string>('');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(config.queueDefaultLimit || 20);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'total' | 'pending' | 'approved' | 'returned' | 'rejected' | 'archived'>('pending');
  const [actingRecordId, setActingRecordId] = useState<number | string | null>(null);
  const [logPopupOpen, setLogPopupOpen] = useState(false);
  const [logEntries, setLogEntries] = useState<WorkflowTimelineItem[]>([]);
  const [logRef, setLogRef] = useState<string>('');
  const [logLoading, setLogLoading] = useState(false);
  const [archivingIds, setArchivingIds] = useState<Set<number | string>>(new Set());
  
  // Action popups
  const [actionPopupOpen, setActionPopupOpen] = useState(false);
  const [actionType, setActionType] = useState<'return' | 'reject' | null>(null);
  const [actionId, setActionId] = useState<number | string | null>(null);
  const [actionRef, setActionRef] = useState<string>("");
  const [actionComment, setActionComment] = useState<string>("");
  const [actionStage, setActionStage] = useState<string>("");

  // Filter states
  const [fiscalYear, setFiscalYear] = useState<number>(() => {
    const d = new Date();
    return d.getMonth() < 1 ? d.getFullYear() - 1 : d.getFullYear();
  });
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<string>("All Beneficiary");

  const permittedStages = useMemo(() => meta?.permittedStages || [], [meta]);

  const getRecordId = useCallback(
    (record: Record<string, any>) => {
      const value = config.getRecordId ? config.getRecordId(record) : record.id;
      return value;
    },
    [config]
  );

  const getMetaEndpoint = useCallback(
    () => (config.getMetaEndpoint ? config.getMetaEndpoint() : `${config.apiBasePath}/workflow/meta`),
    [config]
  );

  const getQueueEndpoint = useCallback(
    (stage: string) => (config.getQueueEndpoint ? config.getQueueEndpoint(stage) : `${config.apiBasePath}/queue/${stage}`),
    [config]
  );

  const getApprovalEndpoint = useCallback(
    (id: number | string) => (config.getApprovalEndpoint ? config.getApprovalEndpoint(id) : `${config.apiBasePath}/${id}/approval`),
    [config]
  );

  const getTimelineEndpoint = useCallback(
    (id: number | string) => (config.getTimelineEndpoint ? config.getTimelineEndpoint(id) : `${config.apiBasePath}/${id}/timeline`),
    [config]
  );

  const getArchiveEndpoint = useCallback(
    (id: number | string) => `${config.apiBasePath}/${id}/archive-toggle`,
    [config]
  );

  const mapQueueResponse = config.mapQueueResponse || defaultQueueMapper;
  const mapTimelineResponse = config.mapTimelineResponse || defaultTimelineMapper;

  const getRecordProposalRef = useCallback((record: Record<string, any>) => {
    return record.proposal_ref || formatProposalRef(record);
  }, []);

  const getRecordCurrentStage = useCallback((record: Record<string, any>) => {
    return String(record.workflow_state?.currentStage || record.workflow_stage || '').toLowerCase();
  }, []);

  // Enhanced approved status detection for current stage
  const isApprovedForCurrentStage = useCallback(
    (record: Record<string, any>) => {
      const status = String(record.workflow_status || record.status || '').toLowerCase();
      const currentStage = activeStage?.toLowerCase() || '';
      
      const approvedStatusMap: Record<string, string[]> = {
        level1: ['level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed', 'approved'],
        hod: ['level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed', 'approved'],
        coordinator: ['level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed', 'approved'],
        ithead: ['ithead_approved', 'dof_approved', 'principal_approved', 'completed', 'approved'],
        dof: ['dof_approved', 'principal_approved', 'completed', 'approved'],
        principal: ['principal_approved', 'completed', 'approved'],
      };
      
      const approvedStates = approvedStatusMap[currentStage] || ['completed', 'approved'];
      
      return approvedStates.some(state => 
        status === state || status.startsWith(state) || status.includes(state)
      );
    },
    [activeStage]
  );

  // Properly categorize item status
  const resolveStatusCategory = useCallback((record: Record<string, any>) => {
    const token = String(record.workflow_status || record.status || '').toLowerCase();
    
    if (token.includes('archived') || token.includes('archive')) return 'archived';
    if (token.includes('rejected')) return 'rejected';
    if (token.includes('returned') || token.includes('return')) return 'returned';
    
    if (isApprovedForCurrentStage(record)) return 'approved';
    
    return 'pending';
  }, [isApprovedForCurrentStage]);

  const isVisibleInWorkflowList = useCallback(
    (record: Record<string, any>, stage: string) => {
      const category = resolveStatusCategory(record);
      if (category === 'approved' || category === 'returned' || category === 'rejected' || category === 'archived') {
        return true;
      }

      return getRecordCurrentStage(record) === String(stage || '').toLowerCase();
    },
    [getRecordCurrentStage, resolveStatusCategory]
  );

  const loadMeta = useCallback(async () => {
    const response = await authenticityUtility.get(getMetaEndpoint());
    if (response?.data) {
      const payload: WorkflowMeta = response.data;
      setMeta(payload);
      const initialStage = Array.isArray(payload.permittedStages) ? payload.permittedStages[0] : '';
      setActiveStage((prev) => prev || initialStage || '');
      return;
    }

    setMeta(null);
    setActiveStage('');
  }, [getMetaEndpoint]);

  const loadQueue = useCallback(
    async (stage: string, requestedPage = 1) => {
      if (!stage) {
        setRows([]);
        setTotalRows(0);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const endpoint = getQueueEndpoint(stage);
        const response = await authenticityUtility.get(endpoint, {
          params: {
            page: requestedPage,
            limit,
            workflowStatus: 'all',
            fiscalYear,
            ...(beneficiaryFilter !== 'All Beneficiary' ? { beneficiaryType: beneficiaryFilter } : {}),
            ...(searchTerm ? { q: searchTerm } : {}),
          },
        });

        const mapped = mapQueueResponse(response);

        let items = Array.isArray(mapped.items) ? mapped.items : [];
        items = items.filter((item) => isVisibleInWorkflowList(item, stage));

        if (beneficiaryFilter !== 'All Beneficiary') {
          items = items.filter(item => {
            const itemBeneficiaryType = (item.beneficiary_type || item.beneficiaryType || '').toLowerCase();
            return itemBeneficiaryType === beneficiaryFilter.toLowerCase();
          });
        }

        setRows(items);
        setTotalRows(items.length);
        setPage(Math.min(Math.max(Number(requestedPage || 1), 1), Math.max(1, Math.ceil(items.length / limit) || 1)));
        setLimit(Number(mapped.limit || limit || config.queueDefaultLimit || 20));
      } catch (queueError: any) {
        setRows([]);
        setTotalRows(0);
        setError(queueError?.response?.data?.message || queueError?.message || 'Failed to load queue');
      } finally {
        setLoading(false);
      }
    },
    [
      getQueueEndpoint,
      isVisibleInWorkflowList,
      limit,
      mapQueueResponse,
      fiscalYear,
      beneficiaryFilter,
      searchTerm,
    ]
  );

  const fetchFullTimeline = useCallback(async (id: number | string, ref: string) => {
    setLogLoading(true);
    setLogRef(ref);
    setLogPopupOpen(true);
    try {
      const response = await authenticityUtility.get(getTimelineEndpoint(id));
      const mapped = mapTimelineResponse(response);
      setLogEntries(mapped);
    } catch (error) {
      console.error('Failed to fetch timeline:', error);
      setLogEntries([]);
    } finally {
      setLogLoading(false);
    }
  }, [getTimelineEndpoint, mapTimelineResponse]);

  useEffect(() => {
    loadMeta().catch((metaError: any) => {
      setError(metaError?.response?.data?.message || metaError?.message || 'Failed to load workflow metadata');
      setLoading(false);
    });
  }, [loadMeta]);

  useEffect(() => {
    if (!activeStage) return;
    loadQueue(activeStage, page).catch((queueError: any) => {
      setError(queueError?.response?.data?.message || queueError?.message || 'Failed to load queue');
      setLoading(false);
    });
  }, [activeStage, loadQueue, page, fiscalYear, beneficiaryFilter, searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [activeStage, fiscalYear, beneficiaryFilter, searchTerm]);

  const onApprove = async (recordId?: number | string, stage?: string) => {
    if (!recordId) {
      window.alert("Missing record id.");
      return;
    }

    if (!window.confirm("Are you sure you want to approve this item?")) return;

    setActingRecordId(recordId);
    setError('');
    try {
      const response: any = await authenticityUtility.patch(getApprovalEndpoint(recordId), {
        decision: "approved",
      });

      if (response?.success || response?.data?.success) {
        setPage(1);
        await loadQueue(activeStage, 1);
        window.alert("Approved successfully");
      } else {
        window.alert(response?.message || response?.data?.message || "Failed to approve");
      }
    } catch (approvalError: any) {
      window.alert(approvalError?.response?.data?.message || "Failed to approve");
    } finally {
      setActingRecordId(null);
    }
  };

  const openActionPopup = (type: "return" | "reject", id: number | string, ref: string, stage: string) => {
    setActionType(type);
    setActionId(id);
    setActionRef(ref);
    setActionComment("");
    setActionStage(stage);
    setActionPopupOpen(true);
  };

  const closeActionPopup = () => {
    setActionPopupOpen(false);
    setActionType(null);
    setActionId(null);
    setActionRef("");
    setActionComment("");
    setActionStage("");
  };

  const submitActionWithComment = async () => {
    if (!actionType || !actionId) return;

    const comment = actionComment.trim();
    if (!comment) {
      window.alert("Please enter comments.");
      return;
    }

    setActingRecordId(actionId);
    setError('');
    try {
      const response: any = await authenticityUtility.patch(getApprovalEndpoint(actionId), {
        decision: actionType === "return" ? "returned" : "rejected",
        feedback: comment,
      });

      if (response?.success || response?.data?.success) {
        window.alert(`${actionType === "return" ? "Returned" : "Rejected"} successfully`);
        closeActionPopup();
        setPage(1);
        await loadQueue(activeStage, 1);
      } else {
        window.alert(response?.message || response?.data?.message || `Failed to ${actionType}`);
      }
    } catch (approvalError: any) {
      window.alert(approvalError?.response?.data?.message || `Failed to ${actionType}`);
    } finally {
      setActingRecordId(null);
    }
  };

  const getDisplayStatus = useCallback((record: Record<string, any>) => {
    const status = String(record.workflow_status || record.status || '').toLowerCase();
    const category = resolveStatusCategory(record);
    
    if (category === 'archived') return 'Archived';
    if (category === 'rejected') return 'Reject';
    if (category === 'returned') return 'Return';
    if (category === 'approved') {
      if (status === 'level1_approved') return 'Approved Level-1';
      if (status === 'hod_approved') return 'Approved HOD';
      if (status === 'ithead_approved') return 'Approved IT Head';
      if (status === 'dof_approved') return 'Approved DoF';
      if (status === 'principal_approved') return 'Approved Principal';
      if (status === 'completed') return 'Completed';
      if (status === 'approved') return 'Approved';
      return 'Approved';
    }
    
    const stage = formatStageLabel(String(record.workflow_stage || ''), config.stageLabels);
    return `Pending ${stage}`;
  }, [resolveStatusCategory, config.stageLabels]);

  const statusStats = useMemo(() => {
    const stats = { total: rows.length, pending: 0, approved: 0, returned: 0, rejected: 0, archived: 0 };
    for (const row of rows) {
      const category = resolveStatusCategory(row);
      stats[category] += 1;
    }
    return stats;
  }, [rows, resolveStatusCategory]);

  const filteredRows = useMemo(() => {
    let filtered = rows;
    
    if (statusFilter !== 'total') {
      filtered = filtered.filter(record => resolveStatusCategory(record) === statusFilter);
    }
    
    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((record) => {
        const beneficiaryType = record.beneficiary_type || record.beneficiaryType || '';
        const tag = getTagFromBeneficiary(beneficiaryType);
        const searchable = [
          record.id,
          record.applicant_name,
          beneficiaryType,
          record.proposal_ref,
          tag,
        ]
          .map((value) => String(value || '').toLowerCase())
          .join(' ');
        return searchable.includes(query);
      });
    }
    
    return filtered;
  }, [rows, searchTerm, statusFilter, resolveStatusCategory]);

  const paginatedRows = useMemo(() => {
    const startIndex = Math.max(0, (page - 1) * (limit || 20));
    return filteredRows.slice(startIndex, startIndex + (limit || 20));
  }, [filteredRows, limit, page]);

  const totalPages = Math.max(1, Math.ceil((filteredRows.length || 0) / (limit || 20)));

  const formatAmount = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return value || '-';
    return `₹ ${num.toLocaleString('en-IN')}`;
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'approved': return 'adminbudget-status adminbudget-status--approved';
      case 'rejected': return 'adminbudget-status adminbudget-status--rejected';
      case 'returned': return 'adminbudget-status adminbudget-status--returned';
      case 'archived': return 'adminbudget-status adminbudget-status--archived';
      default: return 'adminbudget-status adminbudget-status--pending';
    }
  };

  const closeLogPopup = () => {
    setLogPopupOpen(false);
    setLogEntries([]);
    setLogRef('');
  };

  const handleArchiveToggle = async (record: Record<string, any>) => {
    const recordId = getRecordId(record);
    if (recordId === undefined || recordId === null) {
      setError('Unable to process this row because record id is missing.');
      return;
    }

    const isArchived = resolveStatusCategory(record) === 'archived';
    const confirmMessage = isArchived
      ? 'Are you sure you want to unarchive this item?'
      : 'Are you sure you want to archive this item?';

    if (!window.confirm(confirmMessage)) return;

    setArchivingIds((prev) => {
      const next = new Set(prev);
      next.add(recordId);
      return next;
    });

    try {
      await authenticityUtility.patch(getArchiveEndpoint(recordId), {});
      setPage(1);
      await loadQueue(activeStage, 1);
    } catch (archiveError: any) {
      setError(archiveError?.response?.data?.message || archiveError?.message || 'Failed to archive/unarchive item');
    } finally {
      setArchivingIds((prev) => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  };

  const filteredColumns = useMemo(() => {
    return config.columns.filter(column => 
      column.key !== 'applicant_name' && 
      column.key !== 'id' && 
      column.key !== 'total_budget' &&
      column.key !== 'amount' &&
      column.key !== 'total_amount' &&
      column.key !== 'status' &&
      column.key !== 'workflow_status' &&
      column.key !== 'stage' &&
      column.key !== 'workflow_stage'
    );
  }, [config.columns]);

  return (
    <div className="adminbudget-page">
      <div className="adminbudget-container">
        <div className="adminbudget-card">
          <div className="adminbudget-header">
            <h5 className="adminbudget-title">{config.title}</h5>

            {permittedStages.length > 0 && (
              <div className="adminbudget-role-tabs" role="tablist">
                {permittedStages.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    className={`adminbudget-role-tab ${activeStage === stage ? 'active' : ''}`}
                    onClick={() => setActiveStage(stage)}
                    role="tab"
                    aria-selected={activeStage === stage}
                  >
                    {formatStageLabel(stage, config.stageLabels)}
                  </button>
                ))}
              </div>
            )}

            <div className="adminbudget-header-actions">
              <select
                className="adminbudget-control"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                title="Fiscal Year"
              >
                {[2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>
                    FY {year}-{String(year + 1).slice(2)}
                  </option>
                ))}
              </select>

              <select
                className="adminbudget-control"
                value={beneficiaryFilter}
                onChange={(e) => setBeneficiaryFilter(e.target.value)}
                title="Beneficiary"
              >
                {BENEFICIARY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <input
                className="adminbudget-control"
                type="text"
                placeholder="Search ID or Applicant Name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="adminbudget-stats">
            <div
              className={`adminbudget-stats-card total ${statusFilter === 'total' ? 'active' : ''}`}
              onClick={() => setStatusFilter('total')}
            >
              <span className="adminbudget-stats-icon"><Briefcase size={18} /></span>
              <div className="adminbudget-stats-text">
                <span className="adminbudget-stats-label">Total</span>
                <span className="adminbudget-stats-number">{totalRows || statusStats.total}</span>
              </div>
            </div>
            <div
              className={`adminbudget-stats-card pending ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              <span className="adminbudget-stats-icon"><Clock size={18} /></span>
              <div className="adminbudget-stats-text">
                <span className="adminbudget-stats-label">Pending</span>
                <span className="adminbudget-stats-number">{statusStats.pending}</span>
              </div>
            </div>
            <div
              className={`adminbudget-stats-card returned ${statusFilter === 'returned' ? 'active' : ''}`}
              onClick={() => setStatusFilter('returned')}
            >
              <span className="adminbudget-stats-icon"><RotateCcw size={18} /></span>
              <div className="adminbudget-stats-text">
                <span className="adminbudget-stats-label">Return</span>
                <span className="adminbudget-stats-number">{statusStats.returned}</span>
              </div>
            </div>
            <div
              className={`adminbudget-stats-card rejected ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              <span className="adminbudget-stats-icon"><XCircle size={18} /></span>
              <div className="adminbudget-stats-text">
                <span className="adminbudget-stats-label">Reject</span>
                <span className="adminbudget-stats-number">{statusStats.rejected}</span>
              </div>
            </div>
            <div
              className={`adminbudget-stats-card approved ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              <span className="adminbudget-stats-icon"><CheckCircle2 size={18} /></span>
              <div className="adminbudget-stats-text">
                <span className="adminbudget-stats-label">Approved</span>
                <span className="adminbudget-stats-number">{statusStats.approved}</span>
              </div>
            </div>
            <div
              className={`adminbudget-stats-card archived ${statusFilter === 'archived' ? 'active' : ''}`}
              onClick={() => setStatusFilter('archived')}
            >
              <span className="adminbudget-stats-icon"><Archive size={18} /></span>
              <div className="adminbudget-stats-text">
                <span className="adminbudget-stats-label">Archive</span>
                <span className="adminbudget-stats-number">{statusStats.archived}</span>
              </div>
            </div>
          </div>

          <div className="adminbudget-body">
            {error && <div className="adminbudget-state">{error}</div>}

            {loading ? (
              <div className="adminbudget-state">Loading workflow items...</div>
            ) : filteredRows.length === 0 ? (
              <div className="adminbudget-state">No workflow items found</div>
            ) : (
              <>
                <div className="adminbudget-cards-container">
                  {paginatedRows.map((record, rowIndex) => {
                    const recordId = getRecordId(record) ?? `row-${rowIndex}`;
                    const timelineKey = String(recordId);
                    const statusCategory = resolveStatusCategory(record);
                    const isPending = statusCategory === 'pending' && getRecordCurrentStage(record) === activeStage.toLowerCase();
                    const isArchived = statusCategory === 'archived';
                    const proposedAmount = record.total_amount || record.total_budget || record.amount || 0;
                    const approvedAmount = record.approved_total_amount || record.approved_amount || null;
                    const showApprovedAmount = approvedAmount !== null && approvedAmount !== undefined && approvedAmount !== 0;
                    const proposalRef = getRecordProposalRef(record);
                    
                    // Get tag based on beneficiary type
                    const beneficiaryType = record.beneficiary_type || record.beneficiaryType || '';
                    const tag = getTagFromBeneficiary(beneficiaryType);

                    return (
                      <div key={timelineKey} className="adminbudget-item-wrap">
                        <div
                          className={`adminbudget-item adminbudget-item--clickable ${archivingIds.has(recordId) ? 'adminbudget-item--archiving' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/finance/${recordId}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/finance/${recordId}`);
                            }
                          }}
                        >
                          <div className="adminbudget-topbar">
                            <div className="adminbudget-topbar-left">
                              <span className="adminbudget-id">{proposalRef}</span>
                              <h5 className="adminbudget-name">
                                {record.applicant_name || record.user_name || record.faculty_name || 'Unknown'}
                              </h5>
                              {/* Tag Pill - Display based on beneficiary type */}
                              {tag && tag.trim() !== '' && (
                                <span className="adminbudget-tag-pill">{tag}</span>
                              )}
                            </div>

                            <div className="adminbudget-topbar-right">
                              <div className="adminbudget-amounts-container" style={{ display: 'flex', gap: '20px', textAlign: 'right', marginRight: '15px' }}>
                                <div className="adminbudget-amount-item">
                                  <p className="adminbudget-amount-label" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, opacity: 0.75 }}>
                                    {showApprovedAmount ? 'Proposed' : 'Amount'}
                                  </p>
                                  <p className="adminbudget-amount" style={{ margin: 0, fontSize: '1.1rem' }}>
                                    {formatAmount(proposedAmount)}
                                  </p>
                                </div>
                                {showApprovedAmount && (
                                  <div className="adminbudget-amount-item">
                                    <p className="adminbudget-amount-label" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, opacity: 0.75 }}>
                                      Approved
                                    </p>
                                    <p className="adminbudget-amount" style={{ margin: 0, fontSize: '1.1rem', color: '#137a3a' }}>
                                      {formatAmount(approvedAmount)}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <button
                                className="adminbudget-icon-btn"
                                title="Logs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchFullTimeline(recordId, proposalRef);
                                }}
                              >
                                <Info size={16} />
                              </button>

                              <button
                                className="adminbudget-icon-btn"
                                title="View"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/finance/${recordId}`);
                                }}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                className="adminbudget-icon-btn"
                                title="Edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/finance/${recordId}/edit`);
                                }}
                              >
                                <Edit2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="adminbudget-row">
                            <div className="adminbudget-left">
                              {filteredColumns.map((column) => (
                                <div key={column.key} className="adminbudget-detail-row">
                                  <span className="adminbudget-label">{column.label}</span>
                                  <span className="adminbudget-value">
                                    {column.render
                                      ? column.render(record)
                                      : (record[column.key] ?? '-')}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="adminbudget-right">
                              <div className="adminbudget-status-wrap">
                                <span className={getStatusClass(statusCategory)}>
                                  {getDisplayStatus(record)}
                                </span>
                              </div>
                              <div className="adminbudget-actions-row">
                                {!isArchived && (
                                  <>
                                    <button
                                      className="adminbudget-action-btn adminbudget-action-btn--approve"
                                      title="Approve"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onApprove(recordId, record.workflow_stage);
                                      }}
                                      disabled={actingRecordId === recordId || !isPending}
                                    >
                                      <CheckCircle2 size={18} />
                                    </button>

                                    <button
                                      className="adminbudget-action-btn adminbudget-action-btn--return"
                                      title="Return"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openActionPopup("return", recordId, proposalRef, record.workflow_stage);
                                      }}
                                      disabled={actingRecordId === recordId || !isPending}
                                    >
                                      <RotateCcw size={18} />
                                    </button>

                                    <button
                                      className="adminbudget-action-btn adminbudget-action-btn--reject"
                                      title="Reject"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openActionPopup("reject", recordId, proposalRef, record.workflow_stage);
                                      }}
                                      disabled={actingRecordId === recordId || !isPending}
                                    >
                                      <XCircle size={18} />
                                    </button>
                                  </>
                                )}

                                <button
                                  className="adminbudget-action-btn adminbudget-action-btn--archive"
                                  title={isArchived ? 'Unarchive' : 'Archive'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchiveToggle(record);
                                  }}
                                  disabled={archivingIds.has(recordId)}
                                >
                                  <Archive size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="adminbudget-pagination">
                  <div className="adminbudget-pagination-left">
                    <div className="adminbudget-rows-control">
                      <label htmlFor="workflow-rows-per-page" className="adminbudget-rows-label">
                        Rows per page
                      </label>
                      <select
                        id="workflow-rows-per-page"
                        className="adminbudget-rows-select"
                        value={limit}
                        onChange={(e) => {
                          const newLimit = Number(e.target.value);
                          setLimit(newLimit);
                          setPage(1);
                        }}
                      >
                        {[5, 10, 20, 50].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="adminbudget-pagecount">
                      {filteredRows.length === 0
                        ? '0-0 of 0'
                        : `${(page - 1) * limit + 1}-${Math.min(page * limit, filteredRows.length)} of ${filteredRows.length}`}
                    </span>
                  </div>

                  <div className="adminbudget-pagination-right">
                    <button
                      type="button"
                      className="adminbudget-pagebtn"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>

                    <span className="adminbudget-pageinfo">
                      Page {page} of {totalPages}
                    </span>

                    <button
                      type="button"
                      className="adminbudget-pagebtn"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {actionPopupOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999999,
            padding: 16,
          }}
          onClick={closeActionPopup}
        >
          <div
            style={{
              width: "min(520px, 95vw)",
              background: "#fff",
              borderRadius: 12,
              padding: 18,
              boxShadow: "0 10px 35px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h5 style={{ margin: 0, marginBottom: 10 }}>
              {actionType === "return" ? "Return Item" : "Reject Item"} - Comments
            </h5>

            <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
              Reference: <b>{actionRef}</b>
            </div>

            <textarea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={4}
              placeholder="Enter comments (required)..."
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid #e0e0e0",
                padding: "10px 12px",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={closeActionPopup}
                style={{
                  border: "1px solid #ddd",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitActionWithComment}
                style={{
                  border: "none",
                  background: actionType === "reject" ? "#dc3545" : "#f0ad4e",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {logPopupOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: 16,
          }}
          onClick={closeLogPopup}
        >
          <div
            style={{
              width: 'min(760px, 96vw)',
              maxHeight: '80vh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: 12,
              padding: 0,
              boxShadow: '0 10px 35px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="budgetdashboard-log-header">Workflow Timeline</div>
            <div className="budgetdashboard-log-body adminbudget-log-body">
              <div className="budgetdashboard-log-item">
                <span className="log-label">Reference:</span>
                <span className="log-value">{logRef || '--'}</span>
              </div>

              {logLoading && <div className="adminbudget-state" style={{ padding: '24px 0' }}>Loading timeline...</div>}
              {!logLoading && logEntries.length === 0 && (
                <div className="adminbudget-state" style={{ padding: '24px 0' }}>No timeline entries available.</div>
              )}

              {!logLoading && logEntries.length > 0 && (
                <div className="budgetdashboard-log-approvals">
                  {logEntries.map((entry, idx) => (
                    <div key={entry.id || idx} className="log-approval-item">
                      <div className="log-approval-meta">
                        <span className={`log-decision log-decision--${entry.decision?.toLowerCase() || 'approved'}`}>
                          {entry.decision?.toUpperCase() || 'UPDATE'}
                        </span>
                        <span className="log-role">
                          {formatStageLabel(entry.stage, config.stageLabels)}
                        </span>
                        {entry.feedback && (
                          <span className="log-feedback">Note: {entry.feedback}</span>
                        )}
                        <span className="log-actor-line">
                          By: {entry.actorEmail || 'Unknown'}
                        </span>
                        <span className="log-date">
                          {entry.decidedAt ? new Date(entry.decidedAt).toLocaleString() : '-'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 16px' }}>
              <button
                type="button"
                onClick={closeLogPopup}
                style={{
                  border: '1px solid #ddd',
                  background: '#fff',
                  borderRadius: 8,
                  padding: '8px 20px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowApprovalPage;
