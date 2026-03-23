import React from 'react';
import WorkflowApprovalPage from '../../../shared/components/workflow/WorkflowApprovalPage';
import { getWorkflowModuleConfig } from '../../../shared/workflow/workflowModuleConfigs';

const FinanceWorkflowQueue: React.FC = () => {
  const config = getWorkflowModuleConfig('finance');

  if (!config) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning mb-0">Finance workflow config is missing.</div>
      </div>
    );
  }

  return <WorkflowApprovalPage config={config} />;
};

export default FinanceWorkflowQueue;
