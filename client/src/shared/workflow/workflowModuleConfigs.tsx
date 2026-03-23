import { WorkflowApprovalModuleConfig } from './workflowApprovalTypes';

const formatCurrencyINR = (value: number) =>
  `\u20B9 ${Number(value || 0).toLocaleString('en-IN')}`;

export const WORKFLOW_MODULE_CONFIGS: Record<string, WorkflowApprovalModuleConfig> = {
  finance: {
    moduleKey: 'finance',
    title: 'Finance Workflow Queue',
    apiBasePath: '/finance-requests',
    stageLabels: {
      level1: 'Level-1',
      dof: 'DoF',
      principal: 'Principal',
    },
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'applicant_name', label: 'Applicant' },
      { key: 'beneficiary_type', label: 'Beneficiary' },
      { key: 'primary_head', label: 'Head' },
      {
        key: 'total_budget',
        label: 'Amount',
        render: (record) => formatCurrencyINR(Number(record.total_budget || 0)),
      },
    ],
    queueDefaultLimit: 20,
  },
};

export const getWorkflowModuleConfig = (moduleKey: string) =>
  WORKFLOW_MODULE_CONFIGS[String(moduleKey || '').trim().toLowerCase()] || null;
