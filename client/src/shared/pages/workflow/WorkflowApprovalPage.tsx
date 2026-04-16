import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Clock, RotateCcw, XCircle, Eye, Info, Edit2, Archive, Trash2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import authenticityUtility from '../../utils/authenticityUtility';
import { useAuth } from '../../../contexts/AuthContext';
import {
  WorkflowApprovalModuleConfig,
  WorkflowDecision,
  WorkflowMeta,
  WorkflowQueueResult,
  WorkflowTimelineItem,
} from '../../workflow/workflowApprovalTypes';
import './WorkflowApprovalPage.css';
import AlertModal, { type AlertType } from "../../../shared/components/ui/AlertModal";
import CustomModal from "../../../shared/components/ui/CustomModal";

const DEFAULT_DECISIONS: WorkflowDecision[] = ['approved', 'returned', 'rejected'];
const DEFAULT_FEEDBACK_REQUIRED: WorkflowDecision[] = ['returned', 'rejected'];
const FALLBACK_BENEFICIARY_OPTIONS = [
  "All Beneficiary",
  "Faculty",
  "Staff",
  "Department",
  "Centre",
  "Cell",
  "Club",
  "Professional Body",
  "Institution",
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
  if (type === 'centre' || type === 'cell' || type === 'club' || type === 'section' || type === 'professional body' || type === 'institution') {
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

const FINANCE_LEVEL1_PENDING_LABELS = {
  coordinator: 'Pending Coordinator',
  hod: 'Pending HOD',
} as const;

const FINANCE_HOD_BENEFICIARY_OPTIONS = ['All Beneficiary', 'Faculty', 'Staff', 'Department'];
const FINANCE_COORDINATOR_BENEFICIARY_OPTIONS = [
  'All Beneficiary',
  'Centre',
  'Cell',
  'Club',
  'Section',
  'Professional Body',
  'Institution',
];

const getSecondaryFilterValue = (record: Record<string, any>, beneficiaryType: string) => {
  const normalizedType = String(beneficiaryType || '').trim().toLowerCase();

  if (
    !normalizedType ||
    normalizedType === 'all beneficiary' ||
    normalizedType === 'faculty' ||
    normalizedType === 'staff' ||
    normalizedType === 'department'
  ) {
    return String(record.department || '').trim();
  }

  return String(record.beneficiary_value || '').trim();
};

const getSecondaryFilterLabel = (beneficiaryType: string) => {
  const normalizedType = String(beneficiaryType || '').trim().toLowerCase();

  if (
    !normalizedType ||
    normalizedType === 'all beneficiary' ||
    normalizedType === 'faculty' ||
    normalizedType === 'staff' ||
    normalizedType === 'department'
  ) {
    return 'Department';
  }

  if (normalizedType === 'professional body') {
    return 'Professional Body';
  }

  return beneficiaryType || 'Department';
};

const getSecondaryFilterAllLabel = (beneficiaryType: string) => {
  const normalizedType = String(beneficiaryType || '').trim().toLowerCase();

  if (
    !normalizedType ||
    normalizedType === 'all beneficiary' ||
    normalizedType === 'faculty' ||
    normalizedType === 'staff' ||
    normalizedType === 'department'
  ) {
    return 'All Departments';
  }

  if (normalizedType === 'professional body') {
    return 'All Professional Bodies';
  }

  return `All ${beneficiaryType}s`;
};


const defaultQueueMapper = (response: any): WorkflowQueueResult => ({
  items: Array.isArray(response?.data) ? response.data : [],
  total: Number(response?.pagination?.total || 0),
  page: Number(response?.pagination?.page || 1),
  limit: Number(response?.pagination?.limit || 20),
});

const defaultTimelineMapper = (response: any): WorkflowTimelineItem[] =>
  Array.isArray(response?.data) ? response.data : [];

const normalizeLogText = (value: any): string => String(value ?? '').trim();

const formatRowRangesForLog = (rows: number[]) => {
  if (!rows.length) return '';
  const ranges: string[] = [];
  let start = rows[0];
  let prev = rows[0];
  for (let i = 1; i < rows.length; i += 1) {
    const current = rows[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = current;
    prev = current;
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(', ');
};

const summarizeLineChangesForLog = (lines: any[]) => {
  const normalizedLines = Array.isArray(lines) ? lines : [];
  let added = 0;
  let removed = 0;
  let updated = 0;
  const detailPreview: string[] = [];
  const detailFull: string[] = [];

  normalizedLines.forEach((line: any, lineIdx: number) => {
    const lineNo = Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no) || (lineIdx + 1);
    const rawChanges = line?.changes;
    const changeList = Array.isArray(rawChanges)
      ? rawChanges.map((change: any) => normalizeLogText(change)).filter(Boolean)
      : normalizeLogText(rawChanges)
        ? [normalizeLogText(rawChanges)]
        : [];

    const lowered = changeList.map((change: string) => change.toLowerCase());
    const isOnlyAdded = changeList.length === 1 && lowered[0] === 'line added';
    const isOnlyRemoved = changeList.length === 1 && lowered[0] === 'line removed';
    const lineDetails = `Line ${lineNo}: ${changeList.join('; ') || 'Updated'}`;
    detailFull.push(lineDetails);

    if (isOnlyAdded) added += 1;
    else if (isOnlyRemoved) removed += 1;
    else updated += 1;

    if (detailPreview.length < 4 && !isOnlyAdded && !isOnlyRemoved) {
      detailPreview.push(lineDetails);
    }
  });

  const summaryParts: string[] = [];
  if (added > 0) summaryParts.push(`${added} line(s) added`);
  if (removed > 0) summaryParts.push(`${removed} line(s) removed`);
  if (updated > 0) summaryParts.push(`${updated} line(s) updated`);

  const summary = summaryParts.join(', ');
  return {
    compact: [summary, detailPreview.join(' | ')].filter(Boolean).join(' | '),
    full: [summary, detailFull.join(' | ')].filter(Boolean).join(' | '),
  };
};

const parseEntryDetails = (details: any) => {
  if (!details) return null;
  if (typeof details === 'object') return details;
  if (typeof details === 'string') {
    try {
      return JSON.parse(details);
    } catch {
      return null;
    }
  }
  return null;
};

const buildUpdatedLogSubtitles = (entry: WorkflowTimelineItem) => {
  const summary = normalizeLogText(entry.summary || entry.comment || entry.feedback);
  const parsedDetails = parseEntryDetails(entry.details);
  if (!parsedDetails) {
    return {
      compact: summary || 'Request updated',
      full: summary || 'Request updated',
    };
  }

  const lines = Array.isArray(parsedDetails?.lines)
    ? parsedDetails.lines
    : Array.isArray(parsedDetails)
      ? parsedDetails
      : Array.isArray(parsedDetails?.lineChanges)
        ? parsedDetails.lineChanges
        : [];
  const proposalChanges = Array.isArray(parsedDetails?.proposalChanges)
    ? parsedDetails.proposalChanges.map((change: any) => normalizeLogText(change)).filter(Boolean)
    : [];

  let rowSummary = '';
  let compact = '';
  let full = '';

  if (lines.length > 0) {
    const numericRows = lines
      .map((line: any) => Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no))
      .filter((lineNo: number) => Number.isInteger(lineNo) && lineNo > 0);
    const rowNumbers = Array.from(new Set<number>(numericRows)).sort((a, b) => a - b);
    if (rowNumbers.length > 0) {
      rowSummary = `Row No. ${formatRowRangesForLog(rowNumbers)}`;
    }
    const lineSummary = summarizeLineChangesForLog(lines);
    compact = lineSummary.compact;
    full = lineSummary.full;
  }

  if (proposalChanges.length > 0) {
    const proposalSummary = proposalChanges.join('; ');
    compact = [compact, proposalSummary].filter(Boolean).join(' | ');
    full = [full, proposalSummary].filter(Boolean).join(' | ');
  }

  const compactSubtitle = [rowSummary || summary, compact].filter(Boolean).join(' | ');
  const fullSubtitle = [rowSummary || summary, full || compact].filter(Boolean).join(' | ');
  return {
    compact: compactSubtitle || summary || 'Request updated',
    full: fullSubtitle || compactSubtitle || summary || 'Request updated',
  };
};

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

interface WorkflowStageTab {
  key: string;
  stage: string;
  label: string;
  level1Role?: 'hod' | 'coordinator';
  showAllProposals?: boolean;
}

const WorkflowApprovalPage: React.FC<WorkflowApprovalPageProps> = ({ config }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void | Promise<void>;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
  }>({
    show: false,
    message: '',
    type: 'info',
  });
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
  const [expandedLogDetails, setExpandedLogDetails] = useState<Record<string, boolean>>({});
  const [logRef, setLogRef] = useState<string>('');
  const [logLevel1Role, setLogLevel1Role] = useState<'hod' | 'coordinator' | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [archivingIds, setArchivingIds] = useState<Set<number | string>>(new Set());
  
  // Action popups
  const [actionPopupOpen, setActionPopupOpen] = useState(false);
  const [actionType, setActionType] = useState<'return' | 'reject' | null>(null);
  const [actionId, setActionId] = useState<number | string | null>(null);
  const [actionRef, setActionRef] = useState<string>("");
  const [actionComment, setActionComment] = useState<string>("");
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [deletePopupOpen, setDeletePopupOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  const [deleteRef, setDeleteRef] = useState<string>('');
  const [deleteCountdown, setDeleteCountdown] = useState<number>(10);

  const closeAlert = useCallback(() => {
    setAlertConfig((prev) => ({
      ...prev,
      show: false,
      onConfirm: undefined,
    }));
  }, []);

  const showAlert = useCallback(
    (
      message: React.ReactNode,
      type: AlertType = 'info',
      title?: string,
      onConfirm?: () => void | Promise<void>,
      showCancel = false,
      confirmText = 'OK',
      cancelText = 'Cancel'
    ) => {
      setAlertConfig({
        show: true,
        message,
        type,
        title,
        onConfirm: onConfirm
          ? async () => {
              closeAlert();
              await onConfirm();
            }
          : undefined,
        showCancel,
        confirmText,
        cancelText,
      });
    },
    [closeAlert]
  );

  const openDeletePopup = (recordId: number | string, ref: string) => {
    setDeleteId(recordId);
    setDeleteRef(ref);
    setDeleteCountdown(10);
    setDeletePopupOpen(true);
  };

  const closeDeletePopup = () => {
    setDeletePopupOpen(false);
    setDeleteId(null);
    setDeleteRef('');
    setDeleteCountdown(10);
  };

  const handleDeleteRecord = (record: Record<string, any>) => {
    const recordId = getRecordId(record);

    if (recordId === undefined || recordId === null) {
      setError('Unable to delete this row because record id is missing.');
      return;
    }

    const proposalRef = record.proposal_ref || formatProposalRef(record);
    openDeletePopup(recordId, proposalRef);
  };

  const confirmDelete = async () => {
    if (deleteId === null || deleteId === undefined || deleteCountdown > 0) {
      return;
    }

    setActingRecordId(deleteId);
    setError('');

    try {
      const response: any = await authenticityUtility.delete(`${config.apiBasePath}/${deleteId}`);

      if (
        response?.status === 'success' ||
        response?.success === true ||
        response?.data?.success
      ) {
        closeDeletePopup();
        showAlert('Deleted successfully.', 'success');
        await loadQueue(activeStage, 1);
        return;
      }

      showAlert(
        response?.message || response?.data?.message || 'Failed to delete item.',
        'error'
      );
    } catch (deleteError: any) {
      showAlert(
        deleteError?.response?.data?.message || deleteError?.message || 'Failed to delete item.',
        'error'
      );
    } finally {
      setActingRecordId(null);
    }
  };

  const isSuperAdminView = Boolean(meta?.isSuperAdmin);
  // Filter states
  const [fiscalYear, setFiscalYear] = useState<number>(() => {
    const d = new Date();
    return d.getMonth() < 1 ? d.getFullYear() - 1 : d.getFullYear();
  });
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<string>("All Beneficiary");
  const [secondaryFilter, setSecondaryFilter] = useState<string>('');
  const [activeStageTabKey, setActiveStageTabKey] = useState<string>('');

  const permittedStages = useMemo(() => meta?.permittedStages || [], [meta]);

  const stageTabs = useMemo<WorkflowStageTab[]>(() => {
    const roleTokens = Array.isArray(user?.roles) ? user.roles : [];
    const normalizedRoles = roleTokens.map((role) => String(role || '').trim().toLowerCase());
    const tabs: WorkflowStageTab[] = permittedStages.flatMap<WorkflowStageTab>((stage) => {
      const normalizedStage = String(stage || '').trim().toLowerCase();
      if (config.moduleKey === 'finance' && normalizedStage === 'level1') {
        if (meta?.isSuperAdmin) {
          return [
            { key: 'level1-hod', stage: 'level1', label: 'HOD', level1Role: 'hod' as const },
            {
              key: 'level1-coordinator',
              stage: 'level1',
              label: 'Coordinator',
              level1Role: 'coordinator' as const,
            },
          ];
        }

        if (normalizedRoles.includes('coordinator') || normalizedRoles.includes('entity_approver')) {
          return [
            {
              key: 'level1-coordinator',
              stage: 'level1',
              label: 'Coordinator',
              level1Role: 'coordinator' as const,
            },
          ];
        }

        return [{ key: 'level1-hod', stage: 'level1', label: 'HOD', level1Role: 'hod' as const }];
      }

      return [
        {
          key: normalizedStage || stage,
          stage: normalizedStage || stage,
          label: formatStageLabel(stage, config.stageLabels),
        },
      ];
    });

    if (config.moduleKey === 'finance' && meta?.isSuperAdmin && permittedStages.length > 0) {
      tabs.push({
        key: 'finance-all-proposals',
        stage: tabs[0]?.stage || String(permittedStages[0] || '').trim().toLowerCase() || 'level1',
        label: 'All Proposals',
        showAllProposals: true,
      });
    }

    return tabs;
  }, [config.moduleKey, config.stageLabels, meta?.isSuperAdmin, permittedStages, user?.roles]);

  const activeWorkflowTab = useMemo(
    () => stageTabs.find((tab) => tab.key === activeStageTabKey) || null,
    [activeStageTabKey, stageTabs]
  );

  const beneficiaryOptionsFromMeta = useMemo(() => {
    const source = Array.isArray(meta?.availableBeneficiaryTypes) ? meta.availableBeneficiaryTypes : [];
    const dedup = new Map<string, string>();

    for (const item of source) {
      const label = String(item || '').trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (!dedup.has(key)) {
        dedup.set(key, label);
      }
    }

    const dynamic = Array.from(dedup.values());
    if (!dynamic.length) {
      return FALLBACK_BENEFICIARY_OPTIONS;
    }

    return ['All Beneficiary', ...dynamic];
  }, [meta?.availableBeneficiaryTypes]);

  const filteredBeneficiaryOptions = useMemo(() => {
    if (config.moduleKey !== 'finance') {
      return beneficiaryOptionsFromMeta;
    }

    if (activeStage === 'level1' && activeWorkflowTab?.level1Role === 'hod') {
      const allowed = new Set(FINANCE_HOD_BENEFICIARY_OPTIONS.map((option) => option.toLowerCase()));
      return beneficiaryOptionsFromMeta.filter((option) => allowed.has(option.toLowerCase()));
    }

    if (activeStage === 'level1' && activeWorkflowTab?.level1Role === 'coordinator') {
      const allowed = new Set(FINANCE_COORDINATOR_BENEFICIARY_OPTIONS.map((option) => option.toLowerCase()));
      return beneficiaryOptionsFromMeta.filter((option) => allowed.has(option.toLowerCase()));
    }

    return beneficiaryOptionsFromMeta;
  }, [activeStage, activeWorkflowTab?.level1Role, beneficiaryOptionsFromMeta, config.moduleKey]);

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

  const getRecordRoute = useCallback(
    (recordId: number | string, mode: 'view' | 'edit' = 'view') => {
      if (mode === 'edit') {
        if (config.getEditRoute) {
          return config.getEditRoute(recordId);
        }

        return `/${config.moduleKey}/${recordId}/edit`;
      }

      if (config.getViewRoute) {
        return config.getViewRoute(recordId);
      }

      return `/${config.moduleKey}/${recordId}`;
    },
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

  const getRecordStageDecision = useCallback((record: Record<string, any>) => {
    return String(
      record.workflow_stage_decision ||
      record.workflow_stage_status ||
      record.stage_decision ||
      record.stage_status ||
      record.decision ||
      ''
    ).toLowerCase();
  }, []);

  const getRecordWorkflowDecision = useCallback((record: Record<string, any>) => {
    return String(record.workflow_state?.lastDecision || record.lastDecision || '').toLowerCase();
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
    const workflowDecision = getRecordWorkflowDecision(record);
    const stageDecision = getRecordStageDecision(record);
    const token = String(record.workflow_status || record.status || '').toLowerCase();
    const currentStage = getRecordCurrentStage(record);
    const activeStageKey = String(activeStage || '').toLowerCase();

    if (token.includes('archived') || token.includes('archive')) return 'archived';
    if (token.includes('rejected') || workflowDecision === 'rejected') return 'rejected';
    if (token.includes('returned') || token.includes('return') || workflowDecision === 'returned') return 'returned';

    // For requests actively in-progress, treat as pending to prevent stale
    // historical stage decisions (e.g. old "approved"/"returned" from a previous
    // cycle) from overriding fresh resubmission cycles.
    // This MUST come before stageDecision checks.
    // - currentStage === activeStageKey: request is currently at this stage, awaiting action
    // - workflowDecision === 'resubmitted': request went back to an earlier stage,
    //   so ALL later stages' stale decisions should be ignored
    if (token === 'in_progress' && currentStage) {
      if (currentStage === activeStageKey || workflowDecision === 'resubmitted') {
        return 'pending';
      }
    }

    if (workflowDecision === 'resubmitted') return 'pending';

    if (token.includes('completed') || token.includes('approved')) return 'approved';

    if (stageDecision.includes('rejected')) return 'rejected';
    if (stageDecision.includes('returned') || stageDecision.includes('return')) return 'returned';
    if (stageDecision.includes('approved')) return 'approved';

    if (isApprovedForCurrentStage(record)) return 'approved';
    
    return 'pending';
  }, [activeStage, getRecordCurrentStage, getRecordStageDecision, getRecordWorkflowDecision, isApprovedForCurrentStage]);

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
        const activeTab = stageTabs.find((tab) => tab.key === activeStageTabKey) || null;
        const isAllProposalsTab = Boolean(activeTab?.showAllProposals);
        const normalizedStage = String(stage || '').toLowerCase();
        const level1RoleFilter =
          config.moduleKey === 'finance' &&
          normalizedStage === 'level1' &&
          activeTab?.level1Role
            ? activeTab.level1Role
            : null;

        const response = await authenticityUtility.get(endpoint, {
          params: {
            page: requestedPage,
            limit,
            workflowStatus: 'all',
            fiscalYear,
            ...(level1RoleFilter ? { level1Role: level1RoleFilter } : {}),
            ...(beneficiaryFilter !== 'All Beneficiary' ? { beneficiaryType: beneficiaryFilter } : {}),
            ...(searchTerm ? { q: searchTerm } : {}),
          },
        });

        const mapped = mapQueueResponse(response);

        let items = Array.isArray(mapped.items) ? mapped.items : [];
        if (!isAllProposalsTab) {
          items = items.filter((item) => isVisibleInWorkflowList(item, stage));
        }

        setRows(items);
        const nextLimit = Number(mapped.limit || limit || config.queueDefaultLimit || 20);
        const normalizedMappedPage = Math.max(Number(mapped.page || requestedPage || 1), 1);
        const normalizedMappedTotal = Math.max(Number(mapped.total || 0), 0);

        setTotalRows(normalizedMappedTotal);
        setPage(normalizedMappedPage);
        setLimit(nextLimit);
      } catch (queueError: any) {
        setRows([]);
        setTotalRows(0);
        setError(queueError?.response?.data?.message || queueError?.message || 'Failed to load queue');
      } finally {
        setLoading(false);
      }
    },
    [
      activeStageTabKey,
      getQueueEndpoint,
      isVisibleInWorkflowList,
      limit,
      mapQueueResponse,
      config.moduleKey,
      fiscalYear,
      beneficiaryFilter,
      searchTerm,
      stageTabs,
    ]
  );

  const switchToWorkflowStage = useCallback(
    async (nextStage: string | null | undefined) => {
      const normalizedNextStage = String(nextStage || '').toLowerCase();
      if (!normalizedNextStage) {
        return;
      }

      if (permittedStages.length > 0 && !permittedStages.includes(normalizedNextStage)) {
        return;
      }

      const matchingTabs = stageTabs.filter((tab) => tab.stage === normalizedNextStage);
      if (matchingTabs.length > 0) {
        const currentTabForStage = matchingTabs.find((tab) => tab.key === activeStageTabKey) || null;
        const targetTab = currentTabForStage || matchingTabs[0];
        if (targetTab?.key && targetTab.key !== activeStageTabKey) {
          setActiveStageTabKey(targetTab.key);
        }
      }

      setActiveStage(normalizedNextStage);
      setPage(1);
      await loadQueue(normalizedNextStage, 1);
    },
    [activeStageTabKey, loadQueue, permittedStages, stageTabs]
  );

  const fetchFullTimeline = useCallback(async (record: Record<string, any>, id: number | string, ref: string) => {
    setLogLoading(true);
    setLogRef(ref);
    setLogPopupOpen(true);
    if (config.moduleKey === 'finance') {
      const routeType = String(record?.level1_route_type || record?.level1RouteType || '').trim().toLowerCase();
      setLogLevel1Role(routeType === 'entity_contact' ? 'coordinator' : 'hod');
    } else {
      setLogLevel1Role(null);
    }
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
  }, [config.moduleKey, getTimelineEndpoint, mapTimelineResponse]);

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
    if (!deletePopupOpen || deleteCountdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDeleteCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [deletePopupOpen, deleteCountdown]);

  useEffect(() => {
    if (!stageTabs.length) {
      if (activeStageTabKey) {
        setActiveStageTabKey('');
      }
      return;
    }

    const activeTab = stageTabs.find((tab) => tab.key === activeStageTabKey);
    if (!activeTab) {
      const firstTab = stageTabs[0];
      setActiveStageTabKey(firstTab.key);
      if (firstTab.stage !== activeStage) {
        setActiveStage(firstTab.stage);
      }
      return;
    }

    if (activeTab.stage !== activeStage) {
      setActiveStage(activeTab.stage);
    }
  }, [activeStage, activeStageTabKey, stageTabs]);

  useEffect(() => {
    if (!filteredBeneficiaryOptions.includes(beneficiaryFilter)) {
      setBeneficiaryFilter('All Beneficiary');
      setSecondaryFilter('');
    }
  }, [beneficiaryFilter, filteredBeneficiaryOptions]);

  useEffect(() => {
    setSecondaryFilter('');
  }, [beneficiaryFilter, activeStageTabKey]);

  useEffect(() => {
    setPage(1);
  }, [activeStage, fiscalYear, beneficiaryFilter, searchTerm, secondaryFilter]);

  const onApprove = async (recordId?: number | string) => {
  if (!recordId) {
  showAlert('Missing record id.', 'warning');
  return;
}

showAlert(
  'Are you sure you want to approve this proposal?',
  'warning',
  'Confirm Approval',
  async () => {
    setActingRecordId(recordId);
    setError('');

    try {
      const response: any = await authenticityUtility.patch(getApprovalEndpoint(recordId), {
        decision: 'approved',
      });

      if (response?.status === 'success' || response?.success || response?.data?.success) {
        showAlert('Approved successfully', 'success');

        await loadQueue(activeStage, 1);
        return;
      }

      showAlert(response?.message || response?.data?.message || 'Failed to approve', 'error');
    } catch (approvalError: any) {
      showAlert(approvalError?.response?.data?.message || 'Failed to approve', 'error');
    } finally {
      setActingRecordId(null);
    }
  },
  true,
  'Approve',
  'Cancel'
);
};

  const openActionPopup = (type: "return" | "reject", id: number | string, ref: string) => {
    setActionType(type);
    setActionId(id);
    setActionRef(ref);
    setActionComment("");
    setActionPopupOpen(true);
  };

  const closeActionPopup = () => {
    setActionPopupOpen(false);
    setActionType(null);
    setActionId(null);
    setActionRef("");
    setActionComment("");
    setActionSubmitting(false);
  };

  const submitActionWithComment = async () => {
    if (!actionType || !actionId || actionSubmitting) return;

    const comment = actionComment.trim();
    if (!comment) {
  showAlert('Please enter comments.', 'warning');
  return;
}

    setActionSubmitting(true);
    setActingRecordId(actionId);
    setError('');
    try {
      const response: any = await authenticityUtility.patch(getApprovalEndpoint(actionId), {
        decision: actionType === "return" ? "returned" : "rejected",
        feedback: comment,
      });

      if (response?.status === 'success' || response?.success || response?.data?.success) {
        showAlert(actionType === 'return' ? 'Returned successfully' : 'Rejected successfully', 'success');
        closeActionPopup();
        setPage(1);
        await loadQueue(activeStage, 1);
      } else {
       showAlert(response?.message || response?.data?.message || `Failed to ${actionType}`, 'error');
      }
    } catch (approvalError: any) {
    showAlert(approvalError?.response?.data?.message || `Failed to ${actionType}`, 'error');
    } finally {
      setActingRecordId(null);
      setActionSubmitting(false);
    }
  };

  const getDisplayStatus = useCallback((record: Record<string, any>) => {
    const status = String(record.workflow_status || record.status || '').toLowerCase();
    const workflowDecision = getRecordWorkflowDecision(record);
    const stageDecision = getRecordStageDecision(record);
    const category = resolveStatusCategory(record);
    
    if (category === 'archived') return 'Archived';
    if (category === 'rejected') return 'Reject';
    if (category === 'returned') return 'Return';
    if (workflowDecision === 'resubmitted') return 'Resubmitted';
    if (category === 'approved') {
      if (stageDecision.includes('approved')) return 'Approved';
      if (status === 'level1_approved') return 'Approved Level-1';
      if (status === 'hod_approved') return 'Approved HOD';
      if (status === 'ithead_approved') return 'Approved IT Head';
      if (status === 'dof_approved') return 'Approved DoF';
      if (status === 'principal_approved') return 'Approved Principal';
      if (status === 'completed') return 'Completed';
      if (status === 'approved') return 'Approved';
      return 'Approved';
    }

    const activeTab = stageTabs.find((tab) => tab.key === activeStageTabKey) || null;
    if (config.moduleKey === 'finance') {
      const currentStageToken = String(getRecordCurrentStage(record) || '').toLowerCase();
      if (currentStageToken === 'level1') {
        if (activeStage === 'level1' && activeTab?.level1Role) {
          return FINANCE_LEVEL1_PENDING_LABELS[activeTab.level1Role];
        }
        const level1Role = resolveFinanceLevel1Role(record);
        return FINANCE_LEVEL1_PENDING_LABELS[level1Role];
      }
      if (currentStageToken) {
        return `Pending ${formatStageLabel(currentStageToken, config.stageLabels)}`;
      }
    }

    const stage = formatStageLabel(String(record.workflow_stage || ''), config.stageLabels);
    return `Pending ${stage}`;
  }, [
    activeStage,
    activeStageTabKey,
    config.moduleKey,
    config.stageLabels,
    getRecordCurrentStage,
    getRecordStageDecision,
    getRecordWorkflowDecision,
    resolveStatusCategory,
    stageTabs,
  ]);

  function resolveFinanceLevel1Role(record: Record<string, any>): 'hod' | 'coordinator' {
    const routeType = String(record.level1_route_type || record.level1RouteType || '').trim().toLowerCase();
    if (routeType === 'entity_contact') {
      return 'coordinator';
    }
    return 'hod';
  }

  const stageScopedRows = useMemo(() => {
    const activeLevel1Role = activeWorkflowTab?.level1Role || null;

    let filtered = rows;
    if (config.moduleKey === 'finance' && activeStage === 'level1' && activeLevel1Role) {
      filtered = filtered.filter((record) => resolveFinanceLevel1Role(record) === activeLevel1Role);
    }

    if (config.moduleKey === 'finance' && beneficiaryFilter !== 'All Beneficiary') {
      const normalizedBeneficiaryFilter = beneficiaryFilter.toLowerCase();
      filtered = filtered.filter((record) => {
        const itemBeneficiaryType = String(record.beneficiary_type || record.beneficiaryType || '').toLowerCase();
        return itemBeneficiaryType === normalizedBeneficiaryFilter;
      });
    }

    return filtered;
  }, [activeStage, activeWorkflowTab?.level1Role, beneficiaryFilter, config.moduleKey, rows]);

  const secondaryFilterOptions = useMemo(() => {
    if (config.moduleKey !== 'finance') {
      return [];
    }

    const values = new Set<string>();
    for (const row of stageScopedRows) {
      const value = getSecondaryFilterValue(row, beneficiaryFilter);
      if (value) {
        values.add(value);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'en-IN'));
  }, [beneficiaryFilter, config.moduleKey, stageScopedRows]);

  const secondaryFilterLabel = useMemo(
    () => getSecondaryFilterLabel(beneficiaryFilter),
    [beneficiaryFilter]
  );
  const secondaryFilterAllLabel = useMemo(
    () => getSecondaryFilterAllLabel(beneficiaryFilter),
    [beneficiaryFilter]
  );

  const secondaryScopedRows = useMemo(() => {
    if (config.moduleKey !== 'finance' || !secondaryFilter) {
      return stageScopedRows;
    }

    const expected = secondaryFilter.toLowerCase();
    return stageScopedRows.filter((record) => {
      return getSecondaryFilterValue(record, beneficiaryFilter).toLowerCase() === expected;
    });
  }, [beneficiaryFilter, config.moduleKey, secondaryFilter, stageScopedRows]);

  useEffect(() => {
    if (secondaryFilter && !secondaryFilterOptions.includes(secondaryFilter)) {
      setSecondaryFilter('');
    }
  }, [secondaryFilter, secondaryFilterOptions]);

  const statusStats = useMemo(() => {
    const stats = { total: secondaryScopedRows.length, pending: 0, approved: 0, returned: 0, rejected: 0, archived: 0 };
    for (const row of secondaryScopedRows) {
      const category = resolveStatusCategory(row);
      stats[category] += 1;
    }
    return stats;
  }, [resolveStatusCategory, secondaryScopedRows]);

  const filteredRows = useMemo(() => {
    let filtered = secondaryScopedRows;

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
  }, [searchTerm, secondaryScopedRows, statusFilter, resolveStatusCategory]);

  const totalPages = Math.max(1, Math.ceil((totalRows || 0) / (limit || 20)));

  const formatAmount = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return value || '-';
    return `₹ ${num.toLocaleString('en-IN')}`;
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'approved': return 'fw-status fw-status--approved';
      case 'rejected': return 'fw-status fw-status--rejected';
      case 'returned': return 'fw-status fw-status--returned';
      case 'archived': return 'fw-status fw-status--archived';
      default: return 'fw-status fw-status--pending';
    }
  };

  const getTimelineStageLabel = useCallback((entry: WorkflowTimelineItem) => {
    const stageToken = String(entry?.stage || '').trim().toLowerCase();

    if (config.moduleKey === 'finance' && stageToken === 'level1') {
      const actorRoleToken = String(entry?.actorRole || '').trim().toLowerCase();
      if (actorRoleToken === 'coordinator' || actorRoleToken === 'entity_approver') {
        return 'Coordinator';
      }
      if (actorRoleToken === 'hod') {
        return 'HOD';
      }
      if (logLevel1Role === 'coordinator') {
        return 'Coordinator';
      }
      if (logLevel1Role === 'hod') {
        return 'HOD';
      }
    }

    return formatStageLabel(entry.stage, config.stageLabels);
  }, [config.moduleKey, config.stageLabels, logLevel1Role]);

  const closeLogPopup = () => {
    setLogPopupOpen(false);
    setLogEntries([]);
    setExpandedLogDetails({});
    setLogRef('');
    setLogLevel1Role(null);
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

  showAlert(
    confirmMessage,
    'warning',
    isArchived ? 'Confirm Unarchive' : 'Confirm Archive',
    async () => {
      setArchivingIds((prev) => {
        const next = new Set(prev);
        next.add(recordId);
        return next;
      });

      try {
        const response: any = await authenticityUtility.patch(getArchiveEndpoint(recordId), {});
        const restoredStage = String(
          response?.data?.workflow_state?.currentStage ||
            response?.data?.currentState?.currentStage ||
            ''
        ).toLowerCase();

        if (isArchived && restoredStage) {
          setStatusFilter('pending');
          await switchToWorkflowStage(restoredStage);
        } else {
          setPage(1);
          await loadQueue(activeStage, 1);
        }
      } catch (archiveError: any) {
        showAlert(
          archiveError?.response?.data?.message ||
            archiveError?.message ||
            'Failed to archive/unarchive item',
          'error'
        );
      } finally {
        setArchivingIds((prev) => {
          const next = new Set(prev);
          next.delete(recordId);
          return next;
        });
      }
    },
    true,
    isArchived ? 'Unarchive' : 'Archive',
    'Cancel'
  );
  };

  const handlePdfPreviewClick = useCallback(
    (recordId: number | string, isActionablePending?: boolean) => {
      navigate(getRecordRoute(recordId, 'view'), {
        state: {
          openPreview: true,
          autoDownloadPdf: false,
          isActionablePending,
        },
      });
    },
    [getRecordRoute, navigate]
  );

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
    <div className="fw-page">
      <div className="fw-container">
        <div className="fw-card">
          <div className="fw-header">
            <h5 className="fw-title">{config.title}</h5>

            {stageTabs.length > 0 && (
              <div className="fw-role-tabs" role="tablist">
                {stageTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`fw-role-tab ${activeStageTabKey === tab.key ? 'active' : ''}`}
                    onClick={() => {
                      setActiveStageTabKey(tab.key);
                      if (activeStage !== tab.stage) {
                        setActiveStage(tab.stage);
                      }
                      setPage(1);
                    }}
                    role="tab"
                    aria-selected={activeStageTabKey === tab.key}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="fw-header-actions">
              <select
                className="fw-control"
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
                className="fw-control"
                value={beneficiaryFilter}
                onChange={(e) => {
                  setBeneficiaryFilter(e.target.value);
                  setSecondaryFilter('');
                }}
                title="Beneficiary"
              >
                {filteredBeneficiaryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {config.moduleKey === 'finance' && (
                <select
                  className="fw-control"
                  value={secondaryFilter}
                  onChange={(e) => setSecondaryFilter(e.target.value)}
                  title={secondaryFilterLabel}
                >
                  <option value="">{secondaryFilterAllLabel}</option>
                  {secondaryFilterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}

              <input
                className="fw-control"
                type="text"
                placeholder="Search ID or Applicant Name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="fw-stats">
            <div
              className={`fw-stats-card total ${statusFilter === 'total' ? 'active' : ''}`}
              onClick={() => setStatusFilter('total')}
            >
              <span className="fw-stats-icon"><Briefcase size={18} /></span>
              <div className="fw-stats-text">
                <span className="fw-stats-label">Total</span>
                <span className="fw-stats-number">{statusStats.total}</span>
              </div>
            </div>
            <div
              className={`fw-stats-card pending ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              <span className="fw-stats-icon"><Clock size={18} /></span>
              <div className="fw-stats-text">
                <span className="fw-stats-label">Pending</span>
                <span className="fw-stats-number">{statusStats.pending}</span>
              </div>
            </div>
            <div
              className={`fw-stats-card returned ${statusFilter === 'returned' ? 'active' : ''}`}
              onClick={() => setStatusFilter('returned')}
            >
              <span className="fw-stats-icon"><RotateCcw size={18} /></span>
              <div className="fw-stats-text">
                <span className="fw-stats-label">Return</span>
                <span className="fw-stats-number">{statusStats.returned}</span>
              </div>
            </div>
            <div
              className={`fw-stats-card rejected ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              <span className="fw-stats-icon"><XCircle size={18} /></span>
              <div className="fw-stats-text">
                <span className="fw-stats-label">Reject</span>
                <span className="fw-stats-number">{statusStats.rejected}</span>
              </div>
            </div>
            <div
              className={`fw-stats-card approved ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              <span className="fw-stats-icon"><CheckCircle2 size={18} /></span>
              <div className="fw-stats-text">
                <span className="fw-stats-label">Approved</span>
                <span className="fw-stats-number">{statusStats.approved}</span>
              </div>
            </div>
            <div
              className={`fw-stats-card archived ${statusFilter === 'archived' ? 'active' : ''}`}
              onClick={() => setStatusFilter('archived')}
            >
              <span className="fw-stats-icon"><Archive size={18} /></span>
              <div className="fw-stats-text">
                <span className="fw-stats-label">Archive</span>
                <span className="fw-stats-number">{statusStats.archived}</span>
              </div>
            </div>
          </div>

          <div className="fw-body">
            {error && <div className="fw-state">{error}</div>}

            {loading ? (
              <div className="fw-state">Loading workflow items...</div>
            ) : filteredRows.length === 0 ? (
              <div className="fw-state">No workflow items found</div>
            ) : (
              <>
                <div className="fw-cards-container">
                  {filteredRows.map((record, rowIndex) => {
                    const recordId = getRecordId(record) ?? `row-${rowIndex}`;
                    const timelineKey = String(recordId);
                    const statusCategory = resolveStatusCategory(record);
                    const recordCurrentStage = getRecordCurrentStage(record);
                    const isSuperAdminDeleteMode = isSuperAdminView;
                    const isPending = statusCategory === 'pending' && recordCurrentStage === activeStage.toLowerCase();
                    const isActionablePending =
                      isPending ||
                      (isSuperAdminView &&
                        Boolean(activeWorkflowTab?.showAllProposals) &&
                        statusCategory === 'pending' &&
                        Boolean(recordCurrentStage));
                    const isArchived = statusCategory === 'archived';
                    const isApproved = statusCategory === 'approved';
                    const isSuperAdminReturnAllowed =
                      isSuperAdminDeleteMode &&
                      ['pending', 'approved', 'rejected', 'archived'].includes(statusCategory);
                    const proposedAmount = record.total_amount || record.total_budget || record.amount || 0;
                    const approvedAmount = record.approved_total_amount || record.approved_amount || null;
                    const showApprovedAmount = approvedAmount !== null && approvedAmount !== undefined && approvedAmount !== 0;
                    const proposalRef = getRecordProposalRef(record);
                    
                    // Get tag based on beneficiary type
                    const beneficiaryType = record.beneficiary_type || record.beneficiaryType || '';
                    const tag = getTagFromBeneficiary(beneficiaryType);

                    return (
                      <div key={timelineKey} className="fw-item-wrap">
                        <div
                          className={`fw-item fw-item--clickable ${archivingIds.has(recordId) ? 'fw-item--archiving' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(getRecordRoute(recordId, 'view'), { state: { isActionablePending } })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(getRecordRoute(recordId, 'view'), { state: { isActionablePending } });
                            }
                          }}
                        >
                          <div className="fw-topbar">
                            <div className="fw-topbar-left">
                              <span className="fw-id">{proposalRef}</span>
                              <h5 className="fw-name">
                                {record.applicant_name || record.user_name || record.faculty_name || 'Unknown'}
                              </h5>
                              {/* Tag Pill - Display based on beneficiary type */}
                              {tag && tag.trim() !== '' && (
                                <span className="fw-tag-pill">{tag}</span>
                              )}
                            </div>

                            <div className="fw-topbar-right">
                              <div className="fw-amounts-container" style={{ display: 'flex', gap: '20px', textAlign: 'right', marginRight: '15px' }}>
                                <div className="fw-amount-item">
                                  <p className="fw-amount-label" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, opacity: 0.75 }}>
                                    {showApprovedAmount ? 'Proposed' : 'Amount'}
                                  </p>
                                  <p className="fw-amount" style={{ margin: 0, fontSize: '1.1rem' }}>
                                    {formatAmount(proposedAmount)}
                                  </p>
                                </div>
                                {showApprovedAmount && (
                                  <div className="fw-amount-item">
                                    <p className="fw-amount-label" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, opacity: 0.75 }}>
                                      Approved
                                    </p>
                                    <p className="fw-amount" style={{ margin: 0, fontSize: '1.1rem', color: '#137a3a' }}>
                                      {formatAmount(approvedAmount)}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <button
                                className="fw-icon-btn"
                                title="Logs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchFullTimeline(record, recordId, proposalRef);
                                }}
                              >
                                  <Info size={16} />
                                </button>

                              <button
                                className="fw-icon-btn"
                                title="View"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(getRecordRoute(recordId, 'view'), { state: { isActionablePending } });
                                }}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                className="fw-icon-btn"
                                title="Edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isApproved) {
                                    navigate(getRecordRoute(recordId, 'edit'));
                                  }
                                }}
                                disabled={isApproved}
                              >
                                <Edit2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="fw-row">
                            <div className="fw-left">
                              {filteredColumns.map((column) => (
                                <div key={column.key} className="fw-detail-row">
                                  <span className="fw-label">{column.label}</span>
                                  <span className="fw-value">
                                    {column.render
                                      ? column.render(record)
                                      : (record[column.key] ?? '-')}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="fw-right">
                              {Boolean(config.enablePdfPreview) && (
                                <button
                                  type="button"
                                  className="fw-action-btn fw-action-btn--download"
                                  title="Open PDF Preview"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePdfPreviewClick(recordId, isActionablePending);
                                  }}
                                >
                                  <FileText size={18} />
                                </button>
                              )}

                              <div className="fw-status-wrap">
                                <span className={getStatusClass(statusCategory)}>
                                  {getDisplayStatus(record)}
                                </span>
                              </div>
                              <div className="fw-actions-row">
                                {isSuperAdminView ? (
                                  !isArchived && (
                                    <>
                                      {isSuperAdminDeleteMode ? (
                                        <>
                                          <button
                                            className="fw-action-btn fw-action-btn--returned"
                                            title="Return"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openActionPopup("return", recordId, proposalRef);
                                            }}
                                            disabled={actingRecordId === recordId || !isSuperAdminReturnAllowed}
                                          >
                                            <RotateCcw size={18} />
                                          </button>
                                          <button
                                            className="fw-action-btn fw-action-btn--rejected"
                                            title="Delete"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteRecord(record);
                                            }}
                                            disabled={actingRecordId === recordId}
                                          >
                                            <Trash2 size={18} />
                                          </button>
                                        </>
                                      ) : (
                                        statusCategory === 'pending' && (
                                          <>
                                            <button
                                              className="fw-action-btn fw-action-btn--approved"
                                              title="Approve"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onApprove(recordId);
                                              }}
                                              disabled={actingRecordId === recordId || !isActionablePending}
                                            >
                                              <CheckCircle2 size={18} />
                                            </button>

                                            <button
                                              className="fw-action-btn fw-action-btn--returned"
                                              title="Return"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openActionPopup("return", recordId, proposalRef);
                                              }}
                                              disabled={actingRecordId === recordId || !isActionablePending}
                                            >
                                              <RotateCcw size={18} />
                                            </button>
                                          </>
                                        )
                                      )}
                                    </>
                                  )
                                ) : (
                                  statusCategory === 'pending' && (
                                    <>
                                      <button
                                        className="fw-action-btn fw-action-btn--approved"
                                        title="Approve"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onApprove(recordId);
                                        }}
                                        disabled={actingRecordId === recordId || !isActionablePending}
                                      >
                                        <CheckCircle2 size={18} />
                                      </button>

                                      <button
                                        className="fw-action-btn fw-action-btn--returned"
                                        title="Return"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openActionPopup("return", recordId, proposalRef);
                                        }}
                                        disabled={actingRecordId === recordId || !isActionablePending}
                                      >
                                        <RotateCcw size={18} />
                                      </button>

                                      <button
                                        className="fw-action-btn fw-action-btn--rejected"
                                        title="Reject"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openActionPopup("reject", recordId, proposalRef);
                                        }}
                                        disabled={actingRecordId === recordId || !isActionablePending}
                                      >
                                        <XCircle size={18} />
                                      </button>
                                    </>
                                  )
                                )}

                                {(isSuperAdminView || !isApproved) && (
                                  <button
                                    className="fw-action-btn fw-action-btn--archive"
                                    title={isArchived ? 'Unarchive' : 'Archive'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchiveToggle(record);
                                    }}
                                    disabled={
                                      archivingIds.has(recordId) ||
                                      (isSuperAdminView && config.moduleKey !== 'finance' && !isActionablePending)
                                    }
                                  >
                                    <Archive size={18} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="fw-pagination">
                  <div className="fw-pagination-left">
                    <div className="fw-rows-control">
                      <label htmlFor="workflow-rows-per-page" className="fw-rows-label">
                        Rows per page
                      </label>
                      <select
                        id="workflow-rows-per-page"
                        className="fw-rows-select"
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

                    <span className="fw-pagecount">
                      {filteredRows.length === 0
                        ? '0-0 of 0'
                        : `${(page - 1) * limit + 1}-${Math.min(((page - 1) * limit) + filteredRows.length, totalRows)} of ${totalRows}`}
                    </span>
                  </div>

                  <div className="fw-pagination-right">
                    <button
                      type="button"
                      className="fw-pagebtn"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>

                    <span className="fw-pageinfo">
                      Page {page} of {totalPages}
                    </span>

                    <button
                      type="button"
                      className="fw-pagebtn"
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
      {deletePopupOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close delete confirmation dialog"
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
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDeletePopup();
            }
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              closeDeletePopup();
            }
          }}
        >
          <div
            style={{
              width: "min(400px, 95vw)",
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 10px 35px rgba(0,0,0,0.25)",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#dc3545", marginBottom: 16 }}>
              <Trash2 size={48} />
            </div>
            <h4 style={{ margin: "0 0 8px 0", color: "#333" }}>Confirm Deletion</h4>
            <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
              Are you sure you want to permanently delete {config.deleteEntityLabel || 'this request'} <strong>{deleteRef}</strong>? This
              action cannot be undone.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
              <button
                type="button"
                onClick={closeDeletePopup}
                style={{
                  border: "1px solid #ddd",
                  background: "#fff",
                  borderRadius: 8,
                  padding: "8px 24px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteCountdown > 0}
                style={{
                  border: "none",
                  background: deleteCountdown > 0 ? "#e9ecef" : "#dc3545",
                  color: deleteCountdown > 0 ? "#6c757d" : "#fff",
                  borderRadius: 8,
                  padding: "8px 24px",
                  cursor: deleteCountdown > 0 ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  minWidth: "120px",
                  transition: "all 0.2s",
                }}
              >
                {deleteCountdown > 0 ? `Delete (${deleteCountdown}s)` : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
         <AlertModal
  show={alertConfig.show}
  onHide={closeAlert}
  message={alertConfig.message}
  type={alertConfig.type}
  title={alertConfig.title}
  onConfirm={alertConfig.onConfirm}
  showCancel={alertConfig.showCancel}
  confirmText={alertConfig.confirmText}
  cancelText={alertConfig.cancelText}
/>
      <CustomModal
        show={actionPopupOpen}
        onHide={actionSubmitting ? (() => {}) : closeActionPopup}
        title={actionType === "return" ? "Return Item - Comments" : "Reject Item - Comments"}
        size="sm"
        centered
        backdrop={actionSubmitting ? "static" : true}
        keyboard={!actionSubmitting}
        hideCloseButton={actionSubmitting}
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={closeActionPopup}
              disabled={actionSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn-sm ${actionType === "reject" ? "btn-danger" : "btn-warning text-dark"}`}
              onClick={submitActionWithComment}
              disabled={actionSubmitting}
            >
              {actionSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        }
      >
        <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
          Reference: <b>{actionRef}</b>
        </div>

        <textarea
          value={actionComment}
          onChange={(e) => setActionComment(e.target.value)}
          disabled={actionSubmitting}
          rows={4}
          placeholder="Enter comments (required)..."
          className="form-control"
        />
      </CustomModal>

      <CustomModal
        show={logPopupOpen}
        onHide={closeLogPopup}
        title="Workflow Timeline"
        size="lg"
        centered
        className="fw-log-modal"
        footer={
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={closeLogPopup}
          >
            Close
          </button>
        }
      >
        <div className="fw-log-body">
          <div className="fw-log-item">
            <span className="fw-log-label">Reference:</span>
            <span className="fw-log-value">{logRef || '--'}</span>
          </div>

          {logLoading && <div className="fw-state" style={{ padding: '24px 0' }}>Loading timeline...</div>}
          {!logLoading && logEntries.length === 0 && (
            <div className="fw-state" style={{ padding: '24px 0' }}>No timeline entries available.</div>
          )}

          {!logLoading && logEntries.length > 0 && (
            <div className="fw-log-approvals">
              {logEntries.map((entry, idx) => {
                const decisionToken = String(entry.decision || '').trim().toLowerCase();
                const actorRoleToken = String(entry.actorRole || '').trim().toLowerCase();
                const stageLabel = getTimelineStageLabel(entry);
                const isWorkflowUpdater = [
                  'hod',
                  'coordinator',
                  'entity_approver',
                  'ithead',
                  'dof',
                  'principal',
                  'admin',
                  'super_admin',
                  'superadmin',
                ].includes(actorRoleToken);
                const shouldShowStage =
                  Boolean(stageLabel && stageLabel !== '-') &&
                  (decisionToken !== 'updated' || isWorkflowUpdater);
                const entryKey = String(entry.id || idx);
                const updatedSubtitle = decisionToken === 'updated'
                  ? buildUpdatedLogSubtitles(entry)
                  : null;
                const subtitleText =
                  updatedSubtitle
                    ? (
                        expandedLogDetails[entryKey] && updatedSubtitle.full
                          ? updatedSubtitle.full
                          : updatedSubtitle.compact
                      )
                    : normalizeLogText(entry.feedback || entry.comment || entry.summary);
                const hasExpandedSubtitle = Boolean(
                  updatedSubtitle &&
                  updatedSubtitle.full &&
                  updatedSubtitle.compact &&
                  updatedSubtitle.full !== updatedSubtitle.compact
                );
                const actorLine = normalizeLogText(entry.userName)
                  ? `${normalizeLogText(entry.userName)} (${entry.actorEmail || 'Unknown'})`
                  : (entry.actorEmail || 'Unknown');
                const entryDate = entry.decidedAt || entry.createdAt || null;

                return (
                  <div key={entryKey} className="fw-log-approval-item">
                    <div className="fw-log-approval-meta">
                      <span className={`fw-log-decision fw-log-decision--${entry.decision?.toLowerCase() || 'approved'}`}>
                        {entry.decision?.toUpperCase() || 'UPDATE'}
                      </span>
                      {shouldShowStage && (
                        <span className="fw-log-role">
                          {stageLabel}
                        </span>
                      )}
                      {subtitleText && (
                        <span className="fw-log-feedback">Note: {subtitleText}</span>
                      )}
                      {hasExpandedSubtitle && (
                        <button
                          type="button"
                          className="fw-log-toggle-btn"
                          onClick={() => {
                            setExpandedLogDetails((prev) => ({
                              ...prev,
                              [entryKey]: !prev[entryKey],
                            }));
                          }}
                        >
                          {expandedLogDetails[entryKey] ? 'Show less' : 'Show full changes'}
                        </button>
                      )}
                      <span className="fw-log-actor-line">
                        By: {actorLine}
                      </span>
                      <span className="fw-log-date">
                        {entryDate ? new Date(entryDate).toLocaleString() : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CustomModal>
    </div>
  );
};

export default WorkflowApprovalPage;
