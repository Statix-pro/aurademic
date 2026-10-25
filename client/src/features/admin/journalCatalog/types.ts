/** Shapes returned by `/api/journal-catalog` (server/modules/journalCatalog). */

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ImportSource {
  key: string;
  label: string;
  description: string;
  kind: 'seed' | 'reference' | 'papers' | 'staff';
  fileTypes: string[];
  needsMetricYear: boolean;
  /** Pattern (regex source) for the workbook sheet the source reads, when it is a workbook. */
  workbookSheet: string | null;
  requiredColumns: string[];
}

export interface SourcesResponse {
  sources: ImportSource[];
  exclusionReasons: Record<string, string>;
}

export type Outcome = 'add' | 'update' | 'unchanged' | 'exception';
export type Resolution = 'pending' | 'applied' | 'excluded';
export type BatchStatus = 'previewed' | 'applied' | 'discarded';

export interface BatchSummary {
  rowsRead: number;
  outcomes: Record<Outcome, number>;
  excluded: Record<string, number>;
  journalsNotInFile?: number;
  /** Paper imports: of the papers to add, those that credit at least one staff member and those that credit none. */
  papers?: { credited: number; unassigned: number };
  /** Staff Scopus ID sheets: imported papers the new IDs will credit. */
  staff?: { papersToCredit: number };
  previouslyApplied?: { id: number; appliedAt: string } | null;
}

export interface ImportBatch {
  id: number;
  source_key: string;
  file_name: string | null;
  metric_year: number | null;
  status: BatchStatus;
  summary: BatchSummary;
  created_at: string;
  applied_at: string | null;
  discarded_at: string | null;
  created_by_name: string | null;
  applied_by_name: string | null;
  rowCounts?: { outcome: Outcome; resolution: Resolution; total: number }[];
}

export interface FieldChange {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

export interface ImportRow {
  id: number;
  source_row: number;
  outcome: Outcome;
  resolution: Resolution;
  journal_option_id: number | null;
  journal_name: string;
  reason: string | null;
  payload: {
    action: 'add' | 'update';
    create?: {
      journal_name: string;
      print_issn?: string;
      online_issn?: string;
      category?: string;
    };
  };
  changes: FieldChange[];
}

export interface ScopusIdRow {
  id: number;
  scopus_author_id: string;
  source: 'admin_sheet' | 'self_claim';
  created_at: string;
  created_by_name: string | null;
  erp_id: string;
  staff_name: string;
  papers: number;
}

export interface JournalListRow {
  id: number;
  journal_name: string;
  publisher: string | null;
  print_issn: string | null;
  online_issn: string | null;
  category: 'National' | 'International';
  level_source: 'auto' | 'faculty' | 'admin' | null;
  scopus_status: 'active' | 'inactive' | null;
  scopus_discontinued: number;
  medline: number;
  wos_indexed: number;
  country: string | null;
  impact_factor: string | null;
  impact_factor_year: number | null;
  cite_score: string | null;
  quartile: string | null;
  quartile_year: number | null;
  sjr: string | null;
}

export type JournalFilter =
  | 'if_needed'
  | 'no_quartile'
  | 'discontinued'
  | 'not_scopus'
  | 'wos'
  | 'national';

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
}
