import React, { useEffect, useState, useMemo } from "react";
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import "./expendituredashboard.css";
import {
  Eye,
  Edit2,
  Trash2,
  ChevronDown,
  Plus,
  Search,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

interface ExpenditureItem {
  id: number;
  financeid?: number;
  proposalref?: string;
  applicantname: string;
  beneficiarytype: string;
  primaryhead: string;
  sub_head?: string;
  amount: number;
  overallstatus: "pending" | "approved" | "rejected";
  createdat: string;
  request_type?: string;
  workflow_state?: unknown;
}

type WorkflowModule = "Advance" | "Settlement" | "Expenditure";

interface DashboardReturnState {
  dashboardRowId?: string;
  rowReferenceId?: string;
  rowIndex?: number;
  submittedModule?: WorkflowModule;
  submittedAmount?: number;
  submittedRequestId?: number;
  financeRequestId?: number;
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
  tag: string;
  totalAmount: number;
  expenditureAmount: number;
  balanceAmount: number;
}

interface ExpenditureDashboardCardApi {
  financerequestid?: number;
  finance_request_id?: number;
  requestref?: string;
  request_ref?: string;
  applicantname?: string;
  applicant_name?: string;
  financetag?: string;
  finance_tag?: string;
  approvedamount?: number;
  approved_amount?: number;
  expenditureamount?: number;
  expenditure_amount?: number;
  balanceamount?: number;
  balance_amount?: number;
}

interface WorkflowRow {
  id: string;
  requestId?: number | null;
  advanceRequestId?: number | null;
  expenditureRequestId?: number | null;
  settlementRequestId?: number | null;
  rowIndex: number;
  baseRowRef: string;
  advanceRef: string;
  expenditureRef: string;
  settlementRef: string;
  primaryChoice: WorkflowModule | null;
  advanceAmount: number;
  expenditureAmount: number;
  settlementAmount: number;
  advanceSubHead?: string;
  expenditureSubHead?: string;
  settlementSubHead?: string;
  advanceStatus?: string;
  expenditureStatus?: string;
  settlementStatus?: string;
  approvalLevel: number;
}

type WorkflowStage = "idle" | "advance" | "settlement" | "expenditure" | "completed";

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

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeModule = (value: unknown): WorkflowModule | null => {
  const text = normalizeText(value).toLowerCase();
  if (text === "advance") return "Advance";
  if (text === "expenditure") return "Expenditure";
  if (text === "settlement") return "Settlement";
  return null;
};

  const normalizeStatus = (value: unknown) => normalizeText(value).toLowerCase() || "pending";

  const parseWorkflowState = (value: unknown): Record<string, unknown> | null => {
    if (!value) return null;
    if (typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    try {
      const parsed = JSON.parse(String(value));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  };

  const getRowKey = (req: ExpenditureItem) => {
    const state = parseWorkflowState(req.workflow_state);
    const direct = normalizeText(
      state?.workflowrowref ??
      state?.rowReferenceId ??
      state?.dashboardRowId ??
      state?.rowIndex ??
      ""
    );

    if (direct) return direct;
    return `finance-${normalizeText(req.financeid ?? "")}-legacy`;
  };

const ExpenditureDashboard: React.FC = () => {
  const [data, setData] = useState<ExpenditureItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [showWorkflowStatusDetail, setShowWorkflowStatusDetail] = useState<
    Record<string, boolean>
  >({});
  const [showRequestStatusDetail, setShowRequestStatusDetail] = useState<
    Record<number, boolean>
  >({});
  const [financeIdQuery, setFinanceIdQuery] = useState<string>("");
  const [financialYear, setFinancialYear] = useState<string>(getDefaultFilterFY());
  const [proposalCards, setProposalCards] = useState<ExpenditureProposalCard[]>([]);
  const [cardRows, setCardRows] = useState<Record<string, WorkflowRow[]>>({});

  const location = useLocation();
  const navigate = useNavigate();
  const dashboardState = (location.state as DashboardReturnState | null) ?? null;

  const fyOptions = useMemo(() => {
    const running = getRunningFYStart();
    const defaultStart = Number.parseInt(getDefaultFilterFY().split("-")[0], 10);
    const starts = Array.from(new Set([defaultStart, running, running - 1])).sort(
      (a, b) => b - a
    );

    return starts.map((start) => {
      const value = formatFY(start);
      return {
        value,
        label: `FY ${value}`,
      };
    });
  }, []);

  const normalizedFinanceIdQuery = financeIdQuery.trim().toLowerCase();

  const filteredData = useMemo(() => {
    if (!normalizedFinanceIdQuery) return data;

    return data.filter((item) => {
      const searchValues = [
        String(item.proposalref ?? ""),
        String(item.financeid ?? ""),
        String(item.id ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return searchValues.includes(normalizedFinanceIdQuery);
    });
  }, [data, normalizedFinanceIdQuery]);

  const formatAmount = (amount: number) =>
    `Rs ${Number(amount || 0).toLocaleString("en-IN")}`;

  const isApprovedStatus = (status?: string | null) =>
    normalizeStatus(status) === "approved";

  const isWorkflowRowCompleted = (row: WorkflowRow) => {
    if (row.primaryChoice === "Advance") {
      return isApprovedStatus(row.settlementStatus);
    }

    if (row.primaryChoice === "Expenditure") {
      return isApprovedStatus(row.expenditureStatus);
    }

    if (row.primaryChoice === "Settlement") {
      return isApprovedStatus(row.settlementStatus);
    }

    return false;
  };

  const getWorkflowStage = (row: WorkflowRow): WorkflowStage => {
    if (isWorkflowRowCompleted(row)) {
      return "completed";
    }

    if (row.primaryChoice === "Advance") {
      return row.settlementRequestId ? "settlement" : "advance";
    }

    if (row.primaryChoice === "Expenditure") {
      return "expenditure";
    }

    if (row.primaryChoice === "Settlement") {
      return row.settlementAmount > 0 ? "settlement" : "advance";
    }

    return "idle";
  };

  const handleModuleLaunch = (
    row: WorkflowRow,
    module: WorkflowModule,
    card: ExpenditureProposalCard
   ) => {
    const rowReferenceId =
      module === "Advance"
        ? row.advanceRef
        : module === "Expenditure"
        ? row.expenditureRef
        : row.settlementRef;

    const requestId =
      module === "Advance"
        ? row.advanceRequestId
        : module === "Expenditure"
        ? row.expenditureRequestId
        : row.settlementRequestId;

    const targetRequestId = requestId ?? null;

    navigate(targetRequestId ? `/expenditure/${targetRequestId}` : "/expenditure/new", {
      state: {
        activeTab: module,
        dashboardRowId: row.baseRowRef,
        rowReferenceId,
        rowIndex: row.rowIndex,
        submittedRequestId: targetRequestId ?? undefined,
        financeRequestId: Number(card.financeRequestId),
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
    const advanceLabel = "Advance";

    if (isCompleted) {
      return [
        { label: advanceLabel, module: "Advance" as const, disabled: true, submitted: row.primaryChoice === "Advance" },
        { label: "Settlement", module: "Settlement" as const, disabled: true, submitted: row.primaryChoice === "Settlement" },
        { label: "Expenditure", module: "Expenditure" as const, disabled: true, submitted: row.primaryChoice === "Expenditure" },
      ];
    }

    if (row.primaryChoice === "Advance") {
      return [
        { label: advanceLabel, module: "Advance" as const, disabled: true, submitted: true },
        { label: "Settlement", module: "Settlement" as const, disabled: Boolean(row.settlementRequestId), submitted: Boolean(row.settlementRequestId) },
        { label: "Expenditure", module: "Expenditure" as const, disabled: true, submitted: false },
      ];
    }

    if (row.primaryChoice === "Expenditure") {
      return [
        { label: "Advance", module: "Advance" as const, disabled: true, submitted: false },
        { label: "Expenditure", module: "Expenditure" as const, disabled: true, submitted: true },
      ];
    }

    if (row.primaryChoice === "Settlement") {
      return [
        { label: "Advance", module: "Advance" as const, disabled: true, submitted: false },
        { label: "Settlement", module: "Settlement" as const, disabled: true, submitted: true },
        { label: "Expenditure", module: "Expenditure" as const, disabled: true, submitted: false },
      ];
    }

    return [
      { label: "Advance", module: "Advance" as const, disabled: false, submitted: false },
      { label: "Expenditure", module: "Expenditure" as const, disabled: false, submitted: false },
    ];
  };

  const getWorkflowStatusLabel = (row: WorkflowRow) => {
    const stage = getWorkflowStage(row);

    if (stage === "completed") return "Approved";
    if (stage === "advance") return "Advance Submitted";
    if (stage === "settlement") return "Settlement Submitted";
    if (stage === "expenditure") return "Expenditure Submitted";
    return "Status";
  };

  const getWorkflowTimelineState = (
    row: WorkflowRow,
    stage: "hod" | "dof" | "principal"
  ) => {
    const workflowStage = getWorkflowStage(row);

    if (workflowStage === "completed") {
      return "completed";
    }

    if (workflowStage === "settlement") {
      if (stage === "hod") return "completed";
      if (stage === "dof") return "current";
      return "pending";
    }

    if (workflowStage === "advance") {
      if (stage === "hod") return "current";
      return "pending";
    }

    if (workflowStage === "expenditure") {
      if (stage === "hod") return "current";
      return "pending";
    }

    return "pending";
  };

  const getModuleSummary = (row: WorkflowRow, module: WorkflowModule) => {
    if (module === "Advance") {
      return {
        amount: row.advanceAmount,
        subHead: row.advanceSubHead || "",
      };
    }

    if (module === "Expenditure") {
      return {
        amount: row.expenditureAmount,
        subHead: row.expenditureSubHead || "",
      };
    }

    return {
      amount: row.settlementAmount,
      subHead: row.settlementSubHead || "",
    };
  };

  const getRequestStatusLabel = (status: ExpenditureItem["overallstatus"]) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "Pending";
  };

  const getRequestTimelineState = (
    status: ExpenditureItem["overallstatus"],
    stage: "hod" | "dof" | "principal"
  ) => {
    if (status === "approved") return "completed";
    if (status === "rejected") return "pending";
    if (stage === "hod") return "current";
    return "pending";
  };

  const buildRowsFromRequests = (
    cards: ExpenditureProposalCard[],
    requests: ExpenditureItem[]
  ): Record<string, WorkflowRow[]> => {
    const next: Record<string, WorkflowRow[]> = {};

    cards.forEach((card) => {
      const financeId = normalizeText(card.financeRequestId);
      const related = requests.filter(
        (req) => String(req.financeid ?? "") === financeId
      );
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
        const latestRequest = [...rowRequests].sort((a, b) => {
          const aTime = new Date(a.createdat || 0).getTime();
          const bTime = new Date(b.createdat || 0).getTime();
          if (aTime !== bTime) return bTime - aTime;
          return b.id - a.id;
        })[0] ?? null;

        const firstRequest = [...rowRequests].sort((a, b) => {
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
          };
        };

        const advanceSummary = summarizeModule("Advance");
        const expenditureSummary = summarizeModule("Expenditure");
        const settlementSummary = summarizeModule("Settlement");

        return {
          id: rowKey || `${financeId}-req-${latestRequest?.id ?? index + 1}`,
          requestId: latestRequest?.id ?? null,
          advanceRequestId: advanceSummary.requestId,
          expenditureRequestId: expenditureSummary.requestId,
          settlementRequestId: settlementSummary.requestId,
          rowIndex: index + 1,
          baseRowRef: rowKey || `${financeId}-req-${latestRequest?.id ?? index + 1}`,
          advanceRef: `${financeId}-advance-${rowKey || index + 1}`,
          expenditureRef: `${financeId}-expenditure-${rowKey || index + 1}`,
          settlementRef: `${financeId}-settlement-${rowKey || index + 1}`,
          primaryChoice: normalizeModule(firstRequest?.request_type),
          advanceAmount: advanceSummary.amount,
          expenditureAmount: expenditureSummary.amount,
          settlementAmount: settlementSummary.amount,
          advanceSubHead: advanceSummary.subHead,
          expenditureSubHead: expenditureSummary.subHead,
          settlementSubHead: settlementSummary.subHead,
          advanceStatus: advanceSummary.status,
          expenditureStatus: expenditureSummary.status,
          settlementStatus: settlementSummary.status,
          approvalLevel: latestRequest
            ? latestRequest.overallstatus === "approved"
              ? 3
              : latestRequest.overallstatus === "rejected"
              ? 0
              : 1
            : 0,
        };
      });

      next[financeId] = rowEntries.length > 0 ? rowEntries : [
        {
          id: `${financeId}-blank-1`,
          requestId: null,
          rowIndex: 1,
          baseRowRef: `${financeId}-blank-1`,
          advanceRef: `${financeId}-advance-blank-1`,
          expenditureRef: `${financeId}-expenditure-blank-1`,
          settlementRef: `${financeId}-settlement-blank-1`,
          primaryChoice: null,
          advanceAmount: 0,
          expenditureAmount: 0,
          settlementAmount: 0,
          advanceSubHead: "",
          expenditureSubHead: "",
          settlementSubHead: "",
          advanceStatus: "pending",
          expenditureStatus: "pending",
          settlementStatus: "pending",
          approvalLevel: 0,
        },
      ];
    });

    return next;
  };

  const addRow = (financeId: string) => {
    setCardRows((prev) => {
      const existing = prev[financeId] ?? [];
      const nextIndex = existing.length + 1;
      const nextRow: WorkflowRow = {
        id: `${financeId}-manual-${nextIndex}`,
        requestId: null,
        advanceRequestId: null,
        expenditureRequestId: null,
        settlementRequestId: null,
        rowIndex: nextIndex,
        baseRowRef: `${financeId}-manual-${nextIndex}`,
        advanceRef: `${financeId}-advance-manual-${nextIndex}`,
        expenditureRef: `${financeId}-expenditure-manual-${nextIndex}`,
        settlementRef: `${financeId}-settlement-manual-${nextIndex}`,
        primaryChoice: null,
        advanceAmount: 0,
        expenditureAmount: 0,
        settlementAmount: 0,
        advanceSubHead: "",
        expenditureSubHead: "",
        settlementSubHead: "",
        advanceStatus: "pending",
        expenditureStatus: "pending",
        settlementStatus: "pending",
        approvalLevel: 0,
      };

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

      const nextRows = existing
        .filter((row) => row.id !== rowId)
        .map((row, index) => ({
          ...row,
          rowIndex: index + 1,
        }));

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

    const confirmed = window.confirm(
      "Delete this pending expenditure request? This will reverse the reserved amount."
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const result = await authenticityUtility.delete(`/expenditure/${requestId}`) as {
        status?: string;
        message?: string;
      };

      if (result?.status !== "success") {
        throw new Error(result?.message || "Failed to delete expenditure request");
      }

      await fetchDashboard(openCardId);
    } catch (error) {
      console.error("Failed to delete expenditure request:", error);
      window.alert("Unable to delete this request. Only pending requests can be deleted.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async (preferredOpenCardId?: string | null) => {
    try {
      setLoading(true);

      const fyStart = Number.parseInt(financialYear.split("-")[0], 10);

      const res = await authenticityUtility.get("/expenditure/dashboard", {
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
        proposalref: String(item.proposalref ?? item.proposal_ref ?? ""),
        applicantname: String(item.applicantname ?? item.applicant_name ?? ""),
        beneficiarytype: String(item.beneficiarytype ?? item.beneficiary_type ?? ""),
        primaryhead: String(item.primaryhead ?? item.primary_head ?? ""),
        sub_head: String(item.sub_head ?? item.subHead ?? ""),
        amount: Number(item.amount ?? 0),
        overallstatus: String(item.overallstatus ?? item.overall_status ?? "pending") as
          | "pending"
          | "approved"
          | "rejected",
        createdat: String(item.createdat ?? item.created_at ?? ""),
        request_type: item.request_type ? String(item.request_type) : item.type ? String(item.type) : undefined,
        workflow_state: item.workflow_state ?? item.workflowState ?? null,
      }));

      const mappedCards: ExpenditureProposalCard[] = apiCards.map(
        (card: ExpenditureDashboardCardApi) => ({
          financeRequestId: String(card.finance_request_id ?? card.financerequestid ?? ""),
          proposalId: String(card.request_ref ?? card.requestref ?? card.finance_request_id ?? card.financerequestid ?? ""),
          applicantName: String(card.applicantname ?? card.applicant_name ?? ""),
          tag: String(card.financetag ?? card.finance_tag ?? "Finance"),
          totalAmount: Number(card.approvedamount ?? card.approved_amount ?? 0),
          expenditureAmount: Number(
            card.expenditureamount ?? card.expenditure_amount ?? 0
          ),
          balanceAmount: Number(card.balanceamount ?? card.balance_amount ?? 0),
        })
      );

      setData(mappedData);
      setProposalCards(mappedCards);
      setCardRows(buildRowsFromRequests(mappedCards, mappedData));
      setOpenCardId(preferredOpenCardId ?? mappedCards[0]?.financeRequestId ?? null);
    } catch (err) {
      console.error("Expenditure dashboard error:", err);
      setData([]);
      setProposalCards([]);
      setCardRows({});
      setOpenCardId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [financialYear]);

  useEffect(() => {
    const state = location.state as DashboardReturnState | null;
    if (!state) return;

    const financeId = normalizeText(
      state.financeRequestId ?? ""
    );

    if (!financeId) {
      navigate("/expenditurecard", { replace: true, state: null });
      return;
    }

    fetchDashboard(financeId);
    navigate("/expenditurecard", { replace: true, state: null });
  }, [location.state, navigate]);
  return (
    <section className="expenditure-page">
      <div className="expenditure-container">
        <div className="expenditure-card">
          <div className="expenditure-header">
            <div className="expenditure-header-left">
              <h5 className="expenditure-title">Expenditure Requests</h5>
            </div>

            <div className="expenditure-header-right">
              <div className="expenditure-search-wrap">
                <Search size={18} className="expenditure-search-icon" />
                <input
                  type="text"
                  className="expenditure-search-input"
                  value={financeIdQuery}
                  onChange={(e) => setFinanceIdQuery(e.target.value)}
                  placeholder="Search finance ID..."
                  aria-label="Search finance ID"
                />
              </div>

              <select
                className="expenditure-financial-year"
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
              >
                {fyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="expenditure-body">
            <div className="expenditure-demo-wrap">
              {proposalCards.map((card) => {
                const isCardOpen = openCardId === card.financeRequestId;
                const cardExpenditureAmount = Number(card.expenditureAmount || 0);
                const cardBalanceAmount = Math.max(Number(card.balanceAmount || 0), 0);
                const rows = cardRows[card.financeRequestId] ?? [];

                return (
                  <div
                    key={card.financeRequestId + card.applicantName}
                    className={`expenditure-demo-card ${isCardOpen ? "open" : ""}`}
                  >
                    <button
                      type="button"
                      className="expenditure-demo-trigger"
                      onClick={() =>
                        setOpenCardId((prev) =>
                          prev === card.financeRequestId ? null : card.financeRequestId
                        )
                      }
                    >
                      <div className="expenditure-demo-trigger__content">
                        <div className="expenditure-demo-trigger__id">{card.proposalId}</div>

                        <div className="expenditure-demo-trigger__title">
                          {card.applicantName}
                        </div>

                        <div className="expenditure-demo-trigger__meta">
                          <span>{card.tag}</span>
                        </div>
                      </div>

                      <div className="expenditure-demo-trigger__summary">
                        <div className="expenditure-demo-trigger__summary-item">
                          <span className="expenditure-demo-trigger__summary-label">
                            Approved
                          </span>
                          <strong>{formatAmount(card.totalAmount)}</strong>
                        </div>

                        <div className="expenditure-demo-trigger__summary-item">
                          <span className="expenditure-demo-trigger__summary-label">
                            Expenditure
                          </span>
                          <strong>{formatAmount(cardExpenditureAmount)}</strong>
                        </div>

                        <div className="expenditure-demo-trigger__summary-item">
                          <span className="expenditure-demo-trigger__summary-label">
                            Balance
                          </span>
                          <strong>{formatAmount(cardBalanceAmount)}</strong>
                        </div>
                      </div>

                      <ChevronDown
                        size={20}
                        className={`expenditure-demo-trigger__arrow ${
                          isCardOpen ? "open" : ""
                        }`}
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
                                const showAdvanceAmount = row.advanceAmount > 0;
                                const showExpenditureAmount = row.expenditureAmount > 0;
                                const showSettlementAmount = row.settlementAmount > 0;
                                const isCompleted = isWorkflowRowCompleted(row);

                                return (
                                  <div
                                    key={row.id}
                                    className={`expenditure-demo-row ${
                                      isCompleted
                                        ? "expenditure-demo-row--completed"
                                        : ""
                                    }`}
                                  >
                                    <div className="expenditure-demo-row__header">
                                      <div className="expenditure-demo-row__left">
                                        <div className="expenditure-demo-row__buttons">
                                          {actions.map((option) => (
                                            <button
                                              key={`${row.id}-${option.label}`}
                                              type="button"
                                              className={`expenditure-demo-option ${
                                                option.disabled ? "disabled" : ""
                                              } ${
                                                option.submitted ? "submitted" : ""
                                              } ${
                                                row.primaryChoice === option.module ||
                                                (option.module === "Settlement" &&
                                                  row.settlementAmount > 0)
                                                  ? "chosen"
                                                  : ""
                                              }`}
                                              onClick={() =>
                                                !option.disabled &&
                                                handleModuleLaunch(row, option.module, card)
                                              }
                                              disabled={option.disabled}
                                            >
                                              <span className="expenditure-demo-option__label">
                                                {option.label}
                                              </span>
                                            </button>
                                          ))}
                                        </div>

                                        <div className="expenditure-demo-row__amounts">
                                          {showAdvanceAmount && (
                                            <button
                                              type="button"
                                              className="expenditure-demo-row__amount-chip expenditure-demo-row__amount-chip--button"
                                              onClick={() => handleModuleLaunch(row, "Advance", card)}
                                            >
                                              <span className="expenditure-demo-row__amount-label">
                                                Advance
                                              </span>
                                              <strong>
                                                {getModuleSummary(row, "Advance").subHead
                                                  ? `${getModuleSummary(row, "Advance").subHead} | `
                                                  : ""}
                                                {formatAmount(row.advanceAmount)}
                                              </strong>
                                            </button>
                                          )}

                                          {showExpenditureAmount && (
                                            <button
                                              type="button"
                                              className="expenditure-demo-row__amount-chip expenditure-demo-row__amount-chip--button"
                                              onClick={() =>
                                                handleModuleLaunch(row, "Expenditure", card)
                                              }
                                            >
                                              <span className="expenditure-demo-row__amount-label">
                                                Expenditure
                                              </span>
                                              <strong>
                                                {getModuleSummary(row, "Expenditure").subHead
                                                  ? `${getModuleSummary(row, "Expenditure").subHead} | `
                                                  : ""}
                                                {formatAmount(row.expenditureAmount)}
                                              </strong>
                                            </button>
                                          )}

                                          {showSettlementAmount && (
                                            <button
                                              type="button"
                                              className="expenditure-demo-row__amount-chip expenditure-demo-row__amount-chip--button"
                                              onClick={() => handleModuleLaunch(row, "Settlement", card)}
                                            >
                                              <span className="expenditure-demo-row__amount-label">
                                                Settlement
                                              </span>
                                              <strong>
                                                {getModuleSummary(row, "Settlement").subHead
                                                  ? `${getModuleSummary(row, "Settlement").subHead} | `
                                                  : ""}
                                                {formatAmount(row.settlementAmount)}
                                              </strong>
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      <div className="expenditure-demo-row__status">
                                        <button
                                          type="button"
                                          className={`expenditure-status-pill ${
                                            isCompleted
                                              ? "expenditure-status-pill--approved"
                                              : ""
                                          } ${
                                            showWorkflowStatusDetail[row.id]
                                              ? "expenditure-status-pill--active"
                                              : ""
                                          }`}
                                          onClick={() =>
                                            setShowWorkflowStatusDetail((prev) => ({
                                              ...prev,
                                              [row.id]: !prev[row.id],
                                            }))
                                          }
                                          aria-expanded={Boolean(
                                            showWorkflowStatusDetail[row.id]
                                          )}
                                          aria-label={`Toggle approval status for ${row.id}`}
                                        >
                                          {getWorkflowStatusLabel(row)}
                                        </button>

                                        {showWorkflowStatusDetail[row.id] && (
                                          <div className="expenditure-status-detail-line">
                                            {(["hod", "dof", "principal"] as const).map(
                                              (stage, stepIndex, array) => {
                                                const stageState =
                                                  getWorkflowTimelineState(row, stage);

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
                                              }
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <div className="expenditure-demo-row__actions">
                                        {isLastRow && (
                                          <button
                                            type="button"
                                            className="expenditure-demo-row__icon-btn"
                                            onClick={() => addRow(card.financeRequestId)}
                                            title="Add row"
                                            aria-label="Add workflow row"
                                          >
                                            <Plus size={14} />
                                          </button>
                                        )}

                                        {rows.length > 1 && (
                                          <button
                                            type="button"
                                            className="expenditure-demo-row__icon-btn expenditure-demo-row__icon-btn--danger"
                                            onClick={() => deleteWorkflowRow(card.financeRequestId, row)}
                                            title="Delete row"
                                            aria-label="Delete workflow row"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
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
                  const statusLabel = getRequestStatusLabel(item.overallstatus);

                  return (
                    <div key={item.id} className="expenditure-request-card">
                      <div className="expenditure-request-cardtop">
                        <div className="expenditure-request-cardleft">
                          <div className="expenditure-request-cardindex">{idx + 1}</div>

                          <div className="expenditure-request-cardcontent">
                            <div className="expenditure-request-cardname">
                              {item.applicantname}
                            </div>

                            <div className="expenditure-request-cardmeta">
                              <span>{item.beneficiarytype}</span>
                              <span className="expenditure-demo-triggermeta-dot" />
                              <span>{item.primaryhead}</span>
                            </div>

                            <div className="expenditure-request-cardsub">
                              Submitted:{" "}
                              {item.createdat
                                ? new Date(item.createdat).toLocaleDateString()
                                : "-"}
                            </div>
                          </div>
                        </div>

                        <div className="expenditure-request-cardright">
                          <div className="expenditure-request-cardamount">
                            Rs {Number(item.amount || 0).toLocaleString("en-IN")}
                          </div>

                          <div className="expenditure-request-cardactions">
                            <button title="View" className="expenditure-action-global">
                              <Eye size={16} />
                            </button>
                            <button title="Edit" className="expenditure-action-global">
                              <Edit2 size={16} />
                            </button>
                            <button
                              title="Delete"
                              className="expenditure-action-global"
                              style={{ color: "#dc2626" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <button
                            type="button"
                            className={`expenditure-status-pill ${
                              isExpanded ? "expenditure-status-pill--active" : ""
                            }`}
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
                          {(["hod", "dof", "principal"] as const).map(
                            (stage, stageIndex, arr) => {
                              const stageState = getRequestTimelineState(
                                item.overallstatus,
                                stage
                              );

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
                            }
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {loading && (
              <div className="expenditure-state">Loading expenditure requests...</div>
            )}

            {!loading && filteredData.length === 0 && (
              <div className="expenditure-state expenditure-state--empty">
                <div style={{ color: "#6b7280", fontSize: "15px", marginTop: "10px" }}>
                  {financeIdQuery.trim()
                    ? `No expenditure requests found for finance ID "${financeIdQuery.trim()}".`
                    : `No expenditure requests found for FY ${financialYear}.`}
                </div>
              </div>
            )}

            
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExpenditureDashboard;
