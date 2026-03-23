import React, { useCallback, useEffect, useMemo, useState } from 'react';
import authenticityUtility from '../../utils/authenticityUtility';
import {
  WorkflowApprovalModuleConfig,
  WorkflowDecision,
  WorkflowMeta,
  WorkflowQueueResult,
  WorkflowTimelineItem,
} from '../../workflow/workflowApprovalTypes';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
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
    async (stage: string) => {
      if (!stage) {
        setRows([]);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await authenticityUtility.get(getQueueEndpoint(stage), {
          params: {
            page: config.queueParams?.page || 1,
            limit: config.queueParams?.limit || config.queueDefaultLimit || 20,
          },
        });
        const mapped = mapQueueResponse(response);
        setRows(Array.isArray(mapped.items) ? mapped.items : []);
      } catch (queueError: any) {
        setRows([]);
        setError(queueError?.response?.data?.message || queueError?.message || 'Failed to load queue');
      } finally {
        setLoading(false);
      }
    },
    [config.queueDefaultLimit, config.queueParams?.limit, config.queueParams?.page, getQueueEndpoint, mapQueueResponse]
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
    loadQueue(activeStage).catch((queueError: any) => {
      setError(queueError?.response?.data?.message || queueError?.message || 'Failed to load queue');
      setLoading(false);
    });
  }, [activeStage, loadQueue]);

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
      await loadQueue(activeStage);
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

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">{config.title}</h4>
      </div>

      {permittedStages.length > 0 && (
        <div className="d-flex gap-2 flex-wrap mb-3">
          {permittedStages.map((stage) => (
            <button
              key={stage}
              type="button"
              className={`btn ${activeStage === stage ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setActiveStage(stage)}
            >
              {formatStageLabel(stage, config.stageLabels)}
            </button>
          ))}
        </div>
      )}

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <div className="text-muted">Loading queue...</div>
      ) : rows.length === 0 ? (
        <div className="alert alert-light border">No records in this stage queue.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
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
              {rows.map((record, rowIndex) => {
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
                      <td>{formatStageLabel(String(record.workflow_stage || ''), config.stageLabels)}</td>
                      <td>{String(record.workflow_status || '-')}</td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
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
                            <span className="text-muted">Loading timeline...</span>
                          ) : timelineEntries.length === 0 ? (
                            <span className="text-muted">No timeline entries.</span>
                          ) : (
                            <ul className="mb-0 ps-3">
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
    </div>
  );
};

export default WorkflowApprovalPage;
