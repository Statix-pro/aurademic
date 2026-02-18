import React, { useEffect, useMemo, useState } from "react";
import "./budgetdashboard.css";
import { Eye, Edit2, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/layout/navbar/Navbar";
import authenticityUtility from "../../../shared/utils/authenticityUtility";

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
  currentStage: "hod" | "dof" | "principal" | "completed";
  approvalFlow: string;
  createdAt: string;
  items: DashboardLineItem[];
  totalProposed: number;
  totalApproved: number;
}

interface ConsolidatedRow {
  budgetHead: string;
  initial: number;
  additional: number;
  expenditure: number;
  balance: number;
}

const BudgetDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [budgetHeadSearch, setBudgetHeadSearch] = useState("");

  // State
  const [proposals, setProposals] = useState<ProposalGroup[]>([]);
  const [consolidatedData, setConsolidatedData] = useState<ConsolidatedRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showBudgetStatusDetail, setShowBudgetStatusDetail] = useState<{ [key: number]: boolean }>({});

  const getCurrentFY = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fyStart = month >= 4 ? year : year - 1;
    return `${fyStart}-${String(fyStart + 1).slice(2)}`;
  };

  const [financialYear, setFinancialYear] = useState(getCurrentFY());

  // --- Fetch Data ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) {
          setError("Authentication required.");
          return;
        }

        const fiscalYearNum = parseInt(financialYear.split("-")[0]);

        // 1. Fetch List
        const listResult = await authenticityUtility.get(
          `/budget/my?fiscalYear=${fiscalYearNum}&page=1&limit=100`
        ) as any;

        if (!listResult.success || !listResult.data) {
          setProposals([]);
          setConsolidatedData([]);
          return;
        }

        // 2. Fetch Details for ALL (Parallel)
        const detailPromises = listResult.data.map(async (summary: any) => {
          try {
            const detailJson = await authenticityUtility.get(
              `/budget/${summary.id}`
            ) as any;
            return detailJson.success ? detailJson.data : null;
          } catch (e) {
            return null;
          }
        });

        const fullProposals = (await Promise.all(detailPromises)).filter(Boolean);

        // 3. Process Proposals
        const parsedProposals: ProposalGroup[] = fullProposals.map((data: any) => {
          const master = data.master || data;
          const lines = data.lines || [];

          // CHECK: Is this proposal FULLY approved?
          const isFullyApproved = ['principal_approved', 'completed'].includes(master.status);

          const items = lines.map((line: any) => ({
            id: line.id,
            proposalId: master.id,
            budgetHead: line.budget_head || "Unknown",
            subHead: line.sub_head || "-",
            proposedAmount: parseFloat(line.line_total || 0),
            // ✅ FIX: Approved amount is 0 unless status is strictly 'completed' or 'principal_approved'
            approvedAmount: isFullyApproved ? parseFloat(line.line_total || 0) : 0,
            expenditure: 0, // Placeholder for future integration
            createdAt: master.created_at
          }));

          return {
            proposalId: master.id,
            proposalRef: master.proposal_ref,
            status: master.status,
            currentStage: master.current_stage,
            approvalFlow: master.approval_flow,
            createdAt: master.created_at,
            items: items,
            totalProposed: items.reduce((sum: number, i: any) => sum + i.proposedAmount, 0),
            totalApproved: items.reduce((sum: number, i: any) => sum + i.approvedAmount, 0)
          };
        });

        // Sort Chronologically (Oldest First)
        parsedProposals.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setProposals(parsedProposals);

        // 4. Generate Consolidated View (Approved Only)
        // Logic: Only include proposals that are strictly APPROVED
        const approvedProposals = parsedProposals.filter(p =>
          ['principal_approved', 'completed'].includes(p.status)
        );

        const consolidationMap: Record<string, ConsolidatedRow> = {};

        approvedProposals.forEach((p, index) => {
          const isInitial = index === 0; // First approved proposal is Initial

          p.items.forEach(item => {
            if (!consolidationMap[item.budgetHead]) {
              consolidationMap[item.budgetHead] = {
                budgetHead: item.budgetHead,
                initial: 0,
                additional: 0,
                expenditure: 0,
                balance: 0
              };
            }

            if (isInitial) {
              consolidationMap[item.budgetHead].initial += item.approvedAmount;
            } else {
              consolidationMap[item.budgetHead].additional += item.approvedAmount;
            }
          });
        });

        // Calculate Balance
        const finalConsolidated = Object.values(consolidationMap).map(row => ({
          ...row,
          balance: (row.initial + row.additional) - row.expenditure
        }));

        setConsolidatedData(finalConsolidated);

      } catch (err: any) {
        if (err.response?.status === 404) {
          setProposals([]);
          setConsolidatedData([]);
        } else {
          console.error("Dashboard Error:", err);
          setError(err.response?.data?.message || err.message || "Failed to load dashboard.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [financialYear]);

  // --- Helper Functions ---

  const formatINR = (n: number) => Number(n || 0).toLocaleString("en-IN");

  const canAddForCurrentFY = () => {
    const selectedFY = parseInt(financialYear.split("-")[0]);
    const currentFY = parseInt(getCurrentFY().split("-")[0]);
    return selectedFY >= currentFY;
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this proposal?")) return;
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) return;

      const json = await authenticityUtility.delete(`/budget/${id}`) as any;
      if (json.success) {
        setProposals((prev) => prev.filter((p) => p.proposalId !== id));
      } else {
        alert(json.message || "Failed to delete");
      }
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || error.message || "Failed to delete");
    }
  };

  // --- Filtering ---

  // Filtered Consolidated Data
  const filteredConsolidated = useMemo(() => {
    if (!budgetHeadSearch.trim()) return consolidatedData;
    const q = budgetHeadSearch.toLowerCase();
    return consolidatedData.filter(d => d.budgetHead.toLowerCase().includes(q));
  }, [consolidatedData, budgetHeadSearch]);

  const consolidatedTotals = useMemo(() => filteredConsolidated.reduce((acc, row) => ({
    initial: acc.initial + row.initial,
    additional: acc.additional + row.additional,
    expenditure: acc.expenditure + row.expenditure,
    balance: acc.balance + row.balance
  }), { initial: 0, additional: 0, expenditure: 0, balance: 0 }), [filteredConsolidated]);

  // Filtered Proposal List
  const filteredProposals = useMemo(() => {
    if (!budgetHeadSearch.trim()) return proposals;
    const q = budgetHeadSearch.toLowerCase();
    return proposals.filter(p =>
      p.items.some(i => i.budgetHead.toLowerCase().includes(q) || i.subHead.toLowerCase().includes(q))
    );
  }, [proposals, budgetHeadSearch]);

  // --- Timeline Logic ---
  const getTimelineState = (proposal: ProposalGroup, step: 'hod' | 'dof' | 'principal') => {
    const { status, currentStage } = proposal;

    // 1. Rejected
    if (status.includes('rejected')) {
      if (currentStage === step) return 'rejected'; // Red
      return 'completed'; // Green (Passed previous stages)
    }

    // 2. Fully Approved
    if (['principal_approved', 'completed'].includes(status)) return 'completed';

    // 3. In Progress Logic
    const stages = ['hod', 'dof', 'principal'];
    const currentIndex = stages.indexOf(currentStage);
    const stepIndex = stages.indexOf(step);

    if (stepIndex < currentIndex) return 'completed'; // Past stage (Green)
    if (stepIndex === currentIndex) return 'current'; // Current stage (Yellow)
    return 'pending'; // Future stage (Gray)
  };

  const getCircleClass = (state: string) => {
    switch (state) {
      case 'completed': return "budgetdashboard-status-circle-complete"; // Green
      case 'rejected': return "budgetdashboard-status-circle-rejected";  // Red
      case 'current': return "budgetdashboard-status-circle-pending";    // Yellow
      default: return "budgetdashboard-status-circle-incomplete";        // Gray
    }
  };

  const getConnectorClass = (state: string) => {
    switch (state) {
      case 'completed': return "complete";
      case 'rejected': return "rejected";
      case 'current': return "pending";
      default: return "incomplete";
    }
  };

  return (
    <>
      <Navbar />
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
                  <select
                    className="budgetdashboard-financial-year"
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                  >
                    <option value="2026-27">FY 2026-27</option>
                    <option value="2025-26">FY 2025-26</option>
                    <option value="2024-25">FY 2024-25</option>
                  </select>
                  <input
                    type="text"
                    className="budgetdashboard-search"
                    placeholder="Search Budget Head..."
                    value={budgetHeadSearch}
                    onChange={(e) => setBudgetHeadSearch(e.target.value)}
                  />
                </div>
                <button
                  className="budgetdashboard-add-btn"
                  onClick={() => navigate("/budget/new", { state: { fiscalYear: financialYear } })}
                  disabled={!canAddForCurrentFY()}
                  style={{ opacity: canAddForCurrentFY() ? 1 : 0.5 }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            <div className="budgetdashboard-body">
              {loading && <div className="budgetdashboard-state">Loading...</div>}
              {error && <div className="budgetdashboard-state" style={{ color: 'red' }}>{error}</div>}

              {/* 1. CONSOLIDATED TABLE (Approved Items Aggregated) */}
              {!loading && consolidatedData.length > 0 && (
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
                          <td colSpan={2}><strong>Total</strong></td>
                          <td><strong>₹{formatINR(consolidatedTotals.initial)}</strong></td>
                          <td><strong>₹{formatINR(consolidatedTotals.additional)}</strong></td>
                          <td><strong>₹{formatINR(consolidatedTotals.expenditure)}</strong></td>
                          <td><strong>₹{formatINR(consolidatedTotals.balance)}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. PROPOSAL LIST (Cards for Pending, Approved, etc.) */}
              {!loading && filteredProposals.map((proposal, idx) => {
                const label = idx === 0 ? "Initial Budget" : `Additional Budget ${idx}`;
                const isExpanded = showBudgetStatusDetail[proposal.proposalId] || false;

                // Status Pill Text
                let statusLabel = "Submitted";
                if (['principal_approved', 'completed'].includes(proposal.status)) statusLabel = "Approved";
                else if (proposal.status.includes('rejected')) statusLabel = "Rejected";
                else if (proposal.status.includes('returned')) statusLabel = "Returned";
                else if (proposal.status.includes('approved')) statusLabel = "Pending"; // Intermediate approval is still Pending

                // Timeline States
                const hodState = getTimelineState(proposal, 'hod');
                const dofState = getTimelineState(proposal, 'dof');
                const principalState = getTimelineState(proposal, 'principal');

                return (
                  <div key={proposal.proposalId} style={{ marginTop: '20px' }}>

                    {/* Card Header */}
                    <div className="budgetdashboard-proposal-header budgetdashboard-proposal-flat">
                      <div className="budgetdashboard-proposal-left">{label}</div>

                      <div className="budgetdashboard-actions-global">
                        {/* Status Pill */}
                        <div
                          className={`budgetdashboard-status-pill budgetdashboard-status-pill--${statusLabel.toLowerCase()}`}
                          onClick={() => setShowBudgetStatusDetail(prev => ({ ...prev, [proposal.proposalId]: !prev[proposal.proposalId] }))}
                        >
                          {statusLabel}
                        </div>

                        {/* Timeline (Only if Expanded) */}
                        {isExpanded && (
                          <div className="budgetdashboard-status-detail-line">
                            {/* HoD */}
                            <div className={`budgetdashboard-status-line-circle ${getCircleClass(hodState)}`} title="HoD" />
                            <div className={`budgetdashboard-status-line-connector ${getConnectorClass(hodState)}`} />

                            {/* DoF */}
                            <div className={`budgetdashboard-status-line-circle ${getCircleClass(dofState)}`} title="DoF" />
                            <div className={`budgetdashboard-status-line-connector ${getConnectorClass(dofState)}`} />

                            {/* Principal */}
                            <div className={`budgetdashboard-status-line-circle ${getCircleClass(principalState)}`} title="Principal" />
                          </div>
                        )}

                        <button title="View" className="budgetdashboard-action-global" onClick={() => navigate(`/budget/${proposal.proposalId}`)}>
                          <Eye size={16} />
                        </button>
                        {/* Edit only if submitted/returned */}
                        {['submitted', 'hod_returned', 'dof_returned'].includes(proposal.status) && (
                          <button title="Edit" className="budgetdashboard-action-global" onClick={() => navigate(`/budget/${proposal.proposalId}/edit`)}>
                            <Edit2 size={16} />
                          </button>
                        )}
                        {/* Delete only if not fully approved */}
                        {!['principal_approved', 'completed'].includes(proposal.status) && (
                          <button title="Delete" className="budgetdashboard-action-global" onClick={() => handleDelete(proposal.proposalId)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lines Table */}
                    <div className="budgetdashboard-table-section">
                      <div className="budgetdashboard-table-wrapper" style={{ margin: 0 }}>
                        <table className="budgetdashboard-pending-table" style={{ width: "100%" }}>
                          <thead>
                            <tr>
                              <th style={{ width: '50px' }}>S.No</th>
                              <th style={{ width: '300px' }}>Budget Head</th>
                              <th style={{ width: '300px' }}>Sub Head</th>
                              <th style={{ width: '150px' }}>Proposed</th>
                              <th style={{ width: '150px' }}>Approved</th>
                            </tr>
                          </thead>
                          <tbody>
                            {proposal.items.map((line, lIdx) => (
                              <tr key={line.id} onClick={() => navigate(`/budget/${proposal.proposalId}`)} style={{ cursor: 'pointer' }}>
                                <td>{lIdx + 1}</td>
                                <td><div className="budgetdashboard-head-title">{line.budgetHead}</div></td>
                                <td>{line.subHead}</td>
                                <td>₹{formatINR(line.proposedAmount)}</td>
                                <td>₹{formatINR(line.approvedAmount)}</td> {/* 0 until fully approved */}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="budgetdashboard-total-row">
                              <td colSpan={3}><strong>Total</strong></td>
                              <td><strong>₹{formatINR(proposal.totalProposed)}</strong></td>
                              <td><strong>₹{formatINR(proposal.totalApproved)}</strong></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!loading && proposals.length === 0 && (
                <div className="budgetdashboard-state">No budget proposals found for this fiscal year.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default BudgetDashboard;
