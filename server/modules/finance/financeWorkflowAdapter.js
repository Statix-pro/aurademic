import financeModel from './financeModel.js';
import { registerWorkflowModule } from '../shared/workflow/workflowModuleRegistry.js';
import { WorkflowError } from '../shared/workflow/workflowValidators.js';

const ALLOWED_META_KEYS = new Set(['trigger', 'route', 'amountBand', 'financeMeta']);
const ALLOWED_AMOUNT_BANDS = new Set(['lte_10k', 'gt_10k']);
const FINANCE_FLOW_LTE_10K = Object.freeze(['level1', 'dof', 'principal']);
const FINANCE_FLOW_GT_10K = Object.freeze(['level1', 'dof', 'principal', 'chairman']);

const financeWorkflowAdapter = {
  async getRecordContext(recordId, options = {}) {
    return financeModel.getFinanceRecordContext(recordId, options);
  },

  async updateRecordWorkflowSnapshot(recordId, newState, options = {}) {
    return financeModel.updateFinanceWorkflowSnapshot(recordId, newState, options);
  },

  async listRecordsForQueue(stage, filters = {}, options = {}) {
    return financeModel.listFinanceQueueRecords(stage, filters, options);
  },

  async validateModuleMeta(moduleMeta) {
    if (moduleMeta === null || moduleMeta === undefined) {
      return null;
    }

    if (typeof moduleMeta !== 'object' || Array.isArray(moduleMeta)) {
      throw new WorkflowError(
        'finance workflow moduleMeta must be an object or null',
        400,
        'INVALID_WORKFLOW_META'
      );
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(moduleMeta)) {
      if (!ALLOWED_META_KEYS.has(key)) {
        throw new WorkflowError(
          `Unsupported finance workflow moduleMeta key: ${key}`,
          400,
          'INVALID_WORKFLOW_META'
        );
      }

      if (key === 'financeMeta') {
        if (value !== null && value !== undefined && (typeof value !== 'object' || Array.isArray(value))) {
          throw new WorkflowError(
            'finance workflow moduleMeta.financeMeta must be an object or null',
            400,
            'INVALID_WORKFLOW_META'
          );
        }

        sanitized[key] = value
          ? {
              unplannedBudgetEnabled: Boolean(value.unplannedBudgetEnabled),
              unplannedBudgetAmount:
                value.unplannedBudgetAmount !== undefined && value.unplannedBudgetAmount !== null
                  ? Number(value.unplannedBudgetAmount)
                  : null,
            }
          : null;
        continue;
      }

      if (value !== null && value !== undefined && typeof value !== 'string') {
        throw new WorkflowError(
          `finance workflow moduleMeta.${key} must be a string or null`,
          400,
          'INVALID_WORKFLOW_META'
        );
      }

      if (key === 'amountBand' && value !== null && value !== undefined && !ALLOWED_AMOUNT_BANDS.has(value)) {
        throw new WorkflowError(
          `finance workflow moduleMeta.amountBand must be one of: ${Array.from(ALLOWED_AMOUNT_BANDS).join(', ')}`,
          400,
          'INVALID_WORKFLOW_META'
        );
      }

      sanitized[key] = value ?? null;
    }

    return sanitized;
  },

  resolveStartFlow({ metadata }) {
    const amountBand = String(metadata?.moduleMeta?.amountBand || '').toLowerCase();
    return amountBand === 'gt_10k'
      ? [...FINANCE_FLOW_GT_10K]
      : [...FINANCE_FLOW_LTE_10K];
  },
};

registerWorkflowModule({
  moduleKey: 'finance',
  tableName: 'finance_requests',
  idColumn: 'id',
  stateColumn: 'workflow_state',
  adapter: financeWorkflowAdapter,
});

export default financeWorkflowAdapter;
