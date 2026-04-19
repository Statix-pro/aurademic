import type { ReactNode } from 'react';

export type WorkflowDecision = 'approved' | 'rejected' | 'returned';

export interface WorkflowMeta {
  moduleKey: string;
  stages: string[];
  permittedStages: string[];
  isSuperAdmin: boolean;
  availableBeneficiaryTypes?: string[];
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
}

export interface WorkflowApprovalModuleConfig<TRecord extends Record<string, any> = Record<string, any>> {
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
  deleteEntityLabel?: string;
  queueParams?: {
    page?: number;
    limit?: number;
  };
  mapQueueResponse?: (response: any) => WorkflowQueueResult<TRecord>;
  mapTimelineResponse?: (response: any) => WorkflowTimelineItem[];
}
