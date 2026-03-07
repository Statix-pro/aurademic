import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./adminbudget.css";
import Navbar from "../../../shared/components/layout/navbar/Navbar";
import { Eye, Edit2, CheckCircle2, RotateCcw, XCircle, Briefcase, Clock, AlertTriangle, Archive } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import { useAuth } from "../../../contexts/AuthContext";

type ActionType = "return" | "reject" | null;

interface BudgetRequestItem {
  id: number;
  proposal_ref: string;
  applicant_name: string;
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

const AdminBudget: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<BudgetRequestItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [idSearch, setIdSearch] = useState("");
  const [applicantSearch, setApplicantSearch] = useState("");
  const [beneficiaryFilter, setBeneficiaryFilter] = useState("All Beneficiary");

  // Pagination (Using server-side pagination details if possible, but keep current logic for UI consistency)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const navigate = useNavigate();
  const location = useLocation();

  const [actionPopupOpen, setActionPopupOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionRef, setActionRef] = useState<string>("");
  const [actionComment, setActionComment] = useState<string>("");
  const [archivingIds, setArchivingIds] = useState<Set<number>>(new Set<number>());

  const getStatusCategory = useCallback((rawStatus: string) => {
    const s = (rawStatus || "").toLowerCase();
    if (s.includes("returned")) return "returned";
    if (s.includes("rejected")) return "rejected";
    if (s === "completed" || s.includes("approved")) return "approved";
    return "pending";
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const response: any = await authenticityUtility.get('/budget/admin', {
        params: {
          limit: 100,
          status: "",
        }
      });

      if (response.success) {
        setData(response.data || []);
      }
    } catch (error) {
      console.error("Fetch budget error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const openActionPopup = (type: "return" | "reject", id: number, ref: string) => {
    setActionType(type);
    setActionId(id);
    setActionRef(ref);
    setActionComment("");
    setActionPopupOpen(true);
  };

  const closeActionPopup = () => {
    setActionPopupOpen(false);
    setActionType(null);
    setActionId(null);
    setActionRef("");
    setActionComment("");
  };

  const onApprove = async (itemId?: number) => {
  if (!itemId) {
    alert('Missing budget id.');
    return;
  }

  if (!window.confirm('Are you sure you want to approve this budget?')) return;

  try {
    const response: any = await authenticityUtility.patch(`/budget/${itemId}/approval`, {
      decision: 'approved',
    });

    if (response?.success || response?.data?.success) {
      // ✅ GREEN POPUP WITH 3s TIMER
      const successPopup = document.createElement('div');
      successPopup.style.cssText = `
        position: fixed; top: 20%; left: 50%; transform: translateX(-50%); z-index: 999999;
        background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
        border: 3px solid #22c55e; border-radius: 20px; padding: 24px 32px;
        box-shadow: 0 25px 50px rgba(34, 197, 94, 0.4); font-family: system-ui, sans-serif;
        display: flex; align-items: center; gap: 16px; max-width: 420px; min-height: 80px;
      `;
      
      successPopup.innerHTML = `
        <div style="width: 52px; height: 52px; background: #22c55e; border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
        <div>
          <h3 style="margin: 0 0 4px 0; color: #166534; font-size: 22px; font-weight: 700;">
            Approved Successfully!
          </h3>
          <p style="margin: 0; color: #15803d; font-size: 15px; font-weight: 500;">
            Budget <strong>${itemId}</strong> approved successfully.
          </p>
        </div>
      `;
      
      document.body.appendChild(successPopup);

      setTimeout(() => {
        document.body.removeChild(successPopup);
        fetchDashboard();  // Refresh list (admin dashboard)
      }, 3000);

      return;
    }

    alert(response?.message || 'Failed to approve');
  } catch (error: any) {
    alert(error.response?.data?.message || 'Failed to approve');
  }
};

   const onArchive = async (id: number) => {
    if (!window.confirm("Are you sure you want to archive this budget?")) return;
    if (archivingIds.has(id)) return;

    setArchivingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      const response: any = await authenticityUtility.patch(`/budget/${id}/approval`, {
        decision: "archived",
      });

      if (response.success) {
        setData((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: "archived", current_stage: "archived" } : item
          )
        );
      }
    } catch (error: any) {
      setArchivingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      alert(error.response?.data?.message || "Failed to archive");
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

    const comment = actionComment.trim();
    if (!comment) {
      alert("Please enter comments.");
      return;
    }

    try {
      const response: any = await authenticityUtility.patch(`/budget/${actionId}/approval`, {
        decision: actionType === 'return' ? 'returned' : 'rejected',
        feedback: comment
      });

      if (response.success) {
        alert(`${actionType === 'return' ? 'Returned' : 'Rejected'} successfully`);
        closeActionPopup();
        fetchDashboard();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || `Failed to ${actionType}`);
    }
  };

  const baseFilteredData = useMemo(() => {
    const id = idSearch.trim().toLowerCase();
    const name = applicantSearch.trim().toLowerCase();
    const ben = beneficiaryFilter;

    return data.filter((item) => {
      const matchesId = !id || item.proposal_ref.toLowerCase().includes(id);
      const matchesApplicant = !name || (item.applicant_name || "").toLowerCase().includes(name);
      const matchesBeneficiary =
        ben === "All Beneficiary" || item.beneficiary_type.toLowerCase() === ben.toLowerCase();

      return matchesId && matchesApplicant && matchesBeneficiary;
    });
  }, [data, idSearch, applicantSearch, beneficiaryFilter]);

  const [statsFilter, setStatsFilter] = useState<string>('pending'); // Fixed: Proper destructuring + type


// Add this handler after fetchDashboard
const handleStatsFilter = useCallback((filter: string) => {
  setStatsFilter(filter);
  setStatusFilter(filter === 'total' ? 'all' : filter); // Map to your existing filter logic
  setCurrentPage(1); // Reset pagination
}, []);

  useEffect(() => {
    setStatsFilter(statusFilter === "all" ? "total" : statusFilter);
  }, [statusFilter]);

 const filteredData = useMemo(() => {
    const status = statusFilter.trim().toLowerCase();
    const id = idSearch.trim().toLowerCase();
    const name = applicantSearch.trim().toLowerCase();
    const ben = beneficiaryFilter;

    return data.filter((item) => {
      const itemStatus = item.status.toLowerCase();
      const backendArchived = itemStatus.includes("archived") || itemStatus.includes("archive");
      const isArchived = backendArchived;

      // Map backend status to front-end filter
      // Backend status: submitted, hod_approved, completed, rejected, hod_returned, etc.
      let matchesStatus = true;
      if (status === "pending") {
        matchesStatus = !["completed", "rejected", "archived", "archive"].some((s) =>
          itemStatus.includes(s)
        ) && !isArchived;
      } else if (status === "returned") {
        matchesStatus = (itemStatus.includes("returned") || itemStatus.includes("return")) && !isArchived;
      } else if (status === "approved") {
        matchesStatus = itemStatus === "completed" && !isArchived;
      } else if (status === "rejected") {
        matchesStatus = itemStatus === "rejected" && !isArchived;
      } else if (status === "archived") {
        matchesStatus = isArchived;
      }

      const matchesId = !id || item.proposal_ref.toLowerCase().includes(id);
      const matchesApplicant = !name || (item.applicant_name || "").toLowerCase().includes(name);
      const matchesBeneficiary =
        ben === "All Beneficiary" || item.beneficiary_type.toLowerCase() === ben.toLowerCase();

      return matchesStatus && matchesId && matchesApplicant && matchesBeneficiary;
    });
  }, [data, statusFilter, idSearch, applicantSearch, beneficiaryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, idSearch, applicantSearch, beneficiaryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfLast = safeCurrentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirst, indexOfLast);

  const statusClass = (item: BudgetRequestItem) => {
    const s = item.status.toLowerCase();
    if (s.includes("archived") || s.includes("archive")) return "adminbudget-status adminbudget-status--archived";
    if (s === "completed") return "adminbudget-status adminbudget-status--approved";
    if (s.includes("rejected")) return "adminbudget-status adminbudget-status--rejected";
    return "adminbudget-status adminbudget-status--pending";
  };

 const getDisplayStatus = (item: BudgetRequestItem) => {
  const s = item.status.toLowerCase();
  if (s === 'completed') return 'Approved';
  if (s.includes('archived') || s.includes('archive')) return 'Archived';
  if (s.includes('rejected')) return 'Reject';
  if (s.includes('returned') || s.includes('return')) return 'Return';
  return 'Pending' + (item.current_stage ? ` ${item.current_stage.toUpperCase()}` : '');
};

 const stats = useMemo(() => {
  const total = data.length;
  const pendingCount = data.filter(item => {
    const status = item.status.toLowerCase();
    return !['completed', 'rejected', 'archived', 'archive'].some(s => status.includes(s));
  }
  ).length;
  const returnedCount = data.filter(item =>
    (item.status.toLowerCase().includes('returned') || item.status.toLowerCase().includes('return'))
  ).length;
  const rejectedCount = data.filter(item =>
    item.status.toLowerCase().includes('rejected')
  ).length;
  const approvedCount = data.filter(item =>
    (item.status.toLowerCase().includes('completed') || item.status.toLowerCase().includes('approved'))
  ).length;
  const archivedCount = data.filter(item =>
    item.status.toLowerCase().includes('archived') ||
    item.status.toLowerCase().includes('archive')
  ).length;
  return { total, pending: pendingCount, returned: returnedCount, rejected: rejectedCount, approved: approvedCount, archived: archivedCount };
}, [data]);

  const isHodBudgetView = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toLowerCase()) : [];
    const permissions = Array.isArray(user?.permissions)
      ? user.permissions.map((permission) => String(permission).toLowerCase())
      : [];

    return roles.includes("hod") || permissions.includes("budget.workflow.hod");
  }, [user]);

  const activeAdminBudgetTab = useMemo<"dashboard" | "approval">(() => {
    if (location.pathname.endsWith("/dashboard")) {
      return "dashboard";
    }

    return "approval";
  }, [location.pathname]);

  useEffect(() => {
    const isBaseAdminBudgetPath =
      location.pathname === "/adminbudget" || location.pathname === "/admin/budget";

    if (isBaseAdminBudgetPath) {
      navigate("/adminbudget/approval", { replace: true });
    }
  }, [location.pathname, navigate]);

  const goToAdminBudgetTab = (tab: "dashboard" | "approval") => {
    navigate(`/adminbudget/${tab}`);
  };
  const formatCreatedDate = (value?: string) => {
  if (!value) return "";
  const raw = value.split(" ")[0];          // "2026-03-03"
  const [year, month, day] = raw.split("-"); // ["2026","03","03"]
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

              <div className="adminbudget-header-actions">
                

                <select
                  className="adminbudget-control"
                  value={beneficiaryFilter}
                  onChange={(e) => setBeneficiaryFilter(e.target.value)}
                  title="Beneficiary"
                >
                  {BENEFICIARY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                <input
                  className="adminbudget-control"
                  type="text"
                  placeholder="Search Budget ID (#B-2026-0001)"
                  value={idSearch}
                  onChange={(e) => setIdSearch(e.target.value)}
                />

                <input
                  className="adminbudget-control"
                  type="text"
                  placeholder="Search Applicant Name"
                  value={applicantSearch}
                  onChange={(e) => setApplicantSearch(e.target.value)}
                />
              </div>
            </div>
           <div className="adminbudget-stats">
                <div 
                  className={`adminbudget-stats-card total ${statsFilter === 'total' ? 'active' : ''}`}
                  onClick={() => handleStatsFilter('total')}
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
                  className={`adminbudget-stats-card pending ${statsFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => handleStatsFilter('pending')}
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
                  className={`adminbudget-stats-card returned ${statsFilter === 'returned' ? 'active' : ''}`}
                  onClick={() => handleStatsFilter('returned')}
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
                  className={`adminbudget-stats-card rejected ${statsFilter === 'rejected' ? 'active' : ''}`}
                  onClick={() => handleStatsFilter('rejected')}
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
                  className={`adminbudget-stats-card approved ${statsFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => handleStatsFilter('approved')}
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
                  className={`adminbudget-stats-card archived ${statsFilter === 'archived' ? 'active' : ''}`}
                  onClick={() => handleStatsFilter('archived')}
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

              {!loading && filteredData.length === 0 && (
                <div className="adminbudget-state">No budget requests found</div>
              )}

              {!loading && filteredData.length > 0 && (
                <>
                  <div className="adminbudget-cards-container">
                    {currentItems.map((item) => {
                      

                      return (
                        <div className="adminbudget-item-wrap" key={item.id}>
                          <div
                            className={`adminbudget-item adminbudget-item--clickable ${archivingIds.has(item.id) ? "adminbudget-item--archiving" : ""}`}
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
                                <h5 className="adminbudget-name">{item.applicant_name || 'Unknown'}</h5>
                                <span className="adminbudget-date">
                                 {formatCreatedDate(item.created_date)}
                                  </span>

                              </div>

                              <div className="adminbudget-topbar-right">
                                <div className="adminbudget-amounts-container" style={{ display: 'flex', gap: '20px', textAlign: 'right', marginRight: '15px' }}>
                                  <div className="adminbudget-amount-item">
                                    
                                    <p className="adminbudget-amount" style={{ margin: 0, fontSize: '1.1rem' }}>
                                      ₹{Number(item.total_amount || 0).toLocaleString("en-IN")}
                                    </p>
                                  </div>
                                  {/* <div className="adminbudget-amount-item">
                                    <div style={{ fontSize: '11px', color: '#0069ab', textTransform: 'uppercase', marginBottom: '2px' }}>Approved</div>
                                    <p className="adminbudget-amount" style={{ margin: 0, color: '#0069ab', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                      ₹{Number(item.approved_total_amount || item.total_amount || 0).toLocaleString("en-IN")}
                                    </p>
                                  </div> */}
                                </div>

                               <button 
  className="adminbudget-icon-btn" 
  title="View" 
  onClick={(e) => {
    e.stopPropagation();
    navigate(`/budget/${item.id}?admin=true`);  // 👈 NEW - adds admin=true
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
                                    }}  // ✅ Pass admin flag
                                  >
                                    <Edit2 size={16} />
                                  </button>

                              </div>
                            </div>

                            <div className="adminbudget-row">
                              <div className="adminbudget-left">
                                {/* Line 1: Beneficiary TYPE only */}
                                  {/* <div className="adminbudget-detail-row">
                                    <span className="adminbudget-label">Beneficiary Type</span>
                                    <span className="adminbudget-value">{item.beneficiary_type}</span>
                                  </div> */}

                                  {/* Line 2: Beneficiary NAME */}
                                  <div className="adminbudget-detail-row">
                                    <span className="adminbudget-label">Beneficiary</span>
                                    <span className="adminbudget-value">{item.beneficiary_value || "Not specified"}</span>
                                  </div>

                              </div>

                              <div className="adminbudget-right">
                                <div className="adminbudget-status-wrap">
                                 
                                  <span className={statusClass(item)}>
                                    {getDisplayStatus(item)}
                                  </span>
                                </div>
                                <div className="adminbudget-actions-row">
                                  <button
                                    className="adminbudget-action-btn adminbudget-action-btn--approve"
                                    title="Approve"
                                    onClick={() => onApprove(item.id)}
                                    disabled={
                                      item.status.toLowerCase() === "completed" ||
                                      item.status.toLowerCase().includes("archived") ||
                                      item.status.toLowerCase().includes("archive")
                                    }
                                  >
                                    <CheckCircle2 size={18} />
                                  </button>

                                  <button
                                    className="adminbudget-action-btn adminbudget-action-btn--return"
                                    title="Return"
                                    onClick={() => openActionPopup("return", item.id, item.proposal_ref)}
                                    disabled={["completed", "rejected", "archived", "archive"].includes(item.status.toLowerCase())}
                                  >
                                    <RotateCcw size={18} />
                                  </button>

                                  <button
                                    className="adminbudget-action-btn adminbudget-action-btn--reject"
                                    title="Reject"
                                    onClick={() => openActionPopup("reject", item.id, item.proposal_ref)}
                                    disabled={
                                      item.status.toLowerCase() === "rejected" ||
                                      item.status.toLowerCase().includes("archived") ||
                                      item.status.toLowerCase().includes("archive")
                                    }
                                  >
                                    <XCircle size={18} />
                                  </button>

                                  <button
                                    className="adminbudget-action-btn adminbudget-action-btn--archive"
                                    title="Archive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onArchive(item.id);
                                    }}
                                    disabled={
                                      archivingIds.has(item.id) ||
                                      item.status.toLowerCase().includes("archived") ||
                                      item.status.toLowerCase().includes("archive")
                                    }
                                  >
                                    <AlertTriangle size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action card */}
                          
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
              <div className="adminbudget-dashboard-placeholder">
                Dashboard view will be added here.
              </div>
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
