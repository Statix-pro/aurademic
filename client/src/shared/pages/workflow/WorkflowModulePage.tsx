import React from 'react';
import { useParams } from 'react-router-dom';

import WorkflowApprovalPage from './WorkflowApprovalPage';
import { getWorkflowModuleConfig } from '../../workflow/workflowModuleConfigs';

const WorkflowModulePage: React.FC = () => {
  const params = useParams<{ moduleKey?: string }>();
  const moduleKey = String(params.moduleKey || '')
    .trim()
    .toLowerCase();
  const config = getWorkflowModuleConfig(moduleKey);

  if (!moduleKey || !config) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning mb-0">
          Unsupported workflow module: <strong>{moduleKey || 'unknown'}</strong>
        </div>
      </div>
    );
  }

  return <WorkflowApprovalPage config={config} />;
};

export default WorkflowModulePage;
