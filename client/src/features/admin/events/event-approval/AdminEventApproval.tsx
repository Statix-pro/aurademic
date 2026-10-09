import React from 'react';

import WorkflowApprovalPage from '../../../../shared/pages/workflow/WorkflowApprovalPage';
import { getWorkflowModuleConfig } from '../../../../shared/workflow/workflowModuleConfigs';
import './AdminEventApproval.css';

const AdminEventApproval: React.FC = () => {
  const config = getWorkflowModuleConfig('event');
  if (!config) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning mb-0">Event workflow configuration not found.</div>
      </div>
    );
  }

  return (
    <div className="admin-event-approval-wrapper">
      <WorkflowApprovalPage config={config} />
    </div>
  );
};

export default AdminEventApproval;
export { AdminEventApproval };
