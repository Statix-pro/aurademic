import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./adminbudget.css";

import {
  Eye,
  Info,
  Edit2,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Briefcase,
  Clock,
  Archive,
  Trash2,
  CalendarDays,
  Lock,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import authenticityUtility from "../../../../shared/utils/authenticityUtility";
import { useAuth } from "../../../../contexts/AuthContext";
import { hasPermission, isSuperAdmin } from "../../../../shared/utils/permissionUtils";
import AlertModal, { type AlertType } from "../../../../shared/components/ui/AlertModal";

type ActionType = "return" | "reject" | null;
type QueueTabKey = "hod" | "coordinator" | "ithead" | "dof" | "principal" | "admin";

interface QueueTab {
  key: QueueTabKey;
  label: string;
  endpoint: string;
}

interface RbacAssignment {
  entity_id: number;
  entity_type: string;
  entity_name: string;
  role: string;
  permissions: string[];
}

interface BudgetRequestItem {
  id: number;
  proposal_ref: string;
  budget_tag?: string;
  has_approved_override?: number;
  applicant_name: string;
  faculty_name?: string;
  user_name?: string;
  user_email?: string;
  beneficiary_type: string;
  beneficiary_value?: string;
  department: string;
  total_amount: number;
  approved_total_amount?: number;
  status: string;
  current_stage: string;
  created_date: string;
  level1_route_type?: string | null;
}

interface BudgetHistoryEntry {
  role?: string;
  decision?: string;
  feedback?: string;
  decided_at_formatted?: string;
  decided_at?: string;
  approver_email?: string;
}

interface AdminLogEvent {
  key: string;
  title: string;
  subtitle: string;
  fullSubtitle?: string;
  actorLine: string;
  dateLabel: string;
  decision: string;
  timestamp: number;
  actorIsAdmin?: boolean;
  actorBadgeLabel?: string;
}

const BENEFICIARY_OPTIONS = [
  "All Beneficiary",
  "Faculty",
  "Department",
  "Centre",
  "Cell",
  "Club",
  "Professional Body",
  "Institution",
];

const ARCHIVE_TRANSITION_MS = 280;
const ADMIN_FETCH_PAGE_SIZE = 100;
const TAB_PRIORITY: QueueTabKey[] = ["hod", "coordinator", "ithead", "dof", "principal", "admin"];

const STAGE_PERMISSION_MAP: Record<string, string> = {
  level1: "budget.workflow.level1",
  ithead: "budget.workflow.ithead",
  dof: "budget.workflow.dof",
  principal: "budget.workflow.principal",
};

const STAGE_DISPLAY_MAP: Record<string, string> = {
  level1: "Level-1",
  ithead: "IT Head",
  dof: "DoF",
  principal: "Principal",
};

const ENTITY_BENEFICIARY_TYPES = ["Centre", "Cell", "Club", "Professional Body"];
const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50];

const getLevel1Label = (beneficiaryType: string, routeType?: string | null) => {
  if (String(routeType || "").toLowerCase() === "entity_contact") {
    return "Coordinator";
  }
  const type = (beneficiaryType || "").toLowerCase();
  const entityTypes = ENTITY_BENEFICIARY_TYPES.map((t) => t.toLowerCase());
  return entityTypes.includes(type) ? "Coordinator" : "HOD";
};

const getRoleLabel = (role: string) => {
  const map: Record<string, string> = {
    hod: "HoD",
    coordinator: "Coordinator",
    ithead: "IT Head",
    principal: "Principal",
    dof: "DoF",
    admin: "Admin",
    super_admin: "Super Admin",
  };
  return map[role.toLowerCase()] || role.charAt(0).toUpperCase() + role.slice(1);
};

const AdminBudget: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [data, setData] = useState<BudgetRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [kpiStats, setKpiStats] = useState({ total: 0, pending: 0, returned: 0, rejected: 0, approved: 0, archived: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 100, pages: 1 });

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [beneficiaryFilter, setBeneficiaryFilter] = useState("All Beneficiary");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [fiscalYear, setFiscalYear] = useState<number>(() => {
    const d = new Date();
    // FY starts in February (month 1). If month is 0 (January), it's the previous year.
    return d.getMonth() < 1 ? d.getFullYear() - 1 : d.getFullYear();
  });
  const [freezeDate, setFreezeDate] = useState<string>(() => `${new Date().getFullYear()}-02-01`);
  const [isTimeFrozen, setIsTimeFrozen] = useState<boolean>(false);
  const [freezeLoading, setFreezeLoading] = useState<boolean>(false);
  const [freezeSaving, setFreezeSaving] = useState<boolean>(false);
  const [freezePopupOpen, setFreezePopupOpen] = useState<boolean>(false);
  const freezePopoverRef = useRef<HTMLDivElement | null>(null);
  const fetchRequestSeqRef = useRef(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Queue/role handling
  const [assignments, setAssignments] = useState<RbacAssignment[]>([]);
  const [activeAssignmentIndex, setActiveAssignmentIndex] = useState<number>(0);
  const [activeQueueTabKey, setActiveQueueTabKey] = useState<QueueTabKey | null>(null);

  const currentActiveAssignment = useMemo<RbacAssignment | null>(() => {
    return assignments.length > 0 ? assignments[activeAssignmentIndex] : null;
  }, [assignments, activeAssignmentIndex]);

  const queueTabs = useMemo<QueueTab[]>(() => {
    const tabs: QueueTab[] = [];
    const superUser = isSuperAdmin(user);
    const hasLevel1Context =
      currentActiveAssignment?.permissions?.includes("budget.workflow.level1") ||
      hasPermission(user, "budget.workflow.level1");
    const isAcademicContext = currentActiveAssignment
      ? currentActiveAssignment.entity_type === "DEPARTMENT"
      : true;

    if (superUser || (hasLevel1Context && isAcademicContext)) {
      tabs.push({ key: "hod", label: "HOD", endpoint: "/adminbudget/hod" });
    }

    if (superUser || (hasLevel1Context && !isAcademicContext)) {
      tabs.push({ key: "coordinator", label: "Coordinator", endpoint: "/adminbudget/coordinator" });
    }

    if (superUser || hasPermission(user, "budget.workflow.ithead")) {
      tabs.push({ key: "ithead", label: "IT Head", endpoint: "/adminbudget/ithead" });
    }

    if (superUser || hasPermission(user, "budget.workflow.dof")) {
      tabs.push({ key: "dof", label: "DoF", endpoint: "/adminbudget/dof" });
    }

    if (superUser || hasPermission(user, "budget.workflow.principal")) {
      tabs.push({ key: "principal", label: "Principal", endpoint: "/adminbudget/principal" });
    }

    if (
      superUser ||
      hasPermission(user, "budget.admin.view") ||
      hasPermission(user, "budget.admin.manage")
    ) {
      tabs.push({ key: "admin", label: "All Proposals", endpoint: "/adminbudget/admin" });
    }

    return tabs;
  }, [user, currentActiveAssignment]);

  const activeQueueTab = useMemo(
    () => queueTabs.find((tab) => tab.key === activeQueueTabKey) || null,
    [queueTabs, activeQueueTabKey]
  );

  const fetchKpiStats = useCallback(async () => {
    if (!activeQueueTab) return;
    try {
      const response: any = await authenticityUtility.get("/adminbudget/kpi-stats", {
        params: {
          fiscalYear,
          scope: activeQueueTab.key,
          q: searchTerm || undefined,
          beneficiaryType: beneficiaryFilter === "All Beneficiary" ? undefined : beneficiaryFilter,
          departmentFilter: departmentFilter || undefined
        },
      });
      if (response?.success && response.data) {
        setKpiStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch KPI stats:", error);
    }
  }, [activeQueueTab, fiscalYear, searchTerm, beneficiaryFilter, departmentFilter]);

  // Action popups
  const [actionPopupOpen, setActionPopupOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionRef, setActionRef] = useState<string>("");
  const [actionComment, setActionComment] = useState<string>("");
  const [actionStage, setActionStage] = useState<string>("");

  // Super-admin delete
  const [deletePopupOpen, setDeletePopupOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteRef, setDeleteRef] = useState<string>("");
  const [deleteCountdown, setDeleteCountdown] = useState(10);
  const [logPopupOpen, setLogPopupOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logRef, setLogRef] = useState<string>("");
  const [logProposal, setLogProposal] = useState<any>(null);
  const [logEntries, setLogEntries] = useState<BudgetHistoryEntry[]>([]);
  const [logEdits, setLogEdits] = useState<any[]>([]);
  const [expandedLogDetails, setExpandedLogDetails] = useState<Record<string, boolean>>({});

  // Archive animation/state
  const [archivingIds, setArchivingIds] = useState<Set<number>>(new Set<number>());
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: React.ReactNode;
    type: AlertType;
    title?: string;
    onConfirm?: (() => void) | undefined;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
  }>({
    show: false,
    message: "",
    type: "info",
  });

  const showAlert = (
    message: React.ReactNode,
    type: AlertType = "info",
    title?: string,
    onConfirm?: () => void,
    showCancel = false,
    confirmText = "OK",
    cancelText = "Cancel"
  ) => {
    setAlertConfig({
      show: true,
      message,
      type,
      title,
      onConfirm: onConfirm
        ? () => {
          closeAlert();
          onConfirm();
        }
        : undefined,
      showCancel,
      confirmText,
      cancelText,
    });
  };

  const closeAlert = () => {
    setAlertConfig((prev) => ({ ...prev, show: false, onConfirm: undefined }));
  };

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const response: any = await authenticityUtility.get("/adminbudget/faculty");
        if (response?.success && Array.isArray(response?.data?.assignments)) {
          setAssignments(response.data.assignments);
          return;
        }
      } catch (error) {
        console.error("Failed to fetch assignments:", error);
      }
      setAssignments([]);
    };

    fetchAssignments();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response: any = await authenticityUtility.get("/adminbudget/departments", {
          params: {
            beneficiaryType: beneficiaryFilter === "All Beneficiary" ? undefined : beneficiaryFilter
          }
        });
        if (response?.success && Array.isArray(response?.data)) {
          setDepartmentsList(response.data);
        } else {
          setDepartmentsList([]);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    };

    fetchDepartments();
  }, [beneficiaryFilter]);

  useEffect(() => {
    if (!queueTabs.length) {
      setActiveQueueTabKey(null);
      return;
    }

    const activeStillExists =
      activeQueueTabKey !== null && queueTabs.some((tab) => tab.key === activeQueueTabKey);
    if (activeStillExists) return;

    const nextTab =
      TAB_PRIORITY.find((key) => queueTabs.some((tab) => tab.key === key)) || queueTabs[0].key;
    setActiveQueueTabKey(nextTab);
  }, [queueTabs, activeQueueTabKey]);

  const isApprovedForActiveTab = useCallback(
    (item: BudgetRequestItem) => {
      const s = (item.status || "").toLowerCase();

      const approvedStatusByTab: Record<QueueTabKey, string[]> = {
        // Stage-wise cumulative approved visibility:
        // HOD/Coordinator should still see records approved in downstream stages.
        hod: ["level1_approved", "hod_approved", "ithead_approved", "dof_approved", "principal_approved", "completed"],
        coordinator: ["level1_approved", "hod_approved", "ithead_approved", "dof_approved", "principal_approved", "completed"],
        ithead: ["ithead_approved", "dof_approved", "principal_approved", "completed"],
        dof: ["dof_approved", "principal_approved", "completed"],
        principal: ["principal_approved", "completed"],
        admin: ["principal_approved", "completed"],
      };

      const tabKey = activeQueueTabKey || "admin";
      const approvedStates = approvedStatusByTab[tabKey] || approvedStatusByTab.admin;

      return approvedStates.some((stateToken) =>
        stateToken === "completed" ? s === "completed" : s.startsWith(stateToken)
      );
    },
    [activeQueueTabKey]
  );

  const getStatusCategory = useCallback(
    (item: BudgetRequestItem) => {
      const s = (item.status || "").toLowerCase();
      if (s.includes("archived") || s.includes("archive")) return "archived";
      if (s.includes("returned")) return "returned";
      if (s.includes("rejected")) return "rejected";
      if (isApprovedForActiveTab(item)) return "approved";
      return "pending";
    },
    [isApprovedForActiveTab]
  );

  const canProcessStage = useCallback(
    (stage: string) => {
      if (isSuperAdmin(user)) return true;
      const permissionKey = STAGE_PERMISSION_MAP[(stage || "").toLowerCase()];
      if (!permissionKey) return false;
      return hasPermission(user, permissionKey);
    },
    [user]
  );

  const fetchDashboard = useCallback(async () => {
    if (!activeQueueTab) {
      setData([]);
      setAccessError("Insufficient permissions");
      return;
    }

    const requestSeq = ++fetchRequestSeqRef.current;

    try {
      setLoading(true);
      setAccessError("");

      const response: any = await authenticityUtility.get(activeQueueTab.endpoint, {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          status: statusFilter === "all" ? "" : statusFilter,
          fiscalYear,
          scope: activeQueueTab.key,
          q: searchTerm || undefined,
          beneficiaryType: beneficiaryFilter === "All Beneficiary" ? undefined : beneficiaryFilter,
          departmentFilter: departmentFilter || undefined
        },
      });

      if (!response?.success) {
        if (requestSeq !== fetchRequestSeqRef.current) return;
        setData([]);
        return;
      }

      if (requestSeq !== fetchRequestSeqRef.current) return;

      const rows = Array.isArray(response.data) ? response.data : [];
      const normalizedRows: BudgetRequestItem[] = rows.map((row: any) => ({
        ...row,
        applicant_name: String(
          row?.applicant_name || row?.faculty_name || row?.user_name || row?.user_email || ""
        ).trim(),
      }));

      setData(normalizedRows);

      if (response.pagination) {
        setPagination(response.pagination);
      }
    } catch (error: any) {
      if (requestSeq !== fetchRequestSeqRef.current) return;
      console.error("Fetch budget error:", error);
      setData([]);
      setAccessError(error?.response?.data?.message || "Failed to fetch budget requests");
    } finally {
      if (requestSeq !== fetchRequestSeqRef.current) return;
      setLoading(false);
    }
  }, [activeQueueTab, fiscalYear, currentPage, statusFilter, searchTerm, itemsPerPage, beneficiaryFilter, departmentFilter]);

  useEffect(() => {
    fetchDashboard();
    fetchKpiStats();
  }, [fetchDashboard, fetchKpiStats]);

  const refreshBudgetData = useCallback(async () => {
    await Promise.allSettled([fetchDashboard(), fetchKpiStats()]);
  }, [fetchDashboard, fetchKpiStats]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (deletePopupOpen && deleteCountdown > 0) {
      timer = setTimeout(() => setDeleteCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [deletePopupOpen, deleteCountdown]);

  useEffect(() => {
    if (!freezePopupOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!freezePopoverRef.current) return;
      if (freezePopoverRef.current.contains(event.target as Node)) return;
      setFreezePopupOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [freezePopupOpen]);

  const openActionPopup = (type: "return" | "reject", id: number, ref: string, stage: string) => {
    if (!canProcessStage(stage)) {
      showAlert("You do not have permission to process this stage.", "warning");
      return;
    }
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

  const onApprove = async (itemId?: number, stage?: string) => {
    if (!itemId) {
      showAlert("Missing budget id.", "warning");
      return;
    }

    if (!stage || !canProcessStage(stage)) {
      showAlert("You do not have permission to approve this stage.", "warning");
      return;
    }
    showAlert(
      "Are you sure you want to approve this budget?",
      "warning",
      "Confirm Approval",
      async () => {
        try {
          const response: any = await authenticityUtility.patch(`/adminbudget/${itemId}/approval`, {
            decision: "approved",
          });

          if (response?.success || response?.data?.success) {
            await refreshBudgetData();
            return;
          }
          showAlert(response?.message || "Failed to approve", "error");
        } catch (error: any) {
          showAlert(error.response?.data?.message || "Failed to approve", "error");
        }
      },
      true,
      "Approve"
    );
  };

  const onArchiveToggle = (item: BudgetRequestItem) => {
    const id = Number(item.id);
    const isArchived = ["archived", "archive"].some((token) =>
      (item.status || "").toLowerCase().includes(token)
    );
    const confirmMessage = isArchived
      ? "Are you sure you want to unarchive this budget?"
      : "Are you sure you want to archive this budget?";
    showAlert(
      confirmMessage,
      "warning",
      isArchived ? "Confirm Unarchive" : "Confirm Archive",
      async () => {
        if (archivingIds.has(id)) return;

        setArchivingIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });

        try {
          const response: any = await authenticityUtility.patch(`/adminbudget/${id}/archive-toggle`, {});

          if (response?.success || response?.data?.success) {
            await refreshBudgetData();
          } else {
            setArchivingIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            showAlert(
              response?.message || response?.data?.message || "Failed to update archive state",
              "error"
            );
            return;
          }
        } catch (error: any) {
          setArchivingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          showAlert(error.response?.data?.message || "Failed to update archive state", "error");
          return;
        }

        window.setTimeout(() => {
          setArchivingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          refreshBudgetData();
        }, ARCHIVE_TRANSITION_MS);
      },
      true,
      isArchived ? "Unarchive" : "Archive"
    );
  };

  const submitActionWithComment = async () => {
    if (!actionType || !actionId) return;

    if (!canProcessStage(actionStage)) {
      showAlert("You do not have permission to process this stage.", "warning");
      return;
    }

    const comment = actionComment.trim();
    if (!comment) {
      showAlert("Please enter comments.", "warning");
      return;
    }

    try {
      const response: any = await authenticityUtility.patch(`/adminbudget/${actionId}/approval`, {
        decision: actionType === "return" ? "returned" : "rejected",
        feedback: comment,
      });

      if (response?.success || response?.data?.success) {
        showAlert(`${actionType === "return" ? "Returned" : "Rejected"} successfully`, "success");
        closeActionPopup();
        await refreshBudgetData();
        return;
      }
      showAlert(
        response?.message || response?.data?.message || `Failed to ${actionType}`,
        "error"
      );
    } catch (error: any) {
      showAlert(error.response?.data?.message || `Failed to ${actionType}`, "error");
    }
  };

  const openDeletePopup = (id: number, ref: string) => {
    setDeleteId(id);
    setDeleteRef(ref);
    setDeleteCountdown(10);
    setDeletePopupOpen(true);
  };

  const closeDeletePopup = () => {
    setDeletePopupOpen(false);
    setDeleteId(null);
    setDeleteRef("");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const response: any = await authenticityUtility.delete(`/adminbudget/${deleteId}`);
      if (response?.success || response?.data?.success) {
        showAlert("Budget proposal deleted successfully", "success");
        closeDeletePopup();
        await refreshBudgetData();
        return;
      }
      showAlert(
        response?.message || response?.data?.message || "Failed to delete budget proposal",
        "error"
      );
    } catch (error: any) {
      showAlert(error.response?.data?.message || "Failed to delete budget proposal", "error");
    }
  };

  const filteredBeneficiaryOptions = useMemo(() => {
    if (activeQueueTabKey === "hod") {
      return BENEFICIARY_OPTIONS.filter((opt) =>
        ["All Beneficiary", "Faculty", "Department"].includes(opt)
      );
    }
    if (activeQueueTabKey === "coordinator") {
      return BENEFICIARY_OPTIONS.filter((opt) =>
        ["All Beneficiary", "Centre", "Cell", "Club", "Professional Body"].includes(opt)
      );
    }
    return BENEFICIARY_OPTIONS;
  }, [activeQueueTabKey]);

  const baseFilteredData = useMemo(() => {
    let results = [...data];
    if (beneficiaryFilter !== "All Beneficiary") {
      results = results.filter((item) => item.beneficiary_type === beneficiaryFilter);
    }
    return results;
  }, [data, beneficiaryFilter]);

  const stats = useMemo(() => {
    return kpiStats;
  }, [kpiStats]);

  const [localStatsFilter, setLocalStatsFilter] = useState<string>("pending");

  const handleStatsFilter = useCallback((filter: string) => {
    setLocalStatsFilter(filter);
    setStatusFilter(filter === "total" ? "all" : filter);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setLocalStatsFilter(statusFilter === "all" ? "total" : statusFilter);
  }, [statusFilter]);

  const currentItems = baseFilteredData;
  const totalItemsCount = pagination.total;
  const totalPagesCount = pagination.pages;
  const safeCurrentPage = pagination.page;

  const statusClass = (item: BudgetRequestItem) => {
    const category = getStatusCategory(item);
    if (category === "approved") return "adminbudget-status adminbudget-status--approved";
    if (category === "rejected") return "adminbudget-status adminbudget-status--rejected";
    if (category === "archived") return "adminbudget-status adminbudget-status--archived";
    return "adminbudget-status adminbudget-status--pending";
  };

  const getDisplayStatus = (item: BudgetRequestItem) => {
    const s = (item.status || "").toLowerCase();
    if (s === "re_submitted") return "Resubmitted";
    if (getStatusCategory(item) === "approved") return "Approved";
    if (s.includes("archived") || s.includes("archive")) return "Archived";
    if (s.includes("rejected")) return "Reject";
    if (s.includes("returned") || s.includes("return")) return "Return";

    const stageKey = (item.current_stage || "").toLowerCase();
    let stageLabel = STAGE_DISPLAY_MAP[stageKey] || (item.current_stage ? item.current_stage.toUpperCase() : "");
    if (stageKey === "level1") {
      stageLabel = getLevel1Label(item.beneficiary_type, item.level1_route_type);
    }
    return "Pending " + stageLabel;
  };

  const isHodBudgetView = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toLowerCase()) : [];
    const permissions = Array.isArray(user?.permissions)
      ? user.permissions.map((permission) => String(permission).toLowerCase())
      : [];

    return roles.includes("hod") || permissions.includes("budget.workflow.level1");
  }, [user]);

  const isDofLogin = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toLowerCase()) : [];
    const permissions = Array.isArray(user?.permissions)
      ? user.permissions.map((permission) => String(permission).toLowerCase())
      : [];
    return roles.includes("dof") || permissions.includes("budget.workflow.dof");
  }, [user]);

  const isSuperAdminLogin = useMemo(() => isSuperAdmin(user), [user]);
  const showFreezeControls = isDofLogin || isSuperAdminLogin;
  const isTodayFebFirst = useMemo(() => {
    const today = new Date();
    return today.getMonth() === 1 && today.getDate() === 1;
  }, []);
  const canEditFreezeConfig = isSuperAdminLogin || (isDofLogin && !isTimeFrozen && isTodayFebFirst);
  const canFreezeNow = isSuperAdminLogin || (isDofLogin && !isTimeFrozen && isTodayFebFirst);
  const dofFreezeAllowedDateText = useMemo(() => `February 1, ${fiscalYear}`, [fiscalYear]);

  const getDefaultFreezeDate = useCallback((fy: number) => `${fy}-02-01`, []);

  useEffect(() => {
    const fetchFreezeConfig = async () => {
      try {
        setFreezeLoading(true);
        const response: any = await authenticityUtility.get("/adminbudget/freeze-config", {
          params: { fiscalYear },
        });

        if (response?.success && response?.data) {
          setFreezeDate(response.data.cutoffDate || getDefaultFreezeDate(fiscalYear));
          setIsTimeFrozen(Boolean(response.data.isFrozen));
        } else {
          setFreezeDate(getDefaultFreezeDate(fiscalYear));
          setIsTimeFrozen(false);
        }
      } catch (error) {
        console.error("Failed to fetch freeze config:", error);
        setFreezeDate(getDefaultFreezeDate(fiscalYear));
        setIsTimeFrozen(false);
      } finally {
        setFreezeLoading(false);
      }
    };

    fetchFreezeConfig();
  }, [fiscalYear, getDefaultFreezeDate]);

  const onFreezeTime = async () => {
    if (!canFreezeNow) {
      if (isDofLogin && !isSuperAdminLogin && isTimeFrozen) {
        showAlert("Freeze already applied for this fiscal year. Only Super Admin can edit it now.", "warning");
        return;
      }
      if (isDofLogin && !isSuperAdminLogin && !isTodayFebFirst) {
        showAlert(`DoF freeze can be applied only on ${dofFreezeAllowedDateText}.`, "warning");
        return;
      }
      showAlert("Only Super Admin can edit freeze configuration right now.", "warning");
      return;
    }

    const selectedFreezeDate = freezeDate;

    if (!selectedFreezeDate) {
      showAlert("Please select a freeze date.", "warning");
      return;
    }

    try {
      setFreezeSaving(true);
      const response: any = await authenticityUtility.put("/adminbudget/freeze-config", {
        fiscalYear,
        cutoffDate: selectedFreezeDate,
        isFrozen: true,
      });

      if (response?.success) {
        setFreezeDate(response?.data?.cutoffDate || selectedFreezeDate);
        setIsTimeFrozen(true);
        setFreezePopupOpen(false);
      } else {
        showAlert(response?.message || "Failed to freeze budget time.", "error");
      }
    } catch (error: any) {
      showAlert(error?.response?.data?.message || "Failed to freeze budget time.", "error");
    } finally {
      setFreezeSaving(false);
    }
  };

  const activeAdminBudgetTab = useMemo<"dashboard" | "approval">(() => {
    if (location.pathname.endsWith("/dashboard")) return "dashboard";
    return "approval";
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/adminbudget") {
      navigate("/admin/budget", { replace: true });
    }
  }, [location.pathname, navigate]);

  const openLogPopup = async (item: BudgetRequestItem) => {
    setLogPopupOpen(true);
    setLogLoading(true);
    setLogRef(item.proposal_ref || "");
    setLogProposal(null);
    setLogEntries([]);
    setLogEdits([]);
    setExpandedLogDetails({});

    try {
      const response: any = await authenticityUtility.get(`/adminbudget/${item.id}`);
      const proposal = response?.data?.master || response?.data || null;
      const entries = Array.isArray(response?.data?.approvals)
        ? response.data.approvals
        : Array.isArray(response?.data?.pendingApprovals)
          ? response.data.pendingApprovals
          : [];
      const edits = Array.isArray(response?.data?.edits) ? response.data.edits : [];
      setLogProposal(proposal);
      setLogEntries(entries);
      setLogEdits(edits);
    } catch (error: any) {
      showAlert(error?.response?.data?.message || "Failed to fetch proposal logs", "error");
      setLogPopupOpen(false);
    } finally {
      setLogLoading(false);
    }
  };

  const closeLogPopup = () => {
    setLogPopupOpen(false);
    setLogProposal(null);
    setLogEntries([]);
    setLogEdits([]);
    setExpandedLogDetails({});
    setLogRef("");
  };

  const formatFreezeDate = (value?: string) => {
    if (!value) return "--";
    const raw = String(value).trim();

    const ymdMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      return `${day}-${month}-${year}`;
    }

    const parsedMs = parseDateMsForLog(raw);
    if (!parsedMs) return raw;
    const parsed = new Date(parsedMs);
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = String(parsed.getFullYear());
    return `${day}-${month}-${year}`;
  };

  const normalizeTextForLog = (value?: string | null) => String(value || "").trim();
  const normalizeEmailForLog = (value?: string | null) => normalizeTextForLog(value).toLowerCase();

  const normalizeDateTimeForLog = (value?: string | null) => {
    const raw = normalizeTextForLog(value);
    if (!raw) return "";

    return raw;
  };

  const parseDateMsForLog = (value?: string | null) => {
    const raw = normalizeDateTimeForLog(value);
    if (!raw) return 0;

    const dmyMatch = raw.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const yearRaw = Number(dmyMatch[3]);
      const year = yearRaw < 100 ? (2000 + yearRaw) : yearRaw;
      const hour = Number(dmyMatch[4] || 0);
      const minute = Number(dmyMatch[5] || 0);
      const second = Number(dmyMatch[6] || 0);
      const parsedDmy = new Date(year, month - 1, day, hour, minute, second, 0);
      const parsedDmyMs = parsedDmy.getTime();
      return Number.isNaN(parsedDmyMs) ? 0 : parsedDmyMs;
    }

    const ymdNoTzMatch = raw.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (ymdNoTzMatch && !/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
      const year = Number(ymdNoTzMatch[1]);
      const month = Number(ymdNoTzMatch[2]);
      const day = Number(ymdNoTzMatch[3]);
      const hour = Number(ymdNoTzMatch[4] || 0);
      const minute = Number(ymdNoTzMatch[5] || 0);
      const second = Number(ymdNoTzMatch[6] || 0);
      const parsedLocal = new Date(year, month - 1, day, hour, minute, second, 0);
      const parsedLocalMs = parsedLocal.getTime();
      if (!Number.isNaN(parsedLocalMs)) return parsedLocalMs;
    }

    const direct = new Date(raw);
    const directMs = direct.getTime();
    if (!Number.isNaN(directMs)) return directMs;

    const fallback = new Date(raw.replace(" ", "T"));
    const fallbackMs = fallback.getTime();
    return Number.isNaN(fallbackMs) ? 0 : fallbackMs;
  };

  const formatDateTimeForLog = (value?: string) => {
    const ms = parseDateMsForLog(value);
    if (!ms) return "-";
    return new Date(ms).toLocaleString("en-IN");
  };

  const readActorEmail = (record: any, keys: string[]) => {
    for (const key of keys) {
      const value = normalizeEmailForLog(record?.[key]);
      if (value) return value;
    }
    return "";
  };

  const isAdminRoleToken = (value?: string | null) => {
    const token = normalizeTextForLog(value).toLowerCase();
    return token === "admin" || token === "super_admin";
  };

  const getWorkflowBadgeLabel = (role?: string | null) => {
    const token = normalizeTextForLog(role).toLowerCase();
    if (["level1", "hod", "coordinator"].includes(token)) return "HOD";
    if (token === "dof") return "DOF";
    if (["principal", "admin", "super_admin", "superadmin"].includes(token)) return "SUPERADMIN";
    return "";
  };

  const getRoleLabelForLog = (role?: string) => {
    const normalized = String(role || "").toLowerCase();
    if (normalized === "level1") {
      return getLevel1Label(logProposal?.beneficiary_type || "", logProposal?.level1_route_type) === "Coordinator"
        ? "Coordinator"
        : "HoD";
    }
    const map: Record<string, string> = {
      hod: "HoD",
      coordinator: "Coordinator",
      dof: "DoF",
      principal: "Principal",
      admin: "Admin",
      super_admin: "Super Admin",
    };
    return map[normalized] || (role ? role.toUpperCase() : "Approver");
  };

  const formatRowRangesForLog = (rows: number[]) => {
    if (!rows.length) return "";
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
    return ranges.join(", ");
  };

  const summarizeLineChangesForLog = (lines: any[]) => {
    const normalizedLines = Array.isArray(lines) ? lines : [];
    let added = 0;
    let removed = 0;
    let updated = 0;
    const detailLinesPreview: string[] = [];
    const detailLinesFull: string[] = [];

    normalizedLines.forEach((line: any, lineIdx: number) => {
      const lineNo = Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no) || (lineIdx + 1);
      const rawChanges = line?.changes;
      const changeList = Array.isArray(rawChanges)
        ? rawChanges.map((change: any) => normalizeTextForLog(change)).filter(Boolean)
        : normalizeTextForLog(rawChanges)
          ? [normalizeTextForLog(rawChanges)]
          : [];

      const lowered = changeList.map((change: string) => change.toLowerCase());
      const isOnlyAdded = changeList.length === 1 && lowered[0] === "line added";
      const isOnlyRemoved = changeList.length === 1 && lowered[0] === "line removed";
      const lineDetails = `Line ${lineNo}: ${changeList.join("; ") || "Updated"}`;
      detailLinesFull.push(lineDetails);

      if (isOnlyAdded) added += 1;
      else if (isOnlyRemoved) removed += 1;
      else updated += 1;

      if (detailLinesPreview.length < 4 && !isOnlyAdded && !isOnlyRemoved) {
        detailLinesPreview.push(lineDetails);
      }
    });

    const summaryParts: string[] = [];
    if (added > 0) summaryParts.push(`${added} line(s) added`);
    if (removed > 0) summaryParts.push(`${removed} line(s) removed`);
    if (updated > 0) summaryParts.push(`${updated} line(s) updated`);

    const summary = summaryParts.join(", ");
    const compactDetails = detailLinesPreview.join(" | ");
    const fullDetails = detailLinesFull.join(" | ");
    return {
      compact: [summary, compactDetails].filter(Boolean).join(" | "),
      full: [summary, fullDetails].filter(Boolean).join(" | "),
    };
  };

  const buildAdminLogEvents = useMemo<AdminLogEvent[]>(() => {
    const events: AdminLogEvent[] = [];
    const createdAt =
      logProposal?.created_at || logProposal?.createdAt || logProposal?.created_date;
    const updatedAt =
      logProposal?.updated_at || logProposal?.updatedAt || logProposal?.updated_date;
    const createdAtMs = parseDateMsForLog(createdAt);
    const updatedAtMs = parseDateMsForLog(updatedAt);
    const submitterEmail = normalizeEmailForLog(logProposal?.user_email || logProposal?.userEmail);
    const approvalLogs = Array.isArray(logEntries) ? logEntries : [];
    const hasApprovalUpdate = approvalLogs.some(
      (app: any) => String(app?.decision || app?.status || "").toLowerCase() === "updated"
    );

    if (createdAtMs) {
      events.push({
        key: "submitted",
        title: "Submitted",
        subtitle: "Proposal created",
        actorLine: `Submitted By: ${submitterEmail || "-"}`,
        timestamp: createdAtMs,
        dateLabel: formatDateTimeForLog(createdAt),
        decision: "submitted",
      });
    }

    const editLogs = Array.isArray(logEdits) ? logEdits : [];
    if (editLogs.length > 0) {
      editLogs.forEach((edit: any, idx: number) => {
        const editCreatedAt = edit.created_at || edit.createdAt || edit.created_at_formatted;
        const editCreatedMs = parseDateMsForLog(editCreatedAt) || createdAtMs;
        const summary = normalizeTextForLog(edit.summary);
        let parsedDetails: any = null;

        if (edit.details) {
          try {
            parsedDetails = typeof edit.details === "string" ? JSON.parse(edit.details) : edit.details;
          } catch {
            parsedDetails = null;
          }
        }

        const editorEmail = readActorEmail(edit, [
          "edited_by_email",
          "editedByEmail",
          "updated_by_email",
          "updatedByEmail",
          "user_email",
          "email",
        ]);
        const explicitlyAdmin =
          Boolean(edit.is_admin ?? edit.isAdmin ?? edit.updated_by_admin ?? edit.updatedByAdmin) ||
          isAdminRoleToken(edit.edited_by_role || edit.editedByRole || edit.role);
        const inferredAdmin = Boolean(editorEmail && submitterEmail && editorEmail !== submitterEmail);
        const actorIsAdmin = explicitlyAdmin || inferredAdmin;
        const editorRole =
          normalizeTextForLog(edit.edited_by_role || edit.editedByRole || edit.role) ||
          normalizeTextForLog(parsedDetails?.editorRole);
        const actorBadgeLabel = getWorkflowBadgeLabel(editorRole) || (actorIsAdmin ? "SUPERADMIN" : "");
        let rowSummary = "";
        let detailSummary = "";
        let fullDetailSummary = "";

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
                .map((line: any) => Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no))
                .filter((lineNo: number) => Number.isInteger(lineNo) && lineNo > 0);
              const rowNumbers = Array.from(new Set<number>(numericRows)).sort((a, b) => a - b);

              if (rowNumbers.length > 0) {
                rowSummary = `Row No. ${formatRowRangesForLog(rowNumbers)}`;
              }

              const lineSummaries = summarizeLineChangesForLog(lines);
              detailSummary = lineSummaries.compact;
              fullDetailSummary = lineSummaries.full;
            }
            if (proposalChanges.length > 0) {
              const proposalSummary = proposalChanges
                .map((change: any) => normalizeTextForLog(change))
                .filter(Boolean)
                .join("; ");
              detailSummary = [detailSummary, proposalSummary].filter(Boolean).join(" | ");
              fullDetailSummary = [fullDetailSummary, proposalSummary].filter(Boolean).join(" | ");
            }
          } catch {
            // Keep summary fallback if details parse fails.
          }
        }

        const subtitle = [rowSummary || summary, detailSummary].filter(Boolean).join(" | ");
        const fullSubtitle = [rowSummary || summary, fullDetailSummary || detailSummary].filter(Boolean).join(" | ");
        if (!subtitle) return;

        events.push({
          key: `edit-${edit.id || idx}`,
          title: "Updated",
          subtitle,
          fullSubtitle,
          actorLine: `Updated By: ${editorEmail || "-"}`,
          actorIsAdmin,
          actorBadgeLabel,
          timestamp: editCreatedMs,
          dateLabel: formatDateTimeForLog(editCreatedAt || updatedAt || createdAt),
          decision: "updated",
        });
      });
    }

    approvalLogs.forEach((app: any, idx: number) => {
      const feedback = normalizeTextForLog(app.feedback);
      if (feedback === "__archive_meta__:") return;
      if (feedback === "Auto-approved after DoF clearance") return;

      const decision = String(app.decision || app.status || "updated").toLowerCase();
      if (decision === "updated") {
        if (editLogs.length > 0) return;
        if (!feedback || feedback.toLowerCase().includes("reviewed (no line change)")) return;
      }
      const approverEmail = readActorEmail(app, [
        "approver_email",
        "approverEmail",
        "updated_by_email",
        "updatedByEmail",
        "email",
      ]);
      const decidedAt = app.decided_at || app.decidedAt || app.decided_at_formatted;
      const decidedAtMs = parseDateMsForLog(decidedAt);
      const feedbackNote = feedback && !feedback.startsWith("__archive_meta__:")
        ? `Note: ${feedback}`
        : "";
      const actorPrefix =
        decision === "approved"
          ? "Approved By"
          : `${decision.charAt(0).toUpperCase() + decision.slice(1)} By`;
      const subtitleParts = [
        `by ${getRoleLabelForLog(app.role)}`,
        feedbackNote,
      ].filter(Boolean);
      const actorIsAdmin =
        isAdminRoleToken(app.role) ||
        Boolean(app.is_admin ?? app.isAdmin ?? app.updated_by_admin ?? app.updatedByAdmin);
      const actorBadgeLabel = decision === "updated" ? getWorkflowBadgeLabel(app.role) : "";

      events.push({
        key: `approval-${idx}`,
        title: decision.charAt(0).toUpperCase() + decision.slice(1),
        subtitle: subtitleParts.join(" | "),
        actorLine: `${actorPrefix}: ${approverEmail || "-"}`,
        actorIsAdmin,
        actorBadgeLabel,
        timestamp: decidedAtMs || createdAtMs,
        dateLabel: decidedAt ? formatDateTimeForLog(decidedAt) : "-",
        decision,
      });
    });

    const decisionOrder = (decision?: string) => {
      if (decision === "submitted") return 0;
      if (decision === "updated") return 1;
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
  }, [logEntries, logEdits, logProposal]);

  return (
    <>


      <section className="adminbudget-page">
        <div className="adminbudget-container">
          <div className="adminbudget-card">
            {(activeAdminBudgetTab !== "dashboard" || !isHodBudgetView) && (
              <>
                <div className="adminbudget-header">
                  <h5 className="adminbudget-title">Budget Requests</h5>

                  {queueTabs.length > 0 && (
                    <div className="adminbudget-role-tabs" role="tablist" aria-label="Budget queues">
                      {queueTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          className={`adminbudget-role-tab ${activeQueueTabKey === tab.key ? "active" : ""}`}
                          onClick={() => setActiveQueueTabKey(tab.key)}
                          role="tab"
                          aria-selected={activeQueueTabKey === tab.key}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="adminbudget-header-actions">
                    {showFreezeControls && (
                      <div className="adminbudget-freeze-popover-wrap" ref={freezePopoverRef}>
                        <button
                          type="button"
                          className={`adminbudget-freeze-trigger ${isTimeFrozen ? "is-frozen" : ""}`}
                          onClick={() => setFreezePopupOpen((prev) => !prev)}
                          title="Freeze Budget Time"
                          aria-label="Freeze Budget Time"
                        >
                          <Lock size={18} />
                        </button>

                        {freezePopupOpen && (
                          <div className="adminbudget-freeze-popover-card">
                            <div className="adminbudget-freeze-popover-title">Freeze Budget Time</div>
                            <div className="adminbudget-freeze-popover-meta">
                              <div className="adminbudget-freeze-popover-subtitle">
                                FY {fiscalYear}-{String(fiscalYear + 1).slice(2)}
                              </div>
                              <div className="adminbudget-freeze-popover-date">
                                {formatFreezeDate(freezeDate)}
                              </div>
                            </div>

                            <label className="adminbudget-freeze-popover-label" htmlFor="freezeDateInput">
                              Cutoff Date
                            </label>
                            <div className="adminbudget-freeze-date-wrap">
                              <CalendarDays size={18} className="adminbudget-freeze-date-icon" />
                              <input
                                id="freezeDateInput"
                                className="adminbudget-control adminbudget-freeze-date"
                                type="date"
                                value={freezeDate}
                                onChange={(e) => setFreezeDate(e.target.value)}
                                disabled={freezeLoading || freezeSaving || !canEditFreezeConfig}
                                title="Freeze Date"
                              />
                            </div>

                            {!isSuperAdminLogin && (
                              <div className="adminbudget-freeze-popover-note">
                                DoF can freeze once per financial year and only on {dofFreezeAllowedDateText}.
                              </div>
                            )}

                            <div className="adminbudget-freeze-popover-actions">
                              <button
                                type="button"
                                className="adminbudget-freeze-popover-cancel"
                                onClick={() => setFreezePopupOpen(false)}
                                disabled={freezeSaving}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className={`adminbudget-freeze-btn ${isTimeFrozen ? "is-frozen" : ""}`}
                                onClick={onFreezeTime}
                                disabled={freezeLoading || freezeSaving || !canFreezeNow}
                                title={
                                  !canFreezeNow && !isSuperAdminLogin
                                    ? `DoF freeze is available only on ${dofFreezeAllowedDateText}`
                                    : "Freeze"
                                }
                              >
                                {freezeSaving ? "Freezing..." : isTimeFrozen ? "Update Freeze" : "Freeze"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {assignments.length > 1 && (
                      <select
                        className="adminbudget-control"
                        value={activeAssignmentIndex}
                        onChange={(e) => setActiveAssignmentIndex(Number(e.target.value))}
                        title="Active Context"
                      >
                        {assignments.map((assignment, index) => (
                          <option key={`${assignment.entity_id}-${index}`} value={index}>
                            {getRoleLabel(assignment.role)} ({assignment.entity_name})
                          </option>
                        ))}
                      </select>
                    )}

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
                      onChange={(e) => {
                        setBeneficiaryFilter(e.target.value);
                        setDepartmentFilter("");
                      }}
                      title="Beneficiary"
                    >
                      {filteredBeneficiaryOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {(isSuperAdminLogin || isDofLogin || hasPermission(user, "budget.workflow.principal")) && (
                      <select
                        className="adminbudget-control"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        title={beneficiaryFilter === "All Beneficiary" || ["Faculty", "Staff", "Department"].includes(beneficiaryFilter) ? "Department" : beneficiaryFilter}
                      >
                        <option value="">
                          {beneficiaryFilter === "All Beneficiary" || ["Faculty", "Staff", "Department"].includes(beneficiaryFilter) 
                            ? "All Departments" 
                            : beneficiaryFilter === "Professional Body" 
                              ? "All Professional Bodies"
                              : `All ${beneficiaryFilter}s`}
                        </option>
                        {departmentsList.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    )}

                    <input
                      className="adminbudget-control"
                      type="text"
                      placeholder="Search Budget ID or Applicant Name"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="adminbudget-stats">
                  <div
                    className={`adminbudget-stats-card total ${localStatsFilter === "total" ? "active" : ""}`}
                    onClick={() => handleStatsFilter("total")}
                    title="Show All Budgets"
                  >
                    <span className="adminbudget-stats-icon">
                      <Briefcase size={18} />
                    </span>
                    <div className="adminbudget-stats-text">
                      <span className="adminbudget-stats-label">Total</span>
                      <span className="adminbudget-stats-number">{stats.total}</span>
                    </div>
                  </div>
                  <div
                    className={`adminbudget-stats-card pending ${localStatsFilter === "pending" ? "active" : ""}`}
                    onClick={() => handleStatsFilter("pending")}
                    title="Filter Pending"
                  >
                    <span className="adminbudget-stats-icon">
                      <Clock size={18} />
                    </span>
                    <div className="adminbudget-stats-text">
                      <span className="adminbudget-stats-label">Pending</span>
                      <span className="adminbudget-stats-number">{stats.pending}</span>
                    </div>
                  </div>
                  <div
                    className={`adminbudget-stats-card returned ${localStatsFilter === "returned" ? "active" : ""}`}
                    onClick={() => handleStatsFilter("returned")}
                    title="Filter Returned"
                  >
                    <span className="adminbudget-stats-icon">
                      <RotateCcw size={18} />
                    </span>
                    <div className="adminbudget-stats-text">
                      <span className="adminbudget-stats-label">Return</span>
                      <span className="adminbudget-stats-number">{stats.returned}</span>
                    </div>
                  </div>
                  <div
                    className={`adminbudget-stats-card rejected ${localStatsFilter === "rejected" ? "active" : ""}`}
                    onClick={() => handleStatsFilter("rejected")}
                    title="Filter Rejected"
                  >
                    <span className="adminbudget-stats-icon">
                      <XCircle size={18} />
                    </span>
                    <div className="adminbudget-stats-text">
                      <span className="adminbudget-stats-label">Reject</span>
                      <span className="adminbudget-stats-number">{stats.rejected}</span>
                    </div>
                  </div>
                  <div
                    className={`adminbudget-stats-card approved ${localStatsFilter === "approved" ? "active" : ""}`}
                    onClick={() => handleStatsFilter("approved")}
                    title="Filter Approved"
                  >
                    <span className="adminbudget-stats-icon">
                      <CheckCircle2 size={18} />
                    </span>
                    <div className="adminbudget-stats-text">
                      <span className="adminbudget-stats-label">Approved</span>
                      <span className="adminbudget-stats-number">{stats.approved}</span>
                    </div>
                  </div>
                  <div
                    className={`adminbudget-stats-card archived ${localStatsFilter === "archived" ? "active" : ""}`}
                    onClick={() => handleStatsFilter("archived")}
                    title="Filter Archived"
                  >
                    <span className="adminbudget-stats-icon">
                      <Archive size={18} />
                    </span>
                    <div className="adminbudget-stats-text">
                      <span className="adminbudget-stats-label">Archive</span>
                      <span className="adminbudget-stats-number">{stats.archived}</span>
                    </div>
                  </div>
                </div>

                <div className="adminbudget-body">
                  {loading && <div className="adminbudget-state">Loading budget requests...</div>}
                  {!loading && accessError && <div className="adminbudget-state">{accessError}</div>}
                  {!loading && !accessError && baseFilteredData.length === 0 && (
                    <div className="adminbudget-state">No budget requests found</div>
                  )}

                  {!loading && !accessError && baseFilteredData.length > 0 && (
                    <>
                      <div className="adminbudget-cards-container">
                        {currentItems.map((item) => {
                          const canProcessCurrentStage = canProcessStage(item.current_stage);
                          const normalizedStatus = (item.status || "").toLowerCase();
                          const isArchivedStatus = ["archived", "archive"].some((token) => normalizedStatus.includes(token));
                          const isRejectedStatus = normalizedStatus.includes("rejected");
                          const isReturnedStatus = normalizedStatus.includes("returned");
                          const isCompletedStatus = normalizedStatus.includes("completed");
                          const isActionLocked = isArchivedStatus || isRejectedStatus || isReturnedStatus || isCompletedStatus;
                          const hasApprovedOverride = Number(item.has_approved_override ?? 0) > 0;
                          const isApprovedForDisplay = hasApprovedOverride || getStatusCategory(item) === "approved";
                          const displayAmountLabel = isApprovedForDisplay ? "Approved" : "Proposed";
                          const displayAmountValue = isApprovedForDisplay
                            ? Number(item.approved_total_amount ?? item.total_amount ?? 0)
                            : Number(item.total_amount ?? 0);

                          return (
                            <div className="adminbudget-item-wrap" key={item.id}>
                              <div
                                className={`adminbudget-item adminbudget-item--clickable ${archivingIds.has(item.id) ? "adminbudget-item--archiving" : ""
                                  }`}
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(`/budget/${item.id}?admin=true`)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    navigate(`/budget/${item.id}?admin=true`);
                                  }
                                }}
                              >
                                <div className="adminbudget-topbar">
                                  <div className="adminbudget-topbar-left">
                                    <span className="adminbudget-id">{item.proposal_ref}</span>
                                    <h5 className="adminbudget-name">{item.applicant_name || "Unknown"}</h5>
                                    <span className="adminbudget-tag-pill">{item.budget_tag || "No Tag"}</span>
                                  </div>

                                  <div className="adminbudget-topbar-right">
                                    <div
                                      className="adminbudget-amounts-container"
                                      style={{ display: "flex", gap: "20px", textAlign: "right", marginRight: "15px" }}
                                    >
                                      <div className="adminbudget-amount-item">
                                        <p
                                          className="adminbudget-amount-label"
                                          style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, opacity: 0.75 }}
                                        >
                                          {displayAmountLabel}
                                        </p>
                                        <p className="adminbudget-amount" style={{ margin: 0, fontSize: "1.1rem" }}>
                                          Rs {displayAmountValue.toLocaleString("en-IN")}
                                        </p>
                                      </div>
                                    </div>

                                    <button
                                      className="adminbudget-icon-btn"
                                      title="Logs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openLogPopup(item);
                                      }}
                                    >
                                      <Info size={16} />
                                    </button>

                                    <button
                                      className="adminbudget-icon-btn"
                                      title="View"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/budget/${item.id}?admin=true`);
                                      }}
                                    >
                                      <Eye size={16} />
                                    </button>

                                    <button
                                      className="adminbudget-icon-btn"
                                      title="Edit"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/budget/${item.id}/edit?admin=true`);
                                      }}
                                      disabled={isActionLocked}
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                  </div>
                                </div>

                                <div className="adminbudget-row">
                                  <div className="adminbudget-left">
                                    <div className="adminbudget-detail-row">
                                      <span className="adminbudget-label">Beneficiary</span>
                                      <span className="adminbudget-value">{item.beneficiary_value || "Not specified"}</span>
                                    </div>
                                  </div>

                                  <div className="adminbudget-right">
                                    <div className="adminbudget-status-wrap">
                                      <span className={statusClass(item)}>{getDisplayStatus(item)}</span>
                                    </div>
                                    <div className="adminbudget-actions-row">
                                      {!isSuperAdmin(user) && (
                                        <>
                                          <button
                                            className="adminbudget-action-btn adminbudget-action-btn--approve"
                                            title="Approve"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onApprove(item.id, item.current_stage);
                                            }}
                                            disabled={
                                              isActionLocked ||
                                              !canProcessCurrentStage
                                            }
                                          >
                                            <CheckCircle2 size={18} />
                                          </button>

                                          <button
                                            className="adminbudget-action-btn adminbudget-action-btn--return"
                                            title="Return"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openActionPopup("return", item.id, item.proposal_ref, item.current_stage);
                                            }}
                                            disabled={
                                              isActionLocked || !canProcessCurrentStage
                                            }
                                          >
                                            <RotateCcw size={18} />
                                          </button>

                                          <button
                                            className="adminbudget-action-btn adminbudget-action-btn--reject"
                                            title="Reject"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openActionPopup("reject", item.id, item.proposal_ref, item.current_stage);
                                            }}
                                            disabled={
                                              isActionLocked || !canProcessCurrentStage
                                            }
                                          >
                                            <XCircle size={18} />
                                          </button>
                                        </>
                                      )}

                                      {isSuperAdmin(user) && (
                                        <>
                                          <button
                                            className="adminbudget-action-btn adminbudget-action-btn--return"
                                            title="Return"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openActionPopup("return", item.id, item.proposal_ref, item.current_stage);
                                            }}
                                            disabled={isActionLocked}
                                          >
                                            <RotateCcw size={18} />
                                          </button>
                                          <button
                                            className="adminbudget-action-btn adminbudget-action-btn--reject"
                                            title="Delete"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openDeletePopup(item.id, item.proposal_ref);
                                            }}
                                          >
                                            <Trash2 size={18} />
                                          </button>
                                        </>
                                      )}

                                      <button
                                        className="adminbudget-action-btn adminbudget-action-btn--archive"
                                        title={
                                          isArchivedStatus
                                            ? "Unarchive"
                                            : "Archive"
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onArchiveToggle(item);
                                        }}
                                        disabled={archivingIds.has(item.id) || (!isArchivedStatus && (isCompletedStatus || isRejectedStatus || isReturnedStatus))}
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
                            <label htmlFor="adminbudget-rows-per-page" className="adminbudget-rows-label">
                              Rows per page
                            </label>
                            <select
                              id="adminbudget-rows-per-page"
                              className="adminbudget-rows-select"
                              value={itemsPerPage}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                setItemsPerPage(Number.isFinite(next) ? next : 10);
                              }}
                            >
                              {ROWS_PER_PAGE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="adminbudget-pagecount">
                            {totalItemsCount === 0
                              ? "0-0 of 0"
                              : `${(safeCurrentPage - 1) * itemsPerPage + 1}-${Math.min(safeCurrentPage * itemsPerPage, totalItemsCount)} of ${totalItemsCount}`}
                          </span>
                        </div>

                        <div className="adminbudget-pagination-right">
                          <button
                            className="adminbudget-pagebtn"
                            disabled={safeCurrentPage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </button>

                          <span className="adminbudget-pageinfo">
                            Page {safeCurrentPage} of {totalPagesCount}
                          </span>

                          <button
                            className="adminbudget-pagebtn"
                            disabled={safeCurrentPage >= totalPagesCount}
                            onClick={() => setCurrentPage((p) => Math.min(totalPagesCount, p + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {isHodBudgetView && activeAdminBudgetTab === "dashboard" && (
              <div className="adminbudget-dashboard-placeholder">Dashboard view will be added here.</div>
            )}
          </div>
        </div>
      </section >

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
              {actionType === "return" ? "Return Budget" : "Reject Budget"} - Comments
            </h5>

            <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
              Budget ID: <b>{actionRef}</b>
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
              Are you sure you want to permanently delete budget request <strong>{deleteRef}</strong>? This
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

      {logPopupOpen && (
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
          onClick={closeLogPopup}
        >
          <div
            style={{
              width: "min(760px, 96vw)",
              maxHeight: "80vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 12,
              padding: 0,
              boxShadow: "0 10px 35px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="budgetdashboard-log-header">Submission Logs</div>
            <div className="budgetdashboard-log-body adminbudget-log-body">
              <div className="budgetdashboard-log-item">
                <span className="log-label">Proposal:</span>
                <span className="log-value">{logRef || "--"}</span>
              </div>

              {(logProposal?.updated_at || logProposal?.updatedAt) && (logProposal?.created_at || logProposal?.createdAt) && (
                parseDateMsForLog(logProposal.updated_at || logProposal.updatedAt) >
                parseDateMsForLog(logProposal.created_at || logProposal.createdAt)
              ) && (
                  <div className="budgetdashboard-log-item">
                    <span className="log-label">Last Edited:</span>
                    <span className="log-value">{formatDateTimeForLog(logProposal.updated_at || logProposal.updatedAt)}</span>
                  </div>
                )}

              {logLoading && <div className="adminbudget-state" style={{ padding: "24px 0" }}>Loading logs...</div>}
              {!logLoading && buildAdminLogEvents.length === 0 && (
                <div className="adminbudget-state" style={{ padding: "24px 0" }}>No logs available.</div>
              )}

              {!logLoading && buildAdminLogEvents.length > 0 && (
                <div className="budgetdashboard-log-approvals">
                  {buildAdminLogEvents.map((event) => (
                    <div
                      key={event.key}
                      className={`log-approval-item${event.actorBadgeLabel ? " log-approval-item--admin" : ""}`}
                    >
                      {event.actorBadgeLabel && (
                        <span className="log-admin-mark" title="Updated by Admin">
                          {`\u2605 ${event.actorBadgeLabel}`}
                        </span>
                      )}
                      <div className="log-approval-meta">
                        <span className={`log-decision log-decision--${event.decision || "approved"}`}>
                          {event.title.toUpperCase()}
                        </span>
                        <span className="log-role">
                          {(expandedLogDetails[event.key] && event.fullSubtitle)
                            ? event.fullSubtitle
                            : (event.subtitle || "Status update")}
                        </span>
                        {event.fullSubtitle && event.fullSubtitle !== event.subtitle && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedLogDetails((prev) => ({
                                ...prev,
                                [event.key]: !prev[event.key],
                              }));
                            }}
                            style={{
                              marginTop: "4px",
                              alignSelf: "flex-start",
                              border: "none",
                              background: "transparent",
                              color: "#0d6efd",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            {expandedLogDetails[event.key] ? "Show less" : "Show full changes"}
                          </button>
                        )}
                        {event.actorLine && <span className="log-actor-line">{event.actorLine}</span>}
                        <span className="log-date">{event.dateLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 16px 16px" }}>
              <button
                type="button"
                onClick={closeLogPopup}
                style={{
                  border: "1px solid #ddd",
                  background: "#fff",
                  borderRadius: 8,
                  padding: "8px 20px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminBudget;
