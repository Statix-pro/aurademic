import React, { useEffect, useMemo, useState, useRef } from 'react';
import "./budgetdashboard.css";
import { Eye, Edit2, Plus, Trash2, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../../shared/components/layout/navbar/Navbar";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import AlertModal, { AlertType } from "../../../shared/components/ui/AlertModal";

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
  beneficiaryType: string;
  approvalFlow: string;
  createdAt: string;
  updatedAt: string;
  items: DashboardLineItem[];
  approvals: any[];
  edits: any[];
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
  timestamp: number;
  dateLabel: string;
  decision?: string;
}

const BudgetDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [budgetHeadSearch, setBudgetHeadSearch] = useState("");

  // State
  const [proposals, setProposals] = useState<ProposalGroup[]>([]);
  const [consolidatedData, setConsolidatedData] = useState<ConsolidatedRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    message: "",
    type: "info"
  });

  const showAlert = (message: React.ReactNode, type: AlertType = "info", title?: string, showCancel = false, confirmText = "OK", onConfirm?: () => void) => {
    setAlertConfig({ show: true, message, type, title, onConfirm, showCancel, confirmText });
  };

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, show: false }));

  const [showBudgetStatusDetail, setShowBudgetStatusDetail] = useState<{ [key: number]: boolean }>({});
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [logPopoverStyle, setLogPopoverStyle] = useState<React.CSSProperties>({});
  const infoTriggerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const formatFY = (fyStart: number) => `${fyStart}-${String(fyStart + 1).slice(2)}`;

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
  const fyOptions = useMemo(() => {
    const running = getRunningFYStart();
    const defaultStart = Number.parseInt(getDefaultFilterFY().split("-")[0], 10);
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
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError("");

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
        // Build a map of is_applicant_only from the list result
        const applicantOnlyMap: Record<number, boolean> = {};
        listResult.data.forEach((summary: any) => {
          applicantOnlyMap[summary.id] = Boolean(summary.is_applicant_only);
        });

        const detailPromises = listResult.data.map(async (summary: any) => {
          try {
            const detailJson = await authenticityUtility.get(
              `/budget/${summary.id}`
            ) as any;
            return detailJson.success ? { ...detailJson.data, _isApplicantOnly: applicantOnlyMap[summary.id] || false } : null;
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
            beneficiaryType: master.beneficiary_type,
            currentStage: master.current_stage,
            approvalFlow: master.approval_flow,
            createdAt: master.created_at,
            updatedAt: master.updated_at,
            items: items,
            approvals: data.pendingApprovals || data.approvals || [],
            edits: data.edits || [],
            totalProposed: items.reduce((sum: number, i: any) => sum + i.proposedAmount, 0),
            totalApproved: items.reduce((sum: number, i: any) => sum + i.approvedAmount, 0),
            isApplicantOnly: Boolean(data._isApplicantOnly),
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

  const normalizeText = (value?: string | null) => String(value || "").trim();

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString("en-IN");
  };

  const getRoleLabel = (role: string, proposal: ProposalGroup) => {
    const normalized = String(role || "").toLowerCase();
    if (normalized === 'level1') {
      const isEntity = ['club', 'cell', 'center', 'professional body'].includes(
        String(proposal.beneficiaryType || "").toLowerCase().trim()
      );
      return isEntity ? "Coordinator" : "HoD";
    }
    const map: Record<string, string> = {
      hod: "HoD",
      coordinator: "Coordinator",
      headcfrd: "CFRD",
      dof: "DoF",
      principal: "Principal",
    };
    return map[normalized] || (role ? role.toUpperCase() : "Approver");
  };

  const buildLogEvents = (proposal: ProposalGroup): LogEvent[] => {
    const events: LogEvent[] = [];
    const createdAtMs = proposal.createdAt ? new Date(proposal.createdAt).getTime() : 0;
    const updatedAtMs = proposal.updatedAt ? new Date(proposal.updatedAt).getTime() : 0;

    if (createdAtMs) {
      events.push({
        key: "submitted",
        title: "Submitted",
        subtitle: "Proposal created",
        timestamp: createdAtMs,
        dateLabel: formatDateTime(proposal.createdAt),
        decision: "submitted",
      });
    }

    const editLogs = Array.isArray(proposal.edits) ? proposal.edits : [];
    if (editLogs.length > 0) {
      editLogs.forEach((edit: any, idx: number) => {
        const createdAt = edit.created_at || edit.createdAt;
        const createdMs = createdAt ? new Date(createdAt).getTime() : createdAtMs;
        let summary = normalizeText(edit.summary);

        if (!summary && edit.details) {
          try {
            const parsed = JSON.parse(edit.details);
            const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
            if (lines.length > 0) {
              const details = lines.map((line: any) => (
                `Corrections made in Line No. ${line.lineNo}: ${(line.changes || []).join('; ')}`
              ));
              summary = details.join(' | ');
            }
          } catch {
            // ignore parse errors, fallback below
          }
        }

        if (!summary) return;

        events.push({
          key: `edit-${edit.id || idx}`,
          title: "Updated",
          subtitle: summary,
          timestamp: createdMs,
          dateLabel: createdAt ? formatDateTime(createdAt) : "-",
          decision: "updated",
        });
      });
    }

    (proposal.approvals || []).forEach((app: any, idx: number) => {
      const feedback = normalizeText(app.feedback);
      if (feedback === "Auto-approved after DoF clearance") {
        return;
      }
      const decision = String(app.decision || "updated").toLowerCase();
      const decidedAt = app.decided_at || app.decidedAt || app.decided_at_formatted;
      const decidedAtMs = decidedAt ? new Date(decidedAt).getTime() : 0;
      const feedbackNote = feedback ? `Note: ${feedback}` : "";
      const subtitleParts = [
        `by ${getRoleLabel(app.role, proposal)}`,
        feedbackNote,
      ].filter(Boolean);

      events.push({
        key: `approval-${idx}`,
        title: decision.charAt(0).toUpperCase() + decision.slice(1),
        subtitle: subtitleParts.join(" | "),
        timestamp: decidedAtMs || createdAtMs,
        dateLabel: decidedAt ? formatDateTime(decidedAt) : "-",
        decision,
      });
    });

    const submitted = events.filter((e) => e.decision === "submitted");
    const updates = events.filter((e) => e.decision === "updated").sort((a, b) => a.timestamp - b.timestamp);
    const approvals = events.filter((e) => e.decision !== "submitted" && e.decision !== "updated")
      .sort((a, b) => a.timestamp - b.timestamp);
    return [...submitted, ...updates, ...approvals];
  };

  const canAddForCurrentFY = () => {
    const selectedFY = parseInt(financialYear.split("-")[0]);
    const runningFY = getRunningFYStart();
    return selectedFY >= runningFY;
  };

  const handleDelete = async (id: number) => {
    showAlert(
      "Are you sure you want to delete this proposal?",
      "warning",
      "Confirm Deletion",
      true,
      "Delete",
      async () => {
        closeAlert();
        try {
          const json = await authenticityUtility.delete(`/budget/${id}`) as any;
          if (json.success) {
            setProposals((prev) => prev.filter((p) => p.proposalId !== id));
          } else {
            showAlert(json.message || "Failed to delete", "error");
          }
        } catch (error: any) {
          console.error(error);
          showAlert(error.response?.data?.message || error.message || "Failed to delete", "error");
        }
      }
    );
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
  const getTimelineState = (proposal: ProposalGroup, step: string) => {
    const { status, currentStage, approvalFlow } = proposal;

    // 1. Rejected
    if (status.includes('rejected')) {
      if (currentStage === step) return 'rejected';

      const stages = (approvalFlow || "").split('_');
      const currentIndex = stages.indexOf(currentStage);
      const stepIndex = stages.indexOf(step);
      if (stepIndex !== -1 && currentIndex !== -1 && stepIndex < currentIndex) return 'completed';
      return 'pending';
    }

    // 2. Fully Approved
    if (['principal_approved', 'completed'].includes(status)) return 'completed';

    // 3. In Progress Logic
    const stages = (approvalFlow || "hod_dof_principal").split('_');
    const currentIndex = stages.indexOf(currentStage);
    const stepIndex = stages.indexOf(step);

    if (stepIndex === -1) return 'pending';
    if (currentIndex === -1 || stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
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
                    {fyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
                else if (proposal.status === 're_submitted') statusLabel = "Resubmitted";
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="budgetdashboard-proposal-left">{label}</div>
                        <div
                          className="budgetdashboard-info-trigger"
                          ref={(el) => { infoTriggerRefs.current[proposal.proposalId] = el; }}
                          onClick={() => handleInfoClick(proposal.proposalId)}
                        >
                          <Info size={18} color="#6c757d" style={{ cursor: 'pointer' }} />
                          {activeLogId === proposal.proposalId && (
                            <div
                              className="budgetdashboard-log-popover"
                              style={logPopoverStyle}
                              ref={popoverRef}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="budgetdashboard-log-header">Submission Logs</div>
                              <div className="budgetdashboard-log-body">
                                {new Date(proposal.updatedAt).getTime() >
                                  new Date(proposal.createdAt).getTime() + 1000 && (
                                    <div className="budgetdashboard-log-item">
                                      <span className="log-label">Last Edited:</span>
                                      <span className="log-value">
                                        {formatDateTime(proposal.updatedAt)}
                                      </span>
                                    </div>
                                  )}

                                <div className="budgetdashboard-log-approvals">
                                  {buildLogEvents(proposal).map((event) => (
                                    <div key={event.key} className="log-approval-item">
                                      <div className="log-approval-meta">
                                        <span
                                          className={`log-decision log-decision--${event.decision || 'approved'
                                            }`}
                                        >
                                          {event.title.toUpperCase()}
                                        </span>
                                        <span className="log-role">
                                          {event.subtitle || 'Status update'}
                                        </span>
                                        <span className="log-date">{event.dateLabel}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="budgetdashboard-actions-global" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            className={`budgetdashboard-status-pill budgetdashboard-status-pill--${statusLabel.toLowerCase()}`}
                            onClick={() => setShowBudgetStatusDetail(prev => ({ ...prev, [proposal.proposalId]: !prev[proposal.proposalId] }))}
                          >
                            {statusLabel}
                          </div>

                          {/* Timeline (Only if Expanded) */}
                          {isExpanded && (
                            <div className="budgetdashboard-status-detail-line" style={{ marginTop: 0, padding: 0 }}>
                              {(proposal.approvalFlow || "hod_dof_principal").split('_').map((stage, sIdx, array) => {
                                const labelMap: Record<string, string> = {
                                  'hod': 'HoD',
                                  'headcfrd': 'CFRD',
                                  'dof': 'DoF',
                                  'principal': 'Principal'
                                };
                                const stageState = getTimelineState(proposal, stage);
                                return (
                                  <React.Fragment key={stage}>
                                    <div
                                      className={`budgetdashboard-status-line-circle ${getCircleClass(stageState)}`}
                                      title={labelMap[stage] || stage.toUpperCase()}
                                    />
                                    {sIdx < array.length - 1 && (
                                      <div className={`budgetdashboard-status-line-connector ${getConnectorClass(stageState)}`} />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button title="View" className="budgetdashboard-action-global" onClick={() => navigate(`/budget/${proposal.proposalId}`)}>
                            <Eye size={16} />
                          </button>
                          {/* Edit only if submitted/returned AND not applicant-only */}
                          {!proposal.isApplicantOnly && ['submitted', 're_submitted', 'level1_returned', 'hod_returned', 'dof_returned', 'principal_returned'].includes(proposal.status) && (
                            <button title="Edit" className="budgetdashboard-action-global" onClick={() => navigate(`/budget/${proposal.proposalId}/edit`)}>
                              <Edit2 size={16} />
                            </button>
                          )}
                          {/* Delete only if not fully approved AND not applicant-only */}
                          {!proposal.isApplicantOnly && !['principal_approved', 'completed'].includes(proposal.status) && (
                            <button title="Delete" className="budgetdashboard-action-global" onClick={() => handleDelete(proposal.proposalId)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
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
