// client/src/features/user-dashboard/guesthousedashboard/guesthousedashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './guesthousedashboard.css';
import {
  Eye,
  Edit2,
  Briefcase,
  Clock,
  XCircle,
  CheckCircle,
  Archive,
  Search,
  Info,
  Trash2,
  FileText,
  Download,
  Upload,
  House,
  RotateCcw,
  CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import CustomModal from '../../../shared/components/ui/CustomModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import {  
  getGuesthouseWorkflowStage,  
  getGuesthouseWorkflowStages,
  isSuperAdmin,
} from '../../../shared/utils/permissionUtils';
import type { GuesthouseWorkflowStage } from '../../../shared/utils/permissionUtils';

interface GuesthouseCardItem {
  id: number;
  proposal_ref?: string | null;
  applicant_name: string;
  beneficiary_type: string;
  beneficiary_entity_id?: number | null;
  level1_route_type?: string | null;
  primary_head: string;
  budget_tag?: string;
  amount?: number;
  proposed_amount?: number | string | null;
  total_budget?: number | string | null;
  approved_total_amount?: number | string | null;
  overall_status: string;
  workflow_status?: string;
  fiscal_year?: number | string | null;
  fiscalYear?: number | string | null;
  created_at: string;
  updated_at?: string;
  has_room_allocation?: boolean | number;
  history_stage?: string | null;
  stage_decision?: string | null;
  stage_feedback?: string | null;
  stage_decided_at?: string | null;
  is_actionable?: boolean;
  beneficiary_name?: string;
  beneficiary_value?: string;
  guest_details?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  workflow_state?: {
    status: string;
    currentStage: string;
    flow?: string[];
    lastDecision?: string | null;
    isEditableByApplicant?: boolean;
    submittedTotalBudget?: number | string | null;
  };
  principal_document?: {
    id?: number | null;
    original_name?: string | null;
    stored_name?: string | null;
    file_path?: string | null;
    mime_type?: string | null;
    file_size?: number | null;
  } | null;
}

interface GuesthouseStatusUpdate {
  id: number;
  stage?: string | null;
  role?: string | null;
  status?: string | null;
  decision?: string | null;
  comment?: string | null;
  feedback?: string | null;
  summary?: string | null;
  details?: any;
  createdAt?: string | null;
  decidedAt?: string | null;
  userName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  isAdmin?: number | boolean | null;
  // The guesthouse API returns the database field names.  Keep the camel-case
  // fields above for the UI, while accepting the API shape here as well.
  created_at?: string | null;
  decided_at?: string | null;
  user_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  is_admin?: number | boolean | null;
}

interface GuesthouseLogEvent {
  key: string;
  badge: string;
  title: string;
  subtitle?: string;
  actorLabel: string;
  actorValue: string;
  actorBadgeLabel?: string;
  timestamp: string | number;
  dateLabel: string;
  decision?: string;
}

interface GuesthouseDashboardProps {
  approvalMode?: boolean;
}

const GuesthouseDashboard: React.FC<GuesthouseDashboardProps> = ({ approvalMode = false }) => {
  const { user } = useAuth();
  const availableApprovalStages = getGuesthouseWorkflowStages(user);
  const [selectedApprovalStage, setSelectedApprovalStage] = useState('');
  const approvalStage = approvalMode
    ? availableApprovalStages.includes(selectedApprovalStage as GuesthouseWorkflowStage)
      ? selectedApprovalStage as GuesthouseWorkflowStage
      : availableApprovalStages[0] || null
    : getGuesthouseWorkflowStage(user);
  const formatFiscalYearValue = (startYear: number) =>
    `${startYear}-${String(startYear + 1).slice(-2)}`;
  const getCurrentFiscalYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return formatFiscalYearValue(month >= 4 ? year : year - 1);
  };
  const getCurrentFiscalYearStart = () => Number.parseInt(getCurrentFiscalYear().split('-')[0], 10);
  const [data, setData] = useState<GuesthouseCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [queueError, setQueueError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [kpiStats, setKpiStats] = useState({
    total: 0,
    pending: 0,
    returned: 0,
    rejected: 0,
    approved: 0,
    archived: 0,
  });
  const [selectedStatus, setSelectedStatus] = useState<string>(() =>
    approvalMode ? 'pending' : 'all',
  );
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(() =>
    approvalMode ? 'all' : getCurrentFiscalYear(),
  );
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [activeInfoId, setActiveInfoId] = useState<number | null>(null);
  const [loadingInfoId, setLoadingInfoId] = useState<number | null>(null);
  const [logPopoverStyle, setLogPopoverStyle] = useState<React.CSSProperties>({});
  const infoTriggerRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const logPopoverRef = useRef<HTMLDivElement | null>(null);
  const [showGuesthouseStatusDetail, setShowGuesthouseStatusDetail] = useState<Record<number, boolean>>(
    {},
  );
  const [statusUpdatesById, setStatusUpdatesById] = useState<Record<number, GuesthouseStatusUpdate[]>>(
    {},
  );
  const [previewRecordId, setPreviewRecordId] = useState<number | null>(null);
  const navigate = useNavigate();
  const principalDocInputRef = useRef<HTMLInputElement | null>(null);
  const printPreviewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [isPrintPreviewReady, setIsPrintPreviewReady] = useState(false);
  const [principalDocTargetId, setPrincipalDocTargetId] = useState<number | null>(null);
  const [principalDocBusyId, setPrincipalDocBusyId] = useState<number | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<number | null>(null);
  const [dialogMessage, setDialogMessage] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [pendingApproval, setPendingApproval] = useState<{
    id: number;
    decision: 'returned' | 'rejected';
  } | null>(null);
  const [pendingArchive, setPendingArchive] = useState<GuesthouseCardItem | null>(null);
  useEffect(() => {
    fetchDashboard();
  }, [approvalMode, approvalStage]);

  useEffect(() => {
    setSelectedStatus(approvalMode ? 'pending' : 'all');
  }, [approvalMode]);

  useEffect(() => {
    fetchKpiStats();
  }, [approvalMode, approvalStage]);

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

  const updateLogPopoverPosition = (requestId: number) => {
    const trigger = infoTriggerRefs.current[requestId];
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 10;
    const preferredWidth = 320;
    const estimatedHeight = logPopoverRef.current?.offsetHeight || 360;
    // Keep the compact log visibly attached to the clicked Info action.
    // On the rightmost card action column it opens to the left; elsewhere it
    // opens to the right, without leaving the viewport.
    let left = rect.right + 10;
    if (left + preferredWidth > window.innerWidth - viewportPadding) {
      left = rect.left - preferredWidth - 10;
    }
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - preferredWidth - viewportPadding));
    let top = rect.top;
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - estimatedHeight - viewportPadding));

    setLogPopoverStyle({ position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${preferredWidth}px`, zIndex: 1000 });
  };

  useEffect(() => {
    if (activeInfoId === null) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const trigger = infoTriggerRefs.current[activeInfoId];
      if (trigger && !trigger.contains(event.target as Node) && !logPopoverRef.current?.contains(event.target as Node)) {
        setActiveInfoId(null);
      }
    };
    const reflow = () => updateLogPopoverPosition(activeInfoId);
    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('resize', reflow);
      window.removeEventListener('scroll', reflow, true);
    };
  }, [activeInfoId]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setQueueError('');
      setStatusUpdatesById({});
      if (approvalMode && !approvalStage) {
        setData([]);
        setQueueError('No Guest House workflow stage is assigned to this account.');
        return;
      }
      const res = (await authenticityUtility.get(approvalMode
        ? `/guesthouse/queue/${approvalStage}?status=all&limit=100`
        : '/guesthouse?mine=true')) as {
        success?: boolean;
        items?: GuesthouseCardItem[];
        scopeWarning?: string;
      };
      if (res.success === false) {
        throw new Error((res as any).message || 'Guest House queue request failed.');
      }
      setData(Array.isArray(res.items) ? res.items : []);
      if (res.scopeWarning) setQueueError(res.scopeWarning);
    } catch (err) {
      console.error('Guesthouse dashboard error', err);
      setData([]);
      setQueueError(
        (err as any)?.response?.data?.message ||
          (err as any)?.message ||
          'Unable to load Guest House requests. Check the server API.',
      );
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

  const getItemFiscalYear = (item: GuesthouseCardItem) => {
    const explicitYear = Number.parseInt(String(item.fiscal_year ?? item.fiscalYear ?? ''), 10);
    if (Number.isFinite(explicitYear) && explicitYear > 0) {
      return formatFiscalYearValue(explicitYear);
    }

    return formatFiscalYearValue(getFiscalYear(item.created_at));
  };

  const formatFiscalYearLabel = (fiscalYear: string) => `FY ${fiscalYear}`;

  const getWorkflowStatus = (item: GuesthouseCardItem) =>
    String(
      item.workflow_state?.status || item.workflow_status || item.overall_status || '',
    ).toLowerCase();

  const getCurrentStage = (item: GuesthouseCardItem) =>
    String(item.workflow_state?.currentStage || '').toLowerCase();

  const getNormalizedStatus = (item: GuesthouseCardItem) => {
    const stageDecision = String(item.stage_decision || '').toLowerCase();
    const status = getWorkflowStatus(item);
    // The live workflow state wins over an older stage decision. In particular,
    // an archived request may have been approved at an earlier workflow stage.
    if (status === 'archived' || status === 'archive') return 'archived';
    if (stageDecision === 'archived' || stageDecision === 'archive') return 'archived';
    if (stageDecision === 'returned') return 'returned';
    if (stageDecision === 'rejected') return 'rejected';
    if (stageDecision === 'approved' || stageDecision === 'completed') return 'approved';
    const currentStage = getCurrentStage(item);
    const lastDecision = String(item.workflow_state?.lastDecision || '').toLowerCase();
    if (status === 'returned') return 'returned';
    if (status === 'rejected') return 'rejected';
    if (status === 'completed' || status === 'approved') return 'approved';
    if (lastDecision === 'resubmitted') return 'resubmitted';
    if (currentStage === 'hod' && status === 'submitted') {
      return 'submitted';
    }
    if (status === 'submitted' || status === 'in_progress' || status === 'pending' || !status)
      return 'pending';
    return 'pending';
  };

  const getGuesthouseStatusLabel = (item: GuesthouseCardItem) => {
    const normalizedStatus = getNormalizedStatus(item);
    if (normalizedStatus === 'submitted') return 'Submitted';
    if (normalizedStatus === 'pending') return 'Pending';
    if (normalizedStatus === 'approved') return 'Approved';
    if (normalizedStatus === 'rejected') return 'Rejected';
    if (normalizedStatus === 'returned') return 'Returned';
    if (normalizedStatus === 'archived') return 'Archive';
    if (normalizedStatus === 'resubmitted') return 'Resubmitted';
    return 'Submitted';
  };

  const getGuesthouseFlowStages = (item: GuesthouseCardItem) => {
    const flow = item.workflow_state?.flow;
    return Array.isArray(flow) && flow.length ? flow : ['guesthouse_admin'];
  };

  const getGuesthouseTimelineState = (item: GuesthouseCardItem, stage: string) => {
    const normalizedStatus = getNormalizedStatus(item);
    const workflowStatus = getWorkflowStatus(item);
    const currentStage = getCurrentStage(item) || workflowStatus;
    const stages = getGuesthouseFlowStages(item);
    const stageIndex = stages.indexOf(stage);
    const currentIndex = stages.indexOf(currentStage);

    if (normalizedStatus === 'approved') return 'completed';
    if (normalizedStatus === 'rejected') {
      if (currentIndex >= 0 && stageIndex < currentIndex) return 'completed';
      if (currentIndex >= 0 && stageIndex === currentIndex) return 'rejected';
      return 'pending';
    }
    if (normalizedStatus === 'returned') {
      if (currentIndex >= 0 && stageIndex < currentIndex) return 'completed';
      if (currentIndex >= 0 && stageIndex === currentIndex) return 'current';
      return 'pending';
    }
    if (currentIndex >= 0 && stageIndex < currentIndex) return 'completed';
    if (currentIndex >= 0 && stageIndex === currentIndex) return 'current';
    return 'pending';
  };

  const isPendingLikeStatus = (item: GuesthouseCardItem) => {
    const normalizedStatus = getNormalizedStatus(item);
    return ['pending', 'submitted', 'resubmitted'].includes(normalizedStatus);
  };

  const canActOnApprovalItem = (item: GuesthouseCardItem) =>
    approvalMode &&
    item.is_actionable !== false &&
    getCurrentStage(item) === String(approvalStage || '').toLowerCase() &&
    ['in_progress', 'submitted', 'pending'].includes(getWorkflowStatus(item));

  const getDisplayAmount = (item: GuesthouseCardItem) => {
    const normalizedStatus = getNormalizedStatus(item);
    const rawAmount =
      normalizedStatus === 'approved'
        ? (item.approved_total_amount ?? item.total_budget ?? item.proposed_amount ?? 0)
        : (item.total_budget ??
          item.proposed_amount ??
          item.amount ??
          item.workflow_state?.submittedTotalBudget ??
          0);
    const parsedAmount = Number(rawAmount);
    return Number.isFinite(parsedAmount) ? parsedAmount : 0;
  };

  const getPrincipalDocument = (item: GuesthouseCardItem) => item.principal_document || null;

  const getPrincipalDocumentUrl = (item: GuesthouseCardItem) => {
    const filePath = String(getPrincipalDocument(item)?.file_path || '').trim();
    if (!filePath) return '';
    if (
      filePath.startsWith('http://') ||
      filePath.startsWith('https://') ||
      filePath.startsWith('blob:')
    ) {
      return filePath;
    }
    return `${authenticityUtility.getBaseURL()}${filePath}`;
  };

  const isPrincipalUser = Boolean(
    Array.isArray(user?.roles) &&
    user.roles.some(
      (role) =>
        String(role || '')
          .trim()
          .toLowerCase() === 'principal',
    ),
  );

  const isPrincipalDocumentEligible = (item: GuesthouseCardItem) => {
    const amount = getDisplayAmount(item);
    const workflowStatus = getWorkflowStatus(item);

    return (
      amount > 10000 &&
      (workflowStatus === 'approved' ||
        workflowStatus === 'completed' ||
        workflowStatus === 'principal_approved' ||
        workflowStatus === 'chairman_approved')
    );
  };

  const canShowPrincipalDocumentAction = (item: GuesthouseCardItem) => {
    return Boolean(getPrincipalDocumentUrl(item));
  };

  const openPrincipalDocumentPicker = (item: GuesthouseCardItem) => {
    if (!isPrincipalUser || !isPrincipalDocumentEligible(item)) return;
    setPrincipalDocTargetId(item.id);
    window.setTimeout(() => principalDocInputRef.current?.click(), 0);
  };

  const uploadPrincipalDocument = async (item: GuesthouseCardItem, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setPrincipalDocBusyId(item.id);
    try {
      const response = (await authenticityUtility.postFile(
        `/guesthouse/${item.id}/principal-document`,
        formData,
      )) as {
        success?: boolean;
        status?: string;
        message?: string;
        data?: {
          originalName?: string;
          storedName?: string;
          filePath?: string;
          mimeType?: string;
          size?: number;
        };
      };
      const isUploadSuccess = response?.success === true || response?.status === 'success';

      if (!isUploadSuccess) {
        setDialogMessage(response?.message || 'Failed to upload principal document');
        return;
      }

      setDialogMessage(`${file.name} uploaded successfully`);
      setData((prev) =>
        prev.map((row) => {
          if (row.id !== item.id) {
            return row;
          }

          return {
            ...row,
            principal_document: {
              ...(row.principal_document || {}),
              original_name: file.name,
              stored_name: response?.data?.storedName || null,
              file_path: response?.data?.filePath || null,
              mime_type: response?.data?.mimeType || 'application/pdf',
              file_size: Number.isFinite(Number(response?.data?.size))
                ? Number(response.data.size)
                : file.size,
            },
          };
        }),
      );
    } catch (error: any) {
      setDialogMessage(error?.response?.data?.message || error?.message || 'Failed to upload principal document');
    } finally {
      setPrincipalDocBusyId(null);
    }
  };

  const deletePrincipalDocument = async (item: GuesthouseCardItem) => {
    if (!isPrincipalUser || !getPrincipalDocumentUrl(item)) return;

    const confirmed = window.confirm('Delete the uploaded principal document?');
    if (!confirmed) return;

    setPrincipalDocBusyId(item.id);
    try {
      const response = (await authenticityUtility.delete(
        `/guesthouse/${item.id}/principal-document`,
      )) as {
        success?: boolean;
        status?: string;
        message?: string;
      };

      if (response?.success !== true && response?.status !== 'success') {
        setDialogMessage(response?.message || 'Failed to delete principal document');
        return;
      }

      setData((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, principal_document: null } : row)),
      );
    } catch (error: any) {
      setDialogMessage(error?.response?.data?.message || error?.message || 'Failed to delete principal document');
    } finally {
      setPrincipalDocBusyId(null);
    }
  };

  const handlePrincipalDocumentFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const targetId = principalDocTargetId;
    event.target.value = '';

    if (!file || targetId === null) {
      return;
    }

    if (
      (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) ||
      file.size >= 2 * 1024 * 1024
    ) {
      setDialogMessage('Only PDF files with a size less than 2MB are allowed.');
      return;
    }

    const targetItem = data.find((row) => row.id === targetId);
    if (!targetItem) return;

    await uploadPrincipalDocument(targetItem, file);
    setPrincipalDocTargetId(null);
  };

  const formatLabel = (value?: string | null) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '-';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getStageBadgeLabel = (stage?: string | null) => {
    const stageToken = String(stage || '')
      .trim()
      .toLowerCase();
    if (stageToken === 'hod') return 'HOD';
    if (stageToken === 'principal') return 'Principal';
    if (stageToken === 'guesthouse_admin') return 'Guest House Admin';
    if (stageToken === 'archived') return 'Archive';
    return formatLabel(stage);
  };

  const getUpdateTimestamp = (update: GuesthouseStatusUpdate) =>
    String(update.createdAt || update.created_at || update.decidedAt || update.decided_at || '').trim();

  const getUpdateSortPriority = (update: GuesthouseStatusUpdate) => {
    const decisionToken = String(update.decision || update.status || '')
      .trim()
      .toLowerCase();
    if (decisionToken.includes('returned')) return 10;
    if (decisionToken === 'updated') return 20;
    if (decisionToken.includes('approved') || decisionToken.includes('completed')) return 30;
    if (decisionToken.includes('rejected')) return 40;
    return 50;
  };

  const formatAuditValue = (label: string, rawValue: any) => {
    const value = String(rawValue ?? '').trim();
    if (!value || value === '-') return '-';

    const normalizedLabel = String(label || '').toLowerCase();
    const isAmountField = ['amount', 'budget', 'balance', 'partial'].some((token) =>
      normalizedLabel.includes(token),
    );
    if (isAmountField) {
      const num = Number(value);
      if (Number.isFinite(num)) {
        return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }

    const parsedMs = Date.parse(value);
    if (
      Number.isFinite(parsedMs) &&
      (normalizedLabel.includes('date') ||
        /^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value.includes('GMT'))
    ) {
      return new Date(parsedMs).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }

    return value;
  };

  const trimUpdatedSummary = (summary: string) => {
    if (!summary) return '';
    const parts = summary
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !/^\d+\s+field\(s\)\s+updated$/i.test(part));

    return parts.join(' | ');
  };

  const buildRowUpdateSummary = (details: any) => {
    void details;
    return '';
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

  const parseDateTime = (value?: string | null) => {
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
  };

  const fetchKpiStats = async () => {
    if (!approvalMode || !approvalStage) {
      return;
    }

    try {
      setStatsError('');
      const response = (await authenticityUtility.get(
        `/guesthouse/queue/${approvalStage}/kpi-stats`,
      )) as {
        success?: boolean;
        data?: Partial<typeof kpiStats>;
        stats?: Partial<typeof kpiStats>;
        scopeWarning?: string;
      };

      const nextStats = response?.stats || response?.data;
      if (response?.success && nextStats) {
        setKpiStats((prev) => ({ ...prev, ...nextStats }));
        if (response.scopeWarning) setStatsError(response.scopeWarning);
      } else {
        throw new Error((response as any)?.message || 'Guest House queue statistics request failed.');
      }
    } catch (error) {
      console.error('Guesthouse KPI stats error', error);
      setStatsError(
        (error as any)?.response?.data?.message ||
          (error as any)?.message ||
          'Unable to load Guest House queue statistics.',
      );
    }
  };

  type GuesthouseDecision = 'approved' | 'returned' | 'rejected';

  const handleApprovalDecision = async (id: number, decision: GuesthouseDecision) => {
    if (approvalBusyId !== null) return;
    if (decision !== 'approved') {
      setApprovalComment('');
      setPendingApproval({ id, decision });
      return;
    }
    await submitApprovalDecision(id, decision, '');
  };

  const submitApprovalDecision = async (
    id: number,
    decision: GuesthouseDecision,
    comment: string,
  ) => {
    setApprovalBusyId(id);
    try {
      const response = (await authenticityUtility.patch(`/guesthouse/${id}/approval`, {
        decision,
        feedback: comment,
      })) as any;
      if (!response?.success) {
        throw new Error(response?.message || 'Guest House approval could not be completed');
      }
      await fetchDashboard();
      await fetchKpiStats();
    } catch (error) {
      console.error('Guesthouse approval action failed', error);
      setDialogMessage((error as any)?.response?.data?.message || (error as Error).message || 'Guest House approval could not be completed');
    } finally {
      setApprovalBusyId(null);
    }
  };

  const formatBookingDate = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getProposalRef = (item: GuesthouseCardItem) =>
    String(item.proposal_ref || '').trim() ||
    `#GH-${new Date(item.created_at).getFullYear()}-${String(item.id).padStart(4, '0')}`;

  const buildGuesthouseLogEvents = (
    item: GuesthouseCardItem,
    updates: GuesthouseStatusUpdate[],
  ): GuesthouseLogEvent[] => {
    const formatActorIdentity = (
      name?: string | null,
      email?: string | null,
      fallback?: string | null,
    ) => {
      const normalizedName = String(name || '').trim();
      const normalizedEmail = String(email || '').trim();
      const normalizedFallback = String(fallback || '').trim();

      if (
        normalizedName &&
        normalizedEmail &&
        normalizedName.toLowerCase() !== normalizedEmail.toLowerCase()
      ) {
        return `${normalizedName} (${normalizedEmail})`;
      }

      if (normalizedName) return normalizedName;
      if (normalizedEmail) return normalizedEmail;
      return normalizedFallback || '-';
    };

    const hasSubmittedUpdate = updates.some((update) => {
      const decision = String(update.decision || update.status || '')
        .trim()
        .toLowerCase();
      return decision === 'submitted';
    });

    const events: GuesthouseLogEvent[] = hasSubmittedUpdate
      ? []
      : [
          {
            key: `created-${item.id}`,
            badge: 'SUBMITTED',
            title: 'Proposal created',
            subtitle: 'Initial Guest House request submitted',
            actorLabel: 'Submitted By',
            actorValue: item.applicant_name,
            actorBadgeLabel: '',
            timestamp: item.created_at,
            dateLabel: formatDateTime(item.created_at),
            decision: 'submitted',
          },
        ];

    const sortedUpdates = [...updates].sort((left, right) => {
      const leftMs = Date.parse(getUpdateTimestamp(left) || '') || 0;
      const rightMs = Date.parse(getUpdateTimestamp(right) || '') || 0;

      if (leftMs !== rightMs) {
        return leftMs - rightMs;
      }

      const leftPriority = getUpdateSortPriority(left);
      const rightPriority = getUpdateSortPriority(right);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return Number(left.id || 0) - Number(right.id || 0);
    });

    sortedUpdates.forEach((update, index) => {
      const decision = String(update.decision || update.status || '').toLowerCase();
      const stage = getStageBadgeLabel(update.stage || update.role);
      const actorName = update.userName ?? update.user_name;
      const actorEmail = update.actorEmail ?? update.actor_email;
      const actorRole = update.actorRole ?? update.actor_role;
      const eventSummary = update.summary ?? update.feedback ?? update.comment;
      const eventCreatedAt =
        update.createdAt ?? update.created_at ?? update.decidedAt ?? update.decided_at ?? null;
      const actorValue = formatActorIdentity(actorName, actorEmail, actorRole || 'Workflow');
      const isSubmitted = decision.includes('submitted');
      const isReturned = decision.includes('returned');
      const isRejected = decision.includes('rejected');
      const isApproved = decision.includes('approved') || decision.includes('completed');
      const isUpdated = decision === 'updated';
      const isAdmin =
        Boolean(update.isAdmin ?? update.is_admin) ||
        ['admin', 'super_admin', 'superadmin'].includes(String(actorRole || '').toLowerCase());

      let badge = 'UPDATED';
      let title = 'Proposal edited';
      let actorLabel = 'Updated By';
      let subtitle = String(eventSummary || '').trim();
      let actorBadgeLabel = '';

      if (isSubmitted) {
        badge = 'SUBMITTED';
        title = 'Proposal created';
        actorLabel = 'Submitted By';
        // Budget's initial event shows the creator and timestamp without a
        // duplicate "initial submission" status line.
        subtitle = '';
      } else if (isReturned) {
        badge = 'RETURNED';
        title = 'Proposal returned';
        subtitle = [stage !== '-' ? `by ${stage}` : '', subtitle].filter(Boolean).join(' | ');
      } else if (isRejected) {
        badge = 'REJECTED';
        title = 'Proposal rejected';
        subtitle = [stage !== '-' ? `by ${stage}` : '', subtitle].filter(Boolean).join(' | ');
      } else if (isApproved) {
        badge = 'APPROVED';
        title = 'Proposal approved';
        subtitle = [stage !== '-' ? `by ${stage}` : '', subtitle].filter(Boolean).join(' | ');
      } else if (isUpdated) {
        badge = 'UPDATED';
        title = 'Proposal updated';
        const details =
          update.details && typeof update.details === 'object' ? update.details : null;
        const changedFields = Array.isArray(details?.changedFields) ? details.changedFields : [];
        const fieldCountSummary =
          changedFields.length > 0 ? `${changedFields.length} field(s) updated` : '';
        const rowSummary = buildRowUpdateSummary(details);
        const fieldSummary = changedFields.length
          ? changedFields
              .map((field: any) => {
                const label = String(field?.label || '').trim() || 'Field';
                const before = formatAuditValue(label, field?.before);
                const after = formatAuditValue(label, field?.after);
                return `${label}: ${before} -> ${after}`;
              })
              .join(' | ')
          : '';
        const fallbackSummary = trimUpdatedSummary(String(eventSummary || '').trim());
        subtitle =
          [fieldCountSummary, rowSummary || fallbackSummary, fieldSummary]
            .filter(Boolean)
            .join(' | ') || 'Proposal updated';
        if (isAdmin) {
          actorBadgeLabel = 'SUPERADMIN';
        }
      }

      events.push({
        key: `${update.id}-${index}`,
        badge,
        title,
        subtitle,
        actorLabel,
        actorValue,
        // Only explicit administrator edits receive the orange admin treatment,
        // exactly as on the Budget submission-log cards.
        actorBadgeLabel: isUpdated ? actorBadgeLabel : '',
        timestamp: eventCreatedAt || item.created_at,
        dateLabel: formatDateTime(eventCreatedAt || item.created_at),
        decision,
      });
    });

    return events;
  };

  const fetchStatusUpdates = async (requestId: number) => {
    if (statusUpdatesById[requestId]) return;

    try {
      setLoadingInfoId(requestId);
      const response = (await authenticityUtility.get(
        `/guesthouse/${requestId}/status-updates`,
      )) as {
        status?: string;
        success?: boolean;
        data?: GuesthouseStatusUpdate[];
      };

      setStatusUpdatesById((prev) => ({
        ...prev,
        [requestId]:
          response.success === true || response.status === 'success' ? response.data || [] : [],
      }));
    } catch (error) {
      console.error('Failed to load guesthouse status updates', error);
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
    // The second frame runs after the popover ref has been attached, so its
    // measured height is used instead of a guess.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => updateLogPopoverPosition(requestId)),
    );
    await fetchStatusUpdates(requestId);
    requestAnimationFrame(() => updateLogPopoverPosition(requestId));
  };

  const handleViewClick = (requestId: number) => {
    navigate(`/guesthouse/${requestId}${approvalMode ? '?admin=true' : ''}`);
  };

  const canEditRequest = (item: GuesthouseCardItem) => {
    // The dashboard lists the current user's requests; every one can be
    // reopened for editing. The API independently verifies ownership.
    if (approvalMode && ['approved', 'rejected', 'archived'].includes(getNormalizedStatus(item))) {
      return false;
    }
    return Boolean(item) || isSuperAdmin(user);
  };

  const handleEditClick = (item: GuesthouseCardItem) => {
    if (!canEditRequest(item)) return;
    navigate(`/guesthouse/${item.id}/edit`);
  };

  const canToggleArchiveRequest = (item: GuesthouseCardItem) => {
    if (!approvalMode || getCurrentStage(item) !== String(approvalStage || '').toLowerCase()) {
      return false;
    }
    const normalizedStatus = getNormalizedStatus(item);
    return normalizedStatus === 'archived' ||
      !['approved', 'rejected', 'returned'].includes(normalizedStatus);
  };

  const handleArchiveToggle = async () => {
    const item = pendingArchive;
    if (!item || !canToggleArchiveRequest(item) || approvalBusyId !== null) return;
    const isArchived = getNormalizedStatus(item) === 'archived';
    setApprovalBusyId(item.id);
    try {
      const response = (await authenticityUtility.patch(
        `/guesthouse/${item.id}/archive-toggle`,
        {},
      )) as {
        success?: boolean;
        message?: string;
      };
      if (!response.success) {
        throw new Error(response.message || `Failed to ${isArchived ? 'unarchive' : 'archive'} request`);
      }
      await fetchDashboard();
      if (approvalMode) await fetchKpiStats();
      setPendingArchive(null);
    } catch (error) {
      console.error('Failed to toggle Guest House archive state', error);
      setDialogMessage(
        (error as any)?.response?.data?.message ||
          (error as Error).message ||
          'Failed to update archive state',
      );
    } finally {
      setApprovalBusyId(null);
    }
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    if (selectedStatus === 'pending') {
      result = result.filter((item) => isPendingLikeStatus(item));
    } else if (selectedStatus !== 'all' && selectedStatus !== 'total') {
      result = result.filter((item) => getNormalizedStatus(item) === selectedStatus);
    }

    if (selectedFiscalYear !== 'all') {
      result = result.filter((item) => getItemFiscalYear(item) === selectedFiscalYear);
    }

    if (selectedBeneficiary !== 'all') {
      result = result.filter((item) => item.beneficiary_type === selectedBeneficiary);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          (item.applicant_name?.toLowerCase() || '').includes(lowerSearch) ||
          (item.primary_head?.toLowerCase() || '').includes(lowerSearch),
      );
    }

    return result;
  }, [data, selectedStatus, selectedFiscalYear, selectedBeneficiary, searchTerm]);

  const localStats = {
    total: data.length,
    pending: data.filter((item) => isPendingLikeStatus(item)).length,
    returned: data.filter((item) => getNormalizedStatus(item) === 'returned').length,
    rejected: data.filter((item) => getNormalizedStatus(item) === 'rejected').length,
    approved: data.filter((item) => getNormalizedStatus(item) === 'approved').length,
    archived: data.filter((item) => getNormalizedStatus(item) === 'archived').length,
  };
  const stats = approvalMode ? kpiStats : localStats;

  const statCards = [
    { key: 'all', label: 'Total', count: stats.total, icon: Briefcase },
    { key: 'pending', label: 'Pending', count: stats.pending, icon: Clock },
    { key: 'returned', label: 'Return', count: stats.returned, icon: RotateCcw },
    { key: 'rejected', label: 'Reject', count: stats.rejected, icon: XCircle },
    { key: 'approved', label: 'Approved', count: stats.approved, icon: CheckCircle },
    { key: 'archived', label: 'Archive', count: stats.archived, icon: Archive },
  ] as const;

  const currentFiscalYear = getCurrentFiscalYear();
  const currentFiscalYearStart = getCurrentFiscalYearStart();
  const fiscalYears = Array.from(
    new Set([
      ...data.map((item) => getItemFiscalYear(item)).filter(Boolean),
      currentFiscalYear,
      formatFiscalYearValue(currentFiscalYearStart - 1),
    ]),
  ).sort((a, b) => Number.parseInt(b.split('-')[0], 10) - Number.parseInt(a.split('-')[0], 10));
  const beneficiaryTypes = Array.from(
    new Set(
      data
        .map((item) => item.beneficiary_type?.trim())
        .filter((type): type is string => Boolean(type)),
    ),
  ).sort();
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = filteredData.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredData.length);
  const paginatedData = filteredData.slice(pageStartIndex, pageEndIndex);
  const activeInfoItem =
    activeInfoId !== null ? (data.find((item) => item.id === activeInfoId) ?? null) : null;
  const activeStatusUpdates = activeInfoId !== null ? statusUpdatesById[activeInfoId] || [] : [];
  const activeLogEvents = activeInfoItem
    ? buildGuesthouseLogEvents(activeInfoItem, activeStatusUpdates)
    : [];
  const fiscalYearOptions = [
    { value: 'all', label: 'All' },
    ...fiscalYears.map((fy) => ({
      value: fy,
      label: formatFiscalYearLabel(fy),
    })),
  ];
  const beneficiaryTypeOptions = [
    { value: 'all', label: 'All Beneficiaries' },
    ...beneficiaryTypes.map((type) => ({
      value: type,
      label: type,
    })),
  ];
  const handlePdfPreviewClick = (requestId: number) => {
    setIsPrintPreviewReady(false);
    setPreviewRecordId(requestId);
  };

  useEffect(() => {
    const handlePrintDocumentReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== printPreviewFrameRef.current?.contentWindow) return;
      if (event.data?.type === 'guesthouse-print-document-ready') setIsPrintPreviewReady(true);
    };
    window.addEventListener('message', handlePrintDocumentReady);
    return () => window.removeEventListener('message', handlePrintDocumentReady);
  }, []);

  const handleDownloadPreviewPdf = () => {
    if (!isPrintPreviewReady) return;
    const frameWindow = printPreviewFrameRef.current?.contentWindow;
    if (!frameWindow) return;
    const printFrame = frameWindow.document.querySelector<HTMLIFrameElement>('.guesthouse-print-document');
    const printWindow = printFrame?.contentWindow;
    if (!printWindow) return;
    printWindow.focus();
    printWindow.print();
  };

  const approvalStageLabel =
    approvalStage === 'guesthouse_admin'
      ? 'Guest House Admin'
      : approvalStage === 'guesthouse_incharge'
        ? 'Guest House Incharge'
      : approvalStage
        ? approvalStage.toUpperCase()
        : '';
  const pendingArchiveStatus = pendingArchive ? getNormalizedStatus(pendingArchive) : '';
  const pendingApprovalItem = pendingApproval
    ? data.find((item) => item.id === pendingApproval.id)
    : undefined;
  const pendingApprovalReference = pendingApproval
    ? pendingApprovalItem
      ? getProposalRef(pendingApprovalItem)
      : `#GH-${new Date().getFullYear()}-${String(pendingApproval.id).padStart(4, '0')}`
    : '';

  return (
    <>
      <input
        ref={principalDocInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={handlePrincipalDocumentFileChange}
      />
      <section className="guesthousedashboard-page">
        <button
          type="button"
          className="guesthousedashboard-calendar-btn guesthousedashboard-calendar-btn--floating"
          onClick={() =>
            navigate('/guesthouse-calendar', {
              state: { approvalMode, approvalStage },
            })
          }
          aria-label="Open Guest House calendar"
          title="Guest House calendar"
        >
          <CalendarDays size={20} />
        </button>
        <div className="guesthousedashboard-container">
          <div className="guesthousedashboard-card">
            {/* HEADER & FILTERS */}
            <div className="guesthousedashboard-header-single">
              <div className="header-left-section">
                 <h5 className="guesthousedashboard-title">Guest House Requests</h5>
                 {approvalMode && availableApprovalStages.length > 1 && (
                   <select
                     aria-label="Guest House approval stage"
                     value={approvalStage || ''}
                     onChange={(event) => setSelectedApprovalStage(event.target.value)}
                   >
                     {availableApprovalStages.map((stage) => (
                       <option key={stage} value={stage}>
                         {stage.replace(/_/g, ' ').toUpperCase()}
                       </option>
                     ))}
                   </select>
                 )}
                 {approvalMode && approvalStageLabel && (
                   <>
                     <span className="guesthousedashboard-role-badge">
                       {approvalStageLabel}
                     </span>
                     {approvalStage === 'guesthouse_admin' && (
                       <button
                         type="button"
                         className="guesthousedashboard-manage-resources-button"
                         onClick={() => navigate('/guesthouse/new?manageResources=true')}
                       >
                         Manage resources
                       </button>
                     )}
                   </>
                 )}
              </div>

              <div className="header-right-section">
                <div className="search-box">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder={
                      approvalMode
                        ? 'Search Guest House ID or Applicant...'
                        : 'Search applicant or primary head...'
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <XCircle size={16} className="clear-icon" onClick={() => setSearchTerm('')} />
                  )}
                </div>

                <div className="filter-group">
                  <div className="filter-item">
                    <select
                      className="guesthousedashboard-financial-year"
                      value={selectedFiscalYear || currentFiscalYear}
                      onChange={(event) =>
                        setSelectedFiscalYear(event.target.value || currentFiscalYear)
                      }
                      aria-label="Select financial year"
                    >
                      {fiscalYearOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-item">
                    <select
                      className="guesthousedashboard-beneficiary-filter"
                      value={selectedBeneficiary}
                      onChange={(event) => setSelectedBeneficiary(event.target.value || 'all')}
                      aria-label="Select beneficiary type"
                    >
                      {beneficiaryTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="guesthousedashboard-header-actions">
                  {!approvalMode && (
                    <button
                      className="guesthousedashboard-add-btn"
                      onClick={() =>
                        navigate('/guesthouse/new', {
                          state: {
                            fiscalYear:
                              selectedFiscalYear && selectedFiscalYear !== 'all'
                                ? selectedFiscalYear
                                : currentFiscalYear,
                          },
                        })
                      }
                    >
                      Add +
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="guesthousedashboard-stats-row-inside">
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

            {approvalMode && statsError && (
              <div className="guesthousedashboard-state guesthousedashboard-state--error" role="alert">
                Queue counts: {statsError}
              </div>
            )}

            {/* CONTENT */}
            <div className="guesthousedashboard-body">
              {loading && <div className="guesthousedashboard-state">Loading Guest House requests...</div>}

              {!loading && queueError && (
                <div className="guesthousedashboard-state guesthousedashboard-state--error" role="alert">
                  {queueError}
                </div>
              )}

              {!loading && !queueError && filteredData.length === 0 && (
                <div
                  className="guesthousedashboard-state"
                  style={{ padding: '60px 20px', fontSize: '15px' }}
                >
                  No Guest House requests found
                </div>
              )}

              {!loading && !queueError && filteredData.length > 0 && (
                <div className="guesthousedashboard-list-container">
                  {paginatedData.map((item) => {
                    const status = getNormalizedStatus(item);
                    const canEdit = canEditRequest(item);
                    const hasRoomAllocation = Number(item.has_room_allocation) === 1;
                    const canToggleArchive = canToggleArchiveRequest(item);
                    const isStatusExpanded = Boolean(showGuesthouseStatusDetail[item.id]);
                    const principalDocument = getPrincipalDocument(item);
                    const principalDocumentUrl = getPrincipalDocumentUrl(item);
                    const principalDocumentTitle = String(
                      principalDocument?.original_name ||
                        principalDocument?.stored_name ||
                        'Principal Document',
                    ).trim();
                    const showPrincipalDocumentAction =
                      canShowPrincipalDocumentAction(item) ||
                      (isPrincipalUser && isPrincipalDocumentEligible(item));
                    const principalActionLoading = principalDocBusyId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="guesthousedashboard-item-card guesthousedashboard-item-card--openable"
                        role="link"
                        tabIndex={0}
                        aria-label={`View Guest House request ${getProposalRef(item)}`}
                        onClick={(event) => {
                          // Keep the card actions independent; a click on the card body opens a read-only view.
                          if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                          handleViewClick(item.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleViewClick(item.id);
                          }
                        }}
                      >
                        <div className="card-row-top">
                          <div className="card-header-left">
                            <span className="card-id-pill">{getProposalRef(item)}</span>
                            <span className="card-applicant-name">{item.applicant_name}</span>
                            <span className="card-category-tag">
                              {formatBookingDate(item.check_in_date)}
                              {item.check_out_date ? ` – ${formatBookingDate(item.check_out_date)}` : ''}
                            </span>
                          </div>

                          <div className="card-header-right">
                            <div className="card-actions-main">
                              <button
                                type="button"
                                className="icon-btn-subtle guesthousedashboard-info-trigger"
                                title="Info"
                                ref={(element) => { infoTriggerRefs.current[item.id] = element; }}
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
                              {canEdit && (
                                <button
                                  type="button"
                                  className="icon-btn-subtle"
                                  title="Edit"
                                  onClick={() => handleEditClick(item)}
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="card-row-bottom">
                          <div className="card-row-middle">
                            <span className="beneficiary-label">Guest Details :</span>
                            <span className="beneficiary-value">
                              {item.guest_details || item.beneficiary_name || item.beneficiary_value || '-'}
                            </span>
                          </div>
                          <div className="card-footer-right">
                            {!approvalMode && hasRoomAllocation && (
                              <button
                                type="button"
                                className="icon-btn-subtle"
                                title="View room allocation"
                                onClick={() => navigate(`/guesthouse/${item.id}?allotment=true`)}
                              >
                                <House size={18} />
                              </button>
                            )}
                            {isPrincipalUser && isPrincipalDocumentEligible(item) && !principalDocumentUrl && (
                              <button
                                type="button"
                                className="icon-btn-subtle guesthousedashboard-principal-mini-btn"
                                title="Upload Principal Document"
                                onClick={() => openPrincipalDocumentPicker(item)}
                                disabled={principalActionLoading}
                              >
                                <Upload size={16} />
                              </button>
                            )}
                            {showPrincipalDocumentAction && (
                              <>
                                <button
                                  type="button"
                                  className="icon-btn-subtle guesthousedashboard-download-btn guesthousedashboard-principal-download-btn"
                                  title={principalDocumentTitle}
                                  onClick={() => {
                                    if (!principalDocumentUrl) return;
                                    const link = document.createElement('a');
                                    link.href = principalDocumentUrl;
                                    link.download =
                                      principalDocumentTitle || 'Principal Document.pdf';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                  disabled={principalActionLoading}
                                >
                                  <Download size={18} />
                                </button>

                                {isPrincipalUser && (
                                  <>
                                    <button
                                      type="button"
                                      className="icon-btn-subtle guesthousedashboard-principal-mini-btn"
                                      title={`View ${principalDocumentTitle}`}
                                      onClick={() =>
                                        window.open(
                                          principalDocumentUrl,
                                          '_blank',
                                          'noopener,noreferrer',
                                        )
                                      }
                                      disabled={principalActionLoading}
                                    >
                                      <Eye size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      className="icon-btn-subtle guesthousedashboard-principal-mini-btn guesthousedashboard-principal-delete-btn"
                                      title={`Delete ${principalDocumentTitle}`}
                                      onClick={() => deletePrincipalDocument(item)}
                                      disabled={principalActionLoading}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}

                            <button
                              type="button"
                              className="icon-btn-subtle guesthousedashboard-download-btn"
                              title="Open PDF Preview"
                              onClick={() => handlePdfPreviewClick(item.id)}
                            >
                              <FileText size={18} />
                            </button>

                            <div className="guesthousedashboard-status-actions">
                              <button
                                type="button"
                                className={`status-pill-solid status-${status} guesthouse-status-pill`}
                                onClick={() => {
                                  if (approvalMode) {
                                    navigate(`/guesthouse/${item.id}?admin=true`);
                                    return;
                                  }
                                  setShowGuesthouseStatusDetail((prev) => ({
                                    ...prev,
                                    [item.id]: !prev[item.id],
                                  }));
                                }}
                                aria-expanded={!approvalMode ? isStatusExpanded : undefined}
                                aria-label={approvalMode
                                  ? `Open ${getGuesthouseStatusLabel(item)} request for ${item.applicant_name}`
                                  : `Toggle workflow timeline for ${item.applicant_name}`}
                                title={approvalMode ? 'Open request' : 'Show workflow progress'}
                              >
                                {getGuesthouseStatusLabel(item)}
                              </button>
                              {(canActOnApprovalItem(item) || canToggleArchive) && (
                                <div className="guesthousedashboard-approval-actions">
                                  {canActOnApprovalItem(item) && <button
                                    type="button"
                                    className="guesthousedashboard-action-btn guesthousedashboard-action-btn--approve"
                                    title="Approve"
                                    disabled={approvalBusyId !== null}
                                    onClick={() => void handleApprovalDecision(item.id, 'approved')}
                                  >
                                    <CheckCircle size={18} />
                                  </button>}
                                  {canActOnApprovalItem(item) && <button
                                    type="button"
                                    className="guesthousedashboard-action-btn guesthousedashboard-action-btn--return"
                                    title="Return"
                                    disabled={approvalBusyId !== null}
                                    onClick={() => void handleApprovalDecision(item.id, 'returned')}
                                  >
                                    <RotateCcw size={18} />
                                  </button>}
                                  {canActOnApprovalItem(item) && <button
                                    type="button"
                                    className="guesthousedashboard-action-btn guesthousedashboard-action-btn--reject"
                                    title="Reject"
                                    disabled={approvalBusyId !== null}
                                    onClick={() => void handleApprovalDecision(item.id, 'rejected')}
                                  >
                                    <XCircle size={18} />
                                  </button>}
                                  {canToggleArchive && (
                                    <button
                                      type="button"
                                      className="guesthousedashboard-action-btn guesthousedashboard-action-btn--archive"
                                      title={getNormalizedStatus(item) === 'archived' ? 'Unarchive' : 'Archive'}
                                      disabled={approvalBusyId !== null}
                                      onClick={() => setPendingArchive(item)}
                                    >
                                      <Archive size={18} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {!approvalMode && isStatusExpanded && (
                              <div className="guesthouse-status-detail-line">
                                {getGuesthouseFlowStages(item).map((stage, stageIndex, array) => {
                                  const stageState = getGuesthouseTimelineState(item, stage);
                                  return (
                                    <React.Fragment key={stage}>
                                      <div
                                        className={`guesthouse-status-line-circle guesthouse-status-circle-${stageState}`}
                                        title={stage.toUpperCase()}
                                      />
                                      {stageIndex < array.length - 1 && (
                                        <div className={`guesthouse-status-line-connector guesthouse-status-line-connector--${stageState}`} />
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
                <div className="guesthousedashboard-pagination">
                  <div className="guesthousedashboard-pagination-left">
                    <label className="guesthousedashboard-pagination-label" htmlFor="guesthousedashboard-page-size">
                      Rows per page
                    </label>
                    <select
                      id="guesthousedashboard-page-size"
                      className="guesthousedashboard-page-size"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="guesthousedashboard-pagination-count">
                      {pageStartIndex + 1}-{pageEndIndex} of {filteredData.length}
                    </span>
                  </div>

                  <div className="guesthousedashboard-pagination-right">
                    <button
                      type="button"
                      className="guesthousedashboard-page-btn"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <span className="guesthousedashboard-page-indicator">
                      Page {safeCurrentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="guesthousedashboard-page-btn"
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
      {activeInfoItem && (
          <div
            className="guesthousedashboard-log-popover"
            ref={logPopoverRef}
            style={logPopoverStyle}
            role="dialog"
            aria-label="Submission logs"
          >
            <div className="guesthousedashboard-log-header">Submission Logs</div>
            <div className="guesthousedashboard-log-body">
              <div className="guesthousedashboard-log-summary">
                {parseDateTime(activeInfoItem.updated_at) >
                  parseDateTime(activeInfoItem.created_at) && (
                  <div className="guesthousedashboard-log-summary-row">
                    <span className="guesthousedashboard-log-label">Last Edited:</span>
                    <span className="guesthousedashboard-log-value">
                      {formatDateTime(activeInfoItem.updated_at)}
                    </span>
                  </div>
                )}
              </div>

              <div className="guesthousedashboard-log-timeline">
                {loadingInfoId === activeInfoItem.id ? (
                  <div className="guesthousedashboard-log-empty">Loading updates...</div>
                ) : (
                  activeLogEvents.length === 0 ? (
                    <div className="guesthousedashboard-log-empty">No logs available.</div>
                  ) : activeLogEvents.map((event) => (
                    <div
                      key={event.key}
                      className={`guesthousedashboard-log-entry guesthousedashboard-log-entry-modal${event.actorBadgeLabel ? ' guesthousedashboard-log-entry--admin' : ''}`}
                    >
                      {event.actorBadgeLabel === 'SUPERADMIN' && (
                        <span className="guesthousedashboard-log-admin-mark" title="Updated by Admin">
                          {`\u2605 ${event.actorBadgeLabel}`}
                        </span>
                      )}
                      <div className="guesthousedashboard-log-entry-top">
                        <div className="guesthousedashboard-log-entry-title">
                          <span
                            className={`guesthousedashboard-log-badge guesthousedashboard-log-badge--${event.badge.toLowerCase()}`}
                          >
                            {event.badge}
                          </span>
                          <span className="guesthousedashboard-log-title-text">{event.title}</span>
                        </div>
                        {event.actorBadgeLabel &&
                          !['SUPERADMIN', 'HOD', 'DOF'].includes(event.actorBadgeLabel) && (
                            <span className="guesthousedashboard-log-stage-pill">
                              {event.actorBadgeLabel}
                            </span>
                          )}
                      </div>
                      <div className="guesthousedashboard-log-role">
                        {event.subtitle || 'Status update'}
                      </div>
                      <div className="guesthousedashboard-log-actor-line">
                        <strong>{event.actorLabel}:</strong> {event.actorValue}
                      </div>
                      <div className="guesthousedashboard-log-date guesthousedashboard-log-date-right">
                        {event.dateLabel}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
      )}
      </section>
      <CustomModal
        show={pendingApproval !== null}
        onHide={() => setPendingApproval(null)}
        title={`${pendingApproval?.decision === 'rejected' ? 'Reject' : 'Return'} Guest House - Comments`}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingApproval(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${pendingApproval?.decision === 'rejected' ? 'btn-danger' : 'btn-primary'}`}
              disabled={!approvalComment.trim()}
              onClick={() => {
                if (!pendingApproval) return;
                void submitApprovalDecision(pendingApproval.id, pendingApproval.decision, approvalComment.trim());
                setPendingApproval(null);
              }}
            >
              Submit
            </button>
          </>
        }
      >
        <div className="mb-2" style={{ fontSize: 13, color: '#666' }}>
          Guest House ID: <strong>{pendingApprovalReference}</strong>
        </div>
        <textarea
          id="guesthouse-approval-comment"
          className="form-control"
          value={approvalComment}
          onChange={(event) => setApprovalComment(event.target.value)}
          rows={4}
          placeholder="Enter comments (required)..."
          aria-label="Comments (required)"
          autoFocus
        />
      </CustomModal>
      <CustomModal
        show={pendingArchive !== null}
        onHide={() => setPendingArchive(null)}
        title={pendingArchiveStatus === 'archived' ? 'Confirm Unarchive' : 'Confirm Archive'}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingArchive(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={approvalBusyId !== null}
              onClick={() => void handleArchiveToggle()}
            >
              {pendingArchiveStatus === 'archived' ? 'Unarchive' : 'Archive'}
            </button>
          </>
        }
      >
        <p>
          {pendingArchiveStatus === 'archived'
            ? 'Are you sure you want to unarchive this Guest House request?'
            : 'Are you sure you want to archive this Guest House request?'}
        </p>
      </CustomModal>
      <CustomModal
        show={Boolean(dialogMessage)}
        onHide={() => setDialogMessage('')}
        title="Guest House"
        size="sm"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setDialogMessage('')}>
            OK
          </button>
        }
      >
        <p>{dialogMessage}</p>
      </CustomModal>
      <CustomModal
        show={previewRecordId !== null}
        onHide={() => {
          setIsPrintPreviewReady(false);
          setPreviewRecordId(null);
        }}
        title="Request Print Preview"
        size="xl"
        centered
        className="pdf-popup-preview-modal"
        footer={
          <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={handleDownloadPreviewPdf} disabled={!isPrintPreviewReady}>
            <Download size={16} />
            Print / Save PDF
          </button>
        }
      >
        {previewRecordId !== null && (
          <iframe
            ref={printPreviewFrameRef}
            src={`/guesthouse/${previewRecordId}?preview=true`}
            style={{ width: '100%', height: 'calc(100vh - 148px)', border: 'none', display: 'block', background: '#fff' }}
            title="Request Preview"
          />
        )}
      </CustomModal>
    </>
  );
};

export default GuesthouseDashboard;
