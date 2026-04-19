import * as expenditureModel from './expenditureModel.js';
import { registerWorkflowModule } from '../shared/workflow/workflowModuleRegistry.js';

const expenditureWorkflowAdapter = {
  async getRecordContext(recordId, options = {}) {
    return expenditureModel.getExpenditureRecordContext(recordId, options);
  },

  async updateRecordWorkflowSnapshot(recordId, newState, options = {}) {
    return expenditureModel.updateExpenditureWorkflowSnapshot(recordId, newState, options);
  },

  async listRecordsForQueue(stage, filters = {}, options = {}) {
    return expenditureModel.listExpenditureQueueRecords(stage, filters, options);
  },
};

registerWorkflowModule({
  moduleKey: 'expenditure',
  tableName: 'expenditure_requests',
  idColumn: 'id',
  stateColumn: 'workflow_state',
  adapter: expenditureWorkflowAdapter,
});

export default expenditureWorkflowAdapter;
