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
  overallstatus: string;
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
  advanceRequestId2?: number | null; // For second advance
  expenditureRequestId?: number | null;
  settlementRequestId?: number | null;
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
  latestRequestId?: number | null;
  latestRequestType?: WorkflowModule | null;
  latestWorkflowState?: unknown;
  latestWorkflowStatus?: string;
  approvalLevel: number;
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
    workflowState?.status ??
      workflowState?.workflowStatus ??
      workflowState?.overallStatus ??
      "",
  );
  const lastDecision = normalizeText(workflowState?.lastDecision ?? "").toLowerCase();
  const currentStage = normalizeText(
    workflowState?.currentStage ??
      workflowState?.workflowStage ??
      "",
  ).toLowerCase();

  if (lastDecision === "resubmitted") return "Resubmitted";
  if (status === "approved" || status === "completed") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "returned") return "Returned";
  if (status === "principal_approved") return "Approved";
  if (status === "dof_approved") return "Pending Principal Approval";
  if (status === "hod_approved" || status === "level1_approved") return "Pending DoF Approval";
  if (currentStage === "level1" || currentStage === "hod") return "Pending HOD Approval";
  if (currentStage === "dof") return "Pending DoF Approval";
  if (currentStage === "principal") return "Pending Principal Approval";
  return "Pending HOD Approval";
};

const getWorkflowApprovalStageState = (
  workflowState: Record<string, unknown> | null | undefined,
  stage: "hod" | "dof" | "principal",
) => {
  const status = normalizeStatus(
    workflowState?.status ??
      workflowState?.workflowStatus ??
      workflowState?.overallStatus ??
      "",
  );
  const currentStage = normalizeText(
    workflowState?.currentStage ??
      workflowState?.workflowStage ??
      "",
  ).toLowerCase();
  const normalizedCurrentStage =
    currentStage === "level1" ? "hod" : currentStage;
  const stageOrder = ["hod", "dof", "principal"];
  const currentIndex = stageOrder.indexOf(normalizedCurrentStage);
  const stageIndex = stageOrder.indexOf(stage);

  if (status === "approved" || status === "completed" || status === "principal_approved") return "completed";
  if (currentIndex === -1) return "pending";
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "current";
  return "pending";
};

const getRowKey = (req: ExpenditureItem) => {
    const state = parseWorkflowState(req.workflow_state);
    const direct = normalizeText(
      state?.dashboardRowId ??
      state?.workflowrowref ??
      state?.rowReferenceId ??
      state?.rowIndex ??
      ""
    );

    if (direct) return direct;
  return `finance-${normalizeText(req.financeid ?? "")}-request-${normalizeText(req.id ?? "")}`;
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

  const filteredProposalCards = useMemo(() => {
    if (!normalizedFinanceIdQuery) return proposalCards;

    return proposalCards.filter((card) => {
      const searchValues = [
        String(card.financeRequestId ?? ""),
        String(card.proposalId ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return searchValues.includes(normalizedFinanceIdQuery);
    });
  }, [proposalCards, normalizedFinanceIdQuery]);

  const filteredData = useMemo(() => {
    const visibleFinanceIds = new Set(filteredProposalCards.map((card) => card.financeRequestId));
    return data.filter((item) => visibleFinanceIds.has(String(item.financeid ?? "")));
  }, [data, filteredProposalCards]);

  const formatAmount = (amount: number) =>
    `Rs ${Number(amount || 0).toLocaleString("en-IN")}`;

  const isApprovedStatus = (status?: string | null) =>
    ["approved", "completed", "principal_approved"].includes(normalizeStatus(status));

  const isEditableWorkflowStatus = (status?: string | null) => {
    const normalized = normalizeStatus(status);
    return [
      "pending",
      "submitted",
      "in_progress",
      "in progress",
      "returned",
      "draft",
    ].includes(normalized);
  };

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

  const createWorkflowRow = (financeId: string, rowIndex: number): WorkflowRow => ({
    id: `${financeId}-manual-${rowIndex}`,
    requestId: null,
    advanceRequestId: null,
    advanceRequestId2: null,
    expenditureRequestId: null,
    settlementRequestId: null,
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
    advanceSubHead: "",
    advanceSubHead2: "",
    expenditureSubHead: "",
    settlementSubHead: "",
    advanceStatus: "pending",
    advanceStatus2: "pending",
    expenditureStatus: "pending",
    settlementStatus: "pending",
    latestRequestId: null,
    latestRequestType: null,
    latestWorkflowStatus: "pending",
    approvalLevel: 0,
  });

  const handleModuleLaunch = (
    row: WorkflowRow,
    module: WorkflowModule | "Advance2",
    card: ExpenditureProposalCard,
    options?: { forceNew?: boolean; mode?: "create" | "edit" | "view" }
   ) => {
    const targetRow = row;

    // Handle Advance2 specifically
    const isAdvance2 = module === "Advance2";
    const targetModule = isAdvance2 ? "Advance" : module;

    const rowReferenceId =
      targetModule === "Advance"
        ? isAdvance2
          ? targetRow.advanceRef2 ?? `${targetRow.advanceRef}-2`
          : targetRow.advanceRef
        : targetModule === "Expenditure"
        ? targetRow.expenditureRef
        : targetRow.settlementRef;

    const requestId = options?.forceNew
      ? null
      : targetModule === "Advance"
      ? isAdvance2
        ? targetRow.advanceRequestId2
        : targetRow.advanceRequestId
      : targetModule === "Expenditure"
      ? targetRow.expenditureRequestId
      : targetRow.settlementRequestId;

    const targetRequestId = requestId ?? null;
    const launchMode =
      options?.mode ??
      (targetRequestId
        ? isEditableWorkflowStatus(targetRow.latestWorkflowStatus)
          ? "edit"
          : "view"
        : "create");
    const route =
      launchMode === "edit" && targetRequestId
        ? `/expenditure/${targetRequestId}/edit`
        : targetRequestId
        ? `/expenditure/${targetRequestId}`
        : "/expenditure/new";

    navigate(route, {
      state: {
        ...(launchMode === "view" ? { viewOnly: true } : { activeTab: targetModule }),
        isAdvance2: isAdvance2, // Pass flag for Advance2
        dashboardRowId: targetRow.baseRowRef,
        rowReferenceId,
        rowIndex: targetRow.rowIndex,
        submittedRequestId: targetRequestId ?? undefined,
        sourceRequestId: row.requestId ?? undefined,
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
    const hasAdvance1 = Boolean(row.advanceRequestId);
    const hasAdvance2 = Boolean(row.advanceRequestId2);
    const hasSettlement = Boolean(row.settlementRequestId);
    const showAdvance2 = (hasAdvance1 || hasAdvance2) && !hasSettlement;
    const showSettlement = hasAdvance1 || hasAdvance2 || hasSettlement;

    if (isCompleted) {
      return [
        {
          label: "Advance",
          module: "Advance" as const,
          hidden: !hasAdvance1,
          submitted: hasAdvance1,
        },
        {
          label: "Advance2",
          module: "Advance2" as const,
          hidden: !hasAdvance2 || hasSettlement,
          submitted: hasAdvance2,
        },
        {
          label: "Settlement",
          module: "Settlement" as const,
          hidden: !hasSettlement,
          submitted: hasSettlement,
        },
        {
          label: "Expenditure",
          module: "Expenditure" as const,
          hidden: !Boolean(row.expenditureRequestId),
          submitted: Boolean(row.expenditureRequestId),
        },
      ];
    }

    if (row.primaryChoice === "Advance") {
      return [
        {
          label: "Advance",
          module: "Advance" as const,
          hidden: false,
          submitted: hasAdvance1,
        },
        {
          label: "Advance2",
          module: "Advance2" as const,
          hidden: !showAdvance2,
          submitted: hasAdvance2,
        },
        {
          label: "Settlement",
          module: "Settlement" as const,
          hidden: !showSettlement,
          submitted: hasSettlement,
        },
        {
          label: "Expenditure",
          module: "Expenditure" as const,
          hidden: true,
          submitted: Boolean(row.expenditureRequestId),
        },
      ];
    }

  if (row.primaryChoice === "Expenditure") {
    return [
      {
        label: "Advance",
        module: "Advance" as const,
        hidden: true,
        submitted: false,
      },
      {
        label: "Advance2",
        module: "Advance2" as const,
        hidden: true,
        submitted: false,
      },
      {
        label: "Settlement",
        module: "Settlement" as const,
        hidden: true,
        submitted: false,
      },
      {
        label: "Expenditure",
        module: "Expenditure" as const,
        hidden: false,
        submitted: Boolean(row.expenditureRequestId) || row.expenditureAmount > 0,
      },
    ];
  }

  if (row.primaryChoice === "Settlement") {
    return [
      {
        label: "Advance",
        module: "Advance" as const,
        hidden: !hasAdvance1,
        submitted: hasAdvance1,
      },
      {
        label: "Advance2",
        module: "Advance2" as const,
        hidden: !showAdvance2,
        submitted: hasAdvance2,
      },
      {
        label: "Settlement",
        module: "Settlement" as const,
        hidden: false,
        submitted: hasSettlement,
      },
      {
        label: "Expenditure",
        module: "Expenditure" as const,
        hidden: true,
        submitted: false,
      },
    ];
  }

  return [
    {
      label: "Advance",
      module: "Advance" as const,
      hidden: false,
      submitted: false,
    },
    {
      label: "Advance2",
      module: "Advance2" as const,
      hidden: true,
      submitted: false,
    },
    {
      label: "Settlement",
      module: "Settlement" as const,
      hidden: true,
      submitted: false,
    },
    {
      label: "Expenditure",
      module: "Expenditure" as const,
      hidden: false,
      submitted: false,
    },
  ];
};
  const getWorkflowStatusLabel = (row: WorkflowRow) => {
    return getWorkflowApprovalLabel(parseWorkflowState(row.latestWorkflowState));
  };

  const getWorkflowTimelineState = (
    row: WorkflowRow,
    stage: "hod" | "dof" | "principal"
  ) => {
    return getWorkflowApprovalStageState(parseWorkflowState(row.latestWorkflowState), stage);
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

  const getRequestStatusLabel = (item: ExpenditureItem) =>
    getWorkflowApprovalLabel(parseWorkflowState(item.workflow_state));

  const getRequestTimelineState = (
    item: ExpenditureItem,
    stage: "hod" | "dof" | "principal"
  ) => getWorkflowApprovalStageState(parseWorkflowState(item.workflow_state), stage);

  const isWorkflowActionLocked = (row: WorkflowRow) => {
    const workflowState = parseWorkflowState(row.latestWorkflowState);
    const currentStage = normalizeText(
      workflowState?.currentStage ?? workflowState?.workflowStage ?? ""
    ).toLowerCase();
    const status = normalizeStatus(
      workflowState?.status ?? row.latestWorkflowStatus ?? ""
    );

    if (["returned", "rejected"].includes(status)) {
      return false;
    }

    return currentStage === "dof" || currentStage === "principal";
  };

 const getWorkflowGateMessage = (
  row: WorkflowRow,
  module: WorkflowModule | "Advance2"
) => {
  const advanceApproved = isApprovedStatus(row.advanceStatus);

  if (module === "Advance2" && !advanceApproved) {
    return "Advance 2 can be filled only after Advance 1 is completely approved.";
  }

  if (module === "Settlement" && !advanceApproved) {
    return "Settlement can be filled only after Advance 1 is completely approved.";
  }

  return null;
};

  const hasSubmittedProposal = (row: WorkflowRow) =>
    Boolean(
      row.latestRequestId ||
        row.advanceRequestId ||
        row.advanceRequestId2 ||
        row.expenditureRequestId ||
        row.settlementRequestId
    );

  const getRowWorkflowLabel = (row: WorkflowRow) => {
    if (!hasSubmittedProposal(row)) {
      return "Not Submitted";
    }

    return getWorkflowStatusLabel(row);
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
        const latestWorkflowStatus = latestRequest ? getRequestWorkflowStatus(latestRequest) : "pending";
        const latestWorkflowState = latestRequest?.workflow_state ?? null;
        const latestWorkflowCurrentStage = latestRequest
          ? normalizeText(getRequestWorkflowState(latestRequest)?.currentStage ?? "").toLowerCase()
          : "";

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

        // Special handling for Advance - separate first and second advance
        const advanceRows = rowRequests
          .filter((req) => normalizeModule(req.request_type) === "Advance")
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
        };

        const advanceSummary2 = secondAdvance ? {
          requestId: secondAdvance.id,
          amount: Number(secondAdvance.amount ?? 0),
          subHead: normalizeText(secondAdvance.sub_head),
          status: normalizeStatus(secondAdvance.overallstatus),
        } : null;

        const expenditureSummary = summarizeModule("Expenditure");
        const settlementSummary = summarizeModule("Settlement");
        const persistedRowIndex =
          rowRequests
            .map((req) => getWorkflowStateRowIndex(req.workflow_state))
            .find((value): value is number => Boolean(value)) ?? (index + 1);

        return {
          id: rowKey || `${financeId}-req-${latestRequest?.id ?? index + 1}`,
          requestId: latestRequest?.id ?? null,
          advanceRequestId: advanceSummary.requestId,
          advanceRequestId2: advanceSummary2?.requestId ?? null,
          expenditureRequestId: expenditureSummary.requestId,
          settlementRequestId: settlementSummary.requestId,
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
          advanceSubHead2: advanceSummary2?.subHead ?? "",
          expenditureSubHead: expenditureSummary.subHead,
          settlementSubHead: settlementSummary.subHead,
          advanceStatus: advanceSummary.status,
          advanceStatus2: advanceSummary2?.status ?? "pending",
          expenditureStatus: expenditureSummary.status,
          settlementStatus: settlementSummary.status,
          latestRequestId: latestRequest?.id ?? null,
          latestRequestType: normalizeModule(latestRequest?.request_type),
          latestWorkflowState,
          latestWorkflowStatus,
          approvalLevel: latestRequest
            ? latestWorkflowStatus === "approved"
              ? 3
              : latestWorkflowStatus === "rejected"
              ? 0
              : latestWorkflowCurrentStage === "principal"
              ? 3
              : latestWorkflowCurrentStage === "dof"
              ? 2
              : 1
            : 0,
        };
      });

      next[financeId] = rowEntries.length > 0 ? rowEntries : [
        {
          id: `${financeId}-blank-1`,
          requestId: null,
          advanceRequestId: null,
          advanceRequestId2: null,
          rowIndex: 1,
          baseRowRef: `${financeId}-blank-1`,
          advanceRef: `${financeId}-advance-blank-1`,
          advanceRef2: `${financeId}-advance2-blank-1`,
          expenditureRef: `${financeId}-expenditure-blank-1`,
          settlementRef: `${financeId}-settlement-blank-1`,
          primaryChoice: null,
          advanceAmount: 0,
          advanceAmount2: 0,
          expenditureAmount: 0,
          settlementAmount: 0,
          advanceSubHead: "",
          advanceSubHead2: "",
          expenditureSubHead: "",
          settlementSubHead: "",
          advanceStatus: "pending",
          advanceStatus2: "pending",
          expenditureStatus: "pending",
          settlementStatus: "pending",
          latestRequestId: null,
          latestRequestType: null,
          latestWorkflowState: null,
          latestWorkflowStatus: "pending",
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
      window.alert('No remaining balance is available for this proposal.');
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
        overallstatus: String(item.overallstatus ?? item.overall_status ?? "pending"),
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
                  placeholder="Search finance/proposal ID..."
                  aria-label="Search finance/proposal ID"
                />
              </div>

              <div className="expenditure-financial-year-wrap">
                <span className="expenditure-financial-year-label">Financial Year</span>
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
              </div>
            </div>
          </div>

          <div className="expenditure-body">
            <div className="expenditure-demo-wrap">
              {filteredProposalCards.map((card) => {
                const isCardOpen = openCardId === card.financeRequestId;
                const cardExpenditureAmount = Number(card.expenditureAmount || 0);
                const cardBalanceAmount = Math.max(Number(card.balanceAmount || 0), 0);
                const rows = cardRows[card.financeRequestId] ?? [];
                const canAddRow = cardBalanceAmount > 0;

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
                                const showAdvance2Amount =
                                  row.advanceAmount2 > 0 && !Boolean(row.settlementRequestId);
                                const showExpenditureAmount = row.expenditureAmount > 0;
                                const showSettlementAmount = row.settlementAmount > 0;
                                const isCompleted = isWorkflowRowCompleted(row);
                                const isActionLocked = isWorkflowActionLocked(row);
                                const hasProposal = hasSubmittedProposal(row);
                                const isReturnedRow = normalizeStatus(row.latestWorkflowStatus) === "returned";
                                const isRejectedRow = normalizeStatus(row.latestWorkflowStatus) === "rejected";
                                const canEditRow =
                                  hasProposal &&
                                  !isActionLocked &&
                                  (row.latestWorkflowStatus
                                    ? isEditableWorkflowStatus(row.latestWorkflowStatus)
                                    : !Boolean(row.latestRequestId));

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
                                          {actions.map((option) => {
                                            // Skip hidden buttons
                                            if (option.hidden) return null;
                                            const gateMessage = getWorkflowGateMessage(row, option.module);
                                            
                                            return (
                                            <button
                                              key={`${row.id}-${option.label}`}
                                              type="button"
                                              className={`expenditure-demo-option ${
                                                option.submitted ? "submitted" : ""
                                              } ${
                                                gateMessage ? "disabled" : ""
                                              } ${
                                                row.primaryChoice === option.module ||
                                                (option.module === "Settlement" &&
                                                  row.settlementAmount > 0)
                                                  ? "chosen"
                                                  : ""
                                              }`}
                                              onClick={() =>
                                                gateMessage
                                                  ? window.alert(gateMessage)
                                                  : handleModuleLaunch(
                                                      row,
                                                      option.module,
                                                      card,
                                                      {
                                                        mode: (
                                                          (option.module === "Advance" && Boolean(row.advanceRequestId)) ||
                                                          (option.module === "Advance2" && Boolean(row.advanceRequestId2)) ||
                                                          (option.module === "Settlement" && Boolean(row.settlementRequestId)) ||
                                                          (option.module === "Expenditure" && Boolean(row.expenditureRequestId))
                                                        )
                                                          ? "view"
                                                          : "create",
                                                        forceNew:
                                                          option.module === "Advance2" &&
                                                          !Boolean(row.advanceRequestId2),
                                                      }
                                                    )
                                              }
                                              title={gateMessage || undefined}
                                            >
                                              <span className="expenditure-demo-option__label">
                                                {option.label}
                                              </span>
                                            </button>
                                          )})}
                                        </div>

                                        <div className="expenditure-demo-row__amounts">
                                          {showAdvanceAmount && (
                                            <button
                                              type="button"
                                              className="expenditure-demo-row__amount-chip expenditure-demo-row__amount-chip--button"
                                              onClick={() =>
                                                handleModuleLaunch(row, "Advance", card, {
                                                  mode: "view",
                                                })
                                              }
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

                                          {showAdvance2Amount && (
                                            <button
                                              type="button"
                                              className="expenditure-demo-row__amount-chip expenditure-demo-row__amount-chip--button"
                                              onClick={() =>
                                                handleModuleLaunch(row, "Advance2", card, {
                                                  mode: "view",
                                                })
                                              }
                                            >
                                              <span className="expenditure-demo-row__amount-label">
                                                Advance2
                                              </span>
                                              <strong>
                                                {row.advanceSubHead2
                                                  ? `${row.advanceSubHead2} | `
                                                  : ""}
                                                {formatAmount(row.advanceAmount2)}
                                              </strong>
                                            </button>
                                          )}

                                          {showExpenditureAmount && (
                                            <button
                                              type="button"
                                              className="expenditure-demo-row__amount-chip expenditure-demo-row__amount-chip--button"
                                              onClick={() =>
                                                handleModuleLaunch(row, "Expenditure", card, {
                                                  mode: "view",
                                                })
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
                                              onClick={() =>
                                                handleModuleLaunch(row, "Settlement", card, {
                                                  mode: "view",
                                                })
                                              }
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
                                        {/* Edit button - only show for submitted proposals */}
                                        {hasProposal && (
                                          <button
                                            type="button"
                                            className="expenditure-demo-row__icon-btn"
                                            disabled={!canEditRow}
                                            onClick={() => {
                                              if (!canEditRow) return;

                                              // Navigate to the last submitted module for editing
                                              if (row.latestRequestType === "Advance" && row.advanceRequestId2) {
                                                handleModuleLaunch(row, "Advance2", card, { mode: "edit" });
                                              } else if (row.latestRequestType === "Advance" && row.advanceRequestId) {
                                                handleModuleLaunch(row, "Advance", card, { mode: "edit" });
                                              } else if (row.latestRequestType === "Expenditure" && row.expenditureRequestId) {
                                                handleModuleLaunch(row, "Expenditure", card, { mode: "edit" });
                                              } else if (row.latestRequestType === "Settlement" && row.settlementRequestId) {
                                                handleModuleLaunch(row, "Settlement", card, { mode: "edit" });
                                              } else if (row.advanceRequestId2) {
                                                handleModuleLaunch(row, "Advance2", card, { mode: "edit" });
                                              } else if (row.advanceRequestId) {
                                                handleModuleLaunch(row, "Advance", card, { mode: "edit" });
                                              } else if (row.settlementRequestId) {
                                                handleModuleLaunch(row, "Settlement", card, { mode: "edit" });
                                              } else if (row.expenditureRequestId) {
                                                handleModuleLaunch(row, "Expenditure", card, { mode: "edit" });
                                              }
                                            }}
                                            title={
                                              canEditRow
                                                ? "Edit proposal"
                                                : "Editing is disabled while approval is in progress"
                                            }
                                            aria-label="Edit proposal"
                                          >
                                            <Edit2 size={14} />
                                          </button>
                                        )}

                                        {hasProposal && (
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
                                            {getRowWorkflowLabel(row)}
                                          </button>
                                        )}

                                        {hasProposal && showWorkflowStatusDetail[row.id] && (
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
                                        {!isReturnedRow && !isRejectedRow && isLastRow && canAddRow && (
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

                                        {/* Hide delete button after approval/completion/archive */}
                                        {!isReturnedRow && !isRejectedRow && (
                                          <button
                                            type="button"
                                            className="expenditure-demo-row__icon-btn expenditure-demo-row__icon-btn--danger"
                                            disabled={
                                              isActionLocked ||
                                              row.latestWorkflowStatus === "approved" ||
                                              row.latestWorkflowStatus === "completed" ||
                                              row.latestWorkflowStatus === "archived"
                                            }
                                            onClick={() => {
                                              if (
                                                isActionLocked ||
                                                row.latestWorkflowStatus === "approved" ||
                                                row.latestWorkflowStatus === "completed" ||
                                                row.latestWorkflowStatus === "archived"
                                              ) {
                                                return;
                                              }
                                              deleteWorkflowRow(card.financeRequestId, row);
                                            }}
                                            title={
                                              isActionLocked
                                                ? "Delete is disabled while approval is in progress"
                                                : "Delete row"
                                            }
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
                  const statusLabel = getRequestStatusLabel(item);

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
                              title="Edit"
                              className="expenditure-action-global"
                              disabled={!isEditableWorkflowStatus(getRequestWorkflowStatus(item))}
                              onClick={() => {
                                if (!isEditableWorkflowStatus(getRequestWorkflowStatus(item))) return;
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
                                if (!isEditableWorkflowStatus(getRequestWorkflowStatus(item))) return;
                                deleteExpenditureRequest(item.id);
                              }}
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

            {!loading && filteredProposalCards.length === 0 && (
              <div className="expenditure-state expenditure-state--empty">
                <div style={{ color: "#6b7280", fontSize: "15px", marginTop: "10px" }}>
                  {financeIdQuery.trim()
                    ? `No expenditure requests found for "${financeIdQuery.trim()}".`
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
