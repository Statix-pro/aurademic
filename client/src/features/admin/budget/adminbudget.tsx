import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./adminbudget.css";
import Navbar from "../../../shared/components/layout/navbar/Navbar";
import {
  Eye,
  Edit2,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Briefcase,
  Clock,
  AlertTriangle,
  Archive,
  Trash2,
  CalendarDays,
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
  const [freezeDate, setFreezeDate] = useState<string>(() => `${new Date().getFullYear()}-04-10`);
  const [isTimeFrozen, setIsTimeFrozen] = useState<boolean>(false);
  const [freezeLoading, setFreezeLoading] = useState<boolean>(false);
  const [freezeSaving, setFreezeSaving] = useState<boolean>(false);

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
      if (s === "completed") return true;

      switch (activeQueueTabKey) {
        case "hod":
        case "coordinator":
          return s.startsWith("level1_approved");
        case "dof":
          return s.startsWith("dof_approved");
        case "principal":
          return s.startsWith("principal_approved");
        case "admin":
        default:
          return s === "completed" || s.includes("approved");
      }
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
  const showFreezeControls = activeQueueTabKey === "dof" && (isDofLogin || isSuperAdminLogin);
  const canEditFreezeConfig = isSuperAdminLogin || (isDofLogin && !isTimeFrozen);
  const canFreezeNow = isSuperAdminLogin || (isDofLogin && !isTimeFrozen);

  const getDefaultFreezeDate = useCallback((fy: number) => `${fy}-04-10`, []);

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
      alert("Freeze already applied. Only Super Admin can edit and freeze again.");
      return;
    }

    if (!freezeDate) {
      alert("Please select a freeze date.");
      return;
    }

    try {
      setFreezeSaving(true);
      const response: any = await authenticityUtility.put("/adminbudget/freeze-config", {
        fiscalYear,
        cutoffDate: freezeDate,
        isFrozen: true,
      });

      if (response?.success) {
        setIsTimeFrozen(true);
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
    const isBaseAdminBudgetPath =
      location.pathname === "/adminbudget" || location.pathname === "/admin/budget";
    if (isBaseAdminBudgetPath) {
      navigate("/admin/budget/approval", { replace: true });
    }
  }, [location.pathname, navigate]);

  const formatCreatedDate = (value?: string) => {
    if (!value) return "";
    const raw = value.split(" ")[0];
    const [year, month, day] = raw.split("-");
    if (!year || !month || !day) return raw;
    return `${day}.${month}.${year}`;
  };

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
                      <>
                        <div className="adminbudget-freeze-date-wrap">
                          <CalendarDays size={18} className="adminbudget-freeze-date-icon" />
                          <input
                            className="adminbudget-control adminbudget-freeze-date"
                            type="date"
                            value={freezeDate}
                            onChange={(e) => setFreezeDate(e.target.value)}
                            disabled={freezeLoading || freezeSaving || !canEditFreezeConfig}
                            title="Freeze Date"
                          />
                        </div>
                        <button
                          type="button"
                          className={`adminbudget-freeze-btn ${isTimeFrozen ? "is-frozen" : ""}`}
                          onClick={onFreezeTime}
                          disabled={freezeLoading || freezeSaving || !canFreezeNow}
                          title={!canFreezeNow ? "Only Super Admin can freeze again" : "Freeze"}
                        >
                          {freezeSaving ? "Freezing..." : isTimeFrozen ? "Freeze Again" : "Freeze"}
                        </button>
                      </>
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

                          return (
                            <div className="adminbudget-item-wrap" key={item.id}>
                              <div
                                className={`adminbudget-item adminbudget-item--clickable ${
                                  archivingIds.has(item.id) ? "adminbudget-item--archiving" : ""
                                }`}
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(`/budget/${item.id}`)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    navigate(`/budget/${item.id}`);
                                  }
                                }}
                              >
                                <div className="adminbudget-topbar">
                                  <div className="adminbudget-topbar-left">
                                    <span className="adminbudget-id">{item.proposal_ref}</span>
                                    <h5 className="adminbudget-name">{item.applicant_name || "Unknown"}</h5>
                                    <span className="adminbudget-date">{formatCreatedDate(item.created_date)}</span>
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
                                          Proposed
                                        </p>
                                        <p className="adminbudget-amount" style={{ margin: 0, fontSize: "1.1rem" }}>
                                          Rs {Number(item.total_amount || 0).toLocaleString("en-IN")}
                                        </p>
                                      </div>
                                      <div className="adminbudget-amount-item">
                                        <p
                                          className="adminbudget-amount-label"
                                          style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, opacity: 0.75 }}
                                        >
                                          Approved
                                        </p>
                                        <p className="adminbudget-amount" style={{ margin: 0, fontSize: "1.1rem" }}>
                                          Rs {Number(item.approved_total_amount ?? 0).toLocaleString("en-IN")}
                                        </p>
                                      </div>
                                    </div>

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
                                        <AlertTriangle size={18} />
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
      </section>

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
    </>
  );
};

export default AdminBudget;
