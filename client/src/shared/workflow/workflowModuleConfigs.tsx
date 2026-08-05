import {
  WorkflowApprovalModuleConfig,
  WorkflowCsvExportMeta,
  WorkflowCsvExportResult,
} from './workflowApprovalTypes';
import {
  buildCsvFilename,
  buildCsvSection,
  formatAmountForCsv,
  formatDateForCsv,
  formatFiscalYearLabel,
  joinCsvSections,
  type CsvCell,
} from '../utils/csvExportUtils';

const formatCurrencyINR = (value: number) => `\u20B9 ${Number(value || 0).toLocaleString('en-IN')}`;

const formatFinanceBeneficiary = (record: Record<string, any>) => {
  const type = String(record?.beneficiary_type || '').trim();
  const value = String(record?.beneficiary_value || '').trim();

  if (value) {
    return value;
  }

  return type || '-';
};

const getRecordApplicantName = (record: Record<string, any>) =>
  String(record?.applicant_name || record?.user_name || record?.faculty_name || '').trim();

// Beneficiary reads as "Department - CSE" so the type is still visible when the
// value alone would be ambiguous.
const formatCsvBeneficiary = (record: Record<string, any>) => {
  const type = String(record?.beneficiary_type || '').trim();
  const value = String(record?.beneficiary_value || '').trim();

  if (type && value && type.toLowerCase() !== value.toLowerCase()) {
    return `${type} - ${value}`;
  }
  return value || type;
};

const getCsvProposedAmount = (record: Record<string, any>) =>
  formatAmountForCsv(
    record?.total_amount ?? record?.total_budget ?? record?.amount ?? record?.proposed_amount ?? 0,
  );

const getCsvApprovedAmount = (record: Record<string, any>) =>
  formatAmountForCsv(record?.approved_total_amount ?? record?.approved_amount ?? 0);

const getCsvRecordDate = (record: Record<string, any>) =>
  formatDateForCsv(record?.request_date || record?.created_at || record?.created_date);

const STATUS_FILTER_LABELS: Record<string, string> = {
  total: 'All Statuses',
  pending: 'Pending',
  approved: 'Approved',
  returned: 'Returned',
  rejected: 'Rejected',
  archived: 'Archived',
};

const formatStatusFilterLabel = (statusFilter: string) =>
  STATUS_FILTER_LABELS[String(statusFilter || '').toLowerCase()] || 'All Statuses';

const buildCsvHeaderLines = (moduleTitle: string, meta: WorkflowCsvExportMeta): string => {
  const scopeParts = [
    formatFiscalYearLabel(meta.fiscalYear),
    meta.stageLabel,
    formatStatusFilterLabel(meta.statusFilter),
  ].filter(Boolean);

  const lines = [buildCsvSection(`${moduleTitle} Export - ${scopeParts.join(' - ')}`, [], [])];

  const appliedFilters: string[] = [];
  if (meta.beneficiaryFilter && meta.beneficiaryFilter !== 'All Beneficiary') {
    appliedFilters.push(`Beneficiary: ${meta.beneficiaryFilter}`);
  }
  if (meta.secondaryFilter) {
    appliedFilters.push(`Filter: ${meta.secondaryFilter}`);
  }
  if (meta.searchTerm) {
    appliedFilters.push(`Search: ${meta.searchTerm}`);
  }
  if (appliedFilters.length) {
    lines.push(buildCsvSection(appliedFilters.join(' | '), [], []));
  }

  lines.push(buildCsvSection(`Exported on: ${formatDateForCsv(new Date())}`, [], []));

  return lines.join('\n');
};

const buildCsvTotalsSection = (rows: Record<string, any>[], meta: WorkflowCsvExportMeta) => {
  const totalProposed = rows.reduce((sum, record) => sum + getCsvProposedAmount(record), 0);
  const totalApproved = rows.reduce((sum, record) => sum + getCsvApprovedAmount(record), 0);

  const counts = new Map<string, number>();
  rows.forEach((record) => {
    const category = String(meta.getStatusCategory(record) || 'pending').toLowerCase();
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  const totalsRows: CsvCell[][] = [
    ['Total Proposed', totalProposed],
    ['Total Approved', totalApproved],
    ['Total Count', rows.length],
  ];

  ['pending', 'approved', 'returned', 'rejected', 'archived'].forEach((category) => {
    const count = counts.get(category);
    if (count) {
      totalsRows.push([`${category.charAt(0).toUpperCase()}${category.slice(1)} Count`, count]);
    }
  });

  return buildCsvSection('Totals', [], totalsRows);
};

/**
 * Builds a "one row per line item" section from the export endpoint's lineItems map,
 * prefixing each row with its request ref so the section can be read on its own.
 */
const buildCsvBreakdownSection = (
  title: string,
  headers: string[],
  rows: Record<string, any>[],
  meta: WorkflowCsvExportMeta,
  mapLine: (line: Record<string, any>) => CsvCell[],
) => {
  const lineItems = meta.lineItems || {};
  const dataRows: CsvCell[][] = [];

  rows.forEach((record) => {
    const recordLines = lineItems[String(record?.id)] || [];
    recordLines.forEach((line: Record<string, any>) => {
      dataRows.push([meta.getProposalRef(record), ...mapLine(line)]);
    });
  });

  if (!dataRows.length) {
    return '';
  }

  return buildCsvSection(title, ['Ref', ...headers], dataRows);
};

const FINANCE_CSV_HEADERS = [
  'Ref',
  'Applicant',
  'Department',
  'Beneficiary',
  'Tag',
  'Head of Accounts',
  'Proposed Amount',
  'Approved Amount',
  'Status',
  'Stage',
  'Date',
];

const financeCsvExportMapper = (
  rows: Record<string, any>[],
  meta: WorkflowCsvExportMeta,
): WorkflowCsvExportResult => {
  const dataRows: CsvCell[][] = rows.map((record) => [
    meta.getProposalRef(record),
    getRecordApplicantName(record),
    String(record?.department || '').trim(),
    formatCsvBeneficiary(record),
    String(record?.budget_tag || record?.budgetTag || '').trim(),
    String(record?.primary_head || '').trim(),
    getCsvProposedAmount(record),
    getCsvApprovedAmount(record),
    meta.getStatusLabel(record),
    meta.getCurrentStageLabel(record),
    getCsvRecordDate(record),
  ]);

  const content = joinCsvSections([
    buildCsvHeaderLines('Finance Requests', meta),
    buildCsvSection('Request Details', FINANCE_CSV_HEADERS, dataRows),
    buildCsvBreakdownSection(
      'Budget Breakdown',
      ['Head of Accounts', 'Sub Head', 'Proposed Amount', 'Approved Amount', 'Top-up Row'],
      rows,
      meta,
      (line) => [
        String(line?.budget_head || '').trim(),
        String(line?.sub_head || '').trim(),
        formatAmountForCsv(line?.amount),
        formatAmountForCsv(line?.approved_amount),
        Number(line?.is_topup || 0) === 1 ? 'Yes' : 'No',
      ],
    ),
    buildCsvTotalsSection(rows, meta),
  ]);

  return {
    filename: buildCsvFilename([
      'Finance',
      meta.stageLabel,
      formatStatusFilterLabel(meta.statusFilter),
      formatFiscalYearLabel(meta.fiscalYear).replace(/\s+/g, ''),
    ]),
    content,
  };
};

const EXPENDITURE_CSV_HEADERS = [
  'Ref',
  'Applicant',
  'Department',
  'Beneficiary',
  'Type',
  'Proposed Amount',
  'Approved Amount',
  'Status',
  'Stage',
  'Date',
  'Linked Finance Ref',
];

const formatExpenditureProposalType = (record: Record<string, any>) => {
  const rawType = String(
    record?.proposal_type || record?.request_type || record?.expenditure_type || record?.type || '',
  )
    .trim()
    .toLowerCase();

  if (rawType.includes('advance 2') || rawType.includes('advance2')) return 'Advance 2';
  if (rawType.includes('advance')) return 'Advance';
  if (rawType.includes('settlement')) return 'Settlement';
  if (rawType.includes('expenditure')) return 'Expenditure';
  return '';
};

const getLinkedFinanceRef = (record: Record<string, any>) =>
  String(
    record?.finance_request_ref ||
      record?.financeRequestRef ||
      record?.finance_proposal_ref ||
      (record?.finance_request_id ? `#F-${record.finance_request_id}` : ''),
  ).trim();

const expenditureCsvExportMapper = (
  rows: Record<string, any>[],
  meta: WorkflowCsvExportMeta,
): WorkflowCsvExportResult => {
  const dataRows: CsvCell[][] = rows.map((record) => [
    meta.getProposalRef(record),
    getRecordApplicantName(record),
    String(record?.department || '').trim(),
    formatCsvBeneficiary(record),
    formatExpenditureProposalType(record),
    getCsvProposedAmount(record),
    getCsvApprovedAmount(record),
    meta.getStatusLabel(record),
    meta.getCurrentStageLabel(record),
    getCsvRecordDate(record),
    getLinkedFinanceRef(record),
  ]);

  const content = joinCsvSections([
    buildCsvHeaderLines('Expenditure Requests', meta),
    buildCsvSection('Request Details', EXPENDITURE_CSV_HEADERS, dataRows),
    buildCsvBreakdownSection(
      'Row Breakdown',
      ['Row Type', 'Head of Accounts', 'Sub Head', 'Source', 'Budget Amount', 'Amount'],
      rows,
      meta,
      (line) => [
        String(line?.row_kind || '').trim(),
        String(line?.budget_head || '').trim(),
        String(line?.sub_head || '').trim(),
        String(line?.amount_source || '').trim(),
        formatAmountForCsv(line?.budget_amount),
        formatAmountForCsv(line?.amount),
      ],
    ),
    buildCsvTotalsSection(rows, meta),
  ]);

  return {
    filename: buildCsvFilename([
      'Expenditure',
      meta.stageLabel,
      formatStatusFilterLabel(meta.statusFilter),
      formatFiscalYearLabel(meta.fiscalYear).replace(/\s+/g, ''),
    ]),
    content,
  };
};

export const WORKFLOW_MODULE_CONFIGS: Record<string, WorkflowApprovalModuleConfig> = {
  finance: {
    moduleKey: 'finance',
    title: 'Finance Requests',
    apiBasePath: '/finance-requests',
    stageLabels: {
      level1: 'Level-1',
      dof: 'DoF',
      principal: 'Principal',
      chairman: 'Chairman',
    },
    getTimelineEndpoint: (id) => `/finance-requests/${id}/status-updates`,
    getViewRoute: (id) => `/finance/${id}?admin=true`,
    getEditRoute: (id) => `/finance/${id}/edit?admin=true`,
    enablePdfPreview: true,
    enableSuperAdminDelete: true,
    enableLevel1RoleTabs: true,
    enableSuperAdminAllProposals: true,
    enableSecondaryFilter: true,
    enableCsvExport: true,
    csvExportMapper: financeCsvExportMapper,
    deleteEntityLabel: 'finance request',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'applicant_name', label: 'Applicant' },
      {
        key: 'beneficiary_type',
        label: 'Beneficiary',
        render: (record) => formatFinanceBeneficiary(record),
      },
      { key: 'primary_head', label: 'Head' },
      {
        key: 'total_budget',
        label: 'Amount',
        render: (record) => formatCurrencyINR(Number(record.total_budget || 0)),
      },
    ],
    queueDefaultLimit: 20,
  },
  expenditure: {
    moduleKey: 'expenditure',
    title: 'Expenditure Requests',
    apiBasePath: '/expenditure-requests',
    stageLabels: {
      level1: 'Level-1',
      dof: 'DoF',
      principal: 'Principal',
    },
    getTimelineEndpoint: (id) => `/expenditure-requests/${id}/status-updates`,
    getViewRoute: (id) => `/expenditure/${id}?admin=true`,
    getEditRoute: (id) => `/expenditure/${id}/edit?admin=true`,
    enableSuperAdminDelete: true,
    enableLevel1RoleTabs: true,
    enablePdfPreview: false,
    enableSuperAdminAllProposals: true,
    enableSecondaryFilter: true,
    enableCsvExport: true,
    csvExportMapper: expenditureCsvExportMapper,
    deleteEntityLabel: 'expenditure request',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'applicant_name', label: 'Applicant' },
      {
        key: 'beneficiary_type',
        label: 'Beneficiary',
        render: (record) => formatFinanceBeneficiary(record),
      },
      { key: 'primary_head', label: 'Head' },
      {
        key: 'total_amount',
        label: 'Amount',
        render: (record) =>
          formatCurrencyINR(
            Number(record.total_amount || record.total_budget || record.amount || 0),
          ),
      },
    ],
    queueDefaultLimit: 20,
  },
};

export const getWorkflowModuleConfig = (moduleKey: string) =>
  WORKFLOW_MODULE_CONFIGS[
    String(moduleKey || '')
      .trim()
      .toLowerCase()
  ] || null;
