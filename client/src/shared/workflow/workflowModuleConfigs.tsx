import { WorkflowApprovalModuleConfig } from './workflowApprovalTypes';

const formatCurrencyINR = (value: number) =>
  `\u20B9 ${Number(value || 0).toLocaleString('en-IN')}`;

const formatFinanceBeneficiary = (record: Record<string, any>) => {
  const type = String(record?.beneficiary_type || '').trim();
  const value = String(record?.beneficiary_value || '').trim();

  if (value) {
    return value;
  }

  return type || '-';
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
    enableSuperAdminAllProposals: true,
    enableSecondaryFilter: true,
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
            Number(record.total_amount || record.total_budget || record.amount || 0)
          ),
      },
    ],
    queueDefaultLimit: 20,
  },
};

export const getWorkflowModuleConfig = (moduleKey: string) =>
  WORKFLOW_MODULE_CONFIGS[String(moduleKey || '').trim().toLowerCase()] || null;
