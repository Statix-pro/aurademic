import type { ReactNode } from 'react';

export type WorkflowDecision = 'approved' | 'rejected' | 'returned';

export interface WorkflowMeta {
  moduleKey: string;
  stages: string[];
  permittedStages: string[];
  isSuperAdmin: boolean;
  availableBeneficiaryTypes?: string[];
  availableFiscalYears?: number[];
}

export interface WorkflowTimelineItem {
  id: number;
  stage: string;
  decision: string;
  feedback?: string | null;
  comment?: string | null;
  summary?: string | null;
  details?: any;
  actorEmail?: string | null;
  userName?: string | null;
  actorRole?: string | null;
  decidedAt?: string | null;
  createdAt?: string | null;
}

export interface WorkflowQueueColumn<TRecord extends Record<string, any> = Record<string, any>> {
  key: string;
  label: string;
  render?: (record: TRecord) => ReactNode;
  className?: string;
}

export interface WorkflowQueueResult<TRecord extends Record<string, any> = Record<string, any>> {
  items: TRecord[];
  total: number;
  page: number;
  limit: number;
  statusCounts?: {
    total: number;
    pending: number;
    approved: number;
    returned: number;
    rejected: number;
    archived: number;
  };
}

export interface WorkflowCsvExportMeta<TRecord extends Record<string, any> = Record<string, any>> {
  stage: string;
  /** Label of the active stage tab (e.g. "HOD", "Principal", "All Proposals"). */
  stageLabel: string;
  fiscalYear: number;
  statusFilter: string;
  beneficiaryFilter?: string;
  secondaryFilter?: string;
  searchTerm?: string;
  /**
   * Human-readable date window chosen in the export modal, e.g.
   * "01.04.2026 to 10.08.2026". Present only when the user set one — a date-filtered
   * file has to say so, or a reader can't tell it from a full export.
   */
  dateRangeLabel?: string;
  /** True when a date range replaced the fiscal-year scoping, so the file spans years. */
  allFiscalYears?: boolean;
  /**
   * Line-item breakdown keyed by record id, as returned by the module's export
   * endpoint. Empty when the module exposes no line items.
   */
  lineItems?: Record<string, any[]>;
  /** Page-level resolvers so mappers stay consistent with what the list shows. */
  getProposalRef: (record: TRecord) => string;
  getStatusLabel: (record: TRecord) => string;
  getStatusCategory: (record: TRecord) => string;
  getCurrentStageLabel: (record: TRecord) => string;
}

export interface WorkflowCsvExportResult {
  filename: string;
  content: string;
}

export interface WorkflowApprovalModuleConfig<
  TRecord extends Record<string, any> = Record<string, any>,
> {
  moduleKey: string;
  title: string;
  apiBasePath: string;
  columns: WorkflowQueueColumn<TRecord>[];
  stageLabels?: Record<string, string>;
  decisions?: WorkflowDecision[];
  requireFeedbackFor?: WorkflowDecision[];
  queueDefaultLimit?: number;
  getRecordId?: (record: TRecord) => number | string;
  getMetaEndpoint?: () => string;
  getQueueEndpoint?: (stage: string) => string;
  getApprovalEndpoint?: (id: number | string) => string;
  getTimelineEndpoint?: (id: number | string) => string;
  getViewRoute?: (id: number | string) => string;
  getEditRoute?: (id: number | string) => string;
  enablePdfPreview?: boolean;
  enableSuperAdminDelete?: boolean;
  enableLevel1RoleTabs?: boolean;
  enableSuperAdminAllProposals?: boolean;
  enableSecondaryFilter?: boolean;
  enableCsvExport?: boolean;
  csvExportMapper?: (
    rows: TRecord[],
    meta: WorkflowCsvExportMeta<TRecord>,
  ) => WorkflowCsvExportResult;
  deleteEntityLabel?: string;
  queueParams?: {
    page?: number;
    limit?: number;
  };
  mapQueueResponse?: (response: any) => WorkflowQueueResult<TRecord>;
  mapTimelineResponse?: (response: any) => WorkflowTimelineItem[];
}
