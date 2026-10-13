import workorderModel from './workorderModel.js';
import { registerWorkflowModule } from '../shared/workflow/workflowModuleRegistry.js';

export const WORK_ORDER_FLOW = Object.freeze([
  'level1',
  'incharge',
  'principal',
  'workorder_admin',
]);
export const WORK_ORDER_WORKFLOW_PERMISSION = 'work_order.workflow.';

const workorderWorkflowAdapter = {
  async getRecordContext(recordId, options = {}) {
    return workorderModel.getWorkOrderRecordContext(recordId, options);
  },

  async updateRecordWorkflowSnapshot(recordId, newState, options = {}) {
    return workorderModel.updateWorkOrderWorkflowSnapshot(recordId, newState, options);
  },

  async listRecordsForQueue(stage, filters = {}, options = {}) {
    return workorderModel.listWorkOrderQueueRecords(stage, filters, options);
  },

  resolveStartFlow() {
    return [...WORK_ORDER_FLOW];
  },
};

registerWorkflowModule({
  moduleKey: 'workorder',
  tableName: 'work_orders',
  idColumn: 'id',
  stateColumn: 'workflow_state',
  adapter: workorderWorkflowAdapter,
});

export default workorderWorkflowAdapter;
