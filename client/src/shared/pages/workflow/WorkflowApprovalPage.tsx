import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import authenticityUtility from '../../utils/authenticityUtility';
import {
  WorkflowApprovalModuleConfig,
  WorkflowDecision,
  WorkflowMeta,
  WorkflowQueueResult,
  WorkflowTimelineItem,
} from '../../workflow/workflowApprovalTypes';
import './WorkflowApprovalPage.css';
import '../../../features/admin/budget/budget-approval/adminbudget.css';

const DEFAULT_DECISIONS: WorkflowDecision[] = ['approved', 'returned', 'rejected'];
const DEFAULT_FEEDBACK_REQUIRED: WorkflowDecision[] = ['returned', 'rejected'];

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

interface WorkflowApprovalPageProps {
  config: WorkflowApprovalModuleConfig;
}

const WorkflowApprovalPage: React.FC<WorkflowApprovalPageProps> = ({ config }) => {
  const [meta, setMeta] = useState<WorkflowMeta | null>(null);
  const [activeStage, setActiveStage] = useState<string>('');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(config.queueDefaultLimit || 20);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'total' | 'pending' | 'approved' | 'returned' | 'rejected'>('pending');
  const [actingRecordId, setActingRecordId] = useState<number | string | null>(null);
  const [expandedTimelineId, setExpandedTimelineId] = useState<number | string | null>(null);
  const [timelineById, setTimelineById] = useState<Record<string, WorkflowTimelineItem[]>>({});
  const [timelineLoadingId, setTimelineLoadingId] = useState<number | string | null>(null);

  const permittedStages = useMemo(() => meta?.permittedStages || [], [meta]);
  const decisions = config.decisions || DEFAULT_DECISIONS;
  const feedbackRequiredDecisions = new Set(config.requireFeedbackFor || DEFAULT_FEEDBACK_REQUIRED);

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

  const mapQueueResponse = config.mapQueueResponse || defaultQueueMapper;
  const mapTimelineResponse = config.mapTimelineResponse || defaultTimelineMapper;

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
        const response = await authenticityUtility.get(getQueueEndpoint(stage), {
          params: {
            page: requestedPage,
            limit,
          },
        });
        const mapped = mapQueueResponse(response);
        setRows(Array.isArray(mapped.items) ? mapped.items : []);
        setTotalRows(Number(mapped.total || 0));
        setPage(Number(mapped.page || requestedPage || 1));
        setLimit(Number(mapped.limit || limit || config.queueDefaultLimit || 20));
      } catch (queueError: any) {
        setRows([]);
        setTotalRows(0);
        setError(queueError?.response?.data?.message || queueError?.message || 'Failed to load queue');
      } finally {
        setLoading(false);
      }
    },
    [config.queueDefaultLimit, getQueueEndpoint, limit, mapQueueResponse]
  );

  const loadTimeline = useCallback(
    async (id: number | string) => {
      const key = String(id);
      setTimelineLoadingId(id);
      try {
        const response = await authenticityUtility.get(getTimelineEndpoint(id));
        const mapped = mapTimelineResponse(response);
        setTimelineById((prev) => ({ ...prev, [key]: mapped }));
      } catch {
        setTimelineById((prev) => ({ ...prev, [key]: [] }));
      } finally {
        setTimelineLoadingId(null);
      }
    },
    [getTimelineEndpoint, mapTimelineResponse]
  );

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
  }, [activeStage, loadQueue, page]);

  useEffect(() => {
    setPage(1);
  }, [activeStage]);

  const handleDecision = async (record: Record<string, any>, decision: WorkflowDecision) => {
    const recordId = getRecordId(record);
    if (recordId === undefined || recordId === null) {
      setError('Unable to process this row because record id is missing.');
      return;
    }

    let feedback = '';
    if (feedbackRequiredDecisions.has(decision)) {
      const promptValue = window.prompt(`Enter feedback for ${decision}:`, '');
      if (promptValue === null) return;
      feedback = String(promptValue || '').trim();
      if (!feedback) {
        window.alert(`Feedback is required for ${decision}.`);
        return;
      }
    }

    setActingRecordId(recordId);
    setError('');
    try {
      await authenticityUtility.patch(getApprovalEndpoint(recordId), {
        decision,
        feedback: feedback || undefined,
      });
      await loadQueue(activeStage, page);
      if (expandedTimelineId === recordId) {
        await loadTimeline(recordId);
      }
    } catch (approvalError: any) {
      setError(approvalError?.response?.data?.message || approvalError?.message || 'Failed to update workflow');
    } finally {
      setActingRecordId(null);
    }
  };

  const toggleTimeline = async (record: Record<string, any>) => {
    const recordId = getRecordId(record);
    if (recordId === undefined || recordId === null) return;

    if (expandedTimelineId === recordId) {
      setExpandedTimelineId(null);
      return;
    }

    setExpandedTimelineId(recordId);
    const key = String(recordId);
    if (!timelineById[key]) {
      await loadTimeline(recordId);
    }
  };

  const actionLabelMap: Record<WorkflowDecision, string> = {
    approved: 'Approve',
    returned: 'Return',
    rejected: 'Reject',
  };

  const actionClassMap: Record<WorkflowDecision, string> = {
    approved: 'btn-success',
    returned: 'btn-warning',
    rejected: 'btn-danger',
  };

  const resolveStatusCategory = useCallback((record: Record<string, any>) => {
    const token = String(record.workflow_status || record.status || '').toLowerCase();
    if (token.includes('rejected')) return 'rejected';
    if (token.includes('returned') || token.includes('return')) return 'returned';
    if (token.includes('approved') || token === 'completed') return 'approved';
    return 'pending';
  }, []);

  const statusStats = useMemo(() => {
    const stats = { total: rows.length, pending: 0, approved: 0, returned: 0, rejected: 0 };
    for (const row of rows) {
      const category = resolveStatusCategory(row);
      stats[category] += 1;
    }
    return stats;
  }, [rows, resolveStatusCategory]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows.filter((record) => {
      const matchesStatus = statusFilter === 'total' ? true : resolveStatusCategory(record) === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      const searchable = [
        record.id,
        record.applicant_name,
        record.beneficiary_type,
        record.primary_head,
        record.workflow_status,
        record.workflow_stage,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return searchable.includes(query);
    });
  }, [rows, searchTerm, statusFilter, resolveStatusCategory]);

  const totalPages = Math.max(1, Math.ceil((totalRows || 0) / (limit || 20)));

  return (
    <div className="adminbudget-page">
      <div className="adminbudget-container">
        <div className="adminbudget-card">
        <div className="adminbudget-header">
          <h4 className="adminbudget-title">{config.title}</h4>
          <div className="adminbudget-header-actions">
            <input
              type="text"
              className="adminbudget-control"
              placeholder="Search ID, applicant, beneficiary..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

      {permittedStages.length > 0 && (
        <div className="adminbudget-role-tabs" style={{ padding: '0 20px 10px 20px' }}>
          {permittedStages.map((stage) => (
            <button
              key={stage}
              type="button"
              className={`adminbudget-role-tab ${activeStage === stage ? 'active' : ''}`}
              onClick={() => setActiveStage(stage)}
            >
              {formatStageLabel(stage, config.stageLabels)}
            </button>
          ))}
        </div>
      )}

      <div className="adminbudget-stats">
        <button type="button" className={`adminbudget-stats-card total ${statusFilter === 'total' ? 'active' : ''}`} onClick={() => setStatusFilter('total')}>
          <span className="adminbudget-stats-icon"><Briefcase size={18} /></span>
          <span className="adminbudget-stats-text">
            <span className="adminbudget-stats-label">Total</span>
            <span className="adminbudget-stats-number">{totalRows || statusStats.total}</span>
          </span>
        </button>
        <button type="button" className={`adminbudget-stats-card pending ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>
          <span className="adminbudget-stats-icon"><Clock size={18} /></span>
          <span className="adminbudget-stats-text">
            <span className="adminbudget-stats-label">Pending</span>
            <span className="adminbudget-stats-number">{statusStats.pending}</span>
          </span>
        </button>
        <button type="button" className={`adminbudget-stats-card approved ${statusFilter === 'approved' ? 'active' : ''}`} onClick={() => setStatusFilter('approved')}>
          <span className="adminbudget-stats-icon"><CheckCircle2 size={18} /></span>
          <span className="adminbudget-stats-text">
            <span className="adminbudget-stats-label">Approved</span>
            <span className="adminbudget-stats-number">{statusStats.approved}</span>
          </span>
        </button>
        <button type="button" className={`adminbudget-stats-card returned ${statusFilter === 'returned' ? 'active' : ''}`} onClick={() => setStatusFilter('returned')}>
          <span className="adminbudget-stats-icon"><RotateCcw size={18} /></span>
          <span className="adminbudget-stats-text">
            <span className="adminbudget-stats-label">Return</span>
            <span className="adminbudget-stats-number">{statusStats.returned}</span>
          </span>
        </button>
        <button type="button" className={`adminbudget-stats-card rejected ${statusFilter === 'rejected' ? 'active' : ''}`} onClick={() => setStatusFilter('rejected')}>
          <span className="adminbudget-stats-icon"><XCircle size={18} /></span>
          <span className="adminbudget-stats-text">
            <span className="adminbudget-stats-label">Reject</span>
            <span className="adminbudget-stats-number">{statusStats.rejected}</span>
          </span>
        </button>
      </div>

      <div className="adminbudget-body">
      {error && <div className="adminbudget-state">{error}</div>}

      {loading ? (
        <div className="adminbudget-state">Loading queue...</div>
      ) : filteredRows.length === 0 ? (
        <div className="adminbudget-state">No records in this stage queue.</div>
      ) : (
        <div className="workflow-table-wrap">
          <table className="workflow-table">
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>Stage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((record, rowIndex) => {
                const recordId = getRecordId(record) ?? `row-${rowIndex}`;
                const timelineKey = String(recordId);
                const timelineEntries = timelineById[timelineKey] || [];

                return (
                  <React.Fragment key={timelineKey}>
                    <tr>
                      {config.columns.map((column) => (
                        <td key={`${timelineKey}-${column.key}`} className={column.className || ''}>
                          {column.render
                            ? column.render(record)
                            : (record[column.key] ?? '-')}
                        </td>
                      ))}
                      <td>
                        <span className="workflow-stage-pill">
                          {formatStageLabel(String(record.workflow_stage || ''), config.stageLabels)}
                        </span>
                      </td>
                      <td>
                        <span className={`adminbudget-status adminbudget-status--${resolveStatusCategory(record)}`}>
                          {String(record.workflow_status || '-')}
                        </span>
                      </td>
                      <td>
                        <div className="workflow-actions">
                          {decisions.map((decision) => (
                            <button
                              key={`${timelineKey}-${decision}`}
                              type="button"
                              className={`btn ${actionClassMap[decision]} btn-sm`}
                              disabled={actingRecordId === recordId}
                              onClick={() => handleDecision(record, decision)}
                            >
                              {actionLabelMap[decision]}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => toggleTimeline(record)}
                          >
                            {expandedTimelineId === recordId ? 'Hide Timeline' : 'Timeline'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedTimelineId === recordId && (
                      <tr>
                        <td colSpan={config.columns.length + 3}>
                          {timelineLoadingId === recordId ? (
                            <span className="workflow-state-inline">Loading timeline...</span>
                          ) : timelineEntries.length === 0 ? (
                            <span className="workflow-state-inline">No timeline entries.</span>
                          ) : (
                            <ul className="workflow-timeline">
                              {timelineEntries.map((entry) => (
                                <li key={entry.id}>
                                  <strong>{formatStageLabel(entry.stage, config.stageLabels)}</strong> - {entry.decision}
                                  {entry.feedback ? ` (${entry.feedback})` : ''} by {entry.actorEmail || 'Unknown'} on{' '}
                                  {entry.decidedAt ? new Date(entry.decidedAt).toLocaleString() : '-'}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="workflow-pagination">
        <div className="adminbudget-pagination-left">
          <span className="adminbudget-pagecount">Page {page} of {totalPages}</span>
          <span className="adminbudget-pageinfo">{totalRows} total</span>
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
      </div>
      </div>
      </div>
    </div>
  );
};

export default WorkflowApprovalPage;
