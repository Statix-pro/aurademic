import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./adminbudget.css";
import Navbar from "../../../shared/components/layout/navbar/Navbar";
import { Eye, Edit2, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import { useAuth } from "../../../contexts/AuthContext";
import { hasPermission, isSuperAdmin } from "../../../shared/utils/permissionUtils";

type ActionType = "return" | "reject" | null;
type QueueTabKey = "hod" | "dof" | "principal" | "admin";

interface QueueTab {
  key: QueueTabKey;
  label: string;
  endpoint: string;
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

const STAGE_PERMISSION_MAP: Record<string, string> = {
  hod: "budget.workflow.hod",
  dof: "budget.workflow.dof",
  principal: "budget.workflow.principal",
};

const STAGE_DISPLAY_MAP: Record<string, string> = {
  hod: "HOD",
  dof: "DoF",
  principal: "Principal",
};

const ENTITY_BENEFICIARY_TYPES = ['Centre', 'Cell', 'Club', 'Professional Body'];

const getLevel1Label = (beneficiaryType: string) => {
  return ENTITY_BENEFICIARY_TYPES.includes(beneficiaryType) ? "Coordinator" : "HOD";
};

const TAB_PRIORITY: QueueTabKey[] = ["hod", "dof", "principal", "admin"];

const AdminBudget: React.FC = () => {
  const [data, setData] = useState<BudgetRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [beneficiaryFilter, setBeneficiaryFilter] = useState("All Beneficiary");
  const [fiscalYear, setFiscalYear] = useState<number>(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const navigate = useNavigate();
  const { user } = useAuth();

  const queueTabs = useMemo<QueueTab[]>(() => {
    const tabs: QueueTab[] = [];

    if (hasPermission(user, "budget.workflow.hod")) {
      tabs.push({ key: "hod", label: "HOD / Coordinator", endpoint: "/budget/hod" });
    }

    if (hasPermission(user, "budget.workflow.dof")) {
      tabs.push({ key: "dof", label: "DoF", endpoint: "/budget/dof" });
    }

    if (hasPermission(user, "budget.workflow.principal")) {
      tabs.push({ key: "principal", label: "Principal", endpoint: "/budget/principal" });
    }

    if (
      isSuperAdmin(user) ||
      hasPermission(user, "budget.admin.view") ||
      hasPermission(user, "budget.admin.manage")
    ) {
      tabs.push({ key: "admin", label: "Admin", endpoint: "/budget/admin" });
    }

    return tabs;
  }, [user]);

  const [activeQueueTabKey, setActiveQueueTabKey] = useState<QueueTabKey | null>(null);

  useEffect(() => {
    if (!queueTabs.length) {
      setActiveQueueTabKey(null);
      return;
    }

    const activeStillExists =
      activeQueueTabKey !== null && queueTabs.some((tab) => tab.key === activeQueueTabKey);

    if (activeStillExists) {
      return;
    }

    const nextTab =
      TAB_PRIORITY.find((tabKey) => queueTabs.some((tab) => tab.key === tabKey)) ||
      queueTabs[0].key;

    setActiveQueueTabKey(nextTab);
  }, [queueTabs, activeQueueTabKey]);

  const activeQueueTab = useMemo(
    () => queueTabs.find((tab) => tab.key === activeQueueTabKey) || null,
    [queueTabs, activeQueueTabKey]
  );

  const [actionPopupOpen, setActionPopupOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionRef, setActionRef] = useState<string>("");
  const [actionComment, setActionComment] = useState<string>("");
  const [actionStage, setActionStage] = useState<string>("");

  const isApprovedForActiveTab = useCallback(
    (item: BudgetRequestItem) => {
      const s = (item.status || "").toLowerCase();

      if (s === "completed") {
        return true;
      }

      switch (activeQueueTabKey) {
        case "hod":
          return s.startsWith("hod_approved");
        case "dof":
          return s.startsWith("dof_approved");
        case "principal":
          return s.startsWith("principal_approved");
        case "admin":
        default:
          return s.includes("approved");
      }
    },
    [activeQueueTabKey]
  );

  const getStatusCategory = useCallback(
    (item: BudgetRequestItem) => {
      const s = (item.status || "").toLowerCase();
      if (s.includes("returned")) return "returned";
      if (s.includes("rejected")) return "rejected";
      if (isApprovedForActiveTab(item)) return "approved";
      return "pending";
    },
    [isApprovedForActiveTab]
  );

  const canProcessStage = useCallback(
    (stage: string) => {
      if (isSuperAdmin(user)) {
        return true;
      }

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
        params: {
          limit: 100,
          status: "",
          fiscalYear: fiscalYear,
        },
      });

      if (response?.success) {
        const normalizedRows: BudgetRequestItem[] = Array.isArray(response.data)
          ? response.data.map((row: any) => ({
            ...row,
            applicant_name: String(
              row?.applicant_name ||
              row?.faculty_name ||
              row?.user_name ||
              row?.user_email ||
              ""
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

  const openActionPopup = (
    type: "return" | "reject",
    id: number,
    ref: string,
    stage: string
  ) => {
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

  const onApprove = async (id: number, stage: string) => {
    if (!canProcessStage(stage)) {
      alert("You do not have permission to approve this stage.");
      return;
    }

    try {
      if (!window.confirm("Are you sure you want to approve this budget?")) return;
      const response: any = await authenticityUtility.patch(`/budget/${id}/approval`, {
        decision: "approved",
      });
      if (response.success) {
        alert("Approved successfully");
        fetchDashboard();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to approve");
    }
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
      const response: any = await authenticityUtility.patch(`/budget/${actionId}/approval`, {
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

  const baseFilteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const ben = beneficiaryFilter;

    return data.filter((item) => {
      const matchesSearch = !q || 
        item.proposal_ref.toLowerCase().includes(q) || 
        (item.applicant_name || "").toLowerCase().includes(q);
      
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
    return "adminbudget-status adminbudget-status--pending";
  };

  const getDisplayStatus = (item: BudgetRequestItem) => {
    const s = (item.status || "").toLowerCase();
    if (getStatusCategory(item) === "approved") return "Approved";
    if (s.includes("rejected")) return "Reject";
    if (s.includes("returned") || s.includes("return")) return "Return";
    const stageKey = (item.current_stage || "").toLowerCase();
    
    let stageLabel = STAGE_DISPLAY_MAP[stageKey] || (item.current_stage ? item.current_stage.toUpperCase() : "");
    if (stageKey === 'hod') {
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
    return {
      total,
      pending: pendingCount,
      returned: returnedCount,
      rejected: rejectedCount,
      approved: approvedCount,
    };
  }, [baseFilteredData, getStatusCategory]);

  return (
    <>
      <Navbar />

      <section className="adminbudget-page">
        <div className="adminbudget-container">
          <div className="adminbudget-card">
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
                <select
                  className="adminbudget-control"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(Number(e.target.value))}
                  title="Fiscal Year"
                >
                  {[2024, 2025, 2026, 2027].map((year) => (
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
                  {BENEFICIARY_OPTIONS.filter((opt) => {
                    if (activeQueueTabKey === "hod") {
                      return ["All Beneficiary", "Faculty", "Department"].includes(opt);
                    }
                    return true;
                  }).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                <input
                  className="adminbudget-control"
                  type="text"
                  placeholder="Search Budget ID or Applicant"
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
                <span className="adminbudget-stats-number">{stats.total}</span>
                <span className="adminbudget-stats-label">Total</span>
              </div>
              <div
                className={`adminbudget-stats-card pending ${statsFilter === "pending" ? "active" : ""}`}
                onClick={() => handleStatsFilter("pending")}
                title="Filter Pending"
              >
                <span className="adminbudget-stats-number">{stats.pending}</span>
                <span className="adminbudget-stats-label">Pending</span>
              </div>
              <div
                className={`adminbudget-stats-card returned ${statsFilter === "returned" ? "active" : ""}`}
                onClick={() => handleStatsFilter("returned")}
                title="Filter Returned"
              >
                <span className="adminbudget-stats-number">{stats.returned}</span>
                <span className="adminbudget-stats-label">Return</span>
              </div>
              <div
                className={`adminbudget-stats-card rejected ${statsFilter === "rejected" ? "active" : ""}`}
                onClick={() => handleStatsFilter("rejected")}
                title="Filter Rejected"
              >
                <span className="adminbudget-stats-number">{stats.rejected}</span>
                <span className="adminbudget-stats-label">Reject</span>
              </div>
              <div
                className={`adminbudget-stats-card approved ${statsFilter === "approved" ? "active" : ""}`}
                onClick={() => handleStatsFilter("approved")}
                title="Filter Approved"
              >
                <span className="adminbudget-stats-number">{stats.approved}</span>
                <span className="adminbudget-stats-label">Approved</span>
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
                            className="adminbudget-item adminbudget-item--clickable"
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
                                <h5 className="adminbudget-name">
                                  {item.applicant_name || item.user_email || "Unknown"}
                                </h5>
                                <span className="adminbudget-date">
                                  {item.created_date ? item.created_date.split(" ")[0] : ""}
                                </span>
                              </div>

                              <div className="adminbudget-topbar-right">
                                <div
                                  className="adminbudget-amounts-container"
                                  style={{
                                    display: "flex",
                                    gap: "20px",
                                    textAlign: "right",
                                    marginRight: "15px",
                                  }}
                                >
                                  <div className="adminbudget-amount-item">
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#666",
                                        textTransform: "uppercase",
                                        marginBottom: "2px",
                                      }}
                                    >
                                      Proposed
                                    </div>
                                    <p className="adminbudget-amount" style={{ margin: 0, fontSize: "1.1rem" }}>
                                      ₹{Number(item.total_amount || 0).toLocaleString("en-IN")}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  className="adminbudget-icon-btn"
                                  title="View"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/budget/${item.id}`);
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
                                  <span className="adminbudget-value">
                                    {item.beneficiary_value || "Not specified"}
                                  </span>
                                </div>
                              </div>

                              <div className="adminbudget-right">
                                <span className={statusClass(item)}>{getDisplayStatus(item)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="adminbudget-action-card">
                            <button
                              className="adminbudget-action-btn adminbudget-action-btn--approve"
                              title="Approve"
                              onClick={(e) => {
                                e.stopPropagation();
                                onApprove(item.id, item.current_stage);
                              }}
                              disabled={item.status === "completed" || !canProcessCurrentStage}
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
                                ["completed", "rejected"].includes(item.status.toLowerCase()) ||
                                !canProcessCurrentStage
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
                              disabled={item.status === "rejected" || !canProcessCurrentStage}
                            >
                              <XCircle size={18} />
                            </button>
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
              {actionType === "return" ? "Return Budget" : "Reject Budget"} – Comments
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
    </>
  );
};

export default AdminBudget;
