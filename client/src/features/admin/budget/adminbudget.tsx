import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./adminbudget.css";
import Navbar from "../../../shared/components/layout/navbar/Navbar";
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
  Snowflake,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import { useAuth } from "../../../contexts/AuthContext";
import { hasPermission, isSuperAdmin } from "../../../shared/utils/permissionUtils";

type ActionType = "return" | "reject" | null;
type QueueTabKey = "hod" | "coordinator" | "dof" | "principal" | "admin";

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
const TAB_PRIORITY: QueueTabKey[] = ["hod", "coordinator", "dof", "principal", "admin"];

const STAGE_PERMISSION_MAP: Record<string, string> = {
  level1: "budget.workflow.level1",
  dof: "budget.workflow.dof",
  principal: "budget.workflow.principal",
};

const STAGE_DISPLAY_MAP: Record<string, string> = {
  level1: "Level-1",
  dof: "DoF",
  principal: "Principal",
};

const ENTITY_BENEFICIARY_TYPES = ["Centre", "Cell", "Club", "Professional Body"];

const getLevel1Label = (beneficiaryType: string) => {
  const type = (beneficiaryType || "").toLowerCase();
  const entityTypes = ENTITY_BENEFICIARY_TYPES.map((t) => t.toLowerCase());
  return entityTypes.includes(type) ? "Coordinator" : "HOD";
};

const getRoleLabel = (role: string) => {
  const map: Record<string, string> = {
    hod: "HoD",
    coordinator: "Coordinator",
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

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [beneficiaryFilter, setBeneficiaryFilter] = useState("All Beneficiary");
  const [fiscalYear, setFiscalYear] = useState<number>(() => {
    const d = new Date();
    return d.getMonth() < 2 ? d.getFullYear() - 1 : d.getFullYear();
  });
  const [freezeDate, setFreezeDate] = useState<string>(() => `${new Date().getFullYear()}-02-01`);
  const [isTimeFrozen, setIsTimeFrozen] = useState<boolean>(false);
  const [freezeLoading, setFreezeLoading] = useState<boolean>(false);
  const [freezeSaving, setFreezeSaving] = useState<boolean>(false);
  const [freezePopupOpen, setFreezePopupOpen] = useState<boolean>(false);
  const freezePopoverRef = useRef<HTMLDivElement | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Queue/role handling
  const [assignments, setAssignments] = useState<RbacAssignment[]>([]);
  const [activeAssignmentIndex, setActiveAssignmentIndex] = useState<number>(0);
  const [activeQueueTabKey, setActiveQueueTabKey] = useState<QueueTabKey | null>(null);

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

  // Archive animation/state
  const [archivingIds, setArchivingIds] = useState<Set<number>>(new Set<number>());

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
        hod: ["level1_approved", "hod_approved", "dof_approved", "principal_approved", "completed"],
        coordinator: ["level1_approved", "hod_approved", "dof_approved", "principal_approved", "completed"],
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

    try {
      setLoading(true);
      setAccessError("");

      const response: any = await authenticityUtility.get(activeQueueTab.endpoint, {
        params: { limit: 100, status: "", fiscalYear },
      });

      if (response?.success) {
        const normalizedRows: BudgetRequestItem[] = Array.isArray(response.data)
          ? response.data.map((row: any) => ({
            ...row,
            applicant_name: String(
              row?.applicant_name || row?.faculty_name || row?.user_name || row?.user_email || ""
            ).trim(),
          }))
          : [];
        setData(normalizedRows);
      } else {
        setData([]);
      }
    } catch (error: any) {
      console.error("Fetch budget error:", error);
      setData([]);
      setAccessError(error?.response?.data?.message || "Failed to fetch budget requests");
    } finally {
      setLoading(false);
    }
  }, [activeQueueTab, fiscalYear]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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
      alert("You do not have permission to process this stage.");
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
      alert("Missing budget id.");
      return;
    }

    if (!stage || !canProcessStage(stage)) {
      alert("You do not have permission to approve this stage.");
      return;
    }

    if (!window.confirm("Are you sure you want to approve this budget?")) return;

    try {
      const response: any = await authenticityUtility.patch(`/adminbudget/${itemId}/approval`, {
        decision: "approved",
      });

      if (response?.success || response?.data?.success) {
        fetchDashboard();
        return;
      }
      alert(response?.message || "Failed to approve");
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to approve");
    }
  };

  const onArchiveToggle = async (item: BudgetRequestItem) => {
    const id = Number(item.id);
    const isArchived = ["archived", "archive"].some((token) =>
      (item.status || "").toLowerCase().includes(token)
    );
    const confirmMessage = isArchived
      ? "Are you sure you want to unarchive this budget?"
      : "Are you sure you want to archive this budget?";

    if (!window.confirm(confirmMessage)) return;
    if (archivingIds.has(id)) return;

    setArchivingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      const response: any = await authenticityUtility.patch(`/adminbudget/${id}/archive-toggle`, {});

      if (response.success) {
        fetchDashboard();
      }
    } catch (error: any) {
      setArchivingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      alert(error.response?.data?.message || "Failed to update archive state");
      return;
    }

    window.setTimeout(() => {
      setArchivingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchDashboard();
    }, ARCHIVE_TRANSITION_MS);
  };

  const submitActionWithComment = async () => {
    if (!actionType || !actionId) return;

    if (!canProcessStage(actionStage)) {
      alert("You do not have permission to process this stage.");
      return;
    }

    const comment = actionComment.trim();
    if (!comment) {
      alert("Please enter comments.");
      return;
    }

    try {
      const response: any = await authenticityUtility.patch(`/adminbudget/${actionId}/approval`, {
        decision: actionType === "return" ? "returned" : "rejected",
        feedback: comment,
      });

      if (response.success) {
        alert(`${actionType === "return" ? "Returned" : "Rejected"} successfully`);
        closeActionPopup();
        fetchDashboard();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || `Failed to ${actionType}`);
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
      if (response.success) {
        alert("Budget request deleted successfully");
        closeDeletePopup();
        fetchDashboard();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to delete budget request");
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
    const query = searchTerm.trim().toLowerCase();
    const ben = beneficiaryFilter;

    return data.filter((item) => {
      const matchesSearch =
        !query ||
        item.proposal_ref.toLowerCase().includes(query) ||
        (item.applicant_name || "").toLowerCase().includes(query);
      const matchesBeneficiary =
        ben === "All Beneficiary" || item.beneficiary_type.toLowerCase() === ben.toLowerCase();

      return matchesSearch && matchesBeneficiary;
    });
  }, [data, searchTerm, beneficiaryFilter]);

  const [statsFilter, setStatsFilter] = useState<string>("pending");

  const handleStatsFilter = useCallback((filter: string) => {
    setStatsFilter(filter);
    setStatusFilter(filter === "total" ? "all" : filter);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setStatsFilter(statusFilter === "all" ? "total" : statusFilter);
  }, [statusFilter]);

  const filteredData = useMemo(() => {
    const selected = statusFilter.trim().toLowerCase();
    if (!selected || selected === "all") return baseFilteredData;

    return baseFilteredData.filter((item) => getStatusCategory(item) === selected);
  }, [baseFilteredData, statusFilter, getStatusCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, beneficiaryFilter, activeQueueTabKey, fiscalYear]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfLast = safeCurrentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirst, indexOfLast);

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
      stageLabel = getLevel1Label(item.beneficiary_type);
    }
    return "Pending " + stageLabel;
  };

  const stats = useMemo(() => {
    const total = baseFilteredData.length;
    const pendingCount = baseFilteredData.filter((item) => getStatusCategory(item) === "pending").length;
    const returnedCount = baseFilteredData.filter((item) => getStatusCategory(item) === "returned").length;
    const rejectedCount = baseFilteredData.filter((item) => getStatusCategory(item) === "rejected").length;
    const approvedCount = baseFilteredData.filter((item) => getStatusCategory(item) === "approved").length;
    const archivedCount = baseFilteredData.filter((item) => getStatusCategory(item) === "archived").length;
    return { total, pending: pendingCount, returned: returnedCount, rejected: rejectedCount, approved: approvedCount, archived: archivedCount };
  }, [baseFilteredData, getStatusCategory]);

  const isHodBudgetView = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toLowerCase()) : [];
    const permissions = Array.isArray(user?.permissions)
      ? user.permissions.map((permission) => String(permission).toLowerCase())
      : [];

    return roles.includes("hod") || permissions.includes("budget.workflow.hod");
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
        alert("Freeze already applied for this fiscal year. Only Super Admin can edit it now.");
        return;
      }
      if (isDofLogin && !isSuperAdminLogin && !isTodayFebFirst) {
        alert(`DoF freeze can be applied only on ${dofFreezeAllowedDateText}.`);
        return;
      }
      alert("Only Super Admin can edit freeze configuration right now.");
      return;
    }

    const selectedFreezeDate = freezeDate;

    if (!selectedFreezeDate) {
      alert("Please select a freeze date.");
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
        alert(response?.message || "Failed to freeze budget time.");
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to freeze budget time.");
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
      alert(error?.response?.data?.message || "Failed to fetch proposal logs");
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

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = String(parsed.getFullYear());
    return `${day}-${month}-${year}`;
  };

  const normalizeTextForLog = (value?: string | null) => String(value || "").trim();
  const normalizeEmailForLog = (value?: string | null) => normalizeTextForLog(value).toLowerCase();

  const formatDateTimeForLog = (value?: string) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString("en-IN");
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
      const isEntity = ["club", "cell", "center", "centre", "professional body"].includes(
        String(logProposal?.beneficiary_type || "").toLowerCase().trim()
      );
      return isEntity ? "Coordinator" : "HoD";
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

  const buildAdminLogEvents = useMemo<AdminLogEvent[]>(() => {
    const events: AdminLogEvent[] = [];
    const createdAt = logProposal?.created_at || logProposal?.createdAt;
    const updatedAt = logProposal?.updated_at || logProposal?.updatedAt;
    const createdAtMs = createdAt ? new Date(createdAt).getTime() : 0;
    const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : 0;
    const submitterEmail = normalizeEmailForLog(logProposal?.user_email || logProposal?.userEmail);
    const approvalLogs = Array.isArray(logEntries) ? logEntries : [];
    const hasApprovalUpdate = approvalLogs.some(
      (app: any) => String(app?.decision || "").toLowerCase() === "updated"
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
        const editCreatedAt = edit.created_at || edit.createdAt;
        const editCreatedMs = editCreatedAt ? new Date(editCreatedAt).getTime() : createdAtMs;
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
            if (lines.length > 0) {
              const numericRows = lines
                .map((line: any) => Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no))
                .filter((lineNo: number) => Number.isInteger(lineNo) && lineNo > 0);
              const rowNumbers = Array.from(new Set<number>(numericRows)).sort((a, b) => a - b);

              if (rowNumbers.length > 0) {
                rowSummary = `Row No. ${rowNumbers.join(", ")}`;
              }

              const details = lines.map((line: any, lineIdx: number) => {
                const lineNo = Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no) || (lineIdx + 1);
                const rawChanges = line?.changes;
                const changeList = Array.isArray(rawChanges)
                  ? rawChanges
                  : normalizeTextForLog(rawChanges)
                    ? [normalizeTextForLog(rawChanges)]
                    : [];
                return `Line ${lineNo}: ${changeList.join("; ") || "Updated"}`;
              });
              detailSummary = details.join(" | ");
            }
          } catch {
            // Keep summary fallback if details parse fails.
          }
        }

        const subtitle = [rowSummary || summary, detailSummary].filter(Boolean).join(" | ");
        if (!subtitle) return;

        events.push({
          key: `edit-${edit.id || idx}`,
          title: "Updated",
          subtitle,
          actorLine: `Updated By: ${editorEmail || "-"}`,
          actorIsAdmin,
          actorBadgeLabel,
          timestamp: editCreatedMs,
          dateLabel: editCreatedAt ? formatDateTimeForLog(editCreatedAt) : "-",
          decision: "updated",
        });
      });
    }

    if (updatedAtMs && createdAtMs && updatedAtMs > createdAtMs && editLogs.length === 0 && !hasApprovalUpdate) {
      events.push({
        key: "updated-at-fallback",
        title: "Updated",
        subtitle: "Proposal edited",
        actorLine: `Updated By: ${submitterEmail || "-"}`,
        timestamp: updatedAtMs,
        dateLabel: formatDateTimeForLog(updatedAt),
        decision: "updated",
      });
    }

    approvalLogs.forEach((app: any, idx: number) => {
      const feedback = normalizeTextForLog(app.feedback);
      if (feedback === "__archive_meta__:") return;
      if (feedback === "Auto-approved after DoF clearance") return;

      const decision = String(app.decision || "updated").toLowerCase();
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
      const decidedAtMs = decidedAt ? new Date(decidedAt).getTime() : 0;
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

    const submitted = events.filter((e) => e.decision === "submitted");
    const updates = events
      .filter((e) => e.decision === "updated")
      .sort((a, b) => a.timestamp - b.timestamp);
    const approvals = events
      .filter((e) => e.decision !== "submitted" && e.decision !== "updated")
      .sort((a, b) => a.timestamp - b.timestamp);

    return [...submitted, ...updates, ...approvals];
  }, [logEntries, logEdits, logProposal]);

  return (
    <>
      <Navbar />

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
                          <Snowflake size={20} />
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
                      onChange={(e) => setBeneficiaryFilter(e.target.value)}
                      title="Beneficiary"
                    >
                      {filteredBeneficiaryOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

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
                    className={`adminbudget-stats-card total ${statsFilter === "total" ? "active" : ""}`}
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
                    className={`adminbudget-stats-card pending ${statsFilter === "pending" ? "active" : ""}`}
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
                    className={`adminbudget-stats-card returned ${statsFilter === "returned" ? "active" : ""}`}
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
                    className={`adminbudget-stats-card rejected ${statsFilter === "rejected" ? "active" : ""}`}
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
                    className={`adminbudget-stats-card approved ${statsFilter === "approved" ? "active" : ""}`}
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
                    className={`adminbudget-stats-card archived ${statsFilter === "archived" ? "active" : ""}`}
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
                  {!loading && !accessError && filteredData.length === 0 && (
                    <div className="adminbudget-state">No budget requests found</div>
                  )}

                  {!loading && !accessError && filteredData.length > 0 && (
                    <>
                      <div className="adminbudget-cards-container">
                        {currentItems.map((item) => {
                          const canProcessCurrentStage = canProcessStage(item.current_stage);
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
                                              item.status.toLowerCase().includes("completed") ||
                                              item.status.toLowerCase().includes("archived") ||
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
                                              ["completed", "rejected", "archived", "archive"].some((token) =>
                                                item.status.toLowerCase().includes(token)
                                              ) || !canProcessCurrentStage
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
                                              item.status.toLowerCase().includes("rejected") ||
                                              item.status.toLowerCase().includes("archived") ||
                                              !canProcessCurrentStage
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
                                            disabled={["completed", "rejected", "archived", "archive"].some((token) =>
                                              item.status.toLowerCase().includes(token)
                                            )}
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
                                          ["archived", "archive"].some((token) =>
                                            item.status.toLowerCase().includes(token)
                                          )
                                            ? "Unarchive"
                                            : "Archive"
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onArchiveToggle(item);
                                        }}
                                        disabled={archivingIds.has(item.id)}
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
                        <button
                          className="adminbudget-pagebtn"
                          disabled={safeCurrentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </button>

                        <span className="adminbudget-pageinfo">
                          Page {safeCurrentPage} of {totalPages}
                        </span>

                        <button
                          className="adminbudget-pagebtn"
                          disabled={safeCurrentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </button>
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

      {deletePopupOpen && (
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
            onClick={closeDeletePopup}
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
              onClick={(e) => e.stopPropagation()}
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
                new Date(logProposal.updated_at || logProposal.updatedAt).getTime() >
                new Date(logProposal.created_at || logProposal.createdAt).getTime()
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
                        <span className="log-role">{event.subtitle || "Status update"}</span>
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
