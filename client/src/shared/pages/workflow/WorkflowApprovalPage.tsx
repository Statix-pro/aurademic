import {
  Briefcase,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Info,
  Edit2,
  Archive,
  Trash2,
  FileText,
  Upload,
  Download,
  RotateCcw,
  CreditCard,
  Search,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PendingPayeeApprovals from './PendingPayeeApprovals';
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
import AlertModal, { type AlertType } from '../../../shared/components/ui/AlertModal';
import CustomModal from '../../../shared/components/ui/CustomModal';

const DEFAULT_DECISIONS: WorkflowDecision[] = ['approved', 'returned', 'rejected'];
const DEFAULT_FEEDBACK_REQUIRED: WorkflowDecision[] = ['returned', 'rejected'];
const FALLBACK_BENEFICIARY_OPTIONS = [
  'All Beneficiary',
  'Faculty',
  'Staff',
  'Department',
  'Centre',
  'Cell',
  'Club',
  'Professional Body',
  'Institution',
];

const getWorkflowRecordTag = (record: Record<string, any>): string => {
  return String(record.budget_tag || record.budgetTag || '').trim();
};

const formatStageLabel = (stage: string, labels: Record<string, string> = {}) => {
  const normalized = String(stage || '')
    .trim()
    .toLowerCase();
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

const FINANCE_HOD_BENEFICIARY_OPTIONS = ['All Beneficiary', 'Faculty', 'Staff', 'Department'];

const getRunningFiscalYearStart = () => {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

const getWorkflowFiscalYearOptions = () => {
  const running = getRunningFiscalYearStart();
  return [running, running - 1];
};

const normalizeWorkflowFiscalYearOptions = (years: unknown[], fallbackYear: number) => {
  const normalized = new Set<number>([fallbackYear]);
  years.forEach((value) => {
    const year = Number.parseInt(String(value), 10);
    if (Number.isInteger(year) && year > 0) {
      normalized.add(year);
    }
  });
  return Array.from(normalized).sort((a, b) => b - a);
};
const FINANCE_COORDINATOR_BENEFICIARY_OPTIONS = [
  'All Beneficiary',
  'Centre',
  'Cell',
  'Club',
  'Section',
  'Professional Body',
  'Institution',
];

const resolvePreferredStageByRoles = (roles: string[], permitted: string[]) => {
  const permittedSet = new Set(
    permitted.map((stage) =>
      String(stage || '')
        .trim()
        .toLowerCase(),
    ),
  );
  if (!permittedSet.size) return '';

  if (roles.includes('super_admin')) {
    if (permittedSet.has('level1')) return 'level1';
    return permitted[0] || '';
  }

  if (roles.includes('dof') && permittedSet.has('dof')) return 'dof';
  if (roles.includes('principal') && permittedSet.has('principal')) return 'principal';
  if (roles.includes('chairman') && permittedSet.has('chairman')) return 'chairman';
  if (
    (roles.includes('hod') || roles.includes('coordinator') || roles.includes('entity_approver')) &&
    permittedSet.has('level1')
  ) {
    return 'level1';
  }

  return permitted[0] || '';
};

const resolvePreferredTabKey = (tabs: WorkflowStageTab[], roles: string[], fallbackStage = '') => {
  if (!tabs.length) return '';

  const normalizedRoles = roles.map((role) =>
    String(role || '')
      .trim()
      .toLowerCase(),
  );
  const normalizedFallbackStage = String(fallbackStage || '')
    .trim()
    .toLowerCase();

  const pickByStage = (stage: string) =>
    tabs.find(
      (tab) =>
        String(tab.stage || '')
          .trim()
          .toLowerCase() === stage,
    ) || null;

  if (normalizedRoles.includes('dof')) {
    const dofTab = pickByStage('dof');
    if (dofTab) return dofTab.key;
  }

  if (normalizedRoles.includes('principal')) {
    const principalTab = pickByStage('principal');
    if (principalTab) return principalTab.key;
  }

  if (normalizedRoles.includes('chairman')) {
    const chairmanTab = pickByStage('chairman');
    if (chairmanTab) return chairmanTab.key;
  }

  if (normalizedRoles.some((role) => ['hod', 'coordinator', 'entity_approver'].includes(role))) {
    const level1Tab = pickByStage('level1');
    if (level1Tab) return level1Tab.key;
  }

  if (normalizedFallbackStage) {
    const fallbackTab = pickByStage(normalizedFallbackStage);
    if (fallbackTab) return fallbackTab.key;
  }

  return tabs[0].key;
};

const getNormalizedUserRoles = (user: any): string[] => {
  const extractRoleToken = (value: any): string => {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') {
      const candidates = [
        value.role,
        value.role_code,
        value.roleCode,
        value.code,
        value.name,
        value.value,
      ];
      for (const candidate of candidates) {
        const normalized = String(candidate || '').trim();
        if (normalized) return normalized;
      }
    }
    return '';
  };

  const roleTokens: string[] = [];
  if (Array.isArray(user?.roles)) {
    roleTokens.push(...user.roles.map((role: any) => extractRoleToken(role)).filter(Boolean));
  } else if (user?.roles) {
    roleTokens.push(extractRoleToken(user.roles));
  }
  if (user?.role) {
    roleTokens.push(extractRoleToken(user.role));
  }
  return Array.from(new Set(roleTokens.map((role) => role.toLowerCase()).filter(Boolean)));
};

const getNormalizedUserPermissions = (user: any): string[] => {
  const extractPermissionToken = (value: any): string => {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object') {
      const candidates = [
        value.permission,
        value.permission_key,
        value.permissionKey,
        value.code,
        value.name,
        value.value,
      ];
      for (const candidate of candidates) {
        const normalized = String(candidate || '').trim();
        if (normalized) return normalized;
      }
    }
    return '';
  };

  const permissionTokens: string[] = [];
  if (Array.isArray(user?.permissions)) {
    permissionTokens.push(
      ...user.permissions
        .map((permission: any) => extractPermissionToken(permission))
        .filter(Boolean),
    );
  } else if (user?.permissions) {
    permissionTokens.push(extractPermissionToken(user.permissions));
  }
  if (user?.permission) {
    permissionTokens.push(extractPermissionToken(user.permission));
  }
  return Array.from(
    new Set(permissionTokens.map((permission) => permission.toLowerCase()).filter(Boolean)),
  );
};

const getSecondaryFilterValue = (record: Record<string, any>, beneficiaryType: string) => {
  const normalizedType = String(beneficiaryType || '')
    .trim()
    .toLowerCase();

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
  const normalizedType = String(beneficiaryType || '')
    .trim()
    .toLowerCase();

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
  const normalizedType = String(beneficiaryType || '')
    .trim()
    .toLowerCase();

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

type FinanceAmountFilter = '' | 'lt_10000' | 'gte_10000';

const getWorkflowProposedAmount = (record: Record<string, any>) => {
  const rawAmount =
    record.total_amount ?? record.total_budget ?? record.amount ?? record.proposed_amount ?? 0;
  const parsedAmount = Number(rawAmount);
  return Number.isFinite(parsedAmount) ? parsedAmount : 0;
};

const getWorkflowPrincipalDocument = (record: Record<string, any>) =>
  record?.principal_document || null;

const getWorkflowPrincipalDocumentUrl = (record: Record<string, any>) => {
  const filePath = String(getWorkflowPrincipalDocument(record)?.file_path || '').trim();
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

const getWorkflowAnnexures = (record: Record<string, any>) => {
  const rows = Array.isArray(record?.annexures) ? record.annexures : [];
  const annexures = rows
    .filter(
      (row: Record<string, any>) =>
        String(row?.annexure_type || row?.annexureType || '')
          .trim()
          .toLowerCase() !== 'principal_approval',
    )
    .filter((row: Record<string, any>) => String(row?.file_path || row?.filePath || '').trim());

  if (annexures.length) {
    return annexures;
  }

  const filePath = String(record?.annexure_file_path || '').trim();
  const storedName = String(record?.annexure_storage_name || '').trim();
  const originalName = String(record?.annexure_file_name || '').trim();
  if (!filePath || (!storedName && !originalName)) {
    return [];
  }

  return [
    {
      annexure_type: record?.annexure_type || '',
      original_name: originalName || storedName,
      stored_name: storedName || originalName,
      file_path: filePath,
      mime_type: record?.annexure_mime_type || '',
      file_size: record?.annexure_file_size || null,
    },
  ];
};

const getWorkflowAnnexureUrl = (annexure: Record<string, any> | null | undefined) => {
  const filePath = String(annexure?.file_path || annexure?.filePath || '').trim();
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

const getWorkflowAnnexureTitle = (annexure: Record<string, any> | null | undefined) => {
  return String(
    annexure?.original_name ||
      annexure?.originalName ||
      annexure?.stored_name ||
      annexure?.storedName ||
      'Annexure',
  ).trim();
};

const defaultQueueMapper = (response: any): WorkflowQueueResult => ({
  items: Array.isArray(response?.data) ? response.data : [],
  total: Number(response?.pagination?.total || 0),
  page: Number(response?.pagination?.page || 1),
  limit: Number(response?.pagination?.limit || 20),
  statusCounts: response?.pagination?.statusCounts,
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
    const lineNo =
      Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no) || lineIdx + 1;
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
  const fiscalYear = Number.parseInt(String(record?.fiscal_year || record?.fiscalYear || ''), 10);
  const createdAt = record?.created_at ? new Date(record.created_at) : null;
  const requestDate = record?.request_date ? new Date(record.request_date) : null;
  const fallbackDate =
    requestDate && !Number.isNaN(requestDate.getTime())
      ? requestDate
      : createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt
        : new Date();
  const year =
    Number.isFinite(fiscalYear) && fiscalYear > 0
      ? fiscalYear
      : fallbackDate.getFullYear() - (fallbackDate.getMonth() < 3 ? 1 : 0);
  const id = Number(record?.id);
  if (!Number.isFinite(id)) return '-';
  return `#F-${year}-${String(id).padStart(4, '0')}`;
};

interface WorkflowApprovalPageProps {
  config: WorkflowApprovalModuleConfig;
}

interface PendingPayeeRecord {
  id: number;
  payee_name?: string;
  account_name?: string | null;
  pan_number?: string | null;
  account_no?: string;
  account_type?: string | null;
  ifsc?: string;
  bank_name?: string;
  branch_name?: string;
  beneficiary_type?: string | null;
  beneficiary_org?: string | null;
  organization_type?: string | null;
  msme?: string | null;
  gstin?: string | null;
  tds_details?: string | null;
  tds_section?: string | null;
  approval_status?: string | null;
  rejection_reason?: string | null;
  approved_at?: string | null;
  requested_at?: string | null;
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
  const [queueStatusCounts, setQueueStatusCounts] =
    useState<WorkflowQueueResult['statusCounts']>(undefined);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(config.queueDefaultLimit || 20);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [payeeSearchTerm, setPayeeSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<
    'total' | 'pending' | 'approved' | 'returned' | 'rejected' | 'archived'
  >('pending');
  const [viewMode, setViewMode] = useState<'workflow' | 'payees'>('workflow');
  const [actingRecordId, setActingRecordId] = useState<number | string | null>(null);
  const [logPopupOpen, setLogPopupOpen] = useState(false);
  const [logEntries, setLogEntries] = useState<WorkflowTimelineItem[]>([]);
  const [expandedLogDetails, setExpandedLogDetails] = useState<Record<string, boolean>>({});
  const [logRef, setLogRef] = useState<string>('');
  const [logLevel1Role, setLogLevel1Role] = useState<'hod' | 'coordinator' | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [archivingIds, setArchivingIds] = useState<Set<number | string>>(new Set());
  const [principalDocumentBusyId, setPrincipalDocumentBusyId] = useState<number | string | null>(
    null,
  );
  const [principalDocumentTargetId, setPrincipalDocumentTargetId] = useState<
    number | string | null
  >(null);
  const [pendingApprovalAfterUploadId, setPendingApprovalAfterUploadId] = useState<
    number | string | null
  >(null);
  const principalDocumentInputRef = useRef<HTMLInputElement | null>(null);

  const [principalApprovalPopupOpen, setPrincipalApprovalPopupOpen] = useState(false);
  const [principalApprovalPopupId, setPrincipalApprovalPopupId] = useState<number | string | null>(
    null,
  );
  const [principalApprovalFile, setPrincipalApprovalFile] = useState<File | null>(null);
  const [principalApprovalSubmitting, setPrincipalApprovalSubmitting] = useState(false);

  // Action popups
  const [actionPopupOpen, setActionPopupOpen] = useState(false);
  const [actionType, setActionType] = useState<'return' | 'reject' | null>(null);
  const [actionId, setActionId] = useState<number | string | null>(null);
  const [actionRef, setActionRef] = useState<string>('');
  const [actionComment, setActionComment] = useState<string>('');
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);
  const [deletePopupOpen, setDeletePopupOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);
  const [deleteRef, setDeleteRef] = useState<string>('');
  const [deleteCountdown, setDeleteCountdown] = useState<number>(5);
  const [carryForwardPopupOpen, setCarryForwardPopupOpen] = useState(false);
  const [carryForwardRecordId, setCarryForwardRecordId] = useState<number | string | null>(null);
  // Carry-forward is always a FINANCE-request action (allocation keyed to
  // finance_request_id). On the expenditure Advance card we target the parent
  // finance request via this id and the finance API base, not the expenditure id.
  const [carryForwardFinanceId, setCarryForwardFinanceId] = useState<number | string | null>(null);
  const [carryForwardRef, setCarryForwardRef] = useState('');
  const [carryForwardSourceYear, setCarryForwardSourceYear] = useState<number>(
    getRunningFiscalYearStart(),
  );
  const [carryForwardTargetYear, setCarryForwardTargetYear] = useState<number>(
    getRunningFiscalYearStart() + 1,
  );
  const [carryForwardAvailableAmount, setCarryForwardAvailableAmount] = useState<number>(0);
  const [carryForwardRemarks, setCarryForwardRemarks] = useState<string>('');
  const [carryForwardLoading, setCarryForwardLoading] = useState<boolean>(false);
  const [carryForwardSubmitting, setCarryForwardSubmitting] = useState<boolean>(false);
  const [proposalTypeFilter, setProposalTypeFilter] = useState<
    'all' | 'advance' | 'expenditure' | 'settlement'
  >('all');
  const [pendingPayees, setPendingPayees] = useState<PendingPayeeRecord[]>([]);
  const [pendingPayeesLoading, setPendingPayeesLoading] = useState<boolean>(false);
  const [pendingPayeeActingId, setPendingPayeeActingId] = useState<number | null>(null);
  const [pendingPayeeEditingId, setPendingPayeeEditingId] = useState<number | null>(null);
  const [previewRecordId, setPreviewRecordId] = useState<number | string | null>(null);
  const [previewIsActionablePending, setPreviewIsActionablePending] = useState<boolean>(false);

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
      cancelText = 'Cancel',
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
    [closeAlert],
  );

  const openDeletePopup = (recordId: number | string, ref: string) => {
    setDeleteId(recordId);
    setDeleteRef(ref);
    setDeleteCountdown(5);
    setDeletePopupOpen(true);
  };

  const closeDeletePopup = () => {
    setDeletePopupOpen(false);
    setDeleteId(null);
    setDeleteRef('');
    setDeleteCountdown(5);
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

      if (response?.status === 'success' || response?.success === true || response?.data?.success) {
        closeDeletePopup();
        await loadQueue(activeStage, 1);
        return;
      }

      showAlert(response?.message || response?.data?.message || 'Failed to delete item.', 'error');
    } catch (deleteError: any) {
      showAlert(
        deleteError?.response?.data?.message || deleteError?.message || 'Failed to delete item.',
        'error',
      );
    } finally {
      setActingRecordId(null);
    }
  };

  const isSuperAdminView = Boolean(meta?.isSuperAdmin);
  const canManagePrincipalDocuments = Boolean(isSuperAdminView || activeStage === 'principal');
  const isPrincipalDocumentEligible = useCallback((record: Record<string, any>) => {
    const amount = getWorkflowProposedAmount(record);
    const status = String(
      record.workflow_state?.status || record.workflow_status || record.overall_status || '',
    ).toLowerCase();

    if (!(amount > 10000)) {
      return false;
    }

    return status === 'principal_approved' || status === 'approved' || status === 'completed';
  }, []);
  const isPrincipalDocumentFeatureVisible = useCallback((_record: Record<string, any>) => {
    return false;
  }, []);
  const canShowPrincipalDocumentAction = useCallback(
    (record: Record<string, any>) => {
      return isPrincipalDocumentFeatureVisible(record);
    },
    [isPrincipalDocumentFeatureVisible],
  );
  const openPrincipalDocumentPicker = useCallback((recordId: number | string) => {
    setPrincipalDocumentTargetId(recordId);
    window.setTimeout(() => principalDocumentInputRef.current?.click(), 0);
  }, []);
  const handlePrincipalDocumentUploadClick = useCallback(
    (record: Record<string, any>, recordId: number | string) => {
      if (!canManagePrincipalDocuments) {
        showAlert('You do not have access to manage principal documents.', 'error');
        return;
      }

      if (!isPrincipalDocumentFeatureVisible(record)) {
        return;
      }

      if (!isPrincipalDocumentEligible(record)) {
        showAlert('Once approved, you can upload the principal document.', 'warning');
        return;
      }

      openPrincipalDocumentPicker(recordId);
    },
    [
      canManagePrincipalDocuments,
      isPrincipalDocumentEligible,
      isPrincipalDocumentFeatureVisible,
      openPrincipalDocumentPicker,
      showAlert,
    ],
  );
  const uploadPrincipalDocument = useCallback(
    async (recordId: number | string, file: File): Promise<boolean> => {
      const formData = new FormData();
      formData.append('file', file);
      setPrincipalDocumentBusyId(recordId);
      try {
        const response = (await authenticityUtility.postFile(
          `/finance-requests/${recordId}/principal-document`,
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
          showAlert(response?.message || 'Failed to upload principal document', 'error');
          return false;
        }

        showAlert(`${file.name} uploaded successfully`, 'success');
        setRows((prevRows) =>
          prevRows.map((row) => {
            if (String(row.id) !== String(recordId)) {
              return row;
            }

            return {
              ...row,
              principal_document: {
                ...(row.principal_document || {}),
                original_name: response?.data?.originalName || file.name,
                stored_name: response?.data?.storedName || null,
                file_path: response?.data?.filePath || null,
                mime_type: response?.data?.mimeType || 'application/pdf',
                file_size: Number.isFinite(Number(response?.data?.size))
                  ? Number(response?.data?.size)
                  : file.size,
              },
            };
          }),
        );
        return true;
      } catch (error: any) {
        showAlert(
          error?.response?.data?.message || error?.message || 'Failed to upload principal document',
          'error',
        );
        return false;
      } finally {
        setPrincipalDocumentBusyId(null);
      }
    },
    [showAlert],
  );
  const deletePrincipalDocument = useCallback(
    async (record: Record<string, any>) => {
      const recordId = record?.id;
      if (recordId === undefined || recordId === null) return;

      showAlert(
        'Delete the uploaded principal document?',
        'warning',
        'Confirm Delete',
        async () => {
          setPrincipalDocumentBusyId(recordId);
          try {
            const response = (await authenticityUtility.delete(
              `/finance-requests/${recordId}/principal-document`,
            )) as {
              success?: boolean;
              status?: string;
              message?: string;
            };

            if (response?.success !== true && response?.status !== 'success') {
              showAlert(response?.message || 'Failed to delete principal document', 'error');
              return;
            }

            setRows((prevRows) =>
              prevRows.map((row) => {
                if (String(row.id) !== String(recordId)) {
                  return row;
                }

                return {
                  ...row,
                  principal_document: null,
                };
              }),
            );
          } catch (error: any) {
            showAlert(
              error?.response?.data?.message ||
                error?.message ||
                'Failed to delete principal document',
              'error',
            );
          } finally {
            setPrincipalDocumentBusyId(null);
          }
        },
        true,
        'Delete',
        'Cancel',
      );
    },
    [showAlert],
  );
  // Filter states
  const [fiscalYear, setFiscalYear] = useState<number>(() => getRunningFiscalYearStart());
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<string>('All Beneficiary');
  const [secondaryFilter, setSecondaryFilter] = useState<string>('');
  const [amountFilter, setAmountFilter] = useState<FinanceAmountFilter>('');
  const [activeStageTabKey, setActiveStageTabKey] = useState<string>('');

  const permittedStages = useMemo(() => {
    const fromMeta = Array.isArray(meta?.permittedStages) ? meta.permittedStages : [];
    if (fromMeta.length > 0) return fromMeta;

    const roles = getNormalizedUserRoles(user);
    const permissions = getNormalizedUserPermissions(user);

    if (meta?.isSuperAdmin || roles.includes('super_admin')) {
      if (config.moduleKey === 'finance') {
        return ['level1', 'dof', 'principal', 'chairman'];
      }
      return ['level1', 'dof', 'principal'];
    }

    const fallback = new Set<string>();

    // Role‑based access (module‑agnostic)
    if (roles.some((role) => ['hod', 'coordinator', 'entity_approver'].includes(role))) {
      fallback.add('level1');
    }
    if (roles.includes('dof')) {
      fallback.add('dof');
    }
    if (roles.includes('principal')) {
      fallback.add('principal');
    }
    if (roles.includes('chairman')) {
      fallback.add('chairman');
    }

    // Permission‑based access:
    // For expenditure, also accept finance.workflow.* permissions
    const permissionModuleKeys =
      config.moduleKey === 'expenditure' ? ['expenditure', 'finance'] : [config.moduleKey];

    const hasPermissionForStage = (stageKey: string) =>
      permissionModuleKeys.some((mk) => permissions.includes(`${mk}.workflow.${stageKey}`));

    if (hasPermissionForStage('level1')) {
      fallback.add('level1');
    }
    if (hasPermissionForStage('dof')) {
      fallback.add('dof');
    }
    if (hasPermissionForStage('principal')) {
      fallback.add('principal');
    }
    if (hasPermissionForStage('chairman')) {
      fallback.add('chairman');
    }

    return Array.from(fallback);
  }, [config.moduleKey, meta?.isSuperAdmin, meta?.permittedStages, user]);

  const enableLevel1RoleTabs = Boolean(config.enableLevel1RoleTabs);
  const enableSuperAdminAllProposals = Boolean(config.enableSuperAdminAllProposals);
  const enableSecondaryFilter = Boolean(config.enableSecondaryFilter);

  const stageTabs = useMemo<WorkflowStageTab[]>(() => {
    const normalizedRoles = getNormalizedUserRoles(user);
    const tabs: WorkflowStageTab[] = permittedStages.flatMap<WorkflowStageTab>((stage) => {
      const normalizedStage = String(stage || '')
        .trim()
        .toLowerCase();
      if (enableLevel1RoleTabs && normalizedStage === 'level1') {
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

        if (
          normalizedRoles.includes('coordinator') ||
          normalizedRoles.includes('entity_approver')
        ) {
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

    if (enableSuperAdminAllProposals && meta?.isSuperAdmin && permittedStages.length > 0) {
      tabs.push({
        key: `${config.moduleKey}-all-proposals`,
        stage:
          tabs[0]?.stage ||
          String(permittedStages[0] || '')
            .trim()
            .toLowerCase() ||
          'level1',
        label: 'All Proposals',
        showAllProposals: true,
      });
    }

    return tabs;
  }, [
    config.moduleKey,
    config.stageLabels,
    enableLevel1RoleTabs,
    enableSuperAdminAllProposals,
    meta?.isSuperAdmin,
    permittedStages,
    user,
  ]);

  const activeWorkflowTab = useMemo(
    () => stageTabs.find((tab) => tab.key === activeStageTabKey) || null,
    [activeStageTabKey, stageTabs],
  );

  const beneficiaryOptionsFromMeta = useMemo(() => {
    const source = Array.isArray(meta?.availableBeneficiaryTypes)
      ? meta.availableBeneficiaryTypes
      : [];
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
    if (!enableLevel1RoleTabs) {
      return beneficiaryOptionsFromMeta;
    }

    if (activeStage === 'level1' && activeWorkflowTab?.level1Role === 'hod') {
      const allowed = new Set(
        FINANCE_HOD_BENEFICIARY_OPTIONS.map((option) => option.toLowerCase()),
      );
      return beneficiaryOptionsFromMeta.filter((option) => allowed.has(option.toLowerCase()));
    }

    if (activeStage === 'level1' && activeWorkflowTab?.level1Role === 'coordinator') {
      const allowed = new Set(
        FINANCE_COORDINATOR_BENEFICIARY_OPTIONS.map((option) => option.toLowerCase()),
      );
      return beneficiaryOptionsFromMeta.filter((option) => allowed.has(option.toLowerCase()));
    }

    return beneficiaryOptionsFromMeta;
  }, [
    activeStage,
    activeWorkflowTab?.level1Role,
    beneficiaryOptionsFromMeta,
    enableLevel1RoleTabs,
  ]);

  const fiscalYearOptions = useMemo(
    () =>
      normalizeWorkflowFiscalYearOptions(
        meta?.availableFiscalYears?.length
          ? meta.availableFiscalYears
          : getWorkflowFiscalYearOptions(),
        getRunningFiscalYearStart(),
      ),
    [meta?.availableFiscalYears],
  );

  const getRecordId = useCallback(
    (record: Record<string, any>) => {
      const value = config.getRecordId ? config.getRecordId(record) : record.id;
      return value;
    },
    [config],
  );

  const getMetaEndpoint = useCallback(
    () =>
      config.getMetaEndpoint ? config.getMetaEndpoint() : `${config.apiBasePath}/workflow/meta`,
    [config],
  );

  const getQueueEndpoint = useCallback(
    (stage: string) =>
      config.getQueueEndpoint
        ? config.getQueueEndpoint(stage)
        : `${config.apiBasePath}/queue/${stage}`,
    [config],
  );

  const getApprovalEndpoint = useCallback(
    (id: number | string) =>
      config.getApprovalEndpoint
        ? config.getApprovalEndpoint(id)
        : `${config.apiBasePath}/${id}/approval`,
    [config],
  );

  const getTimelineEndpoint = useCallback(
    (id: number | string) =>
      config.getTimelineEndpoint
        ? config.getTimelineEndpoint(id)
        : `${config.apiBasePath}/${id}/timeline`,
    [config],
  );

  const getArchiveEndpoint = useCallback(
    (id: number | string) => `${config.apiBasePath}/${id}/archive-toggle`,
    [config],
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
    [config],
  );

  const mapQueueResponse = config.mapQueueResponse || defaultQueueMapper;
  const mapTimelineResponse = config.mapTimelineResponse || defaultTimelineMapper;

  const getRecordProposalRef = useCallback((record: Record<string, any>) => {
    return record.proposal_ref || formatProposalRef(record);
  }, []);

  const getRecordCurrentStage = useCallback((record: Record<string, any>) => {
    const fromState =
      record.workflow_state?.currentStage ||
      record.workflow_state?.stage ||
      record.workflow_state?.current_stage;
    const fromRecord = record.workflow_stage || record.currentStage || record.current_stage;
    const normalized = String(fromState || fromRecord || '')
      .trim()
      .toLowerCase();

    if (normalized) {
      return normalized;
    }

    const status = String(record.workflow_status || record.status || '')
      .trim()
      .toLowerCase();
    if (
      ['level1', 'hod', 'coordinator', 'ithead', 'dof', 'principal', 'chairman'].includes(status)
    ) {
      return status;
    }

    return '';
  }, []);

  const getRecordStageDecision = useCallback((record: Record<string, any>) => {
    return String(
      record.workflow_stage_decision ||
        record.workflow_stage_status ||
        record.stage_decision ||
        record.stage_status ||
        record.decision ||
        '',
    ).toLowerCase();
  }, []);

  const getRecordWorkflowDecision = useCallback((record: Record<string, any>) => {
    return String(record.workflow_state?.lastDecision || record.lastDecision || '').toLowerCase();
  }, []);

  const isResubmittedRecord = useCallback(
    (record: Record<string, any>) => {
      const resubAt = record.workflow_state?.resubmittedAt || record.resubmittedAt;
      const hasResubmittedTime =
        resubAt &&
        String(resubAt).trim() !== '' &&
        !isNaN(new Date(resubAt).getTime()) &&
        new Date(resubAt).getTime() > 0;
      return getRecordWorkflowDecision(record) === 'resubmitted' || Boolean(hasResubmittedTime);
    },
    [getRecordWorkflowDecision],
  );

  const applyWorkflowDecisionLocally = useCallback(
    (recordId: number | string, decision: WorkflowDecision, nextStage?: string | null) => {
      const normalizedNextStage = String(nextStage || '')
        .trim()
        .toLowerCase();
      setRows((prev) =>
        prev.map((row) => {
          const currentId = getRecordId(row);
          if (String(currentId) !== String(recordId)) return row;

          const currentWorkflowState =
            row.workflow_state &&
            typeof row.workflow_state === 'object' &&
            !Array.isArray(row.workflow_state)
              ? row.workflow_state
              : {};

          const nextStatus =
            decision === 'approved'
              ? normalizedNextStage
                ? 'in_progress'
                : 'completed'
              : decision;

          return {
            ...row,
            workflow_state: {
              ...currentWorkflowState,
              currentStage: normalizedNextStage || currentWorkflowState.currentStage || null,
              status: nextStatus,
              lastDecision: decision,
              updatedAt: new Date().toISOString(),
            },
            workflow_stage: normalizedNextStage || row.workflow_stage,
            workflow_status: nextStatus,
            workflow_stage_decision: decision,
          };
        }),
      );
    },
    [getRecordId],
  );

  const isApprovedForCurrentStage = useCallback(
    (record: Record<string, any>) => {
      const status = String(record.workflow_status || record.status || '').toLowerCase();
      const currentStage = activeStage?.toLowerCase() || '';

      const approvedStatusMap: Record<string, string[]> = {
        level1: [
          'level1_approved',
          'hod_approved',
          'ithead_approved',
          'dof_approved',
          'principal_approved',
          'chairman_approved',
          'completed',
          'approved',
        ],
        hod: [
          'level1_approved',
          'hod_approved',
          'ithead_approved',
          'dof_approved',
          'principal_approved',
          'chairman_approved',
          'completed',
          'approved',
        ],
        coordinator: [
          'level1_approved',
          'hod_approved',
          'ithead_approved',
          'dof_approved',
          'principal_approved',
          'chairman_approved',
          'completed',
          'approved',
        ],
        ithead: [
          'ithead_approved',
          'dof_approved',
          'principal_approved',
          'chairman_approved',
          'completed',
          'approved',
        ],
        dof: ['dof_approved', 'principal_approved', 'chairman_approved', 'completed', 'approved'],
        principal: ['principal_approved', 'chairman_approved', 'completed', 'approved'],
        chairman: ['chairman_approved', 'completed', 'approved'],
      };

      const approvedStates = approvedStatusMap[currentStage] || ['completed', 'approved'];

      return approvedStates.some(
        (state) => status === state || status.startsWith(state) || status.includes(state),
      );
    },
    [activeStage],
  );

  // Properly categorize item status
  const resolveStatusCategory = useCallback(
    (record: Record<string, any>) => {
      const workflowDecision = getRecordWorkflowDecision(record);
      const stageDecision = getRecordStageDecision(record);
      const token = String(record.workflow_status || record.status || '').toLowerCase();
      const currentStage = getRecordCurrentStage(record);
      const activeStageKey = String(activeStage || '').toLowerCase();
      const isAllProposalsTab = Boolean(activeWorkflowTab?.showAllProposals);
      const pendingEntryStatusByStage: Record<string, string[]> = {
        dof: ['level1_approved', 'hod_approved', 'coordinator_approved', 'ithead_approved'],
        principal: ['dof_approved'],
        chairman: ['principal_approved'],
      };

      if (token.includes('archived') || token.includes('archive')) return 'archived';
      if (token.includes('rejected') || workflowDecision === 'rejected') return 'rejected';
      if (token.includes('returned') || token.includes('return') || workflowDecision === 'returned')
        return 'returned';
      if (isAllProposalsTab && token === 'in_progress' && currentStage) return 'pending';

      if (currentStage && activeStageKey && currentStage === activeStageKey) {
        return 'pending';
      }

      if (workflowDecision === 'resubmitted') {
        return 'pending';
      }

      // Stage-owned decisions should drive KPIs for historical actions at this stage.
      if (stageDecision.includes('rejected')) return 'rejected';
      if (stageDecision.includes('returned') || stageDecision.includes('return')) return 'returned';
      if (stageDecision.includes('approved')) return 'approved';

      if (!activeStageKey) {
        if (token.includes('rejected') || workflowDecision === 'rejected') return 'rejected';
        if (
          token.includes('returned') ||
          token.includes('return') ||
          workflowDecision === 'returned'
        )
          return 'returned';
      }

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

      if (
        activeStageKey &&
        pendingEntryStatusByStage[activeStageKey]?.includes(token) &&
        !stageDecision.includes('approved')
      ) {
        return 'pending';
      }

      if (token.includes('completed')) return 'approved';

      if (token === 'approved' || token === 'principal_approved' || token === 'chairman_approved')
        return 'approved';

      if (token.includes('approved') && currentStage) {
        if (currentStage === activeStageKey) {
          return 'pending';
        }

        return isApprovedForCurrentStage(record) ? 'approved' : 'pending';
      }

      if (token.includes('approved')) return 'approved';

      if (isApprovedForCurrentStage(record)) return 'approved';

      return 'pending';
    },
    [
      activeStage,
      activeWorkflowTab?.showAllProposals,
      getRecordCurrentStage,
      getRecordStageDecision,
      getRecordWorkflowDecision,
      isApprovedForCurrentStage,
    ],
  );

  const isVisibleInWorkflowList = useCallback(
    (record: Record<string, any>, stage: string) => {
      const category = resolveStatusCategory(record);
      if (
        category === 'approved' ||
        category === 'returned' ||
        category === 'rejected' ||
        category === 'archived'
      ) {
        return true;
      }

      return getRecordCurrentStage(record) === String(stage || '').toLowerCase();
    },
    [getRecordCurrentStage, resolveStatusCategory],
  );

  const loadMeta = useCallback(async () => {
    const response = await authenticityUtility.get(getMetaEndpoint());
    if (response?.data) {
      const payload: WorkflowMeta = response.data;
      setMeta(payload);
      const normalizedRoles = getNormalizedUserRoles(user);
      const permitted = Array.isArray(payload.permittedStages) ? payload.permittedStages : [];
      const initialStage = resolvePreferredStageByRoles(normalizedRoles, permitted);
      setActiveStage((prev) => prev || initialStage || '');
      if (!initialStage) {
        setLoading(false);
      }
      return;
    }

    setMeta(null);
    setActiveStage('');
    setRows([]);
    setTotalRows(0);
    setLoading(false);
  }, [getMetaEndpoint, user]);

  const loadQueue = useCallback(
    async (stage: string, requestedPage = 1) => {
      if (!stage) {
        setRows([]);
        setTotalRows(0);
        setQueueStatusCounts(undefined);
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
          enableLevel1RoleTabs && normalizedStage === 'level1' && activeTab?.level1Role
            ? activeTab.level1Role
            : null;

        const response = await authenticityUtility.get(endpoint, {
          params: {
            page: requestedPage,
            limit,
            workflowStatus: 'all',
            ...(statusFilter !== 'total' ? { statusCategory: statusFilter } : {}),
            fiscalYear,
            ...(level1RoleFilter ? { level1Role: level1RoleFilter } : {}),
            ...(isAllProposalsTab ? { allProposals: true } : {}),
            ...(beneficiaryFilter !== 'All Beneficiary'
              ? { beneficiaryType: beneficiaryFilter }
              : {}),
            ...(searchTerm ? { q: searchTerm } : {}),
            ...(amountFilter ? { amountBand: amountFilter } : {}),
          },
        });

        const mapped = mapQueueResponse(response);

        const fetchedItems = Array.isArray(mapped.items) ? mapped.items : [];
        let items = fetchedItems;
        if (!isAllProposalsTab) {
          items = fetchedItems.filter((item) => isVisibleInWorkflowList(item, stage));
        }
        // Records hidden by isVisibleInWorkflowList are ones the server counted (in `total`
        // and `statusCounts`) but that don't belong on this stage's list — without this
        // adjustment the stat tiles/pagination text would show a count higher than the
        // number of rows actually rendered on this page.
        const hiddenCount = fetchedItems.length - items.length;

        setRows(items);
        const nextLimit = Number(mapped.limit || limit || config.queueDefaultLimit || 20);
        const normalizedMappedPage = Math.max(Number(mapped.page || requestedPage || 1), 1);
        const normalizedMappedTotal = Math.max(Number(mapped.total || 0) - hiddenCount, 0);

        if (mapped.statusCounts && hiddenCount > 0) {
          // isVisibleInWorkflowList only stage-checks records that resolve to the
          // 'pending' category (all other categories are always visible), so every
          // hidden record was counted as 'pending' server-side.
          setQueueStatusCounts({
            ...mapped.statusCounts,
            total: normalizedMappedTotal,
            pending: Math.max(Number(mapped.statusCounts.pending || 0) - hiddenCount, 0),
          });
        } else {
          setQueueStatusCounts(mapped.statusCounts);
        }

        setTotalRows(normalizedMappedTotal);
        setPage(normalizedMappedPage);
        setLimit(nextLimit);
      } catch (queueError: any) {
        setRows([]);
        setTotalRows(0);
        setQueueStatusCounts(undefined);
        setError(
          queueError?.response?.data?.message || queueError?.message || 'Failed to load queue',
        );
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
      enableLevel1RoleTabs,
      fiscalYear,
      beneficiaryFilter,
      amountFilter,
      searchTerm,
      statusFilter,
      stageTabs,
    ],
  );

  const switchToWorkflowStage = useCallback(
    async (nextStage: string | null | undefined) => {
      const normalizedNextStage = String(nextStage || '').toLowerCase();
      if (!normalizedNextStage) {
        return false;
      }

      if (permittedStages.length > 0 && !permittedStages.includes(normalizedNextStage)) {
        return false;
      }

      const matchingTabs = stageTabs.filter((tab) => tab.stage === normalizedNextStage);
      if (matchingTabs.length > 0) {
        const currentTabForStage =
          matchingTabs.find((tab) => tab.key === activeStageTabKey) || null;
        const targetTab = currentTabForStage || matchingTabs[0];
        if (targetTab?.key && targetTab.key !== activeStageTabKey) {
          setActiveStageTabKey(targetTab.key);
        }
      }

      setActiveStage(normalizedNextStage);
      setPage(1);
      await loadQueue(normalizedNextStage, 1);
      return true;
    },
    [activeStageTabKey, loadQueue, permittedStages, stageTabs],
  );

  const fetchFullTimeline = useCallback(
    async (record: Record<string, any>, id: number | string, ref: string) => {
      setLogLoading(true);
      setLogRef(ref);
      setLogPopupOpen(true);
      if (enableLevel1RoleTabs) {
        const routeType = String(record?.level1_route_type || record?.level1RouteType || '')
          .trim()
          .toLowerCase();
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
    },
    [enableLevel1RoleTabs, getTimelineEndpoint, mapTimelineResponse],
  );

  useEffect(() => {
    loadMeta().catch((metaError: any) => {
      setError(
        metaError?.response?.data?.message ||
          metaError?.message ||
          'Failed to load workflow metadata',
      );
      setLoading(false);
    });
  }, [loadMeta]);

  useEffect(() => {
    if (!activeStage) return;
    loadQueue(activeStage, page).catch((queueError: any) => {
      setError(
        queueError?.response?.data?.message || queueError?.message || 'Failed to load queue',
      );
      setLoading(false);
    });
  }, [activeStage, loadQueue, page, fiscalYear, beneficiaryFilter, searchTerm, statusFilter]);

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
      const normalizedRoles = getNormalizedUserRoles(user);
      const preferredTabKey = resolvePreferredTabKey(stageTabs, normalizedRoles, activeStage);
      const preferredTab = stageTabs.find((tab) => tab.key === preferredTabKey) || stageTabs[0];
      setActiveStageTabKey(preferredTab.key);
      if (preferredTab.stage !== activeStage) {
        setActiveStage(preferredTab.stage);
      }
      return;
    }

    if (activeTab.stage !== activeStage) {
      setActiveStage(activeTab.stage);
    }
  }, [activeStage, activeStageTabKey, stageTabs, user]);

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

  const showExpenditurePayeePanel = useMemo(() => {
    return (
      config.moduleKey === 'expenditure' &&
      (String(activeStage || '').toLowerCase() === 'dof' || isSuperAdminView)
    );
  }, [activeStage, config.moduleKey, isSuperAdminView]);

  const loadPendingPayees = useCallback(async () => {
    if (!showExpenditurePayeePanel) return;
    setPendingPayeesLoading(true);
    try {
      const response = (await authenticityUtility.get(`${config.apiBasePath}/payees`, {
        params: { status: 'all', limit: 200 },
      })) as { success?: boolean; status?: string; data?: PendingPayeeRecord[] };

      if (response?.success === true || response?.status === 'success') {
        setPendingPayees(Array.isArray(response.data) ? response.data : []);
      } else {
        setPendingPayees([]);
      }
    } catch {
      setPendingPayees([]);
    } finally {
      setPendingPayeesLoading(false);
    }
  }, [config.apiBasePath, showExpenditurePayeePanel]);

  useEffect(() => {
    loadPendingPayees().catch(() => {});
  }, [loadPendingPayees]);

  const onPayeeDecision = useCallback(
    async (payeeId: number, decision: 'approved' | 'rejected') => {
      let rejectionReason = '';
      if (decision === 'rejected') {
        rejectionReason = window.prompt('Enter rejection reason')?.trim() || '';
        if (!rejectionReason) {
          showAlert('Rejection reason is required.', 'warning');
          return false;
        }
      }

      setPendingPayeeActingId(payeeId);
      try {
        const response = (await authenticityUtility.patch(
          `${config.apiBasePath}/payees/${payeeId}/approval`,
          {
            decision,
            rejection_reason: rejectionReason || null,
          },
        )) as { success?: boolean; status?: string; message?: string };

        if (response?.success === true || response?.status === 'success') {
          setPendingPayees((prev) =>
            prev.map((row) =>
              Number(row.id) === Number(payeeId)
                ? {
                    ...row,
                    approval_status: decision,
                    rejection_reason: decision === 'rejected' ? rejectionReason : null,
                    approved_at:
                      decision === 'approved' ? new Date().toISOString() : row.approved_at,
                  }
                : row,
            ),
          );
          showAlert(response.message || `Payee ${decision} successfully.`, 'success');
          return true;
        }

        showAlert(response?.message || 'Unable to update payee status.', 'error');
        return false;
      } catch (error: any) {
        showAlert(
          error?.response?.data?.message || error?.message || 'Unable to update payee status.',
          'error',
        );
        return false;
      } finally {
        setPendingPayeeActingId(null);
      }
    },
    [config.apiBasePath, showAlert],
  );

  const onPayeeEdit = useCallback(
    async (payeeId: number, payload: PendingPayeeRecord) => {
      setPendingPayeeEditingId(payeeId);
      try {
        const response = (await authenticityUtility.patch(
          `${config.apiBasePath}/payees/${payeeId}`,
          payload,
        )) as {
          status?: string;
          message?: string;
          data?: PendingPayeeRecord;
          success?: boolean;
        };

        if (response?.success === true || response?.status === 'success') {
          const updatedRow = response.data || payload;
          setPendingPayees((prev) =>
            prev.map((row) =>
              Number(row.id) === Number(payeeId) ? { ...row, ...updatedRow } : row,
            ),
          );
          return true;
        }

        showAlert(response?.message || 'Unable to update payee.', 'error');
        return false;
      } catch (error: any) {
        showAlert(
          error?.response?.data?.message || error?.message || 'Unable to update payee.',
          'error',
        );
        return false;
      } finally {
        setPendingPayeeEditingId(null);
      }
    },
    [config.apiBasePath, showAlert],
  );

  const onPayeeDelete = useCallback(
    async (payeeId: number) => {
      showAlert(
        'Delete this payee from the management list?',
        'warning',
        'Confirm Delete',
        async () => {
          try {
            const response = (await authenticityUtility.delete(
              `${config.apiBasePath}/payees/${payeeId}`,
            )) as {
              success?: boolean;
              status?: string;
              message?: string;
            };

            if (response?.success === true || response?.status === 'success') {
              setPendingPayees((prev) => prev.filter((row) => Number(row.id) !== Number(payeeId)));
              return;
            }

            showAlert(response?.message || 'Unable to delete payee.', 'error');
          } catch (error: any) {
            showAlert(
              error?.response?.data?.message || error?.message || 'Unable to delete payee.',
              'error',
            );
          }
        },
        true,
        'Delete',
        'Cancel',
      );
      return false;
    },
    [config.apiBasePath, showAlert],
  );

  const performApproval = useCallback(
    async (recordId: number | string) => {
      const record = rows.find((r) => getRecordId(r) === recordId);
      if (
        record &&
        activeStage === 'principal' &&
        isPrincipalDocumentFeatureVisible(record) &&
        !getWorkflowPrincipalDocumentUrl(record)
      ) {
        setPrincipalApprovalPopupId(recordId);
        setPrincipalApprovalFile(null);
        setPrincipalApprovalPopupOpen(true);
        return;
      }

      setActingRecordId(recordId);
      setError('');

      try {
        const response: any = await authenticityUtility.patch(getApprovalEndpoint(recordId), {
          decision: 'approved',
        });

        if (response?.status === 'success' || response?.success || response?.data?.success) {
          const nextStage = String(
            response?.data?.currentState?.currentStage ||
              response?.data?.currentState?.stage ||
              response?.data?.workflow_state?.currentStage ||
              '',
          ).toLowerCase();

          applyWorkflowDecisionLocally(recordId, 'approved', nextStage);

          if (nextStage && nextStage !== activeStage) {
            setStatusFilter('pending');
            const switched = await switchToWorkflowStage(nextStage);
            if (!switched) {
              await loadQueue(activeStage, page);
            }
          } else {
            await loadQueue(activeStage, page);
          }
          return;
        }

        showAlert(response?.message || response?.data?.message || 'Failed to approve', 'error');
      } catch (approvalError: any) {
        showAlert(approvalError?.response?.data?.message || 'Failed to approve', 'error');
      } finally {
        setActingRecordId(null);
      }
    },
    [
      activeStage,
      getApprovalEndpoint,
      getWorkflowPrincipalDocumentUrl,
      isPrincipalDocumentFeatureVisible,
      loadQueue,
      page,
      rows,
      showAlert,
    ],
  );

  const handlePrincipalDocumentFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const targetId = principalDocumentTargetId;
      event.target.value = '';

      if (!file || targetId === null || targetId === undefined) {
        setPendingApprovalAfterUploadId(null);
        return;
      }

      if (
        (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) ||
        file.size >= 2 * 1024 * 1024
      ) {
        showAlert('Only PDF files with a size less than 2MB are allowed.', 'error');
        setPendingApprovalAfterUploadId(null);
        return;
      }

      const success = await uploadPrincipalDocument(targetId, file);
      if (success && pendingApprovalAfterUploadId === targetId) {
        await performApproval(targetId);
        setPendingApprovalAfterUploadId(null);
      }
      setPrincipalDocumentTargetId(null);
    },
    [
      principalDocumentTargetId,
      showAlert,
      uploadPrincipalDocument,
      pendingApprovalAfterUploadId,
      performApproval,
    ],
  );

  const onApprove = async (recordId?: number | string) => {
    if (!recordId) {
      showAlert('Missing record id.', 'warning');
      return;
    }

    const record = rows.find((r) => getRecordId(r) === recordId);
    if (
      record &&
      activeStage === 'principal' &&
      isPrincipalDocumentFeatureVisible(record) &&
      !getWorkflowPrincipalDocumentUrl(record)
    ) {
      setPrincipalApprovalPopupId(recordId);
      setPrincipalApprovalFile(null);
      setPrincipalApprovalPopupOpen(true);
      return;
    }

    showAlert(
      'Are you sure you want to approve this proposal?',
      'warning',
      'Confirm Approval',
      async () => {
        await performApproval(recordId);
      },
      true,
      'Approve',
      'Cancel',
    );
  };

  const openActionPopup = (type: 'return' | 'reject', id: number | string, ref: string) => {
    setActionType(type);
    setActionId(id);
    setActionRef(ref);
    setActionComment('');
    setActionPopupOpen(true);
  };

  const closeActionPopup = () => {
    setActionPopupOpen(false);
    setActionType(null);
    setActionId(null);
    setActionRef('');
    setActionComment('');
  };

  const closePrincipalApprovalPopup = () => {
    if (principalApprovalSubmitting) return;
    setPrincipalApprovalPopupOpen(false);
    setPrincipalApprovalPopupId(null);
    setPrincipalApprovalFile(null);
  };

  const submitPrincipalApproval = async () => {
    if (!principalApprovalPopupId || principalApprovalSubmitting) return;
    if (!principalApprovalFile) {
      showAlert('Please select a PDF document to upload before approving.', 'warning');
      return;
    }

    setPrincipalApprovalSubmitting(true);
    try {
      const success = await uploadPrincipalDocument(
        principalApprovalPopupId,
        principalApprovalFile,
      );
      if (success) {
        await performApproval(principalApprovalPopupId);
        setPrincipalApprovalPopupOpen(false);
        setPrincipalApprovalPopupId(null);
        setPrincipalApprovalFile(null);
      }
    } finally {
      setPrincipalApprovalSubmitting(false);
    }
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
        decision: actionType === 'return' ? 'returned' : 'rejected',
        feedback: comment,
      });

      if (response?.status === 'success' || response?.success || response?.data?.success) {
        closeActionPopup();
        const nextStage = String(
          response?.data?.currentState?.currentStage ||
            response?.data?.currentState?.stage ||
            response?.data?.workflow_state?.currentStage ||
            '',
        ).toLowerCase();

        applyWorkflowDecisionLocally(
          actionId,
          actionType === 'return' ? 'returned' : 'rejected',
          nextStage,
        );

        if (nextStage && nextStage !== activeStage) {
          setStatusFilter('pending');
          const switched = await switchToWorkflowStage(nextStage);
          if (!switched) {
            await loadQueue(activeStage, page);
          }
        } else {
          await loadQueue(activeStage, page);
        }
        return;
      } else {
        showAlert(
          response?.message || response?.data?.message || `Failed to ${actionType}`,
          'error',
        );
      }
    } catch (approvalError: any) {
      showAlert(approvalError?.response?.data?.message || `Failed to ${actionType}`, 'error');
    } finally {
      setActingRecordId(null);
      setActionSubmitting(false);
    }
  };

  const getDisplayStatus = useCallback(
    (record: Record<string, any>) => {
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
        if (status === 'chairman_approved') return 'Approved Chairman';
        if (status === 'completed') return 'Completed';
        if (status === 'approved') return 'Approved';
        return 'Approved';
      }

      if (
        ['finance', 'expenditure'].includes(config.moduleKey) &&
        activeWorkflowTab?.showAllProposals &&
        category === 'pending'
      ) {
        const currentStage = getRecordCurrentStage(record);
        if (currentStage === 'level1') {
          return resolveFinanceLevel1Role(record) === 'coordinator'
            ? 'Pending Coordinator'
            : 'Pending HOD';
        }
        if (currentStage) {
          return `Pending ${formatStageLabel(currentStage, config.stageLabels)}`;
        }
      }

      return 'Pending';
    },
    [
      activeWorkflowTab?.showAllProposals,
      config.moduleKey,
      config.stageLabels,
      getRecordCurrentStage,
      getRecordStageDecision,
      getRecordWorkflowDecision,
      resolveStatusCategory,
    ],
  );

  const getFinanceProgressIndicators = useCallback(
    (record: Record<string, any>) => {
      if (config.moduleKey !== 'finance') return null;
      const activeStageKey = String(activeStage || '').toLowerCase();
      const statusCategory = resolveStatusCategory(record);
      if (statusCategory === 'returned' || statusCategory === 'rejected') return null;

      const currentStage = String(getRecordCurrentStage(record) || '').toLowerCase();
      const status = String(record.workflow_status || record.status || '').toLowerCase();
      const workflowStatus = String(record.workflow_state?.status || '').toLowerCase();
      const lastDecision = String(record.workflow_state?.lastDecision || '').toLowerCase();
      const combinedStatus = `${status} ${workflowStatus} ${lastDecision}`;
      const flow = Array.isArray(record.workflow_state?.flow)
        ? record.workflow_state.flow.map((stage: unknown) => String(stage || '').toLowerCase())
        : [];
      const proposedAmount = getWorkflowProposedAmount(record);
      const hasChairmanStage =
        flow.includes('chairman') ||
        proposedAmount > 10000 ||
        currentStage === 'chairman' ||
        combinedStatus.includes('chairman_approved');
      const isPrincipalApproved =
        currentStage === 'chairman' ||
        currentStage === 'completed' ||
        combinedStatus.includes('principal_approved') ||
        combinedStatus.includes('chairman_approved') ||
        combinedStatus.includes('completed') ||
        combinedStatus === 'approved';
      const isChairmanApproved =
        currentStage === 'completed' ||
        combinedStatus.includes('chairman_approved') ||
        combinedStatus.includes('completed') ||
        combinedStatus === 'approved';
      const isStageOverview =
        activeStageKey === 'dof' || activeStageKey === 'all' || !activeStageKey;

      const principalApprovedIndicator = {
        label: 'Principal Approved',
        className: 'fw-principal-indicator fw-principal-indicator--accepted',
      };
      const principalPendingIndicator = {
        label: 'Principal Pending',
        className: 'fw-principal-indicator fw-principal-indicator--pending',
      };
      const chairmanIndicator = {
        label: isChairmanApproved ? 'Chairman Approved' : 'Chairman Pending',
        className: isChairmanApproved
          ? 'fw-principal-indicator fw-principal-indicator--accepted'
          : 'fw-principal-indicator fw-principal-indicator--pending',
      };

      if (hasChairmanStage) {
        if (isPrincipalApproved && (isStageOverview || activeStageKey === 'principal')) {
          return [chairmanIndicator];
        }
        if (isStageOverview && currentStage === 'principal') {
          return [principalPendingIndicator];
        }
        return null;
      }

      if (activeStageKey === 'principal') return null;

      if (isStageOverview && currentStage === 'principal') {
        return [principalPendingIndicator];
      }

      if (isStageOverview && isPrincipalApproved) {
        return [principalApprovedIndicator];
      }

      return null;
    },
    [activeStage, config.moduleKey, getRecordCurrentStage, resolveStatusCategory],
  );

  function resolveFinanceLevel1Role(record: Record<string, any>): 'hod' | 'coordinator' {
    const routeType = String(record.level1_route_type || record.level1RouteType || '')
      .trim()
      .toLowerCase();
    if (routeType === 'entity_contact') {
      return 'coordinator';
    }
    return 'hod';
  }

  const stageScopedRows = useMemo(() => {
    const activeLevel1Role = activeWorkflowTab?.level1Role || null;

    let filtered = rows;
    if (enableLevel1RoleTabs && activeStage === 'level1' && activeLevel1Role) {
      filtered = filtered.filter((record) => resolveFinanceLevel1Role(record) === activeLevel1Role);
    }

    if (enableSecondaryFilter && beneficiaryFilter !== 'All Beneficiary') {
      const normalizedBeneficiaryFilter = beneficiaryFilter.toLowerCase();
      filtered = filtered.filter((record) => {
        const itemBeneficiaryType = String(
          record.beneficiary_type || record.beneficiaryType || '',
        ).toLowerCase();
        return itemBeneficiaryType === normalizedBeneficiaryFilter;
      });
    }

    return filtered;
  }, [
    activeStage,
    activeWorkflowTab?.level1Role,
    beneficiaryFilter,
    enableLevel1RoleTabs,
    enableSecondaryFilter,
    rows,
  ]);

  const secondaryFilterOptions = useMemo(() => {
    if (!enableSecondaryFilter) {
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
  }, [beneficiaryFilter, enableSecondaryFilter, stageScopedRows]);

  const secondaryFilterLabel = useMemo(
    () => getSecondaryFilterLabel(beneficiaryFilter),
    [beneficiaryFilter],
  );
  const secondaryFilterAllLabel = useMemo(
    () => getSecondaryFilterAllLabel(beneficiaryFilter),
    [beneficiaryFilter],
  );

  const secondaryScopedRows = useMemo(() => {
    if (!enableSecondaryFilter || !secondaryFilter) {
      return stageScopedRows;
    }

    const expected = secondaryFilter.toLowerCase();
    return stageScopedRows.filter((record) => {
      return getSecondaryFilterValue(record, beneficiaryFilter).toLowerCase() === expected;
    });
  }, [beneficiaryFilter, enableSecondaryFilter, secondaryFilter, stageScopedRows]);

  const amountScopedRows = useMemo(() => {
    if (config.moduleKey !== 'finance' || !amountFilter) {
      return secondaryScopedRows;
    }

    const threshold = 10000;
    return secondaryScopedRows.filter((record) => {
      const proposedAmount = getWorkflowProposedAmount(record);
      if (amountFilter === 'lt_10000') {
        return proposedAmount < threshold;
      }

      return proposedAmount >= threshold;
    });
  }, [amountFilter, config.moduleKey, secondaryScopedRows]);

  useEffect(() => {
    if (secondaryFilter && !secondaryFilterOptions.includes(secondaryFilter)) {
      setSecondaryFilter('');
    }
  }, [secondaryFilter, secondaryFilterOptions]);

  // The backend queue endpoint already filters `rows` by the search term (see
  // financeModel.listFinanceQueueRecords / expenditureModel's equivalent) across a
  // much broader field set than we could cheaply replicate here. Re-filtering
  // client-side on a narrower field set made the visible list narrower than the
  // (search-aware) server-computed statusCounts, producing a mismatch. Trust the
  // server's filtering and don't re-filter by searchTerm on the client.
  const searchScopedRows = amountScopedRows;

  const statusStats = useMemo(() => {
    if (
      queueStatusCounts &&
      !amountFilter &&
      (!enableSecondaryFilter || beneficiaryFilter === 'All Beneficiary') &&
      !secondaryFilter
    ) {
      return {
        total: Number(queueStatusCounts.total || 0),
        pending: Number(queueStatusCounts.pending || 0),
        approved: Number(queueStatusCounts.approved || 0),
        returned: Number(queueStatusCounts.returned || 0),
        rejected: Number(queueStatusCounts.rejected || 0),
        archived: Number(queueStatusCounts.archived || 0),
      };
    }

    const stats = {
      total: searchScopedRows.length,
      pending: 0,
      approved: 0,
      returned: 0,
      rejected: 0,
      archived: 0,
    };
    for (const row of searchScopedRows) {
      const category = resolveStatusCategory(row);
      stats[category] += 1;
    }
    return stats;
  }, [
    amountFilter,
    beneficiaryFilter,
    config.moduleKey,
    enableSecondaryFilter,
    queueStatusCounts,
    searchScopedRows,
    secondaryFilter,
    resolveStatusCategory,
  ]);

  const filteredRows = useMemo(() => {
    const prioritizeResubmitted = (items: Record<string, any>[]) => {
      if (statusFilter !== 'pending') return items;
      return [...items].sort((a, b) => {
        const aResubmitted = isResubmittedRecord(a);
        const bResubmitted = isResubmittedRecord(b);
        if (aResubmitted !== bResubmitted) return aResubmitted ? -1 : 1;

        const aTime =
          Date.parse(
            String(
              a.workflow_state?.resubmittedAt ||
                a.resubmittedAt ||
                a.updated_at ||
                a.created_at ||
                '',
            ),
          ) || 0;
        const bTime =
          Date.parse(
            String(
              b.workflow_state?.resubmittedAt ||
                b.resubmittedAt ||
                b.updated_at ||
                b.created_at ||
                '',
            ),
          ) || 0;
        return bTime - aTime;
      });
    };

    if (statusFilter === 'total') {
      return searchScopedRows;
    }

    return prioritizeResubmitted(
      searchScopedRows.filter((record) => resolveStatusCategory(record) === statusFilter),
    );
  }, [isResubmittedRecord, searchScopedRows, statusFilter, resolveStatusCategory]);

  const totalPages = Math.max(1, Math.ceil((totalRows || 0) / (limit || 20)));

  const formatAmount = (value: any) => {
    const num = Number(value);
    if (isNaN(num)) return value || '-';
    return `₹ ${num.toLocaleString('en-IN')}`;
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'approved':
        return 'fw-status fw-status--approved';
      case 'rejected':
        return 'fw-status fw-status--rejected';
      case 'returned':
        return 'fw-status fw-status--returned';
      case 'archived':
        return 'fw-status fw-status--archived';
      default:
        return 'fw-status fw-status--pending';
    }
  };

  const getTimelineStageLabel = useCallback(
    (entry: WorkflowTimelineItem) => {
      const stageToken = String(entry?.stage || '')
        .trim()
        .toLowerCase();

      if (enableLevel1RoleTabs && stageToken === 'level1') {
        const actorRoleToken = String(entry?.actorRole || '')
          .trim()
          .toLowerCase();
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
    },
    [config.stageLabels, enableLevel1RoleTabs, logLevel1Role],
  );

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
              '',
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
            'error',
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
      'Cancel',
    );
  };

  const closeCarryForwardPopup = useCallback(() => {
    if (carryForwardSubmitting) return;
    setCarryForwardPopupOpen(false);
    setCarryForwardRecordId(null);
    setCarryForwardFinanceId(null);
    setCarryForwardRef('');
    setCarryForwardAvailableAmount(0);
    setCarryForwardRemarks('');
    setCarryForwardLoading(false);
  }, [carryForwardSubmitting]);

  const openCarryForwardPopup = useCallback(
    async (record: Record<string, any>) => {
      const recordId = getRecordId(record);
      if (recordId === undefined || recordId === null) {
        setError('Unable to carry forward this row because record id is missing.');
        return;
      }

      // Carry-forward always runs against the finance request. On the expenditure
      // Advance card, resolve the parent finance id + use the finance API base.
      const isExpenditureModule = config.moduleKey === 'expenditure';
      const carryForwardBasePath = isExpenditureModule ? '/finance-requests' : config.apiBasePath;
      const carryForwardTargetId = isExpenditureModule
        ? Number(record.finance_request_id ?? record.financeRequestId ?? 0) || null
        : recordId;

      if (!carryForwardTargetId) {
        setError('Unable to carry forward: linked finance request not found.');
        return;
      }

      const proposalRef = getRecordProposalRef(record);
      setCarryForwardRecordId(recordId);
      setCarryForwardFinanceId(carryForwardTargetId);
      setCarryForwardRef(proposalRef);
      setCarryForwardPopupOpen(true);
      setCarryForwardLoading(true);
      setCarryForwardRemarks('');

      try {
        const response: any = await authenticityUtility.get(
          `${carryForwardBasePath}/${carryForwardTargetId}/carry-forward`,
        );
        const envelope =
          response?.data && typeof response.data === 'object' ? response.data : response;
        if (envelope?.success === false || envelope?.status === 'error') {
          throw new Error(envelope?.message || 'Unable to load carry-forward details.');
        }
        const data = envelope?.data || envelope;
        const sourceYear = Number(
          data?.sourceFiscalYear || data?.source_fiscal_year || getRunningFiscalYearStart(),
        );
        const unsettledAdvance = Number(
          data?.unsettledAdvanceAmount ||
            data?.unsettled_advance_amount ||
            data?.balanceAmount ||
            data?.balance_amount ||
            0,
        );
        setCarryForwardSourceYear(sourceYear);
        setCarryForwardTargetYear(sourceYear + 1);
        setCarryForwardAvailableAmount(
          Number.isFinite(unsettledAdvance) ? Math.max(unsettledAdvance, 0) : 0,
        );
      } catch (error: any) {
        closeCarryForwardPopup();
        showAlert(
          error?.response?.data?.message ||
            error?.message ||
            'Unable to load carry-forward details.',
          'error',
        );
      } finally {
        setCarryForwardLoading(false);
      }
    },
    [
      closeCarryForwardPopup,
      config.apiBasePath,
      config.moduleKey,
      getRecordId,
      getRecordProposalRef,
      showAlert,
    ],
  );

  const submitCarryForward = useCallback(async () => {
    if (!carryForwardFinanceId || carryForwardSubmitting) return;

    if (!carryForwardRemarks.trim()) {
      showAlert('Carry-forward remarks are required.', 'warning');
      return;
    }

    const carryForwardBasePath =
      config.moduleKey === 'expenditure' ? '/finance-requests' : config.apiBasePath;

    setCarryForwardSubmitting(true);
    try {
      const response: any = await authenticityUtility.post(
        `${carryForwardBasePath}/${carryForwardFinanceId}/carry-forward`,
        {
          targetFiscalYear: carryForwardTargetYear,
          remarks: carryForwardRemarks.trim(),
        },
      );

      // authenticityUtility returns the response BODY ({ success, message, data }).
      // The success flag sits on this top level — don't unwrap into `.data` (the
      // allocation object), which has no `success` and would falsely read as failure.
      const succeeded = response?.success === true || response?.status === 'success';
      if (!succeeded) {
        throw new Error(response?.message || 'Unable to carry forward this card.');
      }

      closeCarryForwardPopup();
      showAlert('Card carry-forward created successfully.', 'success');
      await loadQueue(activeStage, page);
    } catch (error: any) {
      showAlert(
        error?.response?.data?.message || error?.message || 'Unable to carry forward this card.',
        'error',
      );
    } finally {
      setCarryForwardSubmitting(false);
    }
  }, [
    activeStage,
    carryForwardFinanceId,
    carryForwardRemarks,
    carryForwardSubmitting,
    carryForwardTargetYear,
    closeCarryForwardPopup,
    config.apiBasePath,
    config.moduleKey,
    loadQueue,
    page,
    showAlert,
  ]);

  const handlePdfPreviewClick = useCallback(
    (recordId: number | string, isActionablePending?: boolean) => {
      setPreviewRecordId(recordId);
      setPreviewIsActionablePending(Boolean(isActionablePending));
    },
    [],
  );

  const handlePrincipalDocumentDownload = useCallback((record: Record<string, any>) => {
    const url = getWorkflowPrincipalDocumentUrl(record);
    if (!url) return;
    const title = String(
      getWorkflowPrincipalDocument(record)?.original_name ||
        getWorkflowPrincipalDocument(record)?.stored_name ||
        'Principal Document',
    ).trim();
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = title || 'Principal Document.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, []);

  const handleAnnexureView = useCallback((annexure: Record<string, any>) => {
    const url = getWorkflowAnnexureUrl(annexure);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const filteredColumns = useMemo(() => {
    return config.columns.filter(
      (column) =>
        column.key !== 'applicant_name' &&
        column.key !== 'id' &&
        column.key !== 'total_budget' &&
        column.key !== 'amount' &&
        column.key !== 'total_amount' &&
        column.key !== 'status' &&
        column.key !== 'workflow_status' &&
        column.key !== 'stage' &&
        column.key !== 'workflow_stage',
    );
  }, [config.columns]);
  const getProposalType = (record: any) => {
    const rawType = String(
      record?.proposal_type ||
        record?.request_type ||
        record?.expenditure_type ||
        record?.type ||
        '',
    )
      .trim()
      .toLowerCase();

    if (rawType.includes('advance 2') || rawType.includes('advance2')) {
      return 'advance2';
    }

    if (rawType.includes('advance')) {
      return 'advance1';
    }

    if (rawType.includes('settlement')) {
      return 'settlement';
    }

    if (rawType.includes('expenditure')) {
      return 'expenditure';
    }

    return 'unknown';
  };

  const getProposalBadge = (record: any) => {
    const type = getProposalType(record);

    switch (type) {
      case 'advance1':
      case 'advance2':
        return { label: 'A', className: 'fw-proposal-badge fw-proposal-badge--advance' };
      case 'expenditure':
        return { label: 'E', className: 'fw-proposal-badge fw-proposal-badge--expenditure' };
      case 'settlement':
        return { label: 'S', className: 'fw-proposal-badge fw-proposal-badge--settlement' };
      default:
        return { label: '', className: '' };
    }
  };

  const proposalFilteredRows = useMemo(() => {
    if (config.moduleKey !== 'expenditure') {
      return filteredRows;
    }

    if (proposalTypeFilter === 'all') {
      return filteredRows;
    }

    return filteredRows.filter((record) => {
      const type = getProposalType(record);

      if (proposalTypeFilter === 'advance') {
        return type === 'advance1' || type === 'advance2';
      }

      if (proposalTypeFilter === 'expenditure') {
        return type === 'expenditure';
      }

      if (proposalTypeFilter === 'settlement') {
        return type === 'settlement';
      }

      return true;
    });
  }, [filteredRows, config.moduleKey, proposalTypeFilter]);
  return (
    <>
      <input
        ref={principalDocumentInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={handlePrincipalDocumentFileChange}
      />
      <div className="fw-page">
        <div className="fw-container">
          <div className="fw-card">
            <div className="fw-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <h5 className="fw-title" style={{ margin: 0 }}>
                  {config.title}
                </h5>
                {showExpenditurePayeePanel && (
                  <div
                    className="fw-view-tabs"
                    style={{
                      display: 'flex',
                      background: '#f1f5f9',
                      padding: '4px',
                      borderRadius: '8px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode('workflow')}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        background: viewMode === 'workflow' ? '#fff' : 'transparent',
                        borderRadius: '6px',
                        fontWeight: 600,
                        color: viewMode === 'workflow' ? '#0f172a' : '#64748b',
                        boxShadow: viewMode === 'workflow' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      Requests
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('payees')}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        background: viewMode === 'payees' ? '#fff' : 'transparent',
                        borderRadius: '6px',
                        fontWeight: 600,
                        color: viewMode === 'payees' ? '#0f172a' : '#64748b',
                        boxShadow: viewMode === 'payees' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      Payees
                      {pendingPayees.filter(
                        (payee) =>
                          String(payee.approval_status || 'pending')
                            .trim()
                            .toLowerCase() === 'pending',
                      ).length > 0 && (
                        <span
                          style={{
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            minWidth: '20px',
                            textAlign: 'center',
                          }}
                        >
                          {
                            pendingPayees.filter(
                              (payee) =>
                                String(payee.approval_status || 'pending')
                                  .trim()
                                  .toLowerCase() === 'pending',
                            ).length
                          }
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

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
                        if (tab.showAllProposals) {
                          setStatusFilter('total');
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
              {config.moduleKey === 'expenditure' && (
                <>
                  {viewMode === 'payees' && (
                    <div className="fw-payee-header-search">
                      <Search size={16} className="fw-payee-header-search-icon" />
                      <input
                        type="text"
                        className="fw-control fw-payee-header-search-input"
                        placeholder="Search payee..."
                        value={payeeSearchTerm}
                        onChange={(e) => setPayeeSearchTerm(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="fw-proposal-filter-bar">
                    <button
                      type="button"
                      className={`fw-proposal-filter-btn ${proposalTypeFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setProposalTypeFilter('all')}
                    >
                      All
                    </button>

                    <button
                      type="button"
                      className={`fw-proposal-filter-btn fw-proposal-filter-btn--advance ${proposalTypeFilter === 'advance' ? 'active' : ''}`}
                      onClick={() => setProposalTypeFilter('advance')}
                    >
                      A
                    </button>

                    <button
                      type="button"
                      className={`fw-proposal-filter-btn fw-proposal-filter-btn--expenditure ${proposalTypeFilter === 'expenditure' ? 'active' : ''}`}
                      onClick={() => setProposalTypeFilter('expenditure')}
                    >
                      E
                    </button>

                    <button
                      type="button"
                      className={`fw-proposal-filter-btn fw-proposal-filter-btn--settlement ${proposalTypeFilter === 'settlement' ? 'active' : ''}`}
                      onClick={() => setProposalTypeFilter('settlement')}
                    >
                      S
                    </button>
                  </div>
                </>
              )}
              {viewMode === 'workflow' && (
                <div className="fw-header-actions">
                  {config.moduleKey === 'finance' && (
                    <div
                      className="fw-amount-filters"
                      role="group"
                      aria-label="Amount filter shortcuts"
                    >
                      <button
                        type="button"
                        className={`fw-amount-filter-btn ${amountFilter === 'lt_10000' ? 'active' : ''}`}
                        aria-pressed={amountFilter === 'lt_10000'}
                        onClick={() => {
                          setAmountFilter((current) => (current === 'lt_10000' ? '' : 'lt_10000'));
                          setPage(1);
                        }}
                        title="Shortlist proposals below 10,000"
                      >
                        {'< 10k'}
                      </button>
                      <button
                        type="button"
                        className={`fw-amount-filter-btn ${amountFilter === 'gte_10000' ? 'active' : ''}`}
                        aria-pressed={amountFilter === 'gte_10000'}
                        onClick={() => {
                          setAmountFilter((current) =>
                            current === 'gte_10000' ? '' : 'gte_10000',
                          );
                          setPage(1);
                        }}
                        title="Shortlist proposals 10,000 and above"
                      >
                        {'> 10k'}
                      </button>
                    </div>
                  )}

                  <select
                    className="fw-control"
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                    title="Fiscal Year"
                  >
                    {fiscalYearOptions.map((year) => (
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

                  {enableSecondaryFilter && (
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
              )}
            </div>

            {viewMode === 'workflow' && (
              <div className="fw-stats">
                <div
                  className={`fw-stats-card total ${statusFilter === 'total' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('total');
                    setPage(1);
                  }}
                >
                  <span className="fw-stats-icon">
                    <Briefcase size={18} />
                  </span>
                  <div className="fw-stats-text">
                    <span className="fw-stats-label">Total</span>
                    <span className="fw-stats-number">{statusStats.total}</span>
                  </div>
                </div>
                <div
                  className={`fw-stats-card pending ${statusFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('pending');
                    setPage(1);
                  }}
                >
                  <span className="fw-stats-icon">
                    <Clock size={18} />
                  </span>
                  <div className="fw-stats-text">
                    <span className="fw-stats-label">Pending</span>
                    <span className="fw-stats-number">{statusStats.pending}</span>
                  </div>
                </div>
                <div
                  className={`fw-stats-card returned ${statusFilter === 'returned' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('returned');
                    setPage(1);
                  }}
                >
                  <span className="fw-stats-icon">
                    <RotateCcw size={18} />
                  </span>
                  <div className="fw-stats-text">
                    <span className="fw-stats-label">Return</span>
                    <span className="fw-stats-number">{statusStats.returned}</span>
                  </div>
                </div>
                <div
                  className={`fw-stats-card rejected ${statusFilter === 'rejected' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('rejected');
                    setPage(1);
                  }}
                >
                  <span className="fw-stats-icon">
                    <XCircle size={18} />
                  </span>
                  <div className="fw-stats-text">
                    <span className="fw-stats-label">Reject</span>
                    <span className="fw-stats-number">{statusStats.rejected}</span>
                  </div>
                </div>
                <div
                  className={`fw-stats-card approved ${statusFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('approved');
                    setPage(1);
                  }}
                >
                  <span className="fw-stats-icon">
                    <CheckCircle2 size={18} />
                  </span>
                  <div className="fw-stats-text">
                    <span className="fw-stats-label">Approved</span>
                    <span className="fw-stats-number">{statusStats.approved}</span>
                  </div>
                </div>
                <div
                  className={`fw-stats-card archived ${statusFilter === 'archived' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('archived');
                    setPage(1);
                  }}
                >
                  <span className="fw-stats-icon">
                    <Archive size={18} />
                  </span>
                  <div className="fw-stats-text">
                    <span className="fw-stats-label">Archive</span>
                    <span className="fw-stats-number">{statusStats.archived}</span>
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'payees' ? (
              <div className="fw-payee-panel" style={{ margin: '10px 0 24px', padding: '0 24px' }}>
                <PendingPayeeApprovals
                  pendingPayees={pendingPayees}
                  pendingPayeesLoading={pendingPayeesLoading}
                  onPayeeDecision={onPayeeDecision}
                  pendingPayeeActingId={pendingPayeeActingId}
                  onPayeeEdit={onPayeeEdit}
                  pendingPayeeEditingId={pendingPayeeEditingId}
                  apiBasePath={config.apiBasePath}
                  onPayeeDelete={onPayeeDelete}
                  searchTerm={payeeSearchTerm}
                  onSearchTermChange={setPayeeSearchTerm}
                  showTopSearch={false}
                />
              </div>
            ) : (
              <div className="fw-body">
                {error && <div className="fw-state">{error}</div>}

                {loading ? (
                  <div className="fw-state">Loading workflow items...</div>
                ) : filteredRows.length === 0 ? (
                  <div className="fw-state">No workflow items found</div>
                ) : (
                  <>
                    <div className="fw-cards-container">
                      {proposalFilteredRows.map((record, rowIndex) => {
                        const recordId = getRecordId(record) ?? `row-${rowIndex}`;
                        const timelineKey = String(recordId);
                        const statusCategory = resolveStatusCategory(record);
                        const recordCurrentStage = getRecordCurrentStage(record);
                        const isSuperAdminDeleteMode =
                          Boolean(config.enableSuperAdminDelete) && isSuperAdminView;
                        const isPending =
                          statusCategory === 'pending' &&
                          recordCurrentStage === activeStage.toLowerCase();
                        const isActionablePending =
                          isPending ||
                          (isSuperAdminView &&
                            Boolean(activeWorkflowTab?.showAllProposals) &&
                            statusCategory === 'pending' &&
                            Boolean(recordCurrentStage));
                        const isArchived = statusCategory === 'archived';
                        const isApproved = statusCategory === 'approved';
                        const carryForwardUnsettledAdvance = Number(
                          record.carry_forward_unsettled_advance_amount ??
                            record.carryForwardUnsettledAdvanceAmount ??
                            0,
                        );
                        // Carry-forward now lives on the expenditure ADVANCE card
                        // (moved off the finance request). It carries the parent
                        // finance request's unsettled advance into the next FY.
                        const isAdvanceCard =
                          String(record.request_type || '')
                            .trim()
                            .toLowerCase() === 'advance';
                        const canCarryForwardCard =
                          config.moduleKey === 'expenditure' &&
                          isAdvanceCard &&
                          isSuperAdminView &&
                          !isArchived &&
                          statusCategory === 'approved' &&
                          Number.isFinite(carryForwardUnsettledAdvance) &&
                          carryForwardUnsettledAdvance > 0;
                        const isSuperAdminReturnAllowed =
                          isSuperAdminDeleteMode &&
                          ['pending', 'approved', 'rejected', 'archived'].includes(statusCategory);
                        const proposedAmount =
                          record.total_amount || record.total_budget || record.amount || 0;
                        const rawApprovedAmount = Number(
                          record.approved_total_amount ?? record.approved_amount ?? 0,
                        );
                        const approvedAmount =
                          isApproved && rawApprovedAmount <= 0 ? proposedAmount : rawApprovedAmount;
                        const showApprovedAmount = isApproved || approvedAmount > 0;
                        const proposalRef = getRecordProposalRef(record);
                        const principalDocument = getWorkflowPrincipalDocument(record);
                        const principalDocumentUrl = getWorkflowPrincipalDocumentUrl(record);
                        const principalDocumentTitle = String(
                          principalDocument?.original_name ||
                            principalDocument?.stored_name ||
                            'Principal Document',
                        ).trim();
                        const showPrincipalDocumentAction = canShowPrincipalDocumentAction(record);
                        const principalDocumentActionBusy = principalDocumentBusyId === recordId;
                        const primaryAnnexure = getWorkflowAnnexures(record)[0] || null;
                        const annexureUrl = getWorkflowAnnexureUrl(primaryAnnexure);
                        const annexureTitle = getWorkflowAnnexureTitle(primaryAnnexure);
                        const showWorkflowAnnexureAction =
                          (config.moduleKey === 'finance' || config.moduleKey === 'expenditure') &&
                          Boolean(annexureUrl);

                        const tag = getWorkflowRecordTag(record);

                        const isResubmitted = isResubmittedRecord(record);

                        return (
                          <div key={timelineKey} className="fw-item-wrap">
                            <div
                              className={`fw-item fw-item--clickable ${isResubmitted ? 'fw-item--resubmitted' : ''} ${archivingIds.has(recordId) ? 'fw-item--archiving' : ''}`}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                navigate(getRecordRoute(recordId, 'view'), {
                                  state: { isActionablePending },
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(getRecordRoute(recordId, 'view'), {
                                    state: { isActionablePending },
                                  });
                                }
                              }}
                            >
                              <div className="fw-topbar">
                                <div className="fw-topbar-left">
                                  {config.moduleKey === 'expenditure' ? (
                                    <>
                                      <h5 className="fw-name">
                                        {record.applicant_name ||
                                          record.user_name ||
                                          record.faculty_name ||
                                          'Unknown'}
                                      </h5>
                                      {tag && tag.trim() !== '' && (
                                        <span className="fw-tag-pill">{tag}</span>
                                      )}
                                      {(() => {
                                        const badge = getProposalBadge(record);
                                        return badge.label ? (
                                          <span className={badge.className}>{badge.label}</span>
                                        ) : null;
                                      })()}
                                      {Boolean(
                                        record.has_topup || record.workflow_state?.topupAt,
                                      ) && (
                                        <span
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: '#059669',
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
                                      <span className="fw-id">{proposalRef}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="fw-id">{proposalRef}</span>
                                      <h5 className="fw-name">
                                        {record.applicant_name ||
                                          record.user_name ||
                                          record.faculty_name ||
                                          'Unknown'}
                                      </h5>
                                      {tag && tag.trim() !== '' && (
                                        <span className="fw-tag-pill">{tag}</span>
                                      )}
                                      {Boolean(
                                        record.has_topup || record.workflow_state?.topupAt,
                                      ) && (
                                        <span
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: '#059669',
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
                                    </>
                                  )}
                                </div>

                                <div className="fw-topbar-right">
                                  <div
                                    className="fw-amounts-container"
                                    style={{
                                      display: 'flex',
                                      gap: '20px',
                                      textAlign: 'right',
                                      marginRight: '15px',
                                    }}
                                  >
                                    <div className="fw-amount-item">
                                      <p
                                        className="fw-amount-label"
                                        style={{
                                          margin: 0,
                                          fontSize: '0.78rem',
                                          fontWeight: 600,
                                          opacity: 0.75,
                                        }}
                                      >
                                        {showApprovedAmount ? 'Proposed' : 'Amount'}
                                      </p>
                                      <p
                                        className="fw-amount"
                                        style={{ margin: 0, fontSize: '1.1rem' }}
                                      >
                                        {formatAmount(proposedAmount)}
                                      </p>
                                    </div>
                                    {showApprovedAmount && (
                                      <div className="fw-amount-item">
                                        <p
                                          className="fw-amount-label"
                                          style={{
                                            margin: 0,
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            opacity: 0.75,
                                          }}
                                        >
                                          Approved
                                        </p>
                                        <p
                                          className="fw-amount"
                                          style={{
                                            margin: 0,
                                            fontSize: '1.1rem',
                                            color: '#137a3a',
                                          }}
                                        >
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
                                      navigate(getRecordRoute(recordId, 'view'), {
                                        state: { isActionablePending },
                                      });
                                    }}
                                  >
                                    <Eye size={16} />
                                  </button>

                                  <button
                                    className="fw-icon-btn"
                                    title="Edit"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        !isApproved ||
                                        (isSuperAdminView &&
                                          (config.moduleKey === 'finance' ||
                                            config.moduleKey === 'expenditure'))
                                      ) {
                                        navigate(getRecordRoute(recordId, 'edit'));
                                      }
                                    }}
                                    disabled={
                                      isApproved &&
                                      !(
                                        isSuperAdminView &&
                                        (config.moduleKey === 'finance' ||
                                          config.moduleKey === 'expenditure')
                                      )
                                    }
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
                                  {config.moduleKey === 'finance' &&
                                    showPrincipalDocumentAction &&
                                    (principalDocumentUrl ? (
                                      <button
                                        type="button"
                                        className="fw-action-btn fw-action-btn--download"
                                        title={principalDocumentTitle}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePrincipalDocumentDownload(record);
                                        }}
                                        disabled={
                                          principalDocumentActionBusy || !principalDocumentUrl
                                        }
                                      >
                                        <Download size={18} />
                                      </button>
                                    ) : canManagePrincipalDocuments &&
                                      isPrincipalDocumentEligible(record) ? (
                                      <button
                                        type="button"
                                        className="fw-action-btn fw-action-btn--download"
                                        title="Upload Principal Document"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePrincipalDocumentUploadClick(record, recordId);
                                        }}
                                        disabled={principalDocumentActionBusy}
                                      >
                                        <Upload size={18} />
                                      </button>
                                    ) : null)}

                                  {config.moduleKey === 'finance' &&
                                    principalDocumentUrl &&
                                    canManagePrincipalDocuments && (
                                      <>
                                        <button
                                          type="button"
                                          className="fw-action-btn fw-action-btn--download"
                                          title={`View ${principalDocumentTitle}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(
                                              principalDocumentUrl,
                                              '_blank',
                                              'noopener,noreferrer',
                                            );
                                          }}
                                          disabled={principalDocumentActionBusy}
                                          style={{ background: '#eef6ff', color: '#184d92' }}
                                        >
                                          <Eye size={18} />
                                        </button>
                                        <button
                                          type="button"
                                          className="fw-action-btn fw-action-btn--download"
                                          title={`Delete ${principalDocumentTitle}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deletePrincipalDocument(record);
                                          }}
                                          disabled={principalDocumentActionBusy}
                                          style={{ background: '#fef2f2', color: '#dc2626' }}
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      </>
                                    )}

                                  {showWorkflowAnnexureAction && primaryAnnexure && (
                                    <button
                                      type="button"
                                      className="fw-action-btn fw-action-btn--download"
                                      title={`View Annexure: ${annexureTitle}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAnnexureView(primaryAnnexure);
                                      }}
                                      style={{ background: '#eaf6ff', color: '#075985' }}
                                    >
                                      <FileText size={18} />
                                    </button>
                                  )}

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
                                    {(() => {
                                      const financeIndicators =
                                        getFinanceProgressIndicators(record);
                                      if (!financeIndicators) return null;
                                      return (
                                        <>
                                          {financeIndicators.map((indicator) => (
                                            <span
                                              key={indicator.label}
                                              className={indicator.className}
                                            >
                                              {indicator.label}
                                            </span>
                                          ))}
                                        </>
                                      );
                                    })()}
                                  </div>
                                  <div className="fw-actions-row">
                                    {isSuperAdminView
                                      ? !isArchived && (
                                          <>
                                            {isSuperAdminDeleteMode ? (
                                              <>
                                                <button
                                                  className="fw-action-btn fw-action-btn--returned"
                                                  title="Return"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openActionPopup(
                                                      'return',
                                                      recordId,
                                                      proposalRef,
                                                    );
                                                  }}
                                                  disabled={
                                                    actingRecordId === recordId ||
                                                    !isSuperAdminReturnAllowed
                                                  }
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
                                                    disabled={
                                                      actingRecordId === recordId ||
                                                      !isActionablePending
                                                    }
                                                  >
                                                    <CheckCircle2 size={18} />
                                                  </button>

                                                  <button
                                                    className="fw-action-btn fw-action-btn--returned"
                                                    title="Return"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openActionPopup(
                                                        'return',
                                                        recordId,
                                                        proposalRef,
                                                      );
                                                    }}
                                                    disabled={
                                                      actingRecordId === recordId ||
                                                      !isActionablePending
                                                    }
                                                  >
                                                    <RotateCcw size={18} />
                                                  </button>
                                                </>
                                              )
                                            )}
                                          </>
                                        )
                                      : statusCategory === 'pending' && (
                                          <>
                                            <button
                                              className="fw-action-btn fw-action-btn--approved"
                                              title="Approve"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onApprove(recordId);
                                              }}
                                              disabled={
                                                actingRecordId === recordId || !isActionablePending
                                              }
                                            >
                                              <CheckCircle2 size={18} />
                                            </button>

                                            <button
                                              className="fw-action-btn fw-action-btn--returned"
                                              title="Return"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openActionPopup('return', recordId, proposalRef);
                                              }}
                                              disabled={
                                                actingRecordId === recordId || !isActionablePending
                                              }
                                            >
                                              <RotateCcw size={18} />
                                            </button>

                                            <button
                                              className="fw-action-btn fw-action-btn--rejected"
                                              title="Reject"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openActionPopup('reject', recordId, proposalRef);
                                              }}
                                              disabled={
                                                actingRecordId === recordId || !isActionablePending
                                              }
                                            >
                                              <XCircle size={18} />
                                            </button>
                                          </>
                                        )}

                                    {canCarryForwardCard && (
                                      <button
                                        className="fw-action-btn fw-action-btn--download"
                                        title="Carry Forward Card"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCarryForwardPopup(record);
                                        }}
                                        disabled={actingRecordId === recordId}
                                        style={{ background: '#f0fdf4', color: '#15803d' }}
                                      >
                                        <CreditCard size={18} />
                                      </button>
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
                                          (isSuperAdminView &&
                                            !isActionablePending &&
                                            resolveStatusCategory(record) !== 'archived')
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
                            : `${(page - 1) * limit + 1}-${Math.min((page - 1) * limit + filteredRows.length, totalRows)} of ${totalRows}`}
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
            )}
          </div>
        </div>
        {deletePopupOpen && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Close delete confirmation dialog"
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
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeDeletePopup();
              }
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeDeletePopup();
              }
            }}
          >
            <div
              style={{
                width: 'min(400px, 95vw)',
                background: '#fff',
                borderRadius: 12,
                padding: 24,
                boxShadow: '0 10px 35px rgba(0,0,0,0.25)',
                textAlign: 'center',
              }}
            >
              <div style={{ color: '#dc3545', marginBottom: 16 }}>
                <Trash2 size={48} />
              </div>
              <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Confirm Deletion</h4>
              <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
                Are you sure you want to permanently delete{' '}
                {config.deleteEntityLabel || 'this request'} <strong>{deleteRef}</strong>? This
                action cannot be undone.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={closeDeletePopup}
                  style={{
                    border: '1px solid #ddd',
                    background: '#fff',
                    borderRadius: 8,
                    padding: '8px 24px',
                    cursor: 'pointer',
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
                    border: 'none',
                    background: deleteCountdown > 0 ? '#e9ecef' : '#dc3545',
                    color: deleteCountdown > 0 ? '#6c757d' : '#fff',
                    borderRadius: 8,
                    padding: '8px 24px',
                    cursor: deleteCountdown > 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    minWidth: '120px',
                    transition: 'all 0.2s',
                  }}
                >
                  {deleteCountdown > 0 ? `Delete (${deleteCountdown}s)` : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
        <CustomModal
          show={carryForwardPopupOpen}
          onHide={carryForwardSubmitting ? () => {} : closeCarryForwardPopup}
          title="Carry Forward Card"
          size="lg"
          centered
          backdrop={carryForwardSubmitting ? 'static' : true}
          keyboard={!carryForwardSubmitting}
          hideCloseButton={carryForwardSubmitting}
          footer={
            <div className="d-flex justify-content-end gap-2 w-100">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={closeCarryForwardPopup}
                disabled={carryForwardSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-success"
                onClick={submitCarryForward}
                disabled={carryForwardLoading || carryForwardSubmitting}
              >
                {carryForwardSubmitting ? 'Saving...' : 'Carry Forward Card'}
              </button>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
            Reference: <b>{carryForwardRef}</b>
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
            This only displays the same card in the target FY for settlement. No amount is moved
            from the source FY.
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Source FY</span>
              <input
                className="form-control"
                value={`FY ${carryForwardSourceYear}-${String(carryForwardSourceYear + 1).slice(2)}`}
                disabled
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Target FY</span>
              <select
                className="form-control"
                value={carryForwardTargetYear}
                onChange={(event) => setCarryForwardTargetYear(Number(event.target.value))}
                disabled={carryForwardLoading || carryForwardSubmitting}
              >
                {Array.from({ length: 5 }, (_, offset) => carryForwardSourceYear + 1 + offset).map(
                  (year) => (
                    <option key={year} value={year}>
                      {`FY ${year}-${String(year + 1).slice(2)}`}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div style={{ marginBottom: 12, color: '#475569', fontSize: 13 }}>
            Unsettled advance in source FY: <b>{formatAmount(carryForwardAvailableAmount)}</b>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Remarks</span>
            <textarea
              className="form-control"
              rows={4}
              value={carryForwardRemarks}
              onChange={(event) => setCarryForwardRemarks(event.target.value)}
              disabled={carryForwardLoading || carryForwardSubmitting}
              placeholder="Reason for showing this card in the target FY"
            />
          </label>
        </CustomModal>
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
          onHide={actionSubmitting ? () => {} : closeActionPopup}
          title={actionType === 'return' ? 'Return Item - Comments' : 'Reject Item - Comments'}
          size="sm"
          centered
          backdrop={actionSubmitting ? 'static' : true}
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
                className={`btn btn-sm ${actionType === 'reject' ? 'btn-danger' : 'btn-warning text-dark'}`}
                onClick={submitActionWithComment}
                disabled={actionSubmitting}
              >
                {actionSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
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
          show={principalApprovalPopupOpen}
          onHide={closePrincipalApprovalPopup}
          title="Principal Approval Form"
          centered
          backdrop={principalApprovalSubmitting ? 'static' : true}
          keyboard={!principalApprovalSubmitting}
          hideCloseButton={principalApprovalSubmitting}
          footer={
            <div className="d-flex justify-content-end gap-2 w-100">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={closePrincipalApprovalPopup}
                disabled={principalApprovalSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-success"
                onClick={submitPrincipalApproval}
                disabled={principalApprovalSubmitting || !principalApprovalFile}
              >
                {principalApprovalSubmitting ? 'Submitting...' : 'Approve and Submit'}
              </button>
            </div>
          }
        >
          <div style={{ fontSize: 14, marginBottom: 15 }}>
            Please upload the required annexure document before approving this request.
          </div>
          <div className="mb-3">
            <label className="form-label fw-bold">Upload Principal Annexure (PDF)</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              required
              className="form-control"
              disabled={principalApprovalSubmitting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (
                  file &&
                  ((file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) ||
                    file.size >= 2 * 1024 * 1024)
                ) {
                  showAlert('Only PDF files with a size less than 2MB are allowed.', 'error');
                  e.target.value = '';
                  setPrincipalApprovalFile(null);
                  return;
                }
                setPrincipalApprovalFile(file || null);
              }}
            />
          </div>
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

            {logLoading && (
              <div className="fw-state" style={{ padding: '24px 0' }}>
                Loading timeline...
              </div>
            )}
            {!logLoading && logEntries.length === 0 && (
              <div className="fw-state" style={{ padding: '24px 0' }}>
                No timeline entries available.
              </div>
            )}

            {!logLoading && logEntries.length > 0 && (
              <div className="fw-log-approvals">
                {logEntries.map((entry, idx) => {
                  const decisionToken = String(entry.decision || '')
                    .trim()
                    .toLowerCase();
                  const actorRoleToken = String(entry.actorRole || '')
                    .trim()
                    .toLowerCase();
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
                  const updatedSubtitle =
                    decisionToken === 'updated' ? buildUpdatedLogSubtitles(entry) : null;
                  const subtitleText = updatedSubtitle
                    ? expandedLogDetails[entryKey] && updatedSubtitle.full
                      ? updatedSubtitle.full
                      : updatedSubtitle.compact
                    : normalizeLogText(entry.feedback || entry.comment || entry.summary);
                  const hasExpandedSubtitle = Boolean(
                    updatedSubtitle &&
                    updatedSubtitle.full &&
                    updatedSubtitle.compact &&
                    updatedSubtitle.full !== updatedSubtitle.compact,
                  );
                  const actorLine = normalizeLogText(entry.userName)
                    ? `${normalizeLogText(entry.userName)} (${entry.actorEmail || 'Unknown'})`
                    : entry.actorEmail || 'Unknown';
                  const entryDate = entry.decidedAt || entry.createdAt || null;

                  return (
                    <div key={entryKey} className="fw-log-approval-item">
                      <div className="fw-log-approval-meta">
                        <span
                          className={`fw-log-decision fw-log-decision--${entry.decision?.toLowerCase() || 'approved'}`}
                        >
                          {entry.decision?.toUpperCase() || 'UPDATE'}
                        </span>
                        {shouldShowStage && <span className="fw-log-role">{stageLabel}</span>}
                        {subtitleText && (
                          <span className="fw-log-feedback">Remarks: {subtitleText}</span>
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
                        <span className="fw-log-actor-line">By: {actorLine}</span>
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
              src={`${getRecordRoute(previewRecordId, 'view')}${getRecordRoute(previewRecordId, 'view').includes('?') ? '&' : '?'}preview=true${previewIsActionablePending ? '&isActionablePending=true' : ''}`}
              style={{ width: '100%', height: 'calc(100vh - 92px)', border: 'none' }}
              title="Request Preview"
            />
          )}
        </CustomModal>
      </div>
    </>
  );
};

export default WorkflowApprovalPage;
