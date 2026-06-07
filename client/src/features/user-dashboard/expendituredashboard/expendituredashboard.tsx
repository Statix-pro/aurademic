import React, { useEffect, useState, useMemo } from 'react';

import authenticityUtility from '../../../shared/utils/authenticityUtility';
import './expendituredashboard.css';
import AddPayeeModal, { AddPayeeModalPayee } from '../../../shared/components/AddPayeeModal';

import {
  Info,
  Eye,
  Edit2,
  Trash2,
  ChevronDown,
  Plus,
  Search,
  XCircle,
  FileText,
  Clock,
  RotateCcw,
  CheckCircle2,
  CreditCard,
  Lock,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';

interface ExpenditureItem {
  id: number;
  financeid?: number;
  proposalref?: string;
  requestref?: string;
  applicantname: string;
  beneficiarytype: string;
  primaryhead: string;
  sub_head?: string;
  amount: number;
  overallstatus: string;
  createdat: string;
  request_type?: string;
  payment_status?: string;
  workflow_state?: unknown;
}

type WorkflowModule = 'Advance' | 'Settlement' | 'Expenditure';
type StatusFilterKey = 'all' | 'pending' | 'return' | 'approved' | 'pending_payment' | 'closed';

interface ExpenditureDialogConfig {
  show: boolean;
  title: string;
  message: React.ReactNode;
  variant?: 'info' | 'warning' | 'danger';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
}

interface DashboardReturnState {
  dashboardRowId?: string;
  rowReferenceId?: string;
  rowIndex?: number;
  submittedModule?: WorkflowModule;
  submittedAmount?: number;
  submittedRequestId?: number;
  financeRequestId?: number;
  fiscalYear?: string;
  viewOnly?: boolean;
  financeProposal?: {
    proposalId: string;
    applicantName: string;
    tag: string;
    totalAmount: number;
    expenditureAmount: number;
    balanceAmount: number;
  };
}

interface ExpenditureProposalCard {
  financeRequestId: string;
  proposalId: string;
  applicantName: string;
  beneficiaryName: string;
  tag: string;
  totalAmount: number;
  expenditureAmount: number;
  balanceAmount: number;
  sourceFiscalYear?: number | null;
  carryForwardTargetYears?: string;
}

interface ExpenditureDashboardCardApi {
  financerequestid?: number;
  finance_request_id?: number;
  requestref?: string;
  request_ref?: string;
  applicantname?: string;
  applicant_name?: string;
  beneficiaryname?: string;
  beneficiary_name?: string;
  financetag?: string;
  finance_tag?: string;
  approvedamount?: number;
  approved_amount?: number;
  expenditureamount?: number;
  expenditure_amount?: number;
  balanceamount?: number;
  balance_amount?: number;
  sourcefiscalyear?: number;
  source_fiscal_year?: number;
  carryforwardtargetyears?: string;
  carry_forward_target_years?: string;
}

interface WorkflowRow {
  id: string;
  requestId?: number | null;
  advanceRequestId?: number | null;
  advanceRequestId2?: number | null; // For second advance
  expenditureRequestId?: number | null;
  settlementRequestId?: number | null;
  advanceRequestRef?: string;
  advanceRequestRef2?: string;
  expenditureRequestRef?: string;
  settlementRequestRef?: string;
  rowIndex: number;
  baseRowRef: string;
  advanceRef: string;
  advanceRef2?: string; // For second advance
  expenditureRef: string;
  settlementRef: string;
  primaryChoice: WorkflowModule | null;
  advanceAmount: number;
  advanceAmount2?: number; // For second advance
  expenditureAmount: number;
  settlementAmount: number;
  advanceSubHead?: string;
  advanceSubHead2?: string; // For second advance
  expenditureSubHead?: string;
  settlementSubHead?: string;
  advanceStatus?: string;
  advanceStatus2?: string; // For second advance
  expenditureStatus?: string;
  settlementStatus?: string;
  advancePaymentStatus?: string;
  advancePaymentStatus2?: string;
  expenditurePaymentStatus?: string;
  settlementPaymentStatus?: string;
  latestRequestId?: number | null;
  latestRequestType?: WorkflowModule | null;
  latestWorkflowState?: unknown;
  latestWorkflowStatus?: string;
  approvalLevel: number;
}

interface ExpenditureStatusUpdate {
  id: number | string;
  stage?: string | null;
  role?: string | null;
  status?: string | null;
  decision?: string | null;
  comment?: string | null;
  feedback?: string | null;
  summary?: string | null;
  createdAt?: string | null;
  decidedAt?: string | null;
  userName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  isAdmin?: number | boolean | null;
}

interface ExpenditureLogEvent {
  key: string;
  badge: string;
  title: string;
  subtitle: string;
  actorLabel: string;
  actorValue: string;
  actorBadgeLabel: string;
  dateLabel: string;
}

const formatFY = (fyStart: number) => `${fyStart}-${String(fyStart + 1).slice(-2)}`;

const getDefaultFilterFY = () => {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const fyStart = monthIndex >= 3 ? year : year - 1;
  return formatFY(fyStart);
};

const getRunningFYStart = () => {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 3 ? year : year - 1;
};

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeSearchText = (value: unknown) => normalizeText(value).toLowerCase();
const normalizeCompactSearchText = (value: unknown) =>
  normalizeSearchText(value).replace(/[^a-z0-9]/g, '');

const resolveCanonicalPayeeName = (payeeName: string, accountName: string) => {
  const normalizedPayeeName = normalizeText(payeeName);
  const normalizedAccountName = normalizeText(accountName);
  return normalizedAccountName || normalizedPayeeName;
};

const normalizeModule = (value: unknown): WorkflowModule | null => {
  const text = normalizeText(value).toLowerCase();
  if (text === 'advance') return 'Advance';
  if (text === 'expenditure') return 'Expenditure';
  if (text === 'settlement') return 'Settlement';
  return null;
};

const normalizeStatus = (value: unknown) => normalizeText(value).toLowerCase() || 'pending';

const parseWorkflowState = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const getRequestWorkflowStatus = (req: ExpenditureItem) => {
  const workflowState = parseWorkflowState(req.workflow_state);
  return normalizeStatus(
    workflowState?.status ??
      workflowState?.workflowStatus ??
      workflowState?.overallStatus ??
      req.overallstatus,
  );
};

const getRequestWorkflowState = (req: ExpenditureItem) => parseWorkflowState(req.workflow_state);

const getWorkflowApprovalLabel = (workflowState: Record<string, unknown> | null | undefined) => {
  const status = normalizeStatus(
    workflowState?.status ?? workflowState?.workflowStatus ?? workflowState?.overallStatus ?? '',
  );
  const lastDecision = normalizeText(workflowState?.lastDecision ?? '').toLowerCase();
  const currentStage = normalizeText(
    workflowState?.currentStage ?? workflowState?.workflowStage ?? '',
  ).toLowerCase();

  if (lastDecision === 'resubmitted') return 'Resubmitted';
  if (status === 'approved' || status === 'completed') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'returned') return 'Returned';
  if (status === 'principal_approved') return 'Approved';
  if (
    status === 'dof_approved' ||
    status === 'hod_approved' ||
    status === 'level1_approved' ||
    currentStage === 'level1' ||
    currentStage === 'hod' ||
    currentStage === 'dof' ||
    currentStage === 'principal'
  ) {
    return 'Pending';
  }
  return 'Pending';
};

const getWorkflowApprovalStageState = (
  workflowState: Record<string, unknown> | null | undefined,
  stage: 'hod' | 'dof' | 'principal',
) => {
  const status = normalizeStatus(
    workflowState?.status ?? workflowState?.workflowStatus ?? workflowState?.overallStatus ?? '',
  );
  const currentStage = normalizeText(
    workflowState?.currentStage ?? workflowState?.workflowStage ?? '',
  ).toLowerCase();
  const normalizedCurrentStage = currentStage === 'level1' ? 'hod' : currentStage;
  const stageOrder = ['hod', 'dof', 'principal'];
  const currentIndex = stageOrder.indexOf(normalizedCurrentStage);
  const stageIndex = stageOrder.indexOf(stage);

  if (status === 'approved' || status === 'completed' || status === 'principal_approved')
    return 'completed';
  if (currentIndex === -1) return 'pending';
  if (stageIndex < currentIndex) return 'completed';
  if (stageIndex === currentIndex) return 'current';
  return 'pending';
};

const getRowKey = (req: ExpenditureItem) => {
  const state = parseWorkflowState(req.workflow_state);
  const direct = normalizeText(
    state?.dashboardRowId ??
      state?.workflowrowref ??
      state?.rowReferenceId ??
      state?.rowIndex ??
      '',
  );

  if (direct) return direct;
  return `finance-${normalizeText(req.financeid ?? '')}-request-${normalizeText(req.id ?? '')}`;
};

const getWorkflowStateRowIndex = (value: unknown): number | null => {
  const state = parseWorkflowState(value);
  const raw = Number(state?.rowIndex);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
};

const getNextWorkflowRowIndex = (rows: WorkflowRow[]): number => {
  const maxIndex = rows.reduce((max, row) => Math.max(max, Number(row.rowIndex) || 0), 0);
  return maxIndex + 1;
};

const normalizeFinanceRequestRefBase = (value: unknown, financeRequestId: unknown) => {
  const text = normalizeText(value);
  const structuredMatch = text.match(/^#?F[-_](\d{4})[-_](\d+)$/i);
  if (structuredMatch) {
    return `#F-${structuredMatch[1]}-${structuredMatch[2].padStart(4, '0')}`;
  }

  const fallbackYear = text.match(/(20\d{2})/)?.[1] ?? String(new Date().getFullYear());
  const fallbackSequence = String(financeRequestId ?? '')
    .replace(/\D/g, '')
    .padStart(4, '0');

  return `#F-${fallbackYear}-${fallbackSequence || '0000'}`;
};

const getFinanceRefSequence = (financeBaseRef: string) => {
  const structuredMatch = normalizeText(financeBaseRef).match(/^#?F[-_]\d{4}[-_](\d+)$/i);
  return structuredMatch?.[1]?.padStart(4, '0') ?? '';
};

const getWorkflowRequestDisplayCode = (value: unknown) => {
  const ref = normalizeText(value);
  if (!ref) return '';

  const rowStepCode = ref.match(/([A-Z]+\d+)$/i)?.[1];
  if (rowStepCode) return rowStepCode.toUpperCase();

  const matchedCode = ref.match(/(A\d{3}|S\d{3}|E\d{3})$/i)?.[1];
  if (matchedCode) return matchedCode.toUpperCase();

  const trailingSegment = ref.split(/[_-]/).filter(Boolean).pop() ?? ref;
  return trailingSegment.toUpperCase();
};

const buildWorkflowRequestRefMap = (requests: ExpenditureItem[]) => {
  const refs = new Map<number, string>();

  requests.forEach((request) => {
    const requestId = Number(request.id);
    const backendRequestRef = normalizeText(request.requestref);
    if (Number.isFinite(requestId) && requestId > 0 && backendRequestRef) {
      refs.set(requestId, backendRequestRef);
    }
  });

  return refs;
};

const getRequestStatusLabel = (item: ExpenditureItem) =>
  getWorkflowApprovalLabel(parseWorkflowState(item.workflow_state));

const matchesStatusFilter = (item: ExpenditureItem, filter: StatusFilterKey) => {
  if (filter === 'all') return true;

  const statusLabel = getRequestStatusLabel(item);
  const isPaid = normalizeStatus(item.payment_status) === 'paid';

  if (filter === 'pending') {
    return statusLabel === 'Pending' || statusLabel === 'Resubmitted';
  }
  if (filter === 'return') {
    return statusLabel === 'Returned';
  }
  if (filter === 'approved') {
    return statusLabel === 'Approved';
  }
  if (filter === 'pending_payment') {
    return statusLabel === 'Approved' && !isPaid;
  }
  if (filter === 'closed') {
    return statusLabel === 'Approved' && isPaid;
  }

  return true;
};

const getWorkflowRowOptionStatus = (row: WorkflowRow, module: WorkflowModule | 'Advance2') => {
  if (module === 'Advance2') return row.advanceStatus2 || '';
  if (module === 'Advance') return row.advanceStatus || '';
  if (module === 'Settlement') return row.settlementStatus || '';
  return row.expenditureStatus || '';
};

const getWorkflowRowOptionPaymentStatus = (
  row: WorkflowRow,
  module: WorkflowModule | 'Advance2',
) => {
  if (module === 'Advance2') return row.advancePaymentStatus2 || '';
  if (module === 'Advance') return row.advancePaymentStatus || '';
  if (module === 'Settlement') return row.settlementPaymentStatus || '';
  return row.expenditurePaymentStatus || '';
};

const getWorkflowRowOptionRequestRef = (row: WorkflowRow, module: WorkflowModule | 'Advance2') => {
  if (module === 'Advance2') return row.advanceRequestRef2 || '';
  if (module === 'Advance') return row.advanceRequestRef || '';
  if (module === 'Settlement') return row.settlementRequestRef || '';
  return row.expenditureRequestRef || '';
};

const getWorkflowRowOptionAmount = (row: WorkflowRow, module: WorkflowModule | 'Advance2') => {
  if (module === 'Advance2') return Number(row.advanceAmount2 || 0);
  if (module === 'Advance') return Number(row.advanceAmount || 0);
  if (module === 'Settlement') return Number(row.settlementAmount || 0);
  return Number(row.expenditureAmount || 0);
};

const getWorkflowStatusCategory = (status: unknown) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'returned') return 'Returned';
  if (normalized === 'rejected') return 'Rejected';
  if (normalized === 'resubmitted') return 'Resubmitted';
  if (['approved', 'completed', 'principal_approved'].includes(normalized)) {
    return 'Approved';
  }
  return 'Pending';
};

const matchesWorkflowRowOptionStatusFilter = (
  row: WorkflowRow,
  module: WorkflowModule | 'Advance2',
  filter: StatusFilterKey,
) => {
  if (filter === 'all') return true;

  const hasRequest =
    Boolean(getWorkflowRowOptionRequestRef(row, module)) ||
    getWorkflowRowOptionAmount(row, module) > 0;
  if (!hasRequest) return filter === 'pending';

  const statusCategory = getWorkflowStatusCategory(getWorkflowRowOptionStatus(row, module));
  const isPaid = normalizeStatus(getWorkflowRowOptionPaymentStatus(row, module)) === 'paid';

  if (filter === 'pending') {
    return statusCategory === 'Pending' || statusCategory === 'Resubmitted';
  }
  if (filter === 'return') {
    return statusCategory === 'Returned';
  }
  if (filter === 'approved') {
    return statusCategory === 'Approved';
  }
  if (filter === 'pending_payment') {
    return statusCategory === 'Approved' && !isPaid;
  }
  if (filter === 'closed') {
    return statusCategory === 'Approved' && isPaid;
  }

  return true;
};

const matchesWorkflowRowStatusFilter = (row: WorkflowRow, filter: StatusFilterKey) => {
  if (filter === 'all') return true;

  const modules: Array<WorkflowModule | 'Advance2'> = [
    'Advance',
    'Advance2',
    'Settlement',
    'Expenditure',
  ];
  const hasSubmitted = modules.some(
    (module) =>
      Boolean(getWorkflowRowOptionRequestRef(row, module)) ||
      getWorkflowRowOptionAmount(row, module) > 0,
  );

  if (!hasSubmitted) return filter === 'pending';
  return modules.some((module) => matchesWorkflowRowOptionStatusFilter(row, module, filter));
};

const ExpenditureDashboard: React.FC = () => {
  const [data, setData] = useState<ExpenditureItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [showWorkflowStatusDetail, setShowWorkflowStatusDetail] = useState<Record<string, boolean>>(
    {},
  );
  const [showRequestStatusDetail, setShowRequestStatusDetail] = useState<Record<number, boolean>>(
    {},
  );
  const [financeIdQuery, setFinanceIdQuery] = useState<string>('');
  const [financialYear, setFinancialYear] = useState<string>(getDefaultFilterFY());
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilterKey>('pending');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<
    'all' | 'Advance' | 'Expenditure' | 'Settlement'
  >('all');
  const [proposalCards, setProposalCards] = useState<ExpenditureProposalCard[]>([]);
  const [cardRows, setCardRows] = useState<Record<string, WorkflowRow[]>>({});
  const [dialogConfig, setDialogConfig] = useState<ExpenditureDialogConfig>({
    show: false,
    title: '',
    message: '',
  });
  const [activeInfoId, setActiveInfoId] = useState<number | null>(null);
  const [loadingInfoId, setLoadingInfoId] = useState<number | null>(null);
  const [statusUpdatesById, setStatusUpdatesById] = useState<
    Record<number, ExpenditureStatusUpdate[]>
  >({});
  const [showAddPayeeModal, setShowAddPayeeModal] = useState(false);
  const [isSubmittingPayee, setIsSubmittingPayee] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const dashboardState = (location.state as DashboardReturnState | null) ?? null;

  const submitPayeeForApproval = async (payee: AddPayeeModalPayee) => {
    const canonicalPayeeName = resolveCanonicalPayeeName(payee.payeeName, payee.accountName);

    if (
      !canonicalPayeeName ||
      !normalizeText(payee.accountNo) ||
      !normalizeText(payee.ifsc) ||
      !normalizeText(payee.bankName) ||
      !normalizeText(payee.branchName)
    ) {
      window.alert('Please enter account name, account number, IFSC, bank name and branch name.');
      return;
    }

    try {
      setIsSubmittingPayee(true);
      const response = (await authenticityUtility.post('/expenditure/payees', {
        payee_name: canonicalPayeeName,
        account_name: canonicalPayeeName,
        pan_number: normalizeText(payee.panNumber) || null,
        account_no: normalizeText(payee.accountNo),
        account_type: normalizeText(payee.accountType) || null,
        bank_name: normalizeText(payee.bankName),
        branch_name: normalizeText(payee.branchName),
        ifsc: normalizeText(payee.ifsc).toUpperCase(),
        beneficiary_type: payee.beneficiaryType,
        beneficiary_org: normalizeText(payee.beneficiaryOrg) || null,
        organization_type:
          payee.beneficiaryType === 'organization'
            ? normalizeText(payee.organizationType) || null
            : null,
        msme: payee.beneficiaryType === 'organization' ? normalizeText(payee.msme) || null : null,
        gstin: payee.beneficiaryType === 'organization' ? normalizeText(payee.gstin) || null : null,
        tds_details:
          payee.beneficiaryType === 'organization' ? normalizeText(payee.tdsDetails) || null : null,
        tds_section:
          payee.beneficiaryType === 'organization' ? normalizeText(payee.tdsSection) || null : null,
      })) as { success?: boolean; status?: string; message?: string };

      if (response.success !== true && response.status !== 'success') {
        throw new Error(response.message || 'Unable to send payee for approval');
      }

      window.alert(response.message || 'Payee request submitted for DoF approval.');
      setShowAddPayeeModal(false);
    } catch (error) {
      console.error('Failed to submit payee:', error);
      const apiMessage =
        (error as any)?.response?.data?.message ||
        (error as any)?.response?.data?.error ||
        (error as any)?.message;
      window.alert(apiMessage || 'Unable to send payee for approval right now.');
    } finally {
      setIsSubmittingPayee(false);
    }
  };

  const fyOptions = useMemo(() => {
    const running = getRunningFYStart();
    const defaultStart = Number.parseInt(getDefaultFilterFY().split('-')[0], 10);
    const cardFiscalYears = proposalCards.flatMap((card) => {
      const sourceYear =
        typeof card.sourceFiscalYear === 'number' && card.sourceFiscalYear > 0
          ? [card.sourceFiscalYear]
          : [];
      const targetYears = String(card.carryForwardTargetYears || '')
        .split(',')
        .map((year) => Number.parseInt(year.trim(), 10))
        .filter((year) => Number.isInteger(year) && year > 0);

      return [...sourceYear, ...targetYears];
    });
    const starts = Array.from(
      new Set([defaultStart, running, running - 1, ...cardFiscalYears]),
    ).sort((a, b) => b - a);

    return starts.map((start) => {
      const value = formatFY(start);
      return {
        value,
        label: `FY ${value}`,
      };
    });
  }, [proposalCards]);

  const normalizedFinanceIdQuery = financeIdQuery.trim().toLowerCase();

  const beneficiaryOptions = useMemo(() => {
    const beneficiaryTypes = Array.from(
      new Set(data.map((item) => String(item.beneficiarytype || '').trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    return [
      { value: 'all', label: 'All Beneficiaries' },
      ...beneficiaryTypes.map((type) => ({ value: type, label: type })),
    ];
  }, [data]);

  const searchFilteredProposalCards = useMemo(() => {
    const financeIdsByBeneficiary =
      selectedBeneficiary === 'all'
        ? null
        : new Set(
            data
              .filter((item) => String(item.beneficiarytype || '').trim() === selectedBeneficiary)
              .map((item) => String(item.financeid ?? '')),
          );

    return proposalCards.filter((card) => {
      if (financeIdsByBeneficiary && !financeIdsByBeneficiary.has(card.financeRequestId)) {
        return false;
      }

      if (!normalizedFinanceIdQuery) {
        return true;
      }

      const rows = cardRows[card.financeRequestId] ?? [];
      const financeBaseRef = normalizeFinanceRequestRefBase(card.proposalId, card.financeRequestId);
      const financeSequence = getFinanceRefSequence(financeBaseRef);
      const workflowSearchValues = rows.flatMap((row) => {
        const refs = [
          row.advanceRequestRef,
          row.advanceRequestRef2,
          row.expenditureRequestRef,
          row.settlementRequestRef,
        ].filter(Boolean);

        return refs.flatMap((ref) => {
          const displayCode = getWorkflowRequestDisplayCode(ref);
          return [
            ref,
            displayCode,
            financeSequence && displayCode ? `${financeSequence}${displayCode}` : '',
          ];
        });
      });

      const searchValues = [
        String(card.financeRequestId ?? ''),
        String(card.proposalId ?? ''),
        String(card.applicantName ?? ''),
        String(card.beneficiaryName ?? ''),
        String(card.tag ?? ''),
        ...workflowSearchValues,
      ]
        .join(' ')
        .toLowerCase();

      const compactSearchValues = normalizeCompactSearchText(searchValues);
      const compactQuery = normalizeCompactSearchText(normalizedFinanceIdQuery);

      return (
        searchValues.includes(normalizedFinanceIdQuery) ||
        Boolean(compactQuery && compactSearchValues.includes(compactQuery))
      );
    });
  }, [cardRows, data, proposalCards, normalizedFinanceIdQuery, selectedBeneficiary]);

  const filteredCardRows = useMemo(() => {
    const next: Record<string, WorkflowRow[]> = {};

    searchFilteredProposalCards.forEach((card) => {
      const rows = cardRows[card.financeRequestId] ?? [];
      next[card.financeRequestId] = rows.filter((row) => {
        const matchesStatus =
          selectedStatusFilter === 'all'
            ? true
            : matchesWorkflowRowStatusFilter(row, selectedStatusFilter);

        const matchesType =
          selectedTypeFilter === 'all' ? true : row.primaryChoice === selectedTypeFilter;

        return matchesStatus && matchesType;
      });
    });

    return next;
  }, [cardRows, searchFilteredProposalCards, selectedStatusFilter, selectedTypeFilter]);

  const filteredProposalCards = useMemo(
    () =>
      searchFilteredProposalCards.filter((card) => {
        if (selectedStatusFilter === 'all' && selectedTypeFilter === 'all') return true;
        return (filteredCardRows[card.financeRequestId] ?? []).length > 0;
      }),
    [filteredCardRows, searchFilteredProposalCards, selectedStatusFilter, selectedTypeFilter],
  );

  const stats = useMemo(() => {
    const beneficiaryFilteredData = data.filter((item) => {
      if (selectedBeneficiary === 'all') return true;
      return String(item.beneficiarytype || '').trim() === selectedBeneficiary;
    });

    let total = 0;
    let pending = 0;
    let returned = 0;
    let approved = 0;
    let pendingPayment = 0;
    let closed = 0;

    let totalAmount = 0;
    let pendingAmount = 0;
    let returnedAmount = 0;
    let approvedAmount = 0;
    let pendingPaymentAmount = 0;
    let closedAmount = 0;

    beneficiaryFilteredData.forEach((item) => {
      if (selectedTypeFilter !== 'all') {
        const itemType = normalizeModule(item.request_type);
        if (itemType !== selectedTypeFilter) return;
      }

      total++;
      totalAmount += Number(item.amount || 0);

      if (matchesStatusFilter(item, 'pending')) {
        pending++;
        pendingAmount += Number(item.amount || 0);
      } else if (matchesStatusFilter(item, 'return')) {
        returned++;
        returnedAmount += Number(item.amount || 0);
      } else if (matchesStatusFilter(item, 'approved')) {
        approved++;
        approvedAmount += Number(item.amount || 0);
        if (matchesStatusFilter(item, 'closed')) {
          closed++;
          closedAmount += Number(item.amount || 0);
        } else {
          pendingPayment++;
          pendingPaymentAmount += Number(item.amount || 0);
        }
      }
    });

    return {
      total,
      pending,
      returned,
      approved,
      pendingPayment,
      closed,
      totalAmount,
      pendingAmount,
      returnedAmount,
      approvedAmount,
      pendingPaymentAmount,
      closedAmount,
    };
  }, [data, selectedBeneficiary, selectedTypeFilter]);

  const kpiCards = [
    {
      key: 'all' as const,
      className: 'total',
      label: 'Total',
      value: stats.total,
      amount: stats.totalAmount,
      icon: <FileText size={20} className="expenditure-stats-icon" />,
    },
    {
      key: 'pending' as const,
      className: 'pending',
      label: 'Pending',
      value: stats.pending,
      amount: stats.pendingAmount,
      icon: <Clock size={20} className="expenditure-stats-icon" />,
    },
    {
      key: 'return' as const,
      className: 'return',
      label: 'Return',
      value: stats.returned,
      amount: stats.returnedAmount,
      icon: <RotateCcw size={20} className="expenditure-stats-icon" />,
    },
    {
      key: 'approved' as const,
      className: 'approved',
      label: 'Approved',
      value: stats.approved,
      amount: stats.approvedAmount,
      icon: <CheckCircle2 size={20} className="expenditure-stats-icon" />,
    },
    {
      key: 'pending_payment' as const,
      className: 'pending-payment',
      label: 'Payable',
      value: stats.pendingPayment,
      amount: stats.pendingPaymentAmount,
      icon: <CreditCard size={20} className="expenditure-stats-icon" />,
    },
    {
      key: 'closed' as const,
      className: 'closed',
      label: 'Closed',
      value: stats.closed,
      amount: stats.closedAmount,
      icon: <Lock size={20} className="expenditure-stats-icon" />,
    },
  ];

  const filteredData = useMemo(() => {
    const visibleFinanceIds = new Set(filteredProposalCards.map((card) => card.financeRequestId));
    return data.filter((item) => {
      if (!visibleFinanceIds.has(String(item.financeid ?? ''))) {
        return false;
      }

      const matchesStatus = matchesStatusFilter(item, selectedStatusFilter);
      const matchesType =
        selectedTypeFilter === 'all'
          ? true
          : normalizeModule(item.request_type) === selectedTypeFilter;

      return matchesStatus && matchesType;
    });
  }, [data, filteredProposalCards, selectedStatusFilter, selectedTypeFilter]);

  const formatAmount = (amount: number) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  const getSettlementDashboardAdjustment = (row: WorkflowRow) => {
    if (!row.settlementRequestId) return null;

    const totalAdvanceAmount = Number(row.advanceAmount || 0) + Number(row.advanceAmount2 || 0);
    const settlementAmount = Number(row.settlementAmount || 0);
    const difference = Number((settlementAmount - totalAdvanceAmount).toFixed(2));

    if (difference > 0) {
      return {
        label: 'Amount to be received',
        compactLabel: 'Receivable',
        amount: difference,
        tone: 'receive' as const,
      };
    }

    if (difference < 0) {
      return {
        label: 'Amount to be returned',
        compactLabel: 'Returnable',
        amount: Math.abs(difference),
        tone: 'return' as const,
      };
    }

    return null;
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

  const formatLogLabel = (value?: string | null) => {
    const normalized = normalizeText(value);
    if (!normalized) return '-';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getStageBadgeLabel = (stage?: string | null, actorRole?: string | null) => {
    const stageToken = normalizeText(stage).toLowerCase();
    const actorRoleToken = normalizeText(actorRole).toLowerCase();

    if (stageToken === 'submitted') return 'Submitted';
    if (stageToken === 'level1') {
      if (['coordinator', 'entity_approver'].includes(actorRoleToken)) return 'Coordinator';
      return 'HOD';
    }
    if (stageToken === 'dof') return 'DoF';
    if (stageToken === 'principal') return 'Principal';
    return formatLogLabel(stage);
  };

  const buildExpenditureLogEvents = (
    item: ExpenditureItem,
    updates: ExpenditureStatusUpdate[],
  ): ExpenditureLogEvent[] => {
    const formatActorIdentity = (
      name?: string | null,
      email?: string | null,
      fallback?: string | null,
    ) => {
      const normalizedName = normalizeText(name);
      const normalizedEmail = normalizeText(email);
      const normalizedFallback = normalizeText(fallback);

      if (
        normalizedName &&
        normalizedEmail &&
        normalizedName.toLowerCase() !== normalizedEmail.toLowerCase()
      ) {
        return `${normalizedName} (${normalizedEmail})`;
      }
      return normalizedName || normalizedEmail || normalizedFallback || '-';
    };

    return [...updates]
      .sort((left, right) => {
        const leftMs = Date.parse(normalizeText(left.createdAt || left.decidedAt)) || 0;
        const rightMs = Date.parse(normalizeText(right.createdAt || right.decidedAt)) || 0;
        if (leftMs !== rightMs) return leftMs - rightMs;
        return Number(left.id || 0) - Number(right.id || 0);
      })
      .map((update, index) => {
        const decision = normalizeText(update.decision || update.status).toLowerCase();
        const isSubmitted = decision.includes('submitted');
        const isReturned = decision.includes('returned');
        const isRejected = decision.includes('rejected');
        const isApproved = decision.includes('approved') || decision.includes('completed');
        const isUpdated = decision === 'updated';
        const isAdmin =
          Boolean(update.isAdmin) ||
          ['admin', 'super_admin', 'superadmin'].includes(
            normalizeText(update.actorRole).toLowerCase(),
          );
        const stage = getStageBadgeLabel(update.stage || update.role, update.actorRole);

        let badge = 'UPDATED';
        let title = 'Request updated';
        let actorLabel = 'Updated By';

        if (isSubmitted) {
          badge = 'SUBMITTED';
          title = 'Request submitted';
          actorLabel = 'Submitted By';
        } else if (isReturned) {
          badge = 'RETURNED';
          title = 'Request returned';
        } else if (isRejected) {
          badge = 'REJECTED';
          title = 'Request rejected';
        } else if (isApproved) {
          badge = 'APPROVED';
          title = 'Request approved';
        }

        return {
          key: `${update.id}-${index}`,
          badge,
          title,
          subtitle:
            normalizeText(update.summary || update.feedback || update.comment) || 'Status update',
          actorLabel,
          actorValue: formatActorIdentity(
            update.userName,
            update.actorEmail,
            update.actorRole || item.applicantname,
          ),
          actorBadgeLabel: isUpdated && isAdmin ? 'SUPERADMIN' : stage,
          dateLabel: formatDateTime(update.createdAt || update.decidedAt || item.createdat),
        };
      });
  };

  const fetchStatusUpdates = async (requestId: number) => {
    if (statusUpdatesById[requestId]) return;

    try {
      setLoadingInfoId(requestId);
      const response = (await authenticityUtility.get(
        `/expenditure/${requestId}/status-updates`,
      )) as {
        status?: string;
        success?: boolean;
        data?: ExpenditureStatusUpdate[];
      };

      setStatusUpdatesById((prev) => ({
        ...prev,
        [requestId]:
          response.success === true || response.status === 'success' ? response.data || [] : [],
      }));
    } catch (error) {
      console.error('Failed to fetch expenditure status updates', error);
      setStatusUpdatesById((prev) => ({ ...prev, [requestId]: [] }));
    } finally {
      setLoadingInfoId((prev) => (prev === requestId ? null : prev));
    }
  };

  const handleInfoClick = async (requestId: number | null | undefined) => {
    const normalizedRequestId = Number(requestId || 0);
    if (!normalizedRequestId) return;

    if (activeInfoId === normalizedRequestId) {
      setActiveInfoId(null);
      return;
    }

    setActiveInfoId(normalizedRequestId);
    await fetchStatusUpdates(normalizedRequestId);
  };

  const closeDialog = () => {
    setDialogConfig((prev) => ({
      ...prev,
      show: false,
      onConfirm: undefined,
    }));
  };

  const showDialog = (config: Omit<ExpenditureDialogConfig, 'show'>) => {
    setDialogConfig({
      show: true,
      variant: 'info',
      confirmText: 'OK',
      ...config,
    });
  };

  const isApprovedStatus = (status?: string | null) =>
    ['approved', 'completed', 'principal_approved'].includes(normalizeStatus(status));

  const isEditableWorkflowStatus = (status?: string | null) => {
    const normalized = normalizeStatus(status);
    return ['pending', 'submitted', 'in_progress', 'in progress', 'returned', 'draft'].includes(
      normalized,
    );
  };

  const isWorkflowRowCompleted = (row: WorkflowRow) => {
    if (row.primaryChoice === 'Advance') {
      return isApprovedStatus(row.settlementStatus);
    }

    if (row.primaryChoice === 'Expenditure') {
      return isApprovedStatus(row.expenditureStatus);
    }

    if (row.primaryChoice === 'Settlement') {
      return isApprovedStatus(row.settlementStatus);
    }

    return false;
  };

  const createWorkflowRow = (financeId: string, rowIndex: number): WorkflowRow => ({
    id: `${financeId}-manual-${rowIndex}`,
    requestId: null,
    advanceRequestId: null,
    advanceRequestId2: null,
    expenditureRequestId: null,
    settlementRequestId: null,
    advanceRequestRef: '',
    advanceRequestRef2: '',
    expenditureRequestRef: '',
    settlementRequestRef: '',
    rowIndex,
    baseRowRef: `${financeId}-manual-${rowIndex}`,
    advanceRef: `${financeId}-advance-manual-${rowIndex}`,
    advanceRef2: `${financeId}-advance2-manual-${rowIndex}`,
    expenditureRef: `${financeId}-expenditure-manual-${rowIndex}`,
    settlementRef: `${financeId}-settlement-manual-${rowIndex}`,
    primaryChoice: null,
    advanceAmount: 0,
    advanceAmount2: 0,
    expenditureAmount: 0,
    settlementAmount: 0,
    advanceSubHead: '',
    advanceSubHead2: '',
    expenditureSubHead: '',
    settlementSubHead: '',
    advanceStatus: 'pending',
    advanceStatus2: 'pending',
    expenditureStatus: 'pending',
    settlementStatus: 'pending',
    advancePaymentStatus: 'Pending',
    advancePaymentStatus2: 'Pending',
    expenditurePaymentStatus: 'Pending',
    settlementPaymentStatus: 'Pending',
    latestRequestId: null,
    latestRequestType: null,
    latestWorkflowStatus: 'pending',
    approvalLevel: 0,
  });

  const handleModuleLaunch = (
    row: WorkflowRow,
    module: WorkflowModule | 'Advance2',
    card: ExpenditureProposalCard,
    options?: { forceNew?: boolean; mode?: 'create' | 'edit' | 'view' },
  ) => {
    const targetRow = row;

    // Handle interim advance specifically
    const isAdvance2 = module === 'Advance2';
    const targetModule = isAdvance2 ? 'Advance' : module;

    const rowReferenceId =
      targetModule === 'Advance'
        ? isAdvance2
          ? (targetRow.advanceRef2 ?? `${targetRow.advanceRef}-2`)
          : targetRow.advanceRef
        : targetModule === 'Expenditure'
          ? targetRow.expenditureRef
          : targetRow.settlementRef;

    const requestId = options?.forceNew
      ? null
      : targetModule === 'Advance'
        ? isAdvance2
          ? targetRow.advanceRequestId2
          : targetRow.advanceRequestId
        : targetModule === 'Expenditure'
          ? targetRow.expenditureRequestId
          : targetRow.settlementRequestId;

    const targetRequestId = requestId ?? null;
    const selectedFiscalYearStart = Number.parseInt(financialYear.split('-')[0], 10);
    const sourceFiscalYear = Number(card.sourceFiscalYear || 0);
    const carryForwardTargetYears = String(card.carryForwardTargetYears || '')
      .split(',')
      .map((year) => Number.parseInt(year.trim(), 10))
      .filter((year) => Number.isInteger(year) && year > 0);
    const isCarryForwardCard =
      sourceFiscalYear > 0 &&
      selectedFiscalYearStart > 0 &&
      sourceFiscalYear !== selectedFiscalYearStart &&
      carryForwardTargetYears.includes(selectedFiscalYearStart);
    const launchMode =
      options?.mode ??
      (targetRequestId
        ? isEditableWorkflowStatus(targetRow.latestWorkflowStatus)
          ? 'edit'
          : 'view'
        : 'create');
    const route =
      launchMode === 'edit' && targetRequestId
        ? `/expenditure/${targetRequestId}/edit`
        : targetRequestId
          ? `/expenditure/${targetRequestId}`
          : '/expenditure/new';

    navigate(route, {
      state: {
        ...(launchMode === 'view' ? { viewOnly: true } : { activeTab: targetModule }),
        isAdvance2: isAdvance2,
        dashboardRowId: targetRow.baseRowRef,
        rowReferenceId,
        rowIndex: targetRow.rowIndex,
        submittedRequestId: targetRequestId ?? undefined,
        sourceRequestId: row.requestId ?? undefined,
        financeRequestId: Number(card.financeRequestId),
        fiscalYear: financialYear,
        sourceFiscalYear: sourceFiscalYear || undefined,
        budgetFiscalYear: isCarryForwardCard ? selectedFiscalYearStart : undefined,
        isCarryForwardCard,
        financeProposal: {
          proposalId: card.proposalId,
          applicantName: card.applicantName,
          tag: card.tag,
          totalAmount: card.totalAmount,
          expenditureAmount: Number(card.expenditureAmount || 0),
          balanceAmount: Math.max(Number(card.balanceAmount || 0), 0),
        },
      },
    });
  };

  const getRowActions = (row: WorkflowRow) => {
    const isCompleted = isWorkflowRowCompleted(row);
    const hasAdvance1 = Boolean(row.advanceRequestId);
    const hasAdvance2 = Boolean(row.advanceRequestId2);
    const hasSettlement = Boolean(row.settlementRequestId);
    const showAdvance2 = hasAdvance2 || (hasAdvance1 && !hasSettlement);
    const showSettlement = hasAdvance1 || hasAdvance2 || hasSettlement;

    if (isCompleted) {
      return [
        {
          label: 'Initial Advance',
          module: 'Advance' as const,
          hidden: !hasAdvance1,
          submitted: hasAdvance1,
        },
        {
          label: 'Interim Advance',
          module: 'Advance2' as const,
          hidden: !hasAdvance2,
          submitted: hasAdvance2,
        },
        {
          label: 'Settlement',
          module: 'Settlement' as const,
          hidden: !hasSettlement,
          submitted: hasSettlement,
        },
        {
          label: 'Expenditure',
          module: 'Expenditure' as const,
          hidden: !row.expenditureRequestId,
          submitted: Boolean(row.expenditureRequestId),
        },
      ];
    }

    if (row.primaryChoice === 'Advance') {
      return [
        {
          label: 'Initial Advance',
          module: 'Advance' as const,
          hidden: false,
          submitted: hasAdvance1,
        },
        {
          label: 'Interim Advance',
          module: 'Advance2' as const,
          hidden: !showAdvance2,
          submitted: hasAdvance2,
        },
        {
          label: 'Settlement',
          module: 'Settlement' as const,
          hidden: !showSettlement,
          submitted: hasSettlement,
        },
        {
          label: 'Expenditure',
          module: 'Expenditure' as const,
          hidden: true,
          submitted: Boolean(row.expenditureRequestId),
        },
      ];
    }

    if (row.primaryChoice === 'Expenditure') {
      return [
        {
          label: 'Initial Advance',
          module: 'Advance' as const,
          hidden: true,
          submitted: false,
        },
        {
          label: 'Interim Advance',
          module: 'Advance2' as const,
          hidden: true,
          submitted: false,
        },
        {
          label: 'Settlement',
          module: 'Settlement' as const,
          hidden: true,
          submitted: false,
        },
        {
          label: 'Expenditure',
          module: 'Expenditure' as const,
          hidden: false,
          submitted: Boolean(row.expenditureRequestId) || row.expenditureAmount > 0,
        },
      ];
    }

    if (row.primaryChoice === 'Settlement') {
      return [
        {
          label: 'Initial Advance',
          module: 'Advance' as const,
          hidden: !hasAdvance1,
          submitted: hasAdvance1,
        },
        {
          label: 'Interim Advance',
          module: 'Advance2' as const,
          hidden: !showAdvance2,
          submitted: hasAdvance2,
        },
        {
          label: 'Settlement',
          module: 'Settlement' as const,
          hidden: false,
          submitted: hasSettlement,
        },
        {
          label: 'Expenditure',
          module: 'Expenditure' as const,
          hidden: true,
          submitted: false,
        },
      ];
    }

    return [
      {
        label: 'Initial Advance',
        module: 'Advance' as const,
        hidden: false,
        submitted: false,
      },
      {
        label: 'Interim Advance',
        module: 'Advance2' as const,
        hidden: true,
        submitted: false,
      },
      {
        label: 'Settlement',
        module: 'Settlement' as const,
        hidden: true,
        submitted: false,
      },
      {
        label: 'Expenditure',
        module: 'Expenditure' as const,
        hidden: false,
        submitted: false,
      },
    ];
  };

  const getWorkflowOptionRequestRef = (row: WorkflowRow, module: WorkflowModule | 'Advance2') => {
    if (module === 'Advance2') return row.advanceRequestRef2 || '';
    if (module === 'Advance') return row.advanceRequestRef || '';
    if (module === 'Settlement') return row.settlementRequestRef || '';
    return row.expenditureRequestRef || '';
  };

  const getWorkflowOptionAmount = (row: WorkflowRow, module: WorkflowModule | 'Advance2') => {
    if (module === 'Advance2') return Number(row.advanceAmount2 || 0);
    if (module === 'Advance') return Number(row.advanceAmount || 0);
    if (module === 'Settlement') return Number(row.settlementAmount || 0);
    return Number(row.expenditureAmount || 0);
  };

  const getWorkflowOptionPaymentStatus = (
    row: WorkflowRow,
    module: WorkflowModule | 'Advance2',
  ) => {
    if (module === 'Advance2') return row.advancePaymentStatus2 || '';
    if (module === 'Advance') return row.advancePaymentStatus || '';
    if (module === 'Settlement') return row.settlementPaymentStatus || '';
    return row.expenditurePaymentStatus || '';
  };

  const getWorkflowOptionPaymentToneClass = (
    row: WorkflowRow,
    module: WorkflowModule | 'Advance2',
  ) => {
    const status = normalizeStatus(getWorkflowOptionPaymentStatus(row, module));
    if (status === 'paid') return 'expenditure-demo-option--payment-paid';
    if (status === 'processing') return 'expenditure-demo-option--payment-processing';
    if (status === 'cancelled') return 'expenditure-demo-option--payment-cancelled';
    return '';
  };

  const isWorkflowOptionPaymentPaid = (row: WorkflowRow, module: WorkflowModule | 'Advance2') =>
    normalizeStatus(getWorkflowOptionPaymentStatus(row, module)) === 'paid';

  const isFinanceCardFullyClosed = (rows: WorkflowRow[]) => {
    const submittedOptions = rows.flatMap((row) =>
      getRowActions(row)
        .filter((option) => !option.hidden && option.submitted)
        .map((option) => ({ row, module: option.module })),
    );

    return (
      submittedOptions.length > 0 &&
      submittedOptions.every(({ row, module }) => isWorkflowOptionPaymentPaid(row, module))
    );
  };

  const getWorkflowStatusLabel = (row: WorkflowRow) => {
    return getWorkflowApprovalLabel(parseWorkflowState(row.latestWorkflowState));
  };

  const getWorkflowTimelineState = (row: WorkflowRow, stage: 'hod' | 'dof' | 'principal') => {
    return getWorkflowApprovalStageState(parseWorkflowState(row.latestWorkflowState), stage);
  };

  const getModuleSummary = (row: WorkflowRow, module: WorkflowModule) => {
    if (module === 'Advance') {
      return {
        amount: row.advanceAmount,
        subHead: row.advanceSubHead || '',
      };
    }

    if (module === 'Expenditure') {
      return {
        amount: row.expenditureAmount,
        subHead: row.expenditureSubHead || '',
      };
    }

    return {
      amount: row.settlementAmount,
      subHead: row.settlementSubHead || '',
    };
  };

  const getRowDisplaySubHead = (row: WorkflowRow) => {
    if (row.latestRequestType === 'Settlement' && row.settlementSubHead) {
      return row.settlementSubHead;
    }

    if (row.latestRequestType === 'Expenditure' && row.expenditureSubHead) {
      return row.expenditureSubHead;
    }

    if (row.latestRequestType === 'Advance') {
      return row.advanceSubHead2 || row.advanceSubHead || '';
    }

    return (
      row.advanceSubHead2 ||
      row.advanceSubHead ||
      row.settlementSubHead ||
      row.expenditureSubHead ||
      ''
    );
  };

  const getStatusPillToneClass = (label: string) => {
    const normalizedLabel = label.toLowerCase();

    if (normalizedLabel.includes('approved')) return 'expenditure-status-pill--approved';
    if (normalizedLabel.includes('pending')) return 'expenditure-status-pill--pending';
    if (normalizedLabel.includes('rejected')) return 'expenditure-status-pill--rejected';

    return '';
  };

  const getRequestTimelineState = (item: ExpenditureItem, stage: 'hod' | 'dof' | 'principal') =>
    getWorkflowApprovalStageState(parseWorkflowState(item.workflow_state), stage);

  const isWorkflowActionLocked = (row: WorkflowRow) => {
    const workflowState = parseWorkflowState(row.latestWorkflowState);
    const currentStage = normalizeText(
      workflowState?.currentStage ?? workflowState?.workflowStage ?? '',
    ).toLowerCase();
    const status = normalizeStatus(workflowState?.status ?? row.latestWorkflowStatus ?? '');

    if (['returned', 'rejected'].includes(status)) {
      return false;
    }

    return currentStage === 'dof' || currentStage === 'principal';
  };

  const getWorkflowGateMessage = (row: WorkflowRow, module: WorkflowModule | 'Advance2') => {
    const advanceApproved = isApprovedStatus(row.advanceStatus);

    if (module === 'Advance2' && !advanceApproved) {
      return 'Interim Advance can be filled only after Initial Advance is completely approved.';
    }

    if (module === 'Settlement' && !advanceApproved) {
      return 'Settlement can be filled only after Initial Advance is completely approved.';
    }

    return null;
  };

  const hasSubmittedProposal = (row: WorkflowRow) =>
    Boolean(
      row.latestRequestId ||
      row.advanceRequestId ||
      row.advanceRequestId2 ||
      row.expenditureRequestId ||
      row.settlementRequestId,
    );

  const getRowWorkflowLabel = (row: WorkflowRow) => {
    if (!hasSubmittedProposal(row)) {
      return 'Not Submitted';
    }

    return getWorkflowStatusLabel(row);
  };

  const buildRowsFromRequests = (
    cards: ExpenditureProposalCard[],
    requests: ExpenditureItem[],
  ): Record<string, WorkflowRow[]> => {
    const next: Record<string, WorkflowRow[]> = {};

    cards.forEach((card) => {
      const financeId = normalizeText(card.financeRequestId);
      const related = requests.filter((req) => String(req.financeid ?? '') === financeId);
      const requestRefsById = buildWorkflowRequestRefMap(related);
      const rowsByKey = new Map<string, ExpenditureItem[]>();
      related.forEach((req) => {
        const key = getRowKey(req);
        const bucket = rowsByKey.get(key) ?? [];
        bucket.push(req);
        rowsByKey.set(key, bucket);
      });

      const sortedGroups = Array.from(rowsByKey.entries()).sort((a, b) => {
        const aLatest = [...a[1]].sort((left, right) => {
          const leftTime = new Date(left.createdat || 0).getTime();
          const rightTime = new Date(right.createdat || 0).getTime();
          if (leftTime !== rightTime) return rightTime - leftTime;
          return right.id - left.id;
        })[0];
        const bLatest = [...b[1]].sort((left, right) => {
          const leftTime = new Date(left.createdat || 0).getTime();
          const rightTime = new Date(right.createdat || 0).getTime();
          if (leftTime !== rightTime) return rightTime - leftTime;
          return right.id - left.id;
        })[0];

        const aTime = new Date(aLatest?.createdat || 0).getTime();
        const bTime = new Date(bLatest?.createdat || 0).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return (aLatest?.id || 0) - (bLatest?.id || 0);
      });

      const rowEntries: WorkflowRow[] = sortedGroups.map(([rowKey, rowRequests], index) => {
        const latestRequest =
          [...rowRequests].sort((a, b) => {
            const aTime = new Date(a.createdat || 0).getTime();
            const bTime = new Date(b.createdat || 0).getTime();
            if (aTime !== bTime) return bTime - aTime;
            return b.id - a.id;
          })[0] ?? null;
        const latestWorkflowStatus = latestRequest
          ? getRequestWorkflowStatus(latestRequest)
          : 'pending';
        const latestWorkflowState = latestRequest?.workflow_state ?? null;
        const latestWorkflowCurrentStage = latestRequest
          ? normalizeText(getRequestWorkflowState(latestRequest)?.currentStage ?? '').toLowerCase()
          : '';

        const firstRequest =
          [...rowRequests].sort((a, b) => {
            const aTime = new Date(a.createdat || 0).getTime();
            const bTime = new Date(b.createdat || 0).getTime();
            if (aTime !== bTime) return aTime - bTime;
            return a.id - b.id;
          })[0] ?? null;

        const summarizeModule = (moduleName: WorkflowModule) => {
          const moduleRows = rowRequests
            .filter((req) => normalizeModule(req.request_type) === moduleName)
            .sort((a, b) => {
              const aTime = new Date(a.createdat || 0).getTime();
              const bTime = new Date(b.createdat || 0).getTime();
              if (aTime !== bTime) return bTime - aTime;
              return b.id - a.id;
            });

          const latestModuleRow = moduleRows[0] ?? null;

          return {
            requestId: latestModuleRow?.id ?? null,
            amount: moduleRows.reduce((sum, req) => sum + Number(req.amount ?? 0), 0),
            subHead: normalizeText(latestModuleRow?.sub_head),
            status: normalizeStatus(latestModuleRow?.overallstatus),
            paymentStatus: normalizeText(latestModuleRow?.payment_status),
          };
        };

        // Special handling for Advance - separate first and second advance
        const advanceRows = rowRequests
          .filter((req) => normalizeModule(req.request_type) === 'Advance')
          .sort((a, b) => {
            const aTime = new Date(a.createdat || 0).getTime();
            const bTime = new Date(b.createdat || 0).getTime();
            if (aTime !== bTime) return aTime - bTime; // Oldest first for advance
            return a.id - b.id;
          });

        const firstAdvance = advanceRows[0] ?? null;
        const secondAdvance = advanceRows[1] ?? null;

        const advanceSummary = {
          requestId: firstAdvance?.id ?? null,
          amount: Number(firstAdvance?.amount ?? 0),
          subHead: normalizeText(firstAdvance?.sub_head),
          status: normalizeStatus(firstAdvance?.overallstatus),
          paymentStatus: normalizeText(firstAdvance?.payment_status),
        };

        const advanceSummary2 = secondAdvance
          ? {
              requestId: secondAdvance.id,
              amount: Number(secondAdvance.amount ?? 0),
              subHead: normalizeText(secondAdvance.sub_head),
              status: normalizeStatus(secondAdvance.overallstatus),
              paymentStatus: normalizeText(secondAdvance.payment_status),
            }
          : null;

        const expenditureSummary = summarizeModule('Expenditure');
        const settlementSummary = summarizeModule('Settlement');
        const persistedRowIndex =
          rowRequests
            .map((req) => getWorkflowStateRowIndex(req.workflow_state))
            .find((value): value is number => Boolean(value)) ?? index + 1;

        return {
          id: rowKey || `${financeId}-req-${latestRequest?.id ?? index + 1}`,
          requestId: latestRequest?.id ?? null,
          advanceRequestId: advanceSummary.requestId,
          advanceRequestId2: advanceSummary2?.requestId ?? null,
          expenditureRequestId: expenditureSummary.requestId,
          settlementRequestId: settlementSummary.requestId,
          advanceRequestRef:
            firstAdvance?.id != null ? (requestRefsById.get(firstAdvance.id) ?? '') : '',
          advanceRequestRef2:
            secondAdvance?.id != null ? (requestRefsById.get(secondAdvance.id) ?? '') : '',
          expenditureRequestRef:
            expenditureSummary.requestId != null
              ? (requestRefsById.get(expenditureSummary.requestId) ?? '')
              : '',
          settlementRequestRef:
            settlementSummary.requestId != null
              ? (requestRefsById.get(settlementSummary.requestId) ?? '')
              : '',
          rowIndex: persistedRowIndex,
          baseRowRef: rowKey || `${financeId}-req-${latestRequest?.id ?? index + 1}`,
          advanceRef: `${financeId}-advance-${rowKey || index + 1}`,
          advanceRef2: `${financeId}-advance2-${rowKey || index + 1}`,
          expenditureRef: `${financeId}-expenditure-${rowKey || index + 1}`,
          settlementRef: `${financeId}-settlement-${rowKey || index + 1}`,
          primaryChoice: normalizeModule(firstRequest?.request_type),
          advanceAmount: advanceSummary.amount,
          advanceAmount2: advanceSummary2?.amount ?? 0,
          expenditureAmount: expenditureSummary.amount,
          settlementAmount: settlementSummary.amount,
          advanceSubHead: advanceSummary.subHead,
          advanceSubHead2: advanceSummary2?.subHead ?? '',
          expenditureSubHead: expenditureSummary.subHead,
          settlementSubHead: settlementSummary.subHead,
          advanceStatus: advanceSummary.status,
          advanceStatus2: advanceSummary2?.status ?? 'pending',
          expenditureStatus: expenditureSummary.status,
          settlementStatus: settlementSummary.status,
          advancePaymentStatus: advanceSummary.paymentStatus,
          advancePaymentStatus2: advanceSummary2?.paymentStatus ?? '',
          expenditurePaymentStatus: expenditureSummary.paymentStatus,
          settlementPaymentStatus: settlementSummary.paymentStatus,
          latestRequestId: latestRequest?.id ?? null,
          latestRequestType: normalizeModule(latestRequest?.request_type),
          latestWorkflowState,
          latestWorkflowStatus,
          approvalLevel: latestRequest
            ? latestWorkflowStatus === 'approved'
              ? 3
              : latestWorkflowStatus === 'rejected'
                ? 0
                : latestWorkflowCurrentStage === 'principal'
                  ? 3
                  : latestWorkflowCurrentStage === 'dof'
                    ? 2
                    : 1
            : 0,
        };
      });

      next[financeId] =
        rowEntries.length > 0
          ? rowEntries
          : [
              {
                id: `${financeId}-blank-1`,
                requestId: null,
                advanceRequestId: null,
                advanceRequestId2: null,
                expenditureRequestId: null,
                settlementRequestId: null,
                advanceRequestRef: '',
                advanceRequestRef2: '',
                rowIndex: 1,
                baseRowRef: `${financeId}-blank-1`,
                advanceRef: `${financeId}-advance-blank-1`,
                advanceRef2: `${financeId}-advance2-blank-1`,
                expenditureRef: `${financeId}-expenditure-blank-1`,
                settlementRef: `${financeId}-settlement-blank-1`,
                expenditureRequestRef: '',
                settlementRequestRef: '',
                primaryChoice: null,
                advanceAmount: 0,
                advanceAmount2: 0,
                expenditureAmount: 0,
                settlementAmount: 0,
                advanceSubHead: '',
                advanceSubHead2: '',
                expenditureSubHead: '',
                settlementSubHead: '',
                advanceStatus: 'pending',
                advanceStatus2: 'pending',
                expenditureStatus: 'pending',
                settlementStatus: 'pending',
                advancePaymentStatus: '',
                advancePaymentStatus2: '',
                expenditurePaymentStatus: '',
                settlementPaymentStatus: '',
                latestRequestId: null,
                latestRequestType: null,
                latestWorkflowState: null,
                latestWorkflowStatus: 'pending',
                approvalLevel: 0,
              },
            ];
    });

    return next;
  };

  const addRow = (financeId: string) => {
    const sourceCard = proposalCards.find((card) => card.financeRequestId === financeId);
    const cardBalanceAmount = Math.max(Number(sourceCard?.balanceAmount || 0), 0);

    if (cardBalanceAmount <= 0) {
      showDialog({
        title: 'No Balance Available',
        message: 'No remaining balance is available for this proposal.',
        variant: 'warning',
      });
      return;
    }

    setCardRows((prev) => {
      const existing = prev[financeId] ?? [];
      const nextRow = createWorkflowRow(financeId, getNextWorkflowRowIndex(existing));

      return {
        ...prev,
        [financeId]: [...existing, nextRow],
      };
    });
  };

  const removeRow = (financeId: string, rowId: string) => {
    setCardRows((prev) => {
      const existing = prev[financeId] ?? [];
      if (existing.length <= 1) return prev;

      const nextRows = existing.filter((row) => row.id !== rowId);

      return {
        ...prev,
        [financeId]: nextRows.length > 0 ? nextRows : existing.slice(0, 1),
      };
    });
  };

  const deleteWorkflowRow = async (financeId: string, row: WorkflowRow) => {
    if (row.requestId) {
      await deleteExpenditureRequest(row.requestId);
      return;
    }

    removeRow(financeId, row.id);
  };

  const deleteExpenditureRequest = async (requestId: number) => {
    if (!Number.isFinite(requestId) || requestId <= 0) return;

    showDialog({
      title: 'Delete Request',
      message: 'Delete this pending expenditure request? This will reverse the reserved amount.',
      variant: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          setLoading(true);
          const result = (await authenticityUtility.delete(`/expenditure/${requestId}`)) as {
            success?: boolean;
            status?: string;
            message?: string;
          };

          if (result?.success !== true && result?.status !== 'success') {
            throw new Error(result?.message || 'Failed to delete expenditure request');
          }

          await fetchDashboard(openCardId);
        } catch (error) {
          console.error('Failed to delete expenditure request:', error);
          showDialog({
            title: 'Delete Failed',
            message: 'Unable to delete this request. Only pending requests can be deleted.',
            variant: 'danger',
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const fetchDashboard = async (preferredOpenCardId?: string | null) => {
    try {
      setLoading(true);
      setStatusUpdatesById({});

      const fyStart = Number.parseInt(financialYear.split('-')[0], 10);

      const res = await authenticityUtility.get('/expenditure/dashboard', {
        params: { fiscalYear: fyStart },
      });
      const payload = res as unknown as {
        status?: string;
        data?: unknown;
        requests?: unknown;
        cards?: unknown;
      };

      const apiData = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.requests)
          ? payload.requests
          : [];

      const apiCards = Array.isArray(payload?.cards) ? payload.cards : [];

      const mappedData: ExpenditureItem[] = apiData.map((item: any) => ({
        id: Number(item.id),
        financeid: Number(item.financeid ?? item.finance_id ?? 0),
        proposalref: String(item.proposalref ?? item.proposal_ref ?? ''),
        requestref: String(item.requestref ?? item.request_ref ?? ''),
        applicantname: String(item.applicantname ?? item.applicant_name ?? ''),
        beneficiarytype: String(item.beneficiarytype ?? item.beneficiary_type ?? ''),
        primaryhead: String(item.primaryhead ?? item.primary_head ?? ''),
        sub_head: String(item.sub_head ?? item.subHead ?? ''),
        amount: Number(item.amount ?? 0),
        overallstatus: String(item.overallstatus ?? item.overall_status ?? 'pending'),
        createdat: String(item.createdat ?? item.created_at ?? ''),
        request_type: item.request_type
          ? String(item.request_type)
          : item.type
            ? String(item.type)
            : undefined,
        payment_status: String(item.payment_status ?? item.paymentstatus ?? ''),
        workflow_state: item.workflow_state ?? item.workflowState ?? null,
      }));

      const mappedCards: ExpenditureProposalCard[] = apiCards.map(
        (card: ExpenditureDashboardCardApi) => ({
          financeRequestId: String(card.finance_request_id ?? card.financerequestid ?? ''),
          proposalId: String(
            card.request_ref ??
              card.requestref ??
              card.finance_request_id ??
              card.financerequestid ??
              '',
          ),
          applicantName: String(card.applicantname ?? card.applicant_name ?? ''),
          beneficiaryName: String(card.beneficiaryname ?? card.beneficiary_name ?? ''),
          tag: String(card.financetag ?? card.finance_tag ?? ''),
          totalAmount: Number(card.approvedamount ?? card.approved_amount ?? 0),
          expenditureAmount: Number(card.expenditureamount ?? card.expenditure_amount ?? 0),
          balanceAmount: Number(card.balanceamount ?? card.balance_amount ?? 0),
          sourceFiscalYear: Number(card.sourcefiscalyear ?? card.source_fiscal_year) || null,
          carryForwardTargetYears: String(
            card.carryforwardtargetyears ?? card.carry_forward_target_years ?? '',
          ),
        }),
      );

      setData(mappedData);
      setProposalCards(mappedCards);
      setCardRows(buildRowsFromRequests(mappedCards, mappedData));
      setOpenCardId(preferredOpenCardId ?? mappedCards[0]?.financeRequestId ?? null);
    } catch (err) {
      console.error('Expenditure dashboard error:', err);
      setData([]);
      setProposalCards([]);
      setCardRows({});
      setOpenCardId(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const state = location.state as DashboardReturnState | null;

    const stateFiscalYear = normalizeText(state?.fiscalYear ?? '');
    if (stateFiscalYear && stateFiscalYear !== financialYear) {
      setFinancialYear(stateFiscalYear);
      return;
    }

    const financeId = normalizeText(state?.financeRequestId ?? '');

    if (financeId) {
      fetchDashboard(financeId);
      navigate('/expenditurecard', { replace: true, state: null });
    } else {
      fetchDashboard();
    }
  }, [location.state, financialYear, navigate]);

  const activeInfoItem =
    activeInfoId !== null ? (data.find((item) => item.id === activeInfoId) ?? null) : null;
  const activeStatusUpdates = activeInfoId !== null ? statusUpdatesById[activeInfoId] || [] : [];
  const activeLogEvents = activeInfoItem
    ? buildExpenditureLogEvents(activeInfoItem, activeStatusUpdates)
    : [];

  return (
    <section className="expenditure-page">
      <div className="expenditure-container">
        <div className="expenditure-card">
          <div className="expenditure-header">
            <div className="expenditure-header-left">
              <div className="expenditure-title-row">
                <h5 className="expenditure-title">Expenditure Requests</h5>
                <button
                  type="button"
                  className="expenditure-add-payee-btn"
                  onClick={() => setShowAddPayeeModal(true)}
                >
                  <Plus size={18} />
                  <span>Add Payee</span>
                </button>
              </div>
            </div>

            <div className="expenditure-header-right">
              <div className="expenditure-proposal-filter-bar">
                <button
                  type="button"
                  className={`expenditure-proposal-filter-btn ${selectedTypeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedTypeFilter('all')}
                >
                  All
                </button>

                <button
                  type="button"
                  className={`expenditure-proposal-filter-btn expenditure-proposal-filter-btn--advance ${selectedTypeFilter === 'Advance' ? 'active' : ''}`}
                  onClick={() => setSelectedTypeFilter('Advance')}
                >
                  A
                </button>

                <button
                  type="button"
                  className={`expenditure-proposal-filter-btn expenditure-proposal-filter-btn--expenditure ${selectedTypeFilter === 'Expenditure' ? 'active' : ''}`}
                  onClick={() => setSelectedTypeFilter('Expenditure')}
                >
                  E
                </button>

                <button
                  type="button"
                  className={`expenditure-proposal-filter-btn expenditure-proposal-filter-btn--settlement ${selectedTypeFilter === 'Settlement' ? 'active' : ''}`}
                  onClick={() => setSelectedTypeFilter('Settlement')}
                >
                  S
                </button>
              </div>

              <div className="expenditure-search-wrap">
                <Search size={18} className="expenditure-search-icon" />
                <input
                  type="text"
                  className="expenditure-search-input"
                  value={financeIdQuery}
                  onChange={(e) => setFinanceIdQuery(e.target.value)}
                  placeholder="Search applicant or primary head..."
                  aria-label="Search applicant or primary head"
                />
                {financeIdQuery && (
                  <XCircle
                    size={16}
                    className="expenditure-clear-icon"
                    onClick={() => setFinanceIdQuery('')}
                  />
                )}
              </div>

              <div className="expenditure-filter-group">
                <select
                  className="expenditure-financial-year"
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                  aria-label="Select financial year"
                >
                  {fyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  className="expenditure-beneficiary-filter"
                  value={selectedBeneficiary}
                  onChange={(e) => setSelectedBeneficiary(e.target.value)}
                  aria-label="Select beneficiary type"
                >
                  {beneficiaryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <AddPayeeModal
            show={showAddPayeeModal}
            onClose={() => {
              if (!isSubmittingPayee) setShowAddPayeeModal(false);
            }}
            onAddPayee={submitPayeeForApproval}
            showAlert={(message) => window.alert(String(message))}
            submitLabel="Submit for Approval"
            isSubmitting={isSubmittingPayee}
          />

          <div className="expenditure-body">
            <div className="expenditure-stats-container">
              {kpiCards.map((card) => {
                const isActive = selectedStatusFilter === card.key;

                return (
                  <button
                    key={card.key}
                    type="button"
                    className={`expenditure-stats-card ${card.className} ${
                      isActive ? 'active' : ''
                    }`}
                    onClick={() => setSelectedStatusFilter(card.key)}
                    aria-pressed={isActive}
                    aria-label={`Filter expenditure requests by ${card.label}`}
                  >
                    <div className="expenditure-stats-icon-wrap">{card.icon}</div>
                    <div className="expenditure-stats-info">
                      <span className="expenditure-stats-label">{card.label}</span>
                      <span className="expenditure-stats-number">{card.value}</span>
                      <span className="expenditure-stats-amount">{formatAmount(card.amount)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="expenditure-demo-wrap">
              {filteredProposalCards.map((card) => {
                const isCardOpen = openCardId === card.financeRequestId;
                const cardExpenditureAmount = Number(card.expenditureAmount || 0);
                const cardBalanceAmount = Math.max(Number(card.balanceAmount || 0), 0);
                const rows = filteredCardRows[card.financeRequestId] ?? [];
                const canAddRow = cardBalanceAmount > 0;
                const isFullyClosed = isFinanceCardFullyClosed(rows);
                const selectedFiscalYearStart = Number.parseInt(financialYear.split('-')[0], 10);
                const sourceFiscalYear = Number(card.sourceFiscalYear || 0);
                const showCarryForwardLabel =
                  sourceFiscalYear > 0 &&
                  selectedFiscalYearStart > 0 &&
                  sourceFiscalYear !== selectedFiscalYearStart;
                const hasCarryForwardTarget =
                  String(card.carryForwardTargetYears || '').trim() !== '';

                return (
                  <div
                    key={card.financeRequestId + card.applicantName}
                    className={`expenditure-demo-card ${isCardOpen ? 'open' : ''} ${
                      isFullyClosed ? 'expenditure-demo-card--closed' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="expenditure-demo-trigger"
                      onClick={() =>
                        setOpenCardId((prev) =>
                          prev === card.financeRequestId ? null : card.financeRequestId,
                        )
                      }
                    >
                      <div className="expenditure-demo-trigger__content">
                        {(() => {
                          const proposalText = String(card.proposalId || '').trim();
                          const shortToken =
                            proposalText.split('_').filter(Boolean).pop() || proposalText;
                          const isCompact = /^[AE]\d+$/i.test(shortToken);

                          return (
                            <div
                              className={`expenditure-demo-trigger__id ${
                                isCompact ? 'expenditure-demo-trigger__id--compact' : ''
                              }`}
                            >
                              {isCompact ? shortToken : proposalText}
                            </div>
                          );
                        })()}

                        <div className="expenditure-demo-trigger__title">{card.applicantName}</div>

                        <div className="expenditure-demo-trigger__meta">
                          {card.beneficiaryName && (
                            <span className="expenditure-demo-trigger__meta-text">
                              {card.beneficiaryName}
                            </span>
                          )}
                          {card.tag && (
                            <span className="expenditure-demo-trigger__meta-tag">{card.tag}</span>
                          )}
                          {showCarryForwardLabel && hasCarryForwardTarget && (
                            <span className="expenditure-demo-trigger__meta-tag">
                              Carry Forward Card
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="expenditure-demo-trigger__summary">
                        <div className="expenditure-demo-trigger__summary-item">
                          <span className="expenditure-demo-trigger__summary-label">Approved</span>
                          <strong>{formatAmount(card.totalAmount)}</strong>
                        </div>

                        <div className="expenditure-demo-trigger__summary-item">
                          <span className="expenditure-demo-trigger__summary-label">Balance</span>
                          <strong>{formatAmount(cardBalanceAmount)}</strong>
                        </div>
                      </div>

                      <ChevronDown
                        size={20}
                        className={`expenditure-demo-trigger__arrow ${isCardOpen ? 'open' : ''}`}
                      />
                    </button>

                    {isCardOpen && (
                      <div className="expenditure-demo-dropdown">
                        <div className="expenditure-demo-dropdown__layout">
                          <div className="expenditure-demo-dropdown__left">
                            <div className="expenditure-demo-rows">
                              {rows.map((row) => {
                                const actions = getRowActions(row);
                                const isLastRow = rows[rows.length - 1]?.id === row.id;
                                const isCompleted = isWorkflowRowCompleted(row);
                                const isActionLocked = isWorkflowActionLocked(row);
                                const hasProposal = hasSubmittedProposal(row);
                                const rowDisplaySubHead = getRowDisplaySubHead(row);
                                const isReturnedRow =
                                  normalizeStatus(row.latestWorkflowStatus) === 'returned';
                                const isRejectedRow =
                                  normalizeStatus(row.latestWorkflowStatus) === 'rejected';
                                const settlementAdjustment = getSettlementDashboardAdjustment(row);
                                const canAddWorkflowRow =
                                  !isReturnedRow && !isRejectedRow && isLastRow && canAddRow;
                                const canEditRow =
                                  hasProposal &&
                                  !isActionLocked &&
                                  (row.latestWorkflowStatus
                                    ? isEditableWorkflowStatus(row.latestWorkflowStatus)
                                    : !row.latestRequestId);

                                return (
                                  <div
                                    key={row.id}
                                    className={`expenditure-demo-row ${
                                      isCompleted ? 'expenditure-demo-row--completed' : ''
                                    }`}
                                  >
                                    <div className="expenditure-demo-row__header">
                                      <div className="expenditure-demo-row__left">
                                        <div className="expenditure-demo-row__buttons">
                                          {actions.map((option) => {
                                            // Skip hidden buttons
                                            if (option.hidden) return null;
                                            const gateMessage = getWorkflowGateMessage(
                                              row,
                                              option.module,
                                            );
                                            const optionRequestRef = option.submitted
                                              ? getWorkflowOptionRequestRef(row, option.module)
                                              : '';
                                            const optionRequestCode =
                                              getWorkflowRequestDisplayCode(optionRequestRef);
                                            const optionAmount = option.submitted
                                              ? getWorkflowOptionAmount(row, option.module)
                                              : 0;
                                            const showOptionDetails = Boolean(
                                              optionRequestRef || optionAmount > 0,
                                            );
                                            const isConstructionOption = option.label
                                              ?.toLowerCase()
                                              .includes('construction');
                                            const paymentToneClass = option.submitted
                                              ? getWorkflowOptionPaymentToneClass(
                                                  row,
                                                  option.module,
                                                )
                                              : '';

                                            return (
                                              <button
                                                key={`${row.id}-${option.label}`}
                                                type="button"
                                                className={`expenditure-demo-option ${
                                                  option.submitted ? 'submitted' : ''
                                                } ${gateMessage ? 'disabled' : ''} ${
                                                  showOptionDetails
                                                    ? 'expenditure-demo-option--detailed'
                                                    : ''
                                                } ${
                                                  row.primaryChoice === option.module ||
                                                  (option.module === 'Settlement' &&
                                                    row.settlementAmount > 0)
                                                    ? 'chosen'
                                                    : ''
                                                } ${
                                                  isConstructionOption && !showOptionDetails
                                                    ? 'expenditure-demo-option--construction'
                                                    : ''
                                                } ${paymentToneClass}`}
                                                onClick={() =>
                                                  gateMessage
                                                    ? showDialog({
                                                        title: 'Action Not Available',
                                                        message: gateMessage,
                                                        variant: 'warning',
                                                      })
                                                    : handleModuleLaunch(row, option.module, card, {
                                                        mode:
                                                          (option.module === 'Advance' &&
                                                            Boolean(row.advanceRequestId)) ||
                                                          (option.module === 'Advance2' &&
                                                            Boolean(row.advanceRequestId2)) ||
                                                          (option.module === 'Settlement' &&
                                                            Boolean(row.settlementRequestId)) ||
                                                          (option.module === 'Expenditure' &&
                                                            Boolean(row.expenditureRequestId))
                                                            ? 'view'
                                                            : 'create',
                                                        forceNew:
                                                          option.module === 'Advance2' &&
                                                          !row.advanceRequestId2,
                                                      })
                                                }
                                                title={gateMessage || undefined}
                                              >
                                                {showOptionDetails && (
                                                  <span className="expenditure-demo-option__detail-grid">
                                                    <span
                                                      className="expenditure-demo-option__detail-box expenditure-demo-option__detail-box--ref"
                                                      title={optionRequestRef || undefined}
                                                      aria-label={
                                                        optionRequestRef
                                                          ? `Reference Request ID: ${optionRequestRef}`
                                                          : 'Reference Request ID unavailable'
                                                      }
                                                    >
                                                      <strong className="expenditure-demo-option__detail-ref-value">
                                                        {optionRequestCode || '-'}
                                                      </strong>
                                                    </span>
                                                    <span className="expenditure-demo-option__detail-box expenditure-demo-option__detail-box--amount">
                                                      <span className="expenditure-demo-option__detail-module">
                                                        {option.label}
                                                      </span>
                                                      {optionAmount > 0 && (
                                                        <strong className="expenditure-demo-option__detail-amount-value">
                                                          {formatAmount(optionAmount)}
                                                        </strong>
                                                      )}
                                                    </span>
                                                  </span>
                                                )}
                                                {!showOptionDetails && (
                                                  <span
                                                    className={`expenditure-demo-option__label ${
                                                      option.label
                                                        ?.toLowerCase()
                                                        .includes('construction')
                                                        ? 'expenditure-demo-option__label--construction'
                                                        : ''
                                                    }`}
                                                  >
                                                    {option.label}
                                                  </span>
                                                )}
                                              </button>
                                            );
                                          })}
                                          {settlementAdjustment && (
                                            <div
                                              className={`expenditure-demo-adjustment-card expenditure-demo-adjustment-card--${settlementAdjustment.tone}`}
                                              title={`${settlementAdjustment.label}: ${formatAmount(settlementAdjustment.amount)}`}
                                            >
                                              <span className="expenditure-demo-adjustment-card__label">
                                                {settlementAdjustment.compactLabel}
                                              </span>
                                              <strong className="expenditure-demo-adjustment-card__amount">
                                                {formatAmount(settlementAdjustment.amount)}
                                              </strong>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="expenditure-demo-row__status">
                                        <div
                                          className={`expenditure-demo-row__subhead ${
                                            rowDisplaySubHead
                                              ? ''
                                              : 'expenditure-demo-row__subhead--empty'
                                          } ${
                                            rowDisplaySubHead
                                              ?.toLowerCase()
                                              .includes('construction')
                                              ? 'expenditure-demo-row__subhead--construction'
                                              : ''
                                          }`}
                                          title={rowDisplaySubHead || 'Sub head not selected'}
                                        >
                                          <strong className="expenditure-demo-row__subhead-value">
                                            {rowDisplaySubHead || 'Sub Head -'}
                                          </strong>
                                        </div>

                                        {/* Edit button - only show for submitted proposals */}
                                        {hasProposal && (
                                          <button
                                            type="button"
                                            className="expenditure-demo-row__icon-btn"
                                            disabled={!canEditRow}
                                            onClick={() => {
                                              if (!canEditRow) return;

                                              // Navigate to the last submitted module for editing
                                              if (
                                                row.latestRequestType === 'Advance' &&
                                                row.advanceRequestId2
                                              ) {
                                                handleModuleLaunch(row, 'Advance2', card, {
                                                  mode: 'edit',
                                                });
                                              } else if (
                                                row.latestRequestType === 'Advance' &&
                                                row.advanceRequestId
                                              ) {
                                                handleModuleLaunch(row, 'Advance', card, {
                                                  mode: 'edit',
                                                });
                                              } else if (
                                                row.latestRequestType === 'Expenditure' &&
                                                row.expenditureRequestId
                                              ) {
                                                handleModuleLaunch(row, 'Expenditure', card, {
                                                  mode: 'edit',
                                                });
                                              } else if (
                                                row.latestRequestType === 'Settlement' &&
                                                row.settlementRequestId
                                              ) {
                                                handleModuleLaunch(row, 'Settlement', card, {
                                                  mode: 'edit',
                                                });
                                              } else if (row.advanceRequestId2) {
                                                handleModuleLaunch(row, 'Advance2', card, {
                                                  mode: 'edit',
                                                });
                                              } else if (row.advanceRequestId) {
                                                handleModuleLaunch(row, 'Advance', card, {
                                                  mode: 'edit',
                                                });
                                              } else if (row.settlementRequestId) {
                                                handleModuleLaunch(row, 'Settlement', card, {
                                                  mode: 'edit',
                                                });
                                              } else if (row.expenditureRequestId) {
                                                handleModuleLaunch(row, 'Expenditure', card, {
                                                  mode: 'edit',
                                                });
                                              }
                                            }}
                                            title={
                                              canEditRow
                                                ? 'Edit proposal'
                                                : 'Editing is disabled while approval is in progress'
                                            }
                                            aria-label="Edit proposal"
                                          >
                                            <Edit2 size={14} />
                                          </button>
                                        )}

                                        {hasProposal && (
                                          <button
                                            type="button"
                                            className="expenditure-demo-row__icon-btn"
                                            onClick={() => handleInfoClick(row.latestRequestId)}
                                            title="Logs"
                                            aria-label="View request logs"
                                          >
                                            <Info size={14} />
                                          </button>
                                        )}

                                        {hasProposal &&
                                          (() => {
                                            const rowStatusLabel = getRowWorkflowLabel(row);

                                            return (
                                              <button
                                                type="button"
                                                className={`expenditure-status-pill ${getStatusPillToneClass(
                                                  rowStatusLabel,
                                                )} ${
                                                  showWorkflowStatusDetail[row.id]
                                                    ? 'expenditure-status-pill--active'
                                                    : ''
                                                }`}
                                                onClick={() =>
                                                  setShowWorkflowStatusDetail((prev) => ({
                                                    ...prev,
                                                    [row.id]: !prev[row.id],
                                                  }))
                                                }
                                                aria-expanded={Boolean(
                                                  showWorkflowStatusDetail[row.id],
                                                )}
                                                aria-label={`Toggle approval status for ${row.id}`}
                                              >
                                                {rowStatusLabel}
                                              </button>
                                            );
                                          })()}

                                        {hasProposal && showWorkflowStatusDetail[row.id] && (
                                          <div className="expenditure-status-detail-line">
                                            {(['hod', 'dof', 'principal'] as const).map(
                                              (stage, stepIndex, array) => {
                                                const stageState = getWorkflowTimelineState(
                                                  row,
                                                  stage,
                                                );

                                                return (
                                                  <React.Fragment key={stage}>
                                                    <div
                                                      className={`expenditure-status-line-circle expenditure-status-circle-${stageState}`}
                                                      title={stage.toUpperCase()}
                                                    />
                                                    {stepIndex < array.length - 1 && (
                                                      <div
                                                        className={`expenditure-status-line-connector expenditure-status-line-connector--${stageState}`}
                                                      />
                                                    )}
                                                  </React.Fragment>
                                                );
                                              },
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <div className="expenditure-demo-row__actions">
                                        <button
                                          type="button"
                                          className="expenditure-demo-row__icon-btn"
                                          disabled={!canAddWorkflowRow}
                                          onClick={() => {
                                            if (!canAddWorkflowRow) return;
                                            addRow(card.financeRequestId);
                                          }}
                                          title={
                                            canAddWorkflowRow
                                              ? 'Add row'
                                              : 'Only the latest addable row can create a new row'
                                          }
                                          aria-label="Add workflow row"
                                        >
                                          <Plus size={14} />
                                        </button>

                                        <button
                                          type="button"
                                          className="expenditure-demo-row__icon-btn expenditure-demo-row__icon-btn--danger"
                                          disabled={
                                            isActionLocked ||
                                            row.latestWorkflowStatus === 'approved' ||
                                            row.latestWorkflowStatus === 'completed' ||
                                            row.latestWorkflowStatus === 'archived' ||
                                            isReturnedRow ||
                                            isRejectedRow
                                          }
                                          onClick={() => {
                                            if (
                                              isActionLocked ||
                                              row.latestWorkflowStatus === 'approved' ||
                                              row.latestWorkflowStatus === 'completed' ||
                                              row.latestWorkflowStatus === 'archived' ||
                                              isReturnedRow ||
                                              isRejectedRow
                                            ) {
                                              return;
                                            }
                                            deleteWorkflowRow(card.financeRequestId, row);
                                          }}
                                          title={
                                            isActionLocked
                                              ? 'Delete is disabled while approval is in progress'
                                              : 'Delete row'
                                          }
                                          aria-label="Delete workflow row"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!loading && filteredData.length > 0 && (
              <div className="expenditure-request-list">
                {filteredData.map((item, idx) => {
                  const isExpanded = Boolean(showRequestStatusDetail[item.id]);
                  const statusLabel = getRequestStatusLabel(item);

                  return (
                    <div key={item.id} className="expenditure-request-card">
                      <div className="expenditure-request-cardtop">
                        <div className="expenditure-request-cardleft">
                          <div className="expenditure-request-cardindex">{idx + 1}</div>

                          <div className="expenditure-request-cardcontent">
                            <div className="expenditure-request-cardname">{item.applicantname}</div>

                            <div className="expenditure-request-cardmeta">
                              <span>{item.beneficiarytype}</span>
                              <span className="expenditure-demo-triggermeta-dot" />
                              <span>{item.primaryhead}</span>
                            </div>

                            <div className="expenditure-request-cardsub">
                              Submitted:{' '}
                              {item.createdat ? new Date(item.createdat).toLocaleDateString() : '-'}
                            </div>
                          </div>
                        </div>

                        <div className="expenditure-request-cardright">
                          <div className="expenditure-request-cardamount">
                            ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                          </div>

                          <div className="expenditure-request-cardactions">
                            <button
                              type="button"
                              title="View"
                              className="expenditure-action-global"
                              onClick={() => navigate(`/expenditure/${item.id}`)}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              title="Info"
                              className="expenditure-action-global"
                              onClick={() => handleInfoClick(item.id)}
                            >
                              <Info size={16} />
                            </button>
                            <button
                              type="button"
                              title="Edit"
                              className="expenditure-action-global"
                              disabled={!isEditableWorkflowStatus(getRequestWorkflowStatus(item))}
                              onClick={() => {
                                if (!isEditableWorkflowStatus(getRequestWorkflowStatus(item)))
                                  return;
                                navigate(`/expenditure/${item.id}/edit`);
                              }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              className="expenditure-action-global"
                              disabled={!isEditableWorkflowStatus(getRequestWorkflowStatus(item))}
                              onClick={() => {
                                if (!isEditableWorkflowStatus(getRequestWorkflowStatus(item)))
                                  return;
                                deleteExpenditureRequest(item.id);
                              }}
                              style={{ color: '#dc2626' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <button
                            type="button"
                            className={`expenditure-status-pill ${getStatusPillToneClass(
                              statusLabel,
                            )} ${isExpanded ? 'expenditure-status-pill--active' : ''}`}
                            onClick={() =>
                              setShowRequestStatusDetail((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            aria-expanded={isExpanded}
                            aria-label={`Toggle status for ${item.applicantname}`}
                          >
                            {statusLabel}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="expenditure-request-cardtimeline">
                          {(['hod', 'dof', 'principal'] as const).map((stage, stageIndex, arr) => {
                            const stageState = getRequestTimelineState(item, stage);

                            return (
                              <React.Fragment key={stage}>
                                <div
                                  className={`expenditure-status-line-circle expenditure-status-circle-${stageState}`}
                                  title={stage.toUpperCase()}
                                />
                                {stageIndex < arr.length - 1 && (
                                  <div
                                    className={`expenditure-status-line-connector expenditure-status-line-connector--${stageState}`}
                                  />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {loading && <div className="expenditure-state">Loading expenditure requests...</div>}

            {!loading && filteredProposalCards.length === 0 && (
              <div className="expenditure-state expenditure-state--empty">
                <div style={{ color: '#6b7280', fontSize: '15px', marginTop: '10px' }}>
                  {financeIdQuery.trim()
                    ? `No expenditure requests found for "${financeIdQuery.trim()}".`
                    : `No expenditure requests found for FY ${financialYear}.`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeInfoItem && (
        <div className="expenditure-log-overlay" onClick={() => setActiveInfoId(null)}>
          <div className="expenditure-log-modal" onClick={(event) => event.stopPropagation()}>
            <div className="expenditure-log-header">Submission Logs</div>
            <div className="expenditure-log-body">
              <div className="expenditure-log-summary">
                <div className="expenditure-log-summary-row">
                  <span className="expenditure-log-label">Request:</span>
                  <span className="expenditure-log-value">
                    {activeInfoItem.requestref ||
                      `#EX-${new Date(activeInfoItem.createdat).getFullYear()}-${String(activeInfoItem.id).padStart(4, '0')}`}
                  </span>
                </div>
                <div className="expenditure-log-summary-row">
                  <span className="expenditure-log-label">Submitted:</span>
                  <span className="expenditure-log-value">
                    {formatDateTime(activeInfoItem.createdat)}
                  </span>
                </div>
              </div>

              <div className="expenditure-log-timeline">
                {loadingInfoId === activeInfoItem.id ? (
                  <div className="expenditure-log-empty">Loading updates...</div>
                ) : activeLogEvents.length > 0 ? (
                  activeLogEvents.map((event) => (
                    <div
                      key={event.key}
                      className={`expenditure-log-entry${event.actorBadgeLabel ? ' expenditure-log-entry--stage' : ''}`}
                    >
                      <div className="expenditure-log-entry-top">
                        <div className="expenditure-log-entry-title">
                          <span
                            className={`expenditure-log-badge expenditure-log-badge--${event.badge.toLowerCase()}`}
                          >
                            {event.badge}
                          </span>
                          <span className="expenditure-log-title-text">{event.title}</span>
                        </div>
                        {event.actorBadgeLabel && (
                          <span className="expenditure-log-stage-pill">
                            {event.actorBadgeLabel}
                          </span>
                        )}
                      </div>
                      <div className="expenditure-log-role">{event.subtitle}</div>
                      <div className="expenditure-log-actor-line">
                        <strong>{event.actorLabel}:</strong> {event.actorValue}
                      </div>
                      <div className="expenditure-log-date">{event.dateLabel}</div>
                    </div>
                  ))
                ) : (
                  <div className="expenditure-log-empty">No updates found.</div>
                )}
              </div>

              <div className="expenditure-log-footer">
                <button
                  type="button"
                  className="expenditure-log-close-btn"
                  onClick={() => setActiveInfoId(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        show={dialogConfig.show}
        onHide={closeDialog}
        centered
        className={`expenditure-dialog-modal expenditure-dialog-modal--${dialogConfig.variant ?? 'info'}`}
        aria-labelledby="expenditure-dialog-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="expenditure-dialog-title">{dialogConfig.title}</Modal.Title>
        </Modal.Header>

        <Modal.Body>{dialogConfig.message}</Modal.Body>

        <Modal.Footer>
          {dialogConfig.cancelText && (
            <Button variant="outline-secondary" onClick={closeDialog}>
              {dialogConfig.cancelText}
            </Button>
          )}
          <Button
            variant={dialogConfig.variant === 'danger' ? 'danger' : 'primary'}
            autoFocus
            onClick={async () => {
              const onConfirm = dialogConfig.onConfirm;
              closeDialog();
              await onConfirm?.();
            }}
          >
            {dialogConfig.confirmText ?? 'OK'}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};

export default ExpenditureDashboard;
