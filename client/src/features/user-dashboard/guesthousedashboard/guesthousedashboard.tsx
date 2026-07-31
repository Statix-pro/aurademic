// client/src/features/user-dashboard/guesthousedashboard/guesthousedashboard.tsx
import React, { useEffect, useRef, useState } from 'react';
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
  RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import CustomModal from '../../../shared/components/ui/CustomModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import {
  canAccessAdminArea,
  getGuesthouseWorkflowStage,
  hasPermission,
  isSuperAdmin,
} from '../../../shared/utils/permissionUtils';

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
  beneficiary_name?: string;
  beneficiary_value?: string;
  guest_details?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  workflow_state?: {
    status: string;
    currentStage: string;
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
  const approvalStage = getGuesthouseWorkflowStage(user);
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
  const [filteredData, setFilteredData] = useState<GuesthouseCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
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
    getCurrentFiscalYear(),
  );
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [activeInfoId, setActiveInfoId] = useState<number | null>(null);
  const [loadingInfoId, setLoadingInfoId] = useState<number | null>(null);
  const [showGuesthouseStatusDetail, setShowGuesthouseStatusDetail] = useState<Record<number, boolean>>(
    {},
  );
  const [statusUpdatesById, setStatusUpdatesById] = useState<Record<number, GuesthouseStatusUpdate[]>>(
    {},
  );
  const [previewRecordId, setPreviewRecordId] = useState<number | null>(null);
  const navigate = useNavigate();
  const principalDocInputRef = useRef<HTMLInputElement | null>(null);
  const [principalDocTargetId, setPrincipalDocTargetId] = useState<number | null>(null);
  const [principalDocBusyId, setPrincipalDocBusyId] = useState<number | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<number | null>(null);
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
      setStatusUpdatesById({});
      if (approvalMode && !approvalStage) {
        setData([]);
        return;
      }
      const res = (await authenticityUtility.get(approvalMode
        ? `/guesthouse/queue/${approvalStage}?status=in_progress&limit=100`
        : '/guesthouse?mine=true')) as {
        success?: boolean;
        items?: GuesthouseCardItem[];
      };
      setData(Array.isArray(res.items) ? res.items : []);
    } catch (err) {
      console.error('Guesthouse dashboard error', err);
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
    const status = getWorkflowStatus(item);
    const currentStage = getCurrentStage(item);
    const lastDecision = String(item.workflow_state?.lastDecision || '').toLowerCase();
    if (status === 'archived' || status === 'archive') return 'archived';
    if (status === 'returned') return 'returned';
    if (status === 'rejected') return 'rejected';
    if (status === 'completed' || status === 'approved') return 'approved';
    if (lastDecision === 'resubmitted') return 'resubmitted';
    if (currentStage === 'level1' && status === 'submitted') {
      return 'submitted';
    }
    if (status === 'submitted' || status === 'in_progress' || status === 'pending' || !status)
      return 'pending';
    return 'pending';
  };

  const getGuesthouseTimelineState = (item: GuesthouseCardItem, stage: string) => {
    const normalizedStatus = getNormalizedStatus(item);
    const workflowStatus = getWorkflowStatus(item);
    const currentStage = getCurrentStage(item) || workflowStatus;
    const stages = ['hod', 'principal', 'guesthouse_admin'];
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

    if (normalizedStatus === 'submitted') {
      if (stageIndex === 0) return 'current';
      return 'pending';
    }

    if (currentIndex >= 0 && stageIndex < currentIndex) return 'completed';
    if (currentIndex >= 0 && stageIndex === currentIndex) return 'current';
    if (currentIndex < 0 && stageIndex === 0) return 'current';
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

  const isPendingLikeStatus = (item: GuesthouseCardItem) => {
    const normalizedStatus = getNormalizedStatus(item);
    const currentStage = getCurrentStage(item);
    return (
      normalizedStatus === 'pending' ||
      normalizedStatus === 'submitted' ||
      normalizedStatus === 'resubmitted' ||
      currentStage === 'level1'
    );
  };

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

  const isPrincipalDocumentFeatureVisible = (item: GuesthouseCardItem) =>
    getDisplayAmount(item) > 10000;

  const canShowPrincipalDocumentAction = (item: GuesthouseCardItem) => {
    return Boolean(getPrincipalDocumentUrl(item));
  };

  const openPrincipalDocumentPicker = (item: GuesthouseCardItem) => {
    if (!isPrincipalUser || !isPrincipalDocumentEligible(item)) return;
    setPrincipalDocTargetId(item.id);
    window.setTimeout(() => principalDocInputRef.current?.click(), 0);
  };

  const handlePrincipalDocumentUploadClick = (item: GuesthouseCardItem) => {
    if (!isPrincipalDocumentFeatureVisible(item)) {
      return;
    }

    if (!isPrincipalDocumentEligible(item)) {
      window.alert('Once approved, you can upload the principal document.');
      return;
    }

    openPrincipalDocumentPicker(item);
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
        window.alert(response?.message || 'Failed to upload principal document');
        return;
      }

      window.alert(`${file.name} uploaded successfully`);
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
      window.alert(
        error?.response?.data?.message || error?.message || 'Failed to upload principal document',
      );
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
        window.alert(response?.message || 'Failed to delete principal document');
        return;
      }

      setData((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, principal_document: null } : row)),
      );
    } catch (error: any) {
      window.alert(
        error?.response?.data?.message || error?.message || 'Failed to delete principal document',
      );
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
      window.alert('Only PDF files with a size less than 2MB are allowed.');
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
    if (stageToken === 'guesthouse_admin') return 'Guesthouse Admin';
    if (stageToken === 'archived') return 'Archive';
    return formatLabel(stage);
  };

  const getUpdateTimestamp = (update: GuesthouseStatusUpdate) =>
    String(update.createdAt || update.decidedAt || '').trim();

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

  const fetchKpiStats = async () => {
    if (!approvalMode || !approvalStage) {
      return;
    }

    try {
      const response = (await authenticityUtility.get(
        `/guesthouse/queue/${approvalStage}/kpi-stats`,
      )) as {
        success?: boolean;
        data?: Partial<typeof kpiStats>;
        stats?: Partial<typeof kpiStats>;
      };

      const nextStats = response?.stats || response?.data;
      if (response?.success && nextStats) {
        setKpiStats((prev) => ({ ...prev, ...nextStats }));
      }
    } catch (error) {
      console.error('Guesthouse KPI stats error', error);
    }
  };

  const handleApprovalDecision = async (id: number, decision: 'approve' | 'return' | 'reject') => {
    if (approvalBusyId !== null) return;
    const comment = decision === 'approve' ? '' : window.prompt(`Reason for ${decision}:`, '')?.trim() || '';
    if (decision !== 'approve' && !comment) return;
    setApprovalBusyId(id);
    try {
      const response = (await authenticityUtility.patch(`/guesthouse/${id}/approval`, { decision, comment })) as any;
      if (!response?.success) {
        throw new Error(response?.message || 'Guesthouse approval could not be completed');
      }
      await fetchDashboard();
      await fetchKpiStats();
    } catch (error) {
      console.error('Guesthouse approval action failed', error);
      window.alert((error as any)?.response?.data?.message || (error as Error).message || 'Guesthouse approval could not be completed');
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
    `#F-${new Date(item.created_at).getFullYear()}-${String(item.id).padStart(4, '0')}`;

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
            subtitle: 'Initial guesthouse request submitted',
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
      const actorName = update.userName;
      const actorEmail = update.actorEmail;
      const actorRole = update.actorRole;
      const eventSummary = update.summary ?? update.feedback ?? update.comment;
      const eventCreatedAt = update.createdAt ?? update.decidedAt ?? null;
      const actorValue = formatActorIdentity(actorName, actorEmail, actorRole || 'Workflow');
      const isSubmitted = decision.includes('submitted');
      const isReturned = decision.includes('returned');
      const isRejected = decision.includes('rejected');
      const isApproved = decision.includes('approved') || decision.includes('completed');
      const isUpdated = decision === 'updated';
      const isAdmin =
        Boolean(update.isAdmin) ||
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
      } else if (isReturned) {
        badge = 'RETURNED';
        title = 'Proposal returned';
      } else if (isRejected) {
        badge = 'REJECTED';
        title = 'Proposal rejected';
      } else if (isApproved) {
        badge = 'APPROVED';
        title = 'Proposal approved';
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
        actorBadgeLabel: isUpdated ? actorBadgeLabel : stage !== '-' ? stage : '',
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
    await fetchStatusUpdates(requestId);
  };

  const handleViewClick = (requestId: number) => {
    navigate(`/guesthouse/${requestId}`);
  };

  const canEditRequest = (item: GuesthouseCardItem) => {
    if (isSuperAdmin(user)) return true;
    const normalizedStatus = getNormalizedStatus(item);
    const currentStage = getCurrentStage(item);

    return (
      Boolean(item.workflow_state?.isEditableByApplicant) ||
      normalizedStatus === 'returned' ||
      normalizedStatus === 'submitted' ||
      currentStage === 'level1'
    );
  };

  const handleEditClick = (item: GuesthouseCardItem) => {
    if (!canEditRequest(item)) return;
    navigate(`/guesthouse/${item.id}/edit`);
  };

  const canDeleteRequest = (item: GuesthouseCardItem) => {
    const normalizedStatus = getNormalizedStatus(item);
    const currentStage = getCurrentStage(item);

    return (
      currentStage === 'level1' &&
      !['approved', 'rejected', 'returned', 'archived'].includes(normalizedStatus)
    );
  };

  const handleDeleteClick = async (item: GuesthouseCardItem) => {
    if (!canDeleteRequest(item)) return;

    const confirmed = window.confirm('Delete this guesthouse request? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const response = (await authenticityUtility.delete(`/guesthouse/${item.id}`)) as {
        success?: boolean;
        status?: string;
        message?: string;
      };
      if (response.success !== true && response.status !== 'success') {
        window.alert(response.message || 'Failed to delete guesthouse request');
        return;
      }

      if (activeInfoId === item.id) {
        setActiveInfoId(null);
      }

      await fetchDashboard();
    } catch (error) {
      console.error('Failed to delete guesthouse request', error);
      window.alert((error as any)?.response?.data?.message || 'Failed to delete guesthouse request');
    }
  };

  const applyFilters = () => {
    let result = [...data];

    if (selectedStatus === 'pending') {
      result = result.filter((item) => isPendingLikeStatus(item));
    } else if (selectedStatus !== 'all') {
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

    setFilteredData(result);
  };

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
    setPreviewRecordId(requestId);
  };

  const approvalStageLabel =
    approvalStage === 'guesthouse_admin'
      ? 'Guesthouse Admin'
      : approvalStage
        ? approvalStage.toUpperCase()
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
        <div className="guesthousedashboard-container">
          <div className="guesthousedashboard-card">
            {/* HEADER & FILTERS */}
            <div className="guesthousedashboard-header-single">
              <div className="header-left-section">
                <h5 className="guesthousedashboard-title">Guesthouse Requests</h5>
                {approvalMode && approvalStageLabel && (
                  <span className="guesthousedashboard-role-badge">{approvalStageLabel}</span>
                )}
              </div>

              <div className="header-right-section">
                <div className="search-box">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder={
                      approvalMode
                        ? 'Search Guesthouse ID or Applicant...'
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

                {!approvalMode && <button
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
                </button>}
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

            {/* CONTENT */}
            <div className="guesthousedashboard-body">
              {loading && <div className="guesthousedashboard-state">Loading guesthouse requests...</div>}

              {!loading && filteredData.length === 0 && (
                <div
                  className="guesthousedashboard-state"
                  style={{ padding: '60px 20px', fontSize: '15px' }}
                >
                  No guesthouse requests found
                </div>
              )}

              {!loading && filteredData.length > 0 && (
                <div className="guesthousedashboard-list-container">
                  {paginatedData.map((item) => {
                    const status = getNormalizedStatus(item);
                    const canEdit = canEditRequest(item);
                    const canDelete = canDeleteRequest(item);
                    const isStatusExpanded = Boolean(showGuesthouseStatusDetail[item.id]);
                    const principalDocument = getPrincipalDocument(item);
                    const principalDocumentUrl = getPrincipalDocumentUrl(item);
                    const principalDocumentTitle = String(
                      principalDocument?.original_name ||
                        principalDocument?.stored_name ||
                        'Principal Document',
                    ).trim();
                    const showPrincipalDocumentAction = canShowPrincipalDocumentAction(item);
                    const principalActionLoading = principalDocBusyId === item.id;
                    return (
                      <div key={item.id} className="guesthousedashboard-item-card">
                        <div className="card-row-top">
                          <div className="card-header-left">
                            <span className="card-id-pill">{getProposalRef(item)}</span>
                            <span className="card-applicant-name">{item.applicant_name}</span>
                            <span className="card-category-tag">
                              Stay: {formatBookingDate(item.check_in_date)}
                              {item.check_out_date ? ` – ${formatBookingDate(item.check_out_date)}` : ''}
                            </span>
                          </div>

                          <div className="card-header-right">
                            <div className="card-actions-main">
                              <button
                                type="button"
                                className="icon-btn-subtle guesthousedashboard-info-trigger"
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
                            <span className="beneficiary-label">Guest:</span>
                            <span className="beneficiary-label">Guest Details :</span>
                            <span className="beneficiary-value">
                              {item.guest_details || item.beneficiary_name || item.beneficiary_value || '-'}
                            </span>
                          </div>
                          <div className="card-footer-right">
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
                                className={`status-pill-solid status-${status} guesthouse-status-pill ${isStatusExpanded ? 'guesthouse-status-pill--active' : ''}`}
                                onClick={() =>
                                  setShowGuesthouseStatusDetail((prev) => ({
                                    ...prev,
                                    [item.id]: !prev[item.id],
                                  }))
                                }
                                aria-expanded={isStatusExpanded}
                                aria-label={`Toggle workflow timeline for ${item.applicant_name}`}
                              >
                                {getGuesthouseStatusLabel(item)}
                              </button>
                              {approvalMode && (
                                <div className="guesthousedashboard-approval-actions">
                                  <button
                                    type="button"
                                    className="guesthousedashboard-action-btn guesthousedashboard-action-btn--approve"
                                    title="Approve"
                                    disabled={approvalBusyId !== null}
                                    onClick={() => void handleApprovalDecision(item.id, 'approve')}
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    className="guesthousedashboard-action-btn guesthousedashboard-action-btn--return"
                                    title="Return"
                                    disabled={approvalBusyId !== null}
                                    onClick={() => void handleApprovalDecision(item.id, 'return')}
                                  >
                                    <RotateCcw size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    className="guesthousedashboard-action-btn guesthousedashboard-action-btn--reject"
                                    title="Reject"
                                    disabled={approvalBusyId !== null}
                                    onClick={() => void handleApprovalDecision(item.id, 'reject')}
                                  >
                                    <XCircle size={18} />
                                  </button>
                                  {canDelete && (
                                    <button
                                      type="button"
                                      className="guesthousedashboard-action-btn guesthousedashboard-action-btn--archive"
                                      title="Delete"
                                      onClick={() => handleDeleteClick(item)}
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {isStatusExpanded && (
                              <div className="guesthouse-status-detail-line">
                                {['hod', 'principal', 'guesthouse_admin'].map(
                                  (stage, stageIndex, array) => {
                                    const stageState = getGuesthouseTimelineState(item, stage);
                                    return (
                                      <React.Fragment key={stage}>
                                        <div
                                          className={`guesthouse-status-line-circle guesthouse-status-circle-${stageState}`}
                                          title={stage.toUpperCase()}
                                        />
                                        {stageIndex < array.length - 1 && (
                                          <div
                                            className={`guesthouse-status-line-connector guesthouse-status-line-connector--${stageState}`}
                                          />
                                        )}
                                      </React.Fragment>
                                    );
                                  },
                                )}
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
      </section>
      {activeInfoItem && (
        <div className="guesthousedashboard-log-overlay" onClick={() => setActiveInfoId(null)}>
          <div className="guesthousedashboard-log-modal" onClick={(event) => event.stopPropagation()}>
            <div className="guesthousedashboard-log-header">Submission Logs</div>
            <div className="guesthousedashboard-log-body guesthousedashboard-log-body-modal">
              <div className="guesthousedashboard-log-summary">
                <div className="guesthousedashboard-log-summary-row">
                  <span className="guesthousedashboard-log-label">Proposal:</span>
                  <span className="guesthousedashboard-log-value">{getProposalRef(activeInfoItem)}</span>
                </div>
                <div className="guesthousedashboard-log-summary-row">
                  <span className="guesthousedashboard-log-label">Last Edited:</span>
                  <span className="guesthousedashboard-log-value">
                    {formatDateTime(activeInfoItem.updated_at || activeInfoItem.created_at)}
                  </span>
                </div>
              </div>

              <div className="guesthousedashboard-log-timeline">
                {loadingInfoId === activeInfoItem.id ? (
                  <div className="guesthousedashboard-log-empty">Loading updates...</div>
                ) : (
                  activeLogEvents.map((event) => (
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

              <div className="guesthousedashboard-log-footer">
                <button
                  type="button"
                  className="guesthousedashboard-log-close-btn"
                  onClick={() => setActiveInfoId(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CustomModal
        show={previewRecordId !== null}
        onHide={() => setPreviewRecordId(null)}
        title="Request Print Preview"
        size="xl"
        centered
        className="pdf-popup-preview-modal"
      >
        {previewRecordId !== null && (
          <iframe
            src={`/guesthouse/${previewRecordId}?preview=true`}
            style={{ width: '100%', height: 'calc(100vh - 92px)', border: 'none' }}
            title="Request Preview"
          />
        )}
      </CustomModal>
    </>
  );
};

export default GuesthouseDashboard;
