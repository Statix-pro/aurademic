import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import './budgetdashboard.css';
import { Eye, Edit2, Plus, Trash2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { formatRowRanges, summarizeLineChanges } from '../../../shared/utils/logDiffUtils';

// --- Interfaces ---

interface DashboardLineItem {
  id: number;
  proposalId: number;
  budgetHead: string;
  subHead: string;
  proposedAmount: number;
  approvedAmount: number; // Actual sanctioned amount
  expenditure: number;
  createdAt: string;
}

interface ProposalGroup {
  proposalId: number;
  proposalRef: string;
  status: string; // "submitted", "hod_approved", "dof_approved", "principal_approved", "rejected", "returned"
  currentStage: 'hod' | 'dof' | 'principal' | 'completed';
  beneficiaryType: string;
  beneficiaryValue: string;
  approvalFlow: string;
  createdAt: string;
  requestDate?: string;
  budgetWindowType?: string;
  updatedAt: string;
  items: DashboardLineItem[];
  approvals: any[];
  edits: any[];
  userEmail?: string;
  applicantName?: string;
  budgetTag?: string;
  totalProposed: number;
  totalApproved: number;
  isApplicantOnly: boolean;
}

interface ConsolidatedRow {
  budgetHead: string;
  initial: number;
  additional: number;
  expenditure: number;
  balance: number;
}

interface LogEvent {
  key: string;
  title: string;
  subtitle?: string;
  actorLine?: string;
  actorIsAdmin?: boolean;
  actorBadgeLabel?: string;
  timestamp: number;
  dateLabel: string;
  decision?: string;
}

interface BeneficiaryScopeOption {
  key: string;
  label: string;
}

const BudgetDashboard: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [proposals, setProposals] = useState<ProposalGroup[]>([]);
  const [beneficiaryScope, setBeneficiaryScope] = useState('all');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resolveProposalTag = (proposal: ProposalGroup): string => {
    return String(proposal.budgetTag || '').trim();
  };

  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
  }>({
    show: false,
    message: '',
    type: 'info',
  });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = 'info',
    title?: string,
    showCancel = false,
    confirmText = 'OK',
    onConfirm?: () => void,
  ) => {
    setAlertConfig({ show: true, message, type, title, onConfirm, showCancel, confirmText });
  };

  const closeAlert = () => setAlertConfig((prev) => ({ ...prev, show: false }));

  const [showBudgetStatusDetail, setShowBudgetStatusDetail] = useState<{ [key: number]: boolean }>(
    {},
  );
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [logPopoverStyle, setLogPopoverStyle] = useState<React.CSSProperties>({});
  const infoTriggerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const formatFY = (fyStart: number) => `${fyStart}-${String(fyStart + 1).slice(2)}`;
  const INITIAL_WINDOW_MONTH = 1; // February (0-indexed)
  const INITIAL_WINDOW_DAY = 1;
  const [freezeCutoffDate, setFreezeCutoffDate] = useState<string>('');
  const [isFreezeActive, setIsFreezeActive] = useState<boolean>(false);

  // Business default for filter: from Feb 1, preselect next FY.
  const getDefaultFilterFY = () => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth(); // 0 = Jan, 1 = Feb
    const fyStart = monthIndex >= 1 ? year : year - 1;
    return formatFY(fyStart);
  };

  // Actual running FY (Apr-Mar). Keep this selectable through Mar 31.
  const getRunningFYStart = () => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth(); // Apr = 3
    return monthIndex >= 3 ? year : year - 1;
  };

  const [financialYear, setFinancialYear] = useState(getDefaultFilterFY());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fyOptions = useMemo(() => {
    const running = getRunningFYStart();
    const defaultStart = Number.parseInt(getDefaultFilterFY().split('-')[0], 10);
    const starts = Array.from(new Set([defaultStart, running, running - 1])).sort((a, b) => b - a);
    return starts.map((start) => {
      const value = formatFY(start);
      return { value, label: `FY ${value}` };
    });
  }, []);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveLogId(null);
      }
    };

    if (activeLogId !== null) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeLogId]);

  const parseDateSafe = (value?: string) => {
    if (!value) return null;
    const raw = String(value).trim();

    // Handle common DB/UI formats explicitly first:
    // - DD-MM-YYYY
    // - DD/MM/YYYY
    // - DD-MM-YYYY HH:mm[:ss]
    // - DD/MM/YYYY HH:mm[:ss]
    const dmyMatch = raw.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const yearRaw = Number(dmyMatch[3]);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      const hour = Number(dmyMatch[4] || 0);
      const minute = Number(dmyMatch[5] || 0);
      const second = Number(dmyMatch[6] || 0);
      const parsedDmy = new Date(year, month - 1, day, hour, minute, second, 0);
      if (!Number.isNaN(parsedDmy.getTime())) return parsedDmy;
    }

    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;

    const normalized = raw.replace(' ', 'T');
    const fallback = new Date(normalized);
    if (!Number.isNaN(fallback.getTime())) return fallback;
    return null;
  };

  const getDefaultCutoffDateForFY = (fy: string) => {
    const fyStart = Number.parseInt(String(fy || '').split('-')[0], 10);
    if (!Number.isInteger(fyStart)) return '';
    return `${fyStart}-02-01`;
  };

  useEffect(() => {
    const loadFreezeConfig = async () => {
      try {
        const fyStart = Number.parseInt(financialYear.split('-')[0], 10);
        const response: any = await authenticityUtility.get('/budget/freeze-config', {
          params: { fiscalYear: fyStart },
        });
        if (response?.success && response?.data?.cutoffDate) {
          setFreezeCutoffDate(String(response.data.cutoffDate));
          setIsFreezeActive(Boolean(response?.data?.isFrozen));
          return;
        }
      } catch (error) {
        console.error('Failed to fetch budget freeze config:', error);
      }

      setFreezeCutoffDate(getDefaultCutoffDateForFY(financialYear));
      setIsFreezeActive(false);
    };

    loadFreezeConfig();
  }, [financialYear]);

  const getInitialWindowCutoff = (fy: string) => {
    if (!isFreezeActive) return null;

    const fallback = (() => {
      const fyStart = Number.parseInt(String(fy || '').split('-')[0], 10);
      if (!Number.isInteger(fyStart)) return null;
      return new Date(fyStart, INITIAL_WINDOW_MONTH, INITIAL_WINDOW_DAY, 23, 59, 59, 999);
    })();

    const sourceDateRaw = String(freezeCutoffDate || getDefaultCutoffDateForFY(fy) || '').trim();
    const sourceDate = sourceDateRaw.includes('T') ? sourceDateRaw.split('T')[0] : sourceDateRaw;
    if (!sourceDate) return fallback;

    const parsed = new Date(`${sourceDate}T23:59:59.999`);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed;
  };

  const isInitialBudgetProposal = (proposal: ProposalGroup) => {
    const persistedWindowType = String(proposal.budgetWindowType || '')
      .trim()
      .toLowerCase();
    if (persistedWindowType === 'initial') return true;
    if (persistedWindowType === 'additional') return false;

    const proposalDate = parseDateSafe(proposal.requestDate || proposal.createdAt);
    const cutoff = getInitialWindowCutoff(financialYear);
    if (!proposalDate) return false;
    if (!cutoff) return true;
    const proposalDateOnly = new Date(
      proposalDate.getFullYear(),
      proposalDate.getMonth(),
      proposalDate.getDate(),
      23,
      59,
      59,
      999,
    );
    return proposalDateOnly.getTime() <= cutoff.getTime();
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeLogId === null || !popoverRef.current) return;
      const activeTrigger = infoTriggerRefs.current[activeLogId];
      if (!activeTrigger) return;

      if (
        !activeTrigger.contains(e.target as Node) &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setActiveLogId(null);
      }
    };

    if (activeLogId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeLogId]);

  const updatePopoverPosition = (proposalId: number) => {
    const trigger = infoTriggerRefs.current[proposalId];
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 10;
    const preferredWidth = 320;
    const estimatedHeight = popoverRef.current?.offsetHeight || 360;

    let left = rect.left;
    if (left + preferredWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - preferredWidth - viewportPadding;
    }
    if (left < viewportPadding) {
      left = viewportPadding;
    }

    let top = rect.bottom + 10;
    if (top + estimatedHeight > window.innerHeight - viewportPadding) {
      top = rect.top - estimatedHeight - 10;
    }
    if (top < viewportPadding) {
      top = viewportPadding;
    }

    setLogPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${preferredWidth}px`,
      zIndex: 1000,
    });
  };

  // When we open a popover, compute position
  const handleInfoClick = (proposalId: number) => {
    if (activeLogId === proposalId) {
      setActiveLogId(null);
    } else {
      setActiveLogId(proposalId);
      requestAnimationFrame(() => {
        updatePopoverPosition(proposalId);
      });
    }
  };

  useEffect(() => {
    if (activeLogId === null) return;
    const reflowPopover = () => updatePopoverPosition(activeLogId);
    window.addEventListener('resize', reflowPopover);
    window.addEventListener('scroll', reflowPopover, true);
    return () => {
      window.removeEventListener('resize', reflowPopover);
      window.removeEventListener('scroll', reflowPopover, true);
    };
  }, [activeLogId]);
  // --- Fetch Data ---
  // --- Fetch Data ---
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const fiscalYearNum = parseInt(financialYear.split('-')[0]);

      // Fetch specific page with limit
      const pageResult = (await authenticityUtility.get('/budget/my/full', {
        params: {
          fiscalYear: fiscalYearNum,
          page: currentPage,
          limit: pageSize,
          status: statusFilter === 'all' ? '' : statusFilter,
          q: searchTerm || undefined,
        },
      })) as any;

      if (!pageResult?.success || !Array.isArray(pageResult?.data)) {
        setProposals([]);
        return;
      }

      if (pageResult.pagination) {
        setPagination(pageResult.pagination);
      }

      const fullRows = pageResult.data;

      // 2. Process Proposals
      const parsedProposals: ProposalGroup[] = fullRows.map((data: any) => {
        const master = data.master || data;
        const lines = data.lines || [];

        // CHECK: Is this proposal FULLY approved?
        const isFullyApproved = ['principal_approved', 'completed'].includes(master.status);

        const items = lines.map((line: any) => {
          const unitAmount = Number(line.unit_amount ?? 0);
          const quantity = Number(line.quantity ?? 1);
          const proposedTotal =
            unitAmount > 0 && quantity > 0 ? unitAmount * quantity : Number(line.line_total ?? 0);

          const hasApprovedOverride =
            line.approved_unit_amount != null &&
            (Number(line.approved_unit_amount) !== Number(line.unit_amount) ||
              Number(line.approved_line_total) !== Number(line.line_total));
          const effectiveProposedTotal = hasApprovedOverride
            ? Number(line.approved_line_total)
            : proposedTotal;

          return {
            id: line.id,
            proposalId: master.id,
            budgetHead: line.budget_head || 'Unknown',
            subHead: line.sub_head || '-',
            proposedAmount: Number.isFinite(effectiveProposedTotal) ? effectiveProposedTotal : 0,
            // Show approved amount only after final approval, sourced from approved columns.
            approvedAmount: isFullyApproved
              ? parseFloat(line.approved_line_total ?? line.line_total ?? 0)
              : 0,
            expenditure: 0, // Placeholder for future integration
            createdAt: master.created_at,
          };
        });

        return {
          proposalId: master.id,
          proposalRef: master.proposal_ref,
          status: master.status,
          beneficiaryType: master.beneficiary_type,
          beneficiaryValue: master.beneficiary_value,
          currentStage: master.current_stage,
          approvalFlow: master.approval_flow,
          createdAt: master.created_at || master.created_date || '',
          requestDate: master.request_date || '',
          budgetWindowType: master.budget_window_type || '',
          updatedAt: master.updated_at || master.updated_date || '',
          items: items,
          approvals: Array.isArray(data.approvals)
            ? data.approvals
            : Array.isArray(data.pendingApprovals)
              ? data.pendingApprovals
              : [],
          edits: data.edits || [],
          userEmail: master.user_email || master.userEmail || '',
          applicantName: master.applicant_name || master.user_name || master.name || '',
          budgetTag: master.budget_tag || '',
          totalProposed: items.reduce((sum: number, i: any) => sum + i.proposedAmount, 0),
          totalApproved: items.reduce((sum: number, i: any) => sum + i.approvedAmount, 0),
          isApplicantOnly: Boolean(master.is_applicant_only),
        };
      });

      // Sort Chronologically (Oldest First)
      parsedProposals.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setProposals(parsedProposals);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setProposals([]);
      } else {
        console.error('Dashboard Error:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load dashboard.');
      }
    } finally {
      setLoading(false);
    }
  }, [financialYear, currentPage, pageSize, statusFilter, searchTerm]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [financialYear, searchTerm, statusFilter, pageSize]);

  // --- Helper Functions ---

  const formatINR = (n: number) => Number(n || 0).toLocaleString('en-IN');

  const normalizeText = (value?: string | null) => String(value || '').trim();
  const normalizeScopeKey = (value?: string | null) => normalizeText(value).toLowerCase();
  const normalizeEmail = (value?: string | null) => normalizeText(value).toLowerCase();

  const readActorEmail = (record: any, keys: string[]) => {
    for (const key of keys) {
      const value = normalizeEmail(record?.[key]);
      if (value) return value;
    }
    return '';
  };

  const getScopeFromProposal = (proposal: ProposalGroup) => {
    const type = normalizeText(proposal.beneficiaryType);
    const value = normalizeText(proposal.beneficiaryValue);

    const normalizedType = type.toLowerCase();
    if (
      normalizedType === 'faculty' ||
      normalizedType === 'staff' ||
      normalizedType === 'individual'
    ) {
      return value ? `person::${value}` : 'person::';
    }

    if (!type) {
      return value ? `person::${value}` : 'person::';
    }

    return value ? `${type}::${value}` : `${type}::`;
  };

  const formatScopeLabel = (scopeKey: string) => {
    if (scopeKey.startsWith('person::')) {
      const [, value = ''] = scopeKey.split('::');
      return value || 'Individual';
    }

    const [type = '', value = ''] = scopeKey.split('::');
    return value ? `${type} - ${value}` : type;
  };

  const isAdminRoleToken = (value?: string | null) => {
    const token = normalizeText(value).toLowerCase();
    return token === 'admin' || token === 'super_admin';
  };

  const getWorkflowBadgeLabel = (role?: string | null) => {
    const token = normalizeText(role).toLowerCase();
    if (['level1', 'hod', 'coordinator'].includes(token)) return 'HOD';
    if (token === 'dof') return 'DOF';
    if (['principal', 'admin', 'super_admin', 'superadmin'].includes(token)) return 'SUPERADMIN';
    return '';
  };

  const formatDateTime = (value?: string) => {
    const parsed = parseDateSafe(value);
    if (!parsed) return '-';
    return parsed.toLocaleString('en-IN');
  };

  const parseDateMs = (value?: string | null) => {
    const parsed = parseDateSafe(value || undefined);
    if (!parsed) return 0;
    const ms = parsed.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };

  const getRoleLabel = (role: string, proposal: ProposalGroup) => {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'level1') {
      const isEntity = ['club', 'cell', 'center', 'section', 'professional body'].includes(
        String(proposal.beneficiaryType || '')
          .toLowerCase()
          .trim(),
      );
      return isEntity ? 'Coordinator' : 'HoD';
    }
    const map: Record<string, string> = {
      hod: 'HoD',
      coordinator: 'Coordinator',
      headcfrd: 'CFRD',
      dof: 'DoF',
      principal: 'Principal',
    };
    return map[normalized] || (role ? role.toUpperCase() : 'Approver');
  };

  const buildLogEvents = (proposal: ProposalGroup): LogEvent[] => {
    const events: LogEvent[] = [];
    const createdAtMs = parseDateMs(proposal.createdAt);
    const updatedAtMs = parseDateMs(proposal.updatedAt);
    const submitterEmail = normalizeEmail(proposal.userEmail);
    const approvalLogs = Array.isArray(proposal.approvals) ? proposal.approvals : [];
    const hasApprovalUpdate = approvalLogs.some(
      (app: any) => String(app?.decision || app?.status || '').toLowerCase() === 'updated',
    );

    if (createdAtMs) {
      events.push({
        key: 'submitted',
        title: 'Submitted',
        subtitle: 'Proposal created',
        actorLine: `Submitted By: ${submitterEmail || '-'}`,
        timestamp: createdAtMs,
        dateLabel: formatDateTime(proposal.createdAt),
        decision: 'submitted',
      });
    }

    const editLogs = Array.isArray(proposal.edits) ? proposal.edits : [];
    if (editLogs.length > 0) {
      editLogs.forEach((edit: any, idx: number) => {
        const createdAt = edit.created_at || edit.createdAt || edit.created_at_formatted;
        const createdMs = parseDateMs(createdAt) || createdAtMs;
        const summary = normalizeText(edit.summary);
        let parsedDetails: any = null;
        if (edit.details) {
          try {
            parsedDetails =
              typeof edit.details === 'string' ? JSON.parse(edit.details) : edit.details;
          } catch {
            parsedDetails = null;
          }
        }
        const editorEmail = readActorEmail(edit, [
          'edited_by_email',
          'editedByEmail',
          'updated_by_email',
          'updatedByEmail',
          'user_email',
          'email',
        ]);
        const explicitlyAdmin =
          Boolean(edit.is_admin ?? edit.isAdmin ?? edit.updated_by_admin ?? edit.updatedByAdmin) ||
          isAdminRoleToken(edit.edited_by_role || edit.editedByRole || edit.role);
        const inferredAdmin = Boolean(
          editorEmail && submitterEmail && editorEmail !== submitterEmail,
        );
        const actorIsAdmin = explicitlyAdmin || inferredAdmin;
        const editorRole =
          normalizeText(edit.edited_by_role || edit.editedByRole || edit.role) ||
          normalizeText(parsedDetails?.editorRole);
        const actorBadgeLabel =
          getWorkflowBadgeLabel(editorRole) || (actorIsAdmin ? 'SUPERADMIN' : '');
        let rowSummary = '';
        let detailSummary = '';

        if (edit.details) {
          try {
            const parsed = parsedDetails;
            const lines = Array.isArray(parsed?.lines)
              ? parsed.lines
              : Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed?.lineChanges)
                  ? parsed.lineChanges
                  : [];
            const proposalChanges = Array.isArray(parsed?.proposalChanges)
              ? parsed.proposalChanges
              : [];
            if (lines.length > 0) {
              const numericRows = lines
                .map((line: any) =>
                  Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no),
                )
                .filter((lineNo: number) => Number.isInteger(lineNo) && lineNo > 0);
              const rowNumbers: number[] = Array.from(new Set<number>(numericRows)).sort(
                (a: number, b: number) => a - b,
              );

              if (rowNumbers.length > 0) {
                rowSummary = `Row No. ${formatRowRanges(rowNumbers)}`;
              }

              detailSummary = summarizeLineChanges(lines).compact;
            }
            if (proposalChanges.length > 0) {
              const proposalSummary = proposalChanges
                .map((change: any) => normalizeText(change))
                .filter(Boolean)
                .join('; ');
              detailSummary = [detailSummary, proposalSummary].filter(Boolean).join(' | ');
            }
          } catch {
            // ignore parse errors, keep summary fallback
          }
        }

        const subtitle = [rowSummary || summary, detailSummary].filter(Boolean).join(' | ');
        if (!subtitle) return;

        events.push({
          key: `edit-${edit.id || idx}`,
          title: 'Updated',
          subtitle,
          actorLine: `Updated By: ${editorEmail || '-'}`,
          actorIsAdmin,
          actorBadgeLabel,
          timestamp: createdMs,
          dateLabel: formatDateTime(createdAt || proposal.updatedAt || proposal.createdAt),
          decision: 'updated',
        });
      });
    }

    approvalLogs.forEach((app: any, idx: number) => {
      const feedback = normalizeText(app.feedback);
      if (feedback === 'Auto-approved after DoF clearance') {
        return;
      }
      const decision = String(app.decision || app.status || 'updated').toLowerCase();
      if (decision === 'updated') {
        if (editLogs.length > 0) return;
        if (!feedback || feedback.toLowerCase().includes('reviewed (no line change)')) return;
      }
      const approverEmail = readActorEmail(app, [
        'approver_email',
        'approverEmail',
        'updated_by_email',
        'updatedByEmail',
        'email',
      ]);
      const decidedAt = app.decided_at || app.decidedAt || app.decided_at_formatted;
      const decidedAtMs = parseDateMs(decidedAt);
      const feedbackNote =
        feedback && !feedback.startsWith('__archive_meta__:') ? `Note: ${feedback}` : '';
      const actorPrefix =
        decision === 'approved'
          ? 'Approved By'
          : `${decision.charAt(0).toUpperCase() + decision.slice(1)} By`;
      const subtitleParts = [`by ${getRoleLabel(app.role, proposal)}`, feedbackNote].filter(
        Boolean,
      );
      const actorIsAdmin =
        isAdminRoleToken(app.role) ||
        Boolean(app.is_admin ?? app.isAdmin ?? app.updated_by_admin ?? app.updatedByAdmin);
      const actorBadgeLabel = decision === 'updated' ? getWorkflowBadgeLabel(app.role) : '';

      events.push({
        key: `approval-${idx}`,
        title: decision.charAt(0).toUpperCase() + decision.slice(1),
        subtitle: subtitleParts.join(' | '),
        actorLine: `${actorPrefix}: ${approverEmail || '-'}`,
        actorIsAdmin,
        actorBadgeLabel,
        timestamp: decidedAtMs || createdAtMs,
        dateLabel: decidedAt ? formatDateTime(decidedAt) : '-',
        decision,
      });
    });

    const decisionOrder = (decision?: string) => {
      if (decision === 'submitted') return 0;
      if (decision === 'updated') return 1;
      return 2;
    };

    return [...events].sort((a, b) => {
      const leftTime = a.timestamp > 0 ? a.timestamp : Number.MAX_SAFE_INTEGER;
      const rightTime = b.timestamp > 0 ? b.timestamp : Number.MAX_SAFE_INTEGER;
      if (leftTime !== rightTime) return leftTime - rightTime;

      const leftDecision = decisionOrder(a.decision);
      const rightDecision = decisionOrder(b.decision);
      if (leftDecision !== rightDecision) return leftDecision - rightDecision;

      return String(a.key).localeCompare(String(b.key));
    });
  };

  const handleDelete = async (id: number) => {
    showAlert(
      'Are you sure you want to delete this proposal?',
      'warning',
      'Confirm Deletion',
      true,
      'Delete',
      async () => {
        closeAlert();
        try {
          const json = (await authenticityUtility.delete(`/budget/${id}`)) as any;
          if (json.success) {
            setProposals((prev) => prev.filter((p) => p.proposalId !== id));
          } else {
            showAlert(json.message || 'Failed to delete', 'error');
          }
        } catch (error: any) {
          console.error(error);
          showAlert(error.response?.data?.message || error.message || 'Failed to delete', 'error');
        }
      },
    );
  };

  // --- Filtering ---
  const scopeOptions = useMemo(() => {
    const dynamicScopes = proposals.map(getScopeFromProposal);
    const uniqueScopes = Array.from(new Set(dynamicScopes));
    return [
      { key: 'all', label: 'All Beneficiaries' },
      ...uniqueScopes.map((scopeKey) => ({
        key: scopeKey,
        label: formatScopeLabel(scopeKey),
      })),
    ] as BeneficiaryScopeOption[];
  }, [proposals]);

  useEffect(() => {
    const hasCurrentScope = scopeOptions.some((option) => option.key === beneficiaryScope);
    if (!hasCurrentScope) {
      setBeneficiaryScope('all');
    }
  }, [scopeOptions, beneficiaryScope]);

  const scopeFilteredProposals = useMemo(() => {
    const normalizedSelectedScope = normalizeScopeKey(beneficiaryScope);
    if (normalizedSelectedScope === 'all') {
      return proposals;
    }
    return proposals.filter((proposal) => {
      const proposalScope = normalizeScopeKey(getScopeFromProposal(proposal));
      return proposalScope === normalizedSelectedScope;
    });
  }, [proposals, beneficiaryScope]);

  const scopedConsolidatedData = useMemo(() => {
    const activeProposals = scopeFilteredProposals.filter((proposal) => {
      const status = String(proposal.status || '').toLowerCase();
      return (
        !status.includes('rejected') && !status.includes('returned') && !status.includes('archive')
      );
    });
    const consolidationMap: Record<string, ConsolidatedRow> = {};

    activeProposals.forEach((proposal) => {
      const isInitial = isInitialBudgetProposal(proposal);

      proposal.items.forEach((item) => {
        if (!consolidationMap[item.budgetHead]) {
          consolidationMap[item.budgetHead] = {
            budgetHead: item.budgetHead,
            initial: 0,
            additional: 0,
            expenditure: 0,
            balance: 0,
          };
        }

        const amount = Number(item.proposedAmount || 0);
        if (isInitial) {
          consolidationMap[item.budgetHead].initial += amount;
        } else {
          consolidationMap[item.budgetHead].additional += amount;
        }
      });
    });

    return Object.values(consolidationMap).map((row) => ({
      ...row,
      balance: row.initial + row.additional - row.expenditure,
    }));
  }, [scopeFilteredProposals]);

  // Filtered Consolidated Data
  const filteredConsolidated = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return scopedConsolidatedData;
    return scopedConsolidatedData.filter((d) =>
      String(d.budgetHead || '')
        .toLowerCase()
        .includes(q),
    );
  }, [scopedConsolidatedData, searchTerm]);

  const consolidatedTotals = useMemo(
    () =>
      filteredConsolidated.reduce(
        (acc, row) => ({
          initial: acc.initial + row.initial,
          additional: acc.additional + row.additional,
          expenditure: acc.expenditure + row.expenditure,
          balance: acc.balance + row.balance,
        }),
        { initial: 0, additional: 0, expenditure: 0, balance: 0 },
      ),
    [filteredConsolidated],
  );

  // Filtered Proposal List
  const filteredProposals = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return scopeFilteredProposals;

    return scopeFilteredProposals.filter((p) => {
      const nameMatch = String(p.applicantName || '')
        .toLowerCase()
        .includes(q);
      const refMatch = String(p.proposalRef || '')
        .toLowerCase()
        .includes(q);
      const lineMatch = p.items.some(
        (i) =>
          String(i.budgetHead || '')
            .toLowerCase()
            .includes(q) ||
          String(i.subHead || '')
            .toLowerCase()
            .includes(q),
      );
      return nameMatch || refMatch || lineMatch;
    });
  }, [scopeFilteredProposals, searchTerm]);

  // --- Timeline Logic ---
  const getTimelineState = (proposal: ProposalGroup, step: string) => {
    const { status, currentStage, approvalFlow } = proposal;

    // 1. Rejected
    if (status.includes('rejected')) {
      if (currentStage === step) return 'rejected';

      const stages = (approvalFlow || '').split('_');
      const currentIndex = stages.indexOf(currentStage);
      const stepIndex = stages.indexOf(step);
      if (stepIndex !== -1 && currentIndex !== -1 && stepIndex < currentIndex) return 'completed';
      return 'pending';
    }

    // 2. Fully Approved
    if (['principal_approved', 'completed'].includes(status)) return 'completed';

    // 3. In Progress Logic
    const stages = (approvalFlow || 'hod_dof_principal').split('_');
    const currentIndex = stages.indexOf(currentStage);
    const stepIndex = stages.indexOf(step);

    if (stepIndex === -1) return 'pending';
    if (currentIndex === -1 || stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const getCircleClass = (state: string) => {
    switch (state) {
      case 'completed':
        return 'budgetdashboard-status-circle-complete'; // Green
      case 'rejected':
        return 'budgetdashboard-status-circle-rejected'; // Red
      case 'current':
        return 'budgetdashboard-status-circle-pending'; // Yellow
      default:
        return 'budgetdashboard-status-circle-incomplete'; // Gray
    }
  };

  const getConnectorClass = (state: string) => {
    switch (state) {
      case 'completed':
        return 'complete';
      case 'rejected':
        return 'rejected';
      case 'current':
        return 'pending';
      default:
        return 'incomplete';
    }
  };

  return (
    <>
      <section className="budgetdashboard-page">
        <div className="budgetdashboard-container">
          <div className="budgetdashboard-card">
            {/* Header */}
            <div className="budgetdashboard-header">
              <div className="budgetdashboard-header-left">
                <h5 className="budgetdashboard-title">Consolidated Budget</h5>
              </div>
              <div className="budgetdashboard-header-right">
                <div className="budgetdashboard-header-search-group">
                  <input
                    type="text"
                    className="budgetdashboard-search"
                    placeholder="Search by name, budget head or reference id"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ marginRight: '10px' }}
                  />
                  <select
                    className="budgetdashboard-financial-year"
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                  >
                    {fyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="budgetdashboard-beneficiary-filter"
                    value={beneficiaryScope}
                    onChange={(e) => setBeneficiaryScope(e.target.value)}
                    aria-label="Beneficiary filter"
                  >
                    {scopeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="budgetdashboard-add-btn"
                  onClick={() => navigate('/budget/new', { state: { fiscalYear: financialYear } })}
                >
                  Add +
                </button>
              </div>
            </div>

            <div className="budgetdashboard-body">
              {loading && <div className="budgetdashboard-state">Loading...</div>}
              {error && (
                <div className="budgetdashboard-state" style={{ color: 'red' }}>
                  {error}
                </div>
              )}

              {/* 1. CONSOLIDATED TABLE (Approved Items Aggregated) */}
              {!loading && scopedConsolidatedData.length > 0 && (
                <div className="budgetdashboard-table-section">
                  <div className="budgetdashboard-table-wrapper">
                    <table className="budgetdashboard-table">
                      <thead>
                        <tr>
                          <th>S.No</th>
                          <th>Budget Head</th>
                          <th>Initial</th>
                          <th>Additional</th>
                          <th>Expenditure</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredConsolidated.map((row, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{row.budgetHead}</td>
                            <td>₹{formatINR(row.initial)}</td>
                            <td>₹{formatINR(row.additional)}</td>
                            <td>₹{formatINR(row.expenditure)}</td>
                            <td>₹{formatINR(row.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="budgetdashboard-total-row">
                          <td></td>
                          <td>
                            <strong>Total</strong>
                          </td>
                          <td>
                            <strong>₹{formatINR(consolidatedTotals.initial)}</strong>
                          </td>
                          <td>
                            <strong>₹{formatINR(consolidatedTotals.additional)}</strong>
                          </td>
                          <td>
                            <strong>₹{formatINR(consolidatedTotals.expenditure)}</strong>
                          </td>
                          <td>
                            <strong>₹{formatINR(consolidatedTotals.balance)}</strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. PROPOSAL LIST (Cards for Pending, Approved, etc.) */}
              {!loading &&
                (() => {
                  let initialBudgetCount = 0;
                  let additionalBudgetCount = 0;
                  return filteredProposals.map((proposal) => {
                    const isInitialBudget = isInitialBudgetProposal(proposal);
                    const label = isInitialBudget
                      ? `Initial Budget ${++initialBudgetCount}`
                      : `Additional Budget ${++additionalBudgetCount}`;
                    const displayTag = resolveProposalTag(proposal);
                    const isExpanded = showBudgetStatusDetail[proposal.proposalId] || false;

                    // Status Pill Text
                    let statusLabel = 'Submitted';
                    if (['principal_approved', 'completed'].includes(proposal.status))
                      statusLabel = 'Approved';
                    else if (proposal.status === 're_submitted') statusLabel = 'Resubmitted';
                    else if (proposal.status.includes('rejected')) statusLabel = 'Rejected';
                    else if (proposal.status.includes('returned')) statusLabel = 'Returned';
                    else if (proposal.status.includes('approved')) statusLabel = 'Pending'; // Intermediate approval is still Pending

                    // Timeline States
                    const hodState = getTimelineState(proposal, 'hod');
                    const dofState = getTimelineState(proposal, 'dof');
                    const principalState = getTimelineState(proposal, 'principal');

                    return (
                      <div key={proposal.proposalId} style={{ marginTop: '20px' }}>
                        {/* Card Header */}
                        <div className="budgetdashboard-proposal-header budgetdashboard-proposal-flat">
                          <div className="budgetdashboard-proposal-title-group">
                            <div className="budgetdashboard-proposal-left">{label}</div>
                            <div
                              className="budgetdashboard-info-trigger"
                              ref={(el) => {
                                infoTriggerRefs.current[proposal.proposalId] = el;
                              }}
                              onClick={() => handleInfoClick(proposal.proposalId)}
                            >
                              <Info size={20} color="#6b7280" style={{ cursor: 'pointer' }} />
                              {activeLogId === proposal.proposalId && (
                                <div
                                  className="budgetdashboard-log-popover"
                                  style={logPopoverStyle}
                                  ref={popoverRef}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="budgetdashboard-log-header">Submission Logs</div>
                                  <div className="budgetdashboard-log-body">
                                    {parseDateMs(proposal.updatedAt) >
                                      parseDateMs(proposal.createdAt) && (
                                      <div className="budgetdashboard-log-item">
                                        <span className="log-label">Last Edited:</span>
                                        <span className="log-value">
                                          {formatDateTime(proposal.updatedAt)}
                                        </span>
                                      </div>
                                    )}

                                    <div className="budgetdashboard-log-approvals">
                                      {buildLogEvents(proposal).map((event) => (
                                        <div
                                          key={event.key}
                                          className={`log-approval-item${event.actorBadgeLabel ? ' log-approval-item--admin' : ''}`}
                                        >
                                          {event.actorBadgeLabel && (
                                            <span
                                              className="log-admin-mark"
                                              title="Updated by Admin"
                                            >
                                              {`\u2605 ${event.actorBadgeLabel}`}
                                            </span>
                                          )}
                                          <div className="log-approval-meta">
                                            <span
                                              className={`log-decision log-decision--${
                                                event.decision || 'approved'
                                              }`}
                                            >
                                              {event.title.toUpperCase()}
                                            </span>
                                            <span className="log-role">
                                              {event.subtitle || 'Status update'}
                                            </span>
                                            {event.actorLine && (
                                              <span className="log-actor-line">
                                                {event.actorLine}
                                              </span>
                                            )}
                                            <span className="log-date">{event.dateLabel}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="budgetdashboard-proposal-applicant">
                              {proposal.applicantName || '-'}
                            </div>
                            {displayTag && (
                              <div className="budgetdashboard-proposal-tag-pill">{displayTag}</div>
                            )}
                          </div>

                          <div
                            className="budgetdashboard-actions-global"
                            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                className={`budgetdashboard-status-pill budgetdashboard-status-pill--${statusLabel.toLowerCase()}`}
                                onClick={() =>
                                  setShowBudgetStatusDetail((prev) => ({
                                    ...prev,
                                    [proposal.proposalId]: !prev[proposal.proposalId],
                                  }))
                                }
                              >
                                {statusLabel}
                              </div>

                              {/* Timeline (Only if Expanded) */}
                              {isExpanded && (
                                <div
                                  className="budgetdashboard-status-detail-line"
                                  style={{ marginTop: 0, padding: 0 }}
                                >
                                  {(proposal.approvalFlow || 'hod_dof_principal')
                                    .split('_')
                                    .map((stage, sIdx, array) => {
                                      const labelMap: Record<string, string> = {
                                        hod: 'HoD',
                                        headcfrd: 'CFRD',
                                        dof: 'DoF',
                                        principal: 'Principal',
                                      };
                                      const stageState = getTimelineState(proposal, stage);
                                      return (
                                        <React.Fragment key={stage}>
                                          <div
                                            className={`budgetdashboard-status-line-circle ${getCircleClass(stageState)}`}
                                            title={labelMap[stage] || stage.toUpperCase()}
                                          />
                                          {sIdx < array.length - 1 && (
                                            <div
                                              className={`budgetdashboard-status-line-connector ${getConnectorClass(stageState)}`}
                                            />
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                title="View"
                                className="budgetdashboard-action-global"
                                onClick={() => navigate(`/budget/${proposal.proposalId}`)}
                              >
                                <Eye size={16} />
                              </button>
                              {/* Edit only if submitted/returned AND not applicant-only */}
                              {!proposal.isApplicantOnly &&
                                [
                                  'submitted',
                                  're_submitted',
                                  'level1_returned',
                                  'hod_returned',
                                  'ithead_returned',
                                  'dof_returned',
                                  'principal_returned',
                                ].includes(proposal.status) && (
                                  <button
                                    title="Edit"
                                    className="budgetdashboard-action-global"
                                    onClick={() => navigate(`/budget/${proposal.proposalId}/edit`)}
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                )}
                              {/* Delete only if not fully approved AND not applicant-only */}
                              {['submitted', 'resubmitted'].includes(proposal.status) && (
                                <button
                                  title="Delete"
                                  className="budgetdashboard-action-global"
                                  onClick={() => handleDelete(proposal.proposalId)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Lines Table */}
                        <div className="budgetdashboard-table-section">
                          <div className="budgetdashboard-table-wrapper" style={{ margin: 0 }}>
                            <table
                              className="budgetdashboard-pending-table"
                              style={{ width: '100%' }}
                            >
                              <thead>
                                <tr>
                                  <th
                                    style={{
                                      fontSize: 'var(--font-size-secondary)',
                                      width: '50px',
                                    }}
                                  >
                                    S.No
                                  </th>
                                  <th
                                    style={{
                                      fontSize: 'var(--font-size-secondary)',
                                      width: '300px',
                                    }}
                                  >
                                    Budget Head
                                  </th>
                                  <th
                                    style={{
                                      fontSize: 'var(--font-size-secondary)',
                                      width: '300px',
                                    }}
                                  >
                                    Sub Head
                                  </th>
                                  <th
                                    style={{
                                      fontSize: 'var(--font-size-secondary)',
                                      width: '150px',
                                    }}
                                  >
                                    Proposed
                                  </th>
                                  <th
                                    style={{
                                      fontSize: 'var(--font-size-secondary)',
                                      width: '150px',
                                    }}
                                  >
                                    Approved
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {proposal.items.map((line, lIdx) => (
                                  <tr
                                    key={line.id}
                                    onClick={() => navigate(`/budget/${proposal.proposalId}`)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <td>{lIdx + 1}</td>
                                    <td>
                                      <div className="budgetdashboard-head-title">
                                        {line.budgetHead}
                                      </div>
                                    </td>
                                    <td>{line.subHead}</td>
                                    <td>₹{formatINR(line.proposedAmount)}</td>
                                    <td>₹{formatINR(line.approvedAmount)}</td>
                                    {/* 0 until fully approved */}
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="budgetdashboard-total-row">
                                  <td colSpan={3}>
                                    <strong>Total</strong>
                                  </td>
                                  <td>
                                    <strong>₹{formatINR(proposal.totalProposed)}</strong>
                                  </td>
                                  <td>
                                    <strong>₹{formatINR(proposal.totalApproved)}</strong>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

              {!loading && proposals.length === 0 && (
                <div className="budgetdashboard-state">
                  No budget proposals found for this fiscal year.
                </div>
              )}

              {!loading && pagination.pages > 1 && (
                <div
                  className="budgetdashboard-pagination"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '30px',
                    padding: '20px',
                    borderTop: '1px solid #e5e7eb',
                  }}
                >
                  <div className="budgetdashboard-pagination-left">
                    <span style={{ fontSize: 'var(--font-size-secondary)', color: '#6b7280' }}>
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} proposals
                    </span>
                  </div>
                  <div
                    className="budgetdashboard-pagination-right"
                    style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                  >
                    <button
                      className="budgetdashboard-pagebtn"
                      disabled={pagination.page <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{
                        height: 'var(--chip-height)',
                        padding: '0 14px',
                        fontSize: 'var(--font-size-secondary)',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: pagination.page <= 1 ? '#f3f4f6' : 'white',
                        color: pagination.page <= 1 ? '#9ca3af' : '#374151',
                        cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: 'var(--font-size-secondary)', fontWeight: 500 }}>
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                      className="budgetdashboard-pagebtn"
                      disabled={pagination.page >= pagination.pages}
                      onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                      style={{
                        height: 'var(--chip-height)',
                        padding: '0 14px',
                        fontSize: 'var(--font-size-secondary)',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: pagination.page >= pagination.pages ? '#f3f4f6' : 'white',
                        color: pagination.page >= pagination.pages ? '#9ca3af' : '#374151',
                        cursor: pagination.page >= pagination.pages ? 'not-allowed' : 'pointer',
                      }}
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

      <AlertModal
        show={alertConfig.show}
        onHide={closeAlert}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
      />
    </>
  );
};

export default BudgetDashboard;
