// client/src/features/user-dashboard/financecard/financecard.tsx
import React, { useEffect, useRef, useState } from 'react';
import './financecard.css';
import {
  Eye,
  Edit2,
  Briefcase,
  Clock,
  XCircle,
  CheckCircle,
  Archive,
  FolderOpen,
  CheckCheck,
  Search,
  Info,
  Trash2,
  FileText,
  Download,
  RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import CustomActivityLog, {
  type ActivityLogEntry,
} from '../../../shared/components/ui/CustomActivityLog';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomPagination from '../../../shared/components/ui/CustomPagination';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import {
  formatFullDate,
  formatFullDateTime,
  formatSubmissionDates,
} from '../../../shared/utils/dateFormat';

interface FinanceCardItem {
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
  balance_amount?: number | string | null;
  // Derived server-side from the expenditure requests under this card. null means the
  // card has no expenditure requests at all, so nothing has been claimed yet.
  claimed_amount?: number | string | null;
  // Live expenditure requests raised against this card (rejected/deleted/archived ones
  // are excluded server-side), so 0 means nothing has been opened against it yet.
  expenditure_request_count?: number | null;
  topup_amount?: number | string | null;
  overall_status: string;
  workflow_status?: string;
  fiscal_year?: number | string | null;
  fiscalYear?: number | string | null;
  created_at: string;
  updated_at?: string;
  beneficiary_name?: string;
  beneficiary_value?: string;
  workflow_state?: {
    status: string;
    currentStage: string;
    lastDecision?: string | null;
    isEditableByApplicant?: boolean;
    submittedTotalBudget?: number | string | null;
    topupAt?: string | null;
    topupAmount?: number | string | null;
    resubmittedAt?: string | null;
  };
  has_topup?: boolean | number | null;
  // Set when the card has been finalized and closed from the Expenditure module.
  closed_at?: string | null;
  principal_document?: {
    id?: number | null;
    original_name?: string | null;
    stored_name?: string | null;
    file_path?: string | null;
    mime_type?: string | null;
    file_size?: number | null;
  } | null;
}

interface FinanceStatusUpdate {
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

const FinanceCard: React.FC = () => {
  const { user } = useAuth();
  const formatFiscalYearValue = (startYear: number) =>
    `${startYear}-${String(startYear + 1).slice(-2)}`;
  const getCurrentFiscalYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return formatFiscalYearValue(month >= 4 ? year : year - 1);
  };
  const getCurrentFiscalYearStart = () => Number.parseInt(getCurrentFiscalYear().split('-')[0], 10);
  const [data, setData] = useState<FinanceCardItem[]>([]);
  const [filteredData, setFilteredData] = useState<FinanceCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(() =>
    getCurrentFiscalYear(),
  );
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [activeInfoId, setActiveInfoId] = useState<number | null>(null);
  const [loadingInfoId, setLoadingInfoId] = useState<number | null>(null);
  const [showFinanceStatusDetail, setShowFinanceStatusDetail] = useState<Record<number, boolean>>(
    {},
  );
  const [statusUpdatesById, setStatusUpdatesById] = useState<Record<number, FinanceStatusUpdate[]>>(
    {},
  );
  const [previewRecordId, setPreviewRecordId] = useState<number | null>(null);
  const navigate = useNavigate();
  const principalDocInputRef = useRef<HTMLInputElement | null>(null);
  const [principalDocTargetId, setPrincipalDocTargetId] = useState<number | null>(null);
  const [principalDocBusyId, setPrincipalDocBusyId] = useState<number | null>(null);
  const isSuperAdminUser =
    Boolean((user as any)?.is_super_admin || (user as any)?.isSuperAdmin) ||
    (Array.isArray((user as any)?.roles) &&
      (user as any).roles.some(
        (role: unknown) => String(role || '').toLowerCase() === 'super_admin',
      ));

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
      setStatusUpdatesById({});
      const res = (await authenticityUtility.get('/finance-requests?mine=true')) as {
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

  const getItemFiscalYear = (item: FinanceCardItem) => {
    const explicitYear = Number.parseInt(String(item.fiscal_year ?? item.fiscalYear ?? ''), 10);
    if (Number.isFinite(explicitYear) && explicitYear > 0) {
      return formatFiscalYearValue(explicitYear);
    }

    return formatFiscalYearValue(getFiscalYear(item.created_at));
  };

  const formatFiscalYearLabel = (fiscalYear: string) => `FY ${fiscalYear}`;

  const getWorkflowStatus = (item: FinanceCardItem) =>
    String(
      item.workflow_state?.status || item.workflow_status || item.overall_status || '',
    ).toLowerCase();

  const getCurrentStage = (item: FinanceCardItem) =>
    String(item.workflow_state?.currentStage || '').toLowerCase();

  const getNormalizedStatus = (item: FinanceCardItem) => {
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

  const getFinanceTimelineState = (item: FinanceCardItem, stage: string) => {
    const normalizedStatus = getNormalizedStatus(item);
    const workflowStatus = getWorkflowStatus(item);
    const currentStage = getCurrentStage(item) || workflowStatus;
    const stages = ['hod', 'dof', 'principal', 'chairman'];
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

  const hasTopup = (item: FinanceCardItem) => Boolean(item.workflow_state?.topupAt);

  // The pending cycle's own delta, which the server stamps on workflow_state.topupAmount
  // when the top-up restarts the workflow. topup_amount is the cumulative total of every
  // top-up row ever added, so it overstates the request from the second top-up onwards.
  const getTopupAmount = (item: FinanceCardItem) => {
    const cycleAmount = Number(item.workflow_state?.topupAmount ?? 0);
    if (Number.isFinite(cycleAmount) && cycleAmount > 0) return cycleAmount;

    // FALLBACK: top-ups submitted before workflow_state.topupAmount existed only have
    // the cumulative total, which equals the cycle amount for a first top-up. Remove
    // once no in-flight top-up predates topupAmount.
    const legacyTopupAmount = Number(item.topup_amount ?? 0);
    return Number.isFinite(legacyTopupAmount) ? legacyTopupAmount : 0;
  };

  // True once at least one live (not rejected/deleted/archived) expenditure request has
  // been raised against the card, which the server counts into expenditure_request_count.
  const hasExpenditureInProcess = (item: FinanceCardItem) =>
    Number(item.expenditure_request_count ?? 0) > 0;

  /**
   * The card life-cycle, in the order a request travels through it:
   *   Pending  - anywhere in the approval chain, up to Principal/Chairman
   *   Approved - approved, with no expenditure raised against it yet
   *   Opened   - expenditure is in process against the approved card
   *   Closed   - finalized and closed from the Expenditure module
   * Returned/Rejected/Archive keep their own labels.
   */
  const getFinanceCardState = (item: FinanceCardItem) => {
    const normalizedStatus = getNormalizedStatus(item);
    if (normalizedStatus === 'approved') {
      if (isCardClosed(item)) return 'closed';
      if (hasExpenditureInProcess(item)) return 'opened';
      return 'approved';
    }
    if (['rejected', 'returned', 'archived'].includes(normalizedStatus)) return normalizedStatus;
    // submitted/resubmitted are just points inside the approval chain, so they read as
    // one Pending state instead of a colour per hop.
    return 'pending';
  };

  // A top-up restarts the approval workflow, so the status must keep tracking the
  // workflow itself (Pending while in the chain, Approved once approved). The top-up is
  // surfaced through the "Top-up" badge and amount boxes instead of the status label.
  const getFinanceStatusLabel = (item: FinanceCardItem) => {
    const cardState = getFinanceCardState(item);
    if (cardState === 'approved') return 'Approved';
    if (cardState === 'opened') return 'Opened';
    if (cardState === 'closed') return 'Closed';
    if (cardState === 'rejected') return 'Rejected';
    if (cardState === 'returned') return 'Returned';
    if (cardState === 'archived') return 'Archive';
    return 'Pending';
  };

  const getDisplayAmount = (item: FinanceCardItem) => {
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

  const isTopupInProgress = (item: FinanceCardItem) =>
    hasTopup(item) && getNormalizedStatus(item) !== 'approved';

  const getProposedAmount = (item: FinanceCardItem) => {
    const rawAmount =
      item.total_budget ??
      item.proposed_amount ??
      item.amount ??
      item.workflow_state?.submittedTotalBudget ??
      0;
    const parsedAmount = Number(rawAmount);
    return Number.isFinite(parsedAmount) ? parsedAmount : 0;
  };

  const getApprovedAmount = (item: FinanceCardItem) => {
    const parsedAmount = Number(item.approved_total_amount ?? 0);
    return Number.isFinite(parsedAmount) ? parsedAmount : 0;
  };

  // Claims come from the expenditure requests raised under this card (claimed_amount is
  // derived server-side). It is deliberately NOT read from balance_amount: approval
  // writes the parent budget line's leftover headroom there, so an unrelated edit that
  // rewrote the budget breakup could zero it and make an untouched card read as fully
  // claimed. Clamped to the approved total so a card never reports over-claiming.
  const getClaimedAmount = (item: FinanceCardItem) => {
    if (item.claimed_amount === null || item.claimed_amount === undefined) return null;
    const claimedAmount = Number(item.claimed_amount);
    if (!Number.isFinite(claimedAmount)) return null;
    const approvedAmount = getApprovedAmount(item);
    if (!(approvedAmount > 0)) return null;
    return Math.min(approvedAmount, Math.max(0, claimedAmount));
  };

  // The two amount boxes are stage-aware:
  //   Initial proposal          -> Proposed | Approved
  //   After expenditure claims  -> Approved | Claimed
  //   During a top-up request   -> Top-up   | Approved
  const getCardAmountBoxes = (
    item: FinanceCardItem,
  ): Array<{ key: string; label: string; value: number }> => {
    if (isTopupInProgress(item) && getTopupAmount(item) > 0) {
      return [
        { key: 'topup', label: 'Top-up', value: getTopupAmount(item) },
        { key: 'approved-previous', label: 'Approved', value: getApprovedAmount(item) },
      ];
    }

    const claimedAmount = getClaimedAmount(item);
    if (getNormalizedStatus(item) === 'approved' && claimedAmount !== null && claimedAmount > 0) {
      return [
        { key: 'approved', label: 'Approved', value: getApprovedAmount(item) },
        { key: 'claimed', label: 'Claimed', value: claimedAmount },
      ];
    }

    return [
      { key: 'proposed', label: 'Proposed', value: getProposedAmount(item) },
      { key: 'approved', label: 'Approved', value: getApprovedAmount(item) },
    ];
  };

  const getPrincipalDocument = (item: FinanceCardItem) => item.principal_document || null;

  const getPrincipalDocumentUrl = (item: FinanceCardItem) => {
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

  const isPrincipalDocumentEligible = (item: FinanceCardItem) => {
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

  const isPrincipalDocumentFeatureVisible = (item: FinanceCardItem) =>
    getDisplayAmount(item) > 10000;

  const canShowPrincipalDocumentAction = (item: FinanceCardItem) => {
    return Boolean(getPrincipalDocumentUrl(item));
  };

  const openPrincipalDocumentPicker = (item: FinanceCardItem) => {
    if (!isPrincipalUser || !isPrincipalDocumentEligible(item)) return;
    setPrincipalDocTargetId(item.id);
    window.setTimeout(() => principalDocInputRef.current?.click(), 0);
  };

  const handlePrincipalDocumentUploadClick = (item: FinanceCardItem) => {
    if (!isPrincipalDocumentFeatureVisible(item)) {
      return;
    }

    if (!isPrincipalDocumentEligible(item)) {
      window.alert('Once approved, you can upload the principal document.');
      return;
    }

    openPrincipalDocumentPicker(item);
  };

  const uploadPrincipalDocument = async (item: FinanceCardItem, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setPrincipalDocBusyId(item.id);
    try {
      const response = (await authenticityUtility.postFile(
        `/finance-requests/${item.id}/principal-document`,
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

  const deletePrincipalDocument = async (item: FinanceCardItem) => {
    if (!isPrincipalUser || !getPrincipalDocumentUrl(item)) return;

    const confirmed = window.confirm('Delete the uploaded principal document?');
    if (!confirmed) return;

    setPrincipalDocBusyId(item.id);
    try {
      const response = (await authenticityUtility.delete(
        `/finance-requests/${item.id}/principal-document`,
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

  const getStageBadgeLabel = (
    item: FinanceCardItem,
    stage?: string | null,
    actorRole?: string | null,
  ) => {
    const stageToken = String(stage || '')
      .trim()
      .toLowerCase();
    const actorRoleToken = String(actorRole || '')
      .trim()
      .toLowerCase();
    const level1RouteType = String(item?.level1_route_type || '')
      .trim()
      .toLowerCase();
    const beneficiaryTypeToken = String(item?.beneficiary_type || '')
      .trim()
      .toLowerCase();
    const beneficiaryEntityId = Number(item?.beneficiary_entity_id || 0);

    if (stageToken === 'level1') {
      if (actorRoleToken === 'coordinator' || actorRoleToken === 'entity_approver') {
        return 'Coordinator';
      }
      if (actorRoleToken === 'hod') {
        return 'HOD';
      }
      if (level1RouteType === 'entity_contact') {
        return 'Coordinator';
      }
      if (
        ['centre', 'cell', 'club', 'section', 'professional body', 'professional bodies'].includes(
          beneficiaryTypeToken,
        ) ||
        (['faculty', 'staff'].includes(beneficiaryTypeToken) && beneficiaryEntityId > 0)
      ) {
        return 'Coordinator';
      }
      return 'HOD';
    }

    if (stageToken === 'dof') return 'DoF';
    if (stageToken === 'ithead') return 'IT Head';
    if (stageToken === 'principal') return 'Principal';
    if (stageToken === 'chairman') return 'Chairman';
    if (stageToken === 'archived') return 'Archive';
    return formatLabel(stage);
  };

  const getUpdateTimestamp = (update: FinanceStatusUpdate) =>
    String(update.createdAt || update.decidedAt || '').trim();

  const getUpdateSortPriority = (update: FinanceStatusUpdate) => {
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
    const parts: string[] = [];
    const budgetRowsCount = Number(details?.budgetRowsCount || 0);
    const incomeRowsCount = Number(details?.incomeRowsCount || 0);
    const budgetRowsChanged = Boolean(details?.budgetRowsChanged);
    const incomeRowsChanged = Boolean(details?.incomeRowsChanged);

    if (budgetRowsCount > 0) {
      parts.push(
        `Budget rows ${budgetRowsChanged ? 'updated' : 'reviewed'} (${budgetRowsCount} row(s))`,
      );
    }
    if (incomeRowsCount > 0) {
      parts.push(
        `Income rows ${incomeRowsChanged ? 'updated' : 'reviewed'} (${incomeRowsCount} row(s))`,
      );
    }

    return parts.join(' | ');
  };

  const getProposalRef = (item: FinanceCardItem) =>
    String(item.proposal_ref || '').trim() ||
    `#F-${new Date(item.created_at).getFullYear()}-${String(item.id).padStart(4, '0')}`;

  const buildFinanceLogEvents = (
    item: FinanceCardItem,
    updates: FinanceStatusUpdate[],
  ): ActivityLogEntry[] => {
    const hasSubmittedUpdate = updates.some((update) => {
      const decision = String(update.decision || update.status || '')
        .trim()
        .toLowerCase();
      return decision === 'submitted';
    });

    // Requests from before submissions were logged have no row for it; the creation stands in.
    const events: ActivityLogEntry[] = hasSubmittedUpdate
      ? []
      : [
          {
            key: `created-${item.id}`,
            decision: 'submitted',
            status: 'Submitted',
            date: formatFullDateTime(item.created_at),
            actorName: item.applicant_name,
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
      const stage = getStageBadgeLabel(item, update.stage || update.role, update.actorRole);
      const actorRole = update.actorRole;
      const eventSummary = String(update.summary ?? update.feedback ?? update.comment ?? '').trim();
      const eventCreatedAt = update.createdAt ?? update.decidedAt ?? null;
      const isTopupSubmitted = decision === 'topup_submitted';
      const isUpdated = decision === 'updated';
      const isAdmin =
        Boolean(update.isAdmin) ||
        ['admin', 'super_admin', 'superadmin'].includes(String(actorRole || '').toLowerCase());

      let remark = eventSummary;
      let fullRemark: string | undefined;
      if (isTopupSubmitted && !remark) {
        remark = 'Additional budget requested via top-up';
      } else if (isUpdated) {
        const details =
          update.details && typeof update.details === 'object' ? update.details : null;
        const changedFields = Array.isArray(details?.changedFields) ? details.changedFields : [];
        const fieldCountSummary =
          changedFields.length > 0 ? `${changedFields.length} field(s) updated` : '';
        const rowSummary = buildRowUpdateSummary(details);
        const fieldSummary = changedFields
          .map((field: any) => {
            const label = String(field?.label || '').trim() || 'Field';
            const before = formatAuditValue(label, field?.before);
            const after = formatAuditValue(label, field?.after);
            return `${label}: ${before} -> ${after}`;
          })
          .join(' | ');
        const fallbackSummary = trimUpdatedSummary(eventSummary);
        remark =
          [fieldCountSummary, rowSummary || fallbackSummary].filter(Boolean).join(' | ') ||
          'Proposal updated';
        fullRemark = fieldSummary ? [remark, fieldSummary].join(' | ') : undefined;
      }

      events.push({
        key: `${update.id}-${index}`,
        decision,
        status: isTopupSubmitted ? 'Top-up' : decision ? formatLabel(decision) : 'Update',
        // An edit names a stage only when an approver or admin made it, as on the approval page.
        stage: isUpdated ? (isAdmin ? 'Admin' : undefined) : stage !== '-' ? stage : undefined,
        date: formatFullDateTime(eventCreatedAt || item.created_at),
        actorName: update.userName || (update.actorEmail ? '' : actorRole || ''),
        actorEmail: update.actorEmail || '',
        remark,
        fullRemark,
      });
    });

    return events;
  };

  const fetchStatusUpdates = async (requestId: number) => {
    if (statusUpdatesById[requestId]) return;

    try {
      setLoadingInfoId(requestId);
      const response = (await authenticityUtility.get(
        `/finance-requests/${requestId}/status-updates`,
      )) as {
        status?: string;
        success?: boolean;
        data?: FinanceStatusUpdate[];
      };

      setStatusUpdatesById((prev) => ({
        ...prev,
        [requestId]:
          response.success === true || response.status === 'success' ? response.data || [] : [],
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
    if (isSuperAdminUser) return true;
    const normalizedStatus = getNormalizedStatus(item);
    const currentStage = getCurrentStage(item);

    return (
      Boolean(item.workflow_state?.isEditableByApplicant) ||
      normalizedStatus === 'returned' ||
      normalizedStatus === 'submitted' ||
      currentStage === 'level1'
    );
  };

  const handleEditClick = (item: FinanceCardItem) => {
    if (!canEditRequest(item)) return;
    navigate(`/finance/${item.id}/edit`);
  };

  const isCardClosed = (item: FinanceCardItem) => Boolean(item.closed_at);

  // A card finalized & closed in the Expenditure module is settled money, so no
  // further top-up may be drawn against it. The API rejects it too.
  const canTopupRequest = (item: FinanceCardItem) =>
    ['approved', 'completed'].includes(getNormalizedStatus(item)) && !isCardClosed(item);

  const handleTopupClick = (item: FinanceCardItem) => {
    if (!canTopupRequest(item)) return;
    navigate(`/finance/${item.id}/edit?topup=true`);
  };

  const canDeleteRequest = (item: FinanceCardItem) => {
    // A top-up has already been submitted into the approval workflow. It must
    // not be removable by regular users while it is waiting for HOD/Coordinator
    // approval. Keep the existing super-admin exception consistent with the API.
    if (hasTopup(item) && !isSuperAdminUser) return false;

    const normalizedStatus = getNormalizedStatus(item);
    const currentStage = getCurrentStage(item);

    return (
      currentStage === 'level1' &&
      !['approved', 'rejected', 'returned', 'archived'].includes(normalizedStatus)
    );
  };

  const handleDeleteClick = async (item: FinanceCardItem) => {
    if (!canDeleteRequest(item)) return;

    const confirmed = window.confirm('Delete this finance request? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const response = (await authenticityUtility.delete(`/finance-requests/${item.id}`)) as {
        success?: boolean;
        status?: string;
        message?: string;
      };
      if (response.success !== true && response.status !== 'success') {
        window.alert(response.message || 'Failed to delete finance request');
        return;
      }

      if (activeInfoId === item.id) {
        setActiveInfoId(null);
      }

      await fetchDashboard();
    } catch (error) {
      console.error('Failed to delete finance request', error);
      window.alert((error as any)?.response?.data?.message || 'Failed to delete finance request');
    }
  };

  const applyFilters = () => {
    let result = [...data];

    // Every stat card key is a card state, so a chip can only ever select cards whose
    // status pill carries that same label.
    if (selectedStatus !== 'all') {
      result = result.filter((item) => getFinanceCardState(item) === selectedStatus);
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

  // One pass over the cards, keyed by the same state the pill renders, so a chip count can
  // never drift from the number of cards the chip selects.
  const stateCounts = data.reduce<Record<string, number>>((counts, item) => {
    const cardState = getFinanceCardState(item);
    counts[cardState] = (counts[cardState] || 0) + 1;
    return counts;
  }, {});

  const statCards = [
    { key: 'all', label: 'Total', count: data.length, icon: Briefcase },
    { key: 'pending', label: 'Pending', count: stateCounts.pending || 0, icon: Clock },
    { key: 'returned', label: 'Return', count: stateCounts.returned || 0, icon: RotateCcw },
    { key: 'rejected', label: 'Reject', count: stateCounts.rejected || 0, icon: XCircle },
    { key: 'approved', label: 'Approved', count: stateCounts.approved || 0, icon: CheckCircle },
    { key: 'opened', label: 'Opened', count: stateCounts.opened || 0, icon: FolderOpen },
    { key: 'closed', label: 'Closed', count: stateCounts.closed || 0, icon: CheckCheck },
    { key: 'archived', label: 'Archive', count: stateCounts.archived || 0, icon: Archive },
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
    ? buildFinanceLogEvents(activeInfoItem, activeStatusUpdates)
    : [];
  const fiscalYearOptions = [
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

  return (
    <>
      <input
        ref={principalDocInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={handlePrincipalDocumentFileChange}
      />
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
                  {searchTerm && (
                    <XCircle size={16} className="clear-icon" onClick={() => setSearchTerm('')} />
                  )}
                </div>

                <div className="filter-group">
                  <div className="filter-item">
                    <select
                      className="financecard-financial-year"
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
                      className="financecard-beneficiary-filter"
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

                <button
                  className="financecard-add-btn"
                  onClick={() =>
                    navigate('/finance/new', {
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
              {loading && <div className="financecard-state">Loading finance requests...</div>}

              {!loading && filteredData.length === 0 && (
                <div
                  className="financecard-state"
                  style={{ padding: '60px 20px', fontSize: 'var(--font-size-body)' }}
                >
                  No finance requests found
                </div>
              )}

              {!loading && filteredData.length > 0 && (
                <div className="financecard-list-container">
                  {paginatedData.map((item) => {
                    const status = getFinanceCardState(item);
                    const canEdit = canEditRequest(item);
                    const canDelete = canDeleteRequest(item);
                    const isStatusExpanded = Boolean(showFinanceStatusDetail[item.id]);
                    const principalDocument = getPrincipalDocument(item);
                    const principalDocumentUrl = getPrincipalDocumentUrl(item);
                    const principalDocumentTitle = String(
                      principalDocument?.original_name ||
                        principalDocument?.stored_name ||
                        'Principal Document',
                    ).trim();
                    const showPrincipalDocumentAction = canShowPrincipalDocumentAction(item);
                    const principalActionLoading = principalDocBusyId === item.id;
                    const submissionDates = formatSubmissionDates(
                      item.created_at,
                      item.workflow_state?.resubmittedAt,
                    );
                    return (
                      <div key={item.id} className="financecard-item-card">
                        <div className="card-row-top">
                          <div className="card-header-left">
                            <span className="card-id-pill">{getProposalRef(item)}</span>
                            <div className="financecard-name-block">
                              <span className="card-applicant-name">{item.applicant_name}</span>
                              {submissionDates.text && (
                                <span
                                  className="financecard-submitted"
                                  title={submissionDates.title}
                                >
                                  {submissionDates.text}
                                </span>
                              )}
                            </div>
                            <span className="card-category-tag">{item.budget_tag || '-'}</span>
                            {Boolean(item.workflow_state?.topupAt) && (
                              <span
                                style={{
                                  fontSize: 'var(--font-size-tertiary)',
                                  fontWeight: 700,
                                  color: '#047857',
                                  backgroundColor: '#d1fae5',
                                  border: '1px solid #10b981',
                                  borderRadius: '12px',
                                  padding: '2px 8px',
                                  letterSpacing: '0.03em',
                                  marginLeft: '8px',
                                }}
                              >
                                Top-up
                              </span>
                            )}
                          </div>

                          <div className="card-header-right">
                            {getCardAmountBoxes(item).map((box) => (
                              <div key={box.key} className="card-amount-box">
                                <span className="amount-label">{box.label}</span>
                                <span className="amount-value">₹{box.value.toLocaleString()}</span>
                              </div>
                            ))}
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
                              {canTopupRequest(item) && (
                                <button
                                  type="button"
                                  className="financecard-topup-btn"
                                  title="Topup"
                                  onClick={() => handleTopupClick(item)}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={18}
                                    height={18}
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M0 0h24v24H0z" fill="none" />
                                    <path
                                      fill="currentColor"
                                      d="M3 0v3H0v2h3v3h2V5h3V3H5V0zm6 3v3H6v3H3v10a2 2 0 0 0 2 2h14c1.11 0 2-.89 2-2v-1h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h9V5a2 2 0 0 0-2-2zm3 5v8h10V8zm4 2.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5"
                                    />
                                  </svg>
                                </button>
                              )}
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
                              {canDelete && (
                                <button
                                  type="button"
                                  className="icon-btn-subtle"
                                  title="Delete"
                                  onClick={() => handleDeleteClick(item)}
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="card-row-bottom">
                          <div className="card-row-middle">
                            <span className="beneficiary-label">Beneficiary :</span>
                            <span className="beneficiary-value">
                              {item.beneficiary_name ||
                                item.beneficiary_value ||
                                item.applicant_name}
                            </span>
                          </div>
                          <div className="card-footer-right">
                            {showPrincipalDocumentAction && (
                              <>
                                <button
                                  type="button"
                                  className="icon-btn-subtle financecard-download-btn financecard-principal-download-btn"
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
                                      className="icon-btn-subtle financecard-principal-mini-btn"
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
                                      className="icon-btn-subtle financecard-principal-mini-btn financecard-principal-delete-btn"
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
                              className="icon-btn-subtle financecard-download-btn"
                              title="Open PDF Preview"
                              onClick={() => handlePdfPreviewClick(item.id)}
                            >
                              <FileText size={18} />
                            </button>

                            <button
                              type="button"
                              className={`status-pill-solid status-${status} finance-status-pill ${isStatusExpanded ? 'finance-status-pill--active' : ''}`}
                              onClick={() =>
                                setShowFinanceStatusDetail((prev) => ({
                                  ...prev,
                                  [item.id]: !prev[item.id],
                                }))
                              }
                              aria-expanded={isStatusExpanded}
                              aria-label={`Toggle workflow timeline for ${item.applicant_name}`}
                            >
                              {getFinanceStatusLabel(item)}
                            </button>
                            {isStatusExpanded && (
                              <div className="finance-status-detail-line">
                                {['hod', 'dof', 'principal', 'chairman'].map(
                                  (stage, stageIndex, array) => {
                                    const stageState = getFinanceTimelineState(item, stage);
                                    return (
                                      <React.Fragment key={stage}>
                                        <div
                                          className={`finance-status-line-circle finance-status-circle-${stageState}`}
                                          title={stage.toUpperCase()}
                                        />
                                        {stageIndex < array.length - 1 && (
                                          <div
                                            className={`finance-status-line-connector finance-status-line-connector--${stageState}`}
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
                <CustomPagination
                  name="financecard-page-size"
                  page={safeCurrentPage}
                  pageSize={pageSize}
                  total={filteredData.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>
          </div>
        </div>
      </section>
      <CustomActivityLog
        show={Boolean(activeInfoItem)}
        onHide={() => setActiveInfoId(null)}
        summary={
          activeInfoItem
            ? [
                { label: 'Reference', value: getProposalRef(activeInfoItem) },
                { label: 'Submitted', value: formatFullDate(activeInfoItem.created_at) },
                {
                  label: 'Resubmitted',
                  value: formatFullDate(activeInfoItem.workflow_state?.resubmittedAt),
                },
                {
                  label: 'Last edited',
                  value: formatFullDateTime(activeInfoItem.updated_at || activeInfoItem.created_at),
                },
              ]
            : []
        }
        entries={activeLogEvents}
        loading={activeInfoItem ? loadingInfoId === activeInfoItem.id : false}
      />
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
            src={`/finance/${previewRecordId}?preview=true`}
            style={{ width: '100%', height: 'calc(100vh - 92px)', border: 'none' }}
            title="Request Preview"
          />
        )}
      </CustomModal>
    </>
  );
};

export default FinanceCard;
