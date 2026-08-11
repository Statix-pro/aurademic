import * as expenditureModel from './expenditureModel.js';
import { registerWorkflowModule } from '../shared/workflow/workflowModuleRegistry.js';
import { WorkflowError } from '../shared/workflow/workflowValidators.js';

const ALLOWED_META_KEYS = new Set([
  'trigger',
  'route',
  'amountBand',
  'beneficiaryType',
  'expenditureMeta',
]);
const ALLOWED_AMOUNT_BANDS = new Set(['lte_10k', 'gt_10k']);
const EXPENDITURE_FLOW_DEFAULT = Object.freeze(['level1', 'dof', 'principal']);
const EXPENDITURE_FLOW_INSTITUTION = Object.freeze(['dof', 'principal']);

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

  async listLineItemsForExport(recordIds = [], options = {}) {
    return expenditureModel.listExpenditureRowsForExport(recordIds, options);
  },

  async validateModuleMeta(moduleMeta) {
    if (moduleMeta === null || moduleMeta === undefined) {
      return null;
    }

    if (typeof moduleMeta !== 'object' || Array.isArray(moduleMeta)) {
      throw new WorkflowError(
        'expenditure workflow moduleMeta must be an object or null',
        400,
        'INVALID_WORKFLOW_META',
      );
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(moduleMeta)) {
      if (!ALLOWED_META_KEYS.has(key)) {
        throw new WorkflowError(
          `Unsupported expenditure workflow moduleMeta key: ${key}`,
          400,
          'INVALID_WORKFLOW_META',
        );
      }

      if (key === 'expenditureMeta') {
        if (
          value !== null &&
          value !== undefined &&
          (typeof value !== 'object' || Array.isArray(value))
        ) {
          throw new WorkflowError(
            'expenditure workflow moduleMeta.expenditureMeta must be an object or null',
            400,
            'INVALID_WORKFLOW_META',
          );
        }

        sanitized[key] = value
          ? {
              unplannedBudgetEnabled: Boolean(value.unplannedBudgetEnabled),
              unplannedBudgetAmount:
                value.unplannedBudgetAmount !== undefined && value.unplannedBudgetAmount !== null
                  ? Number(value.unplannedBudgetAmount)
                  : null,
              unplannedBudgetHead:
                value.unplannedBudgetHead !== undefined && value.unplannedBudgetHead !== null
                  ? String(value.unplannedBudgetHead).trim()
                  : null,
              unplannedBudgetSubHead:
                value.unplannedBudgetSubHead !== undefined && value.unplannedBudgetSubHead !== null
                  ? String(value.unplannedBudgetSubHead).trim()
                  : null,
              unplannedBudgetDescription:
                value.unplannedBudgetDescription !== undefined &&
                value.unplannedBudgetDescription !== null
                  ? String(value.unplannedBudgetDescription).trim()
                  : null,
            }
          : null;

        continue;
      }

      if (key === 'beneficiaryType') {
        sanitized[key] = value === null || value === undefined ? null : String(value).trim();
        continue;
      }

      if (value !== null && value !== undefined && typeof value !== 'string') {
        throw new WorkflowError(
          `expenditure workflow moduleMeta.${key} must be a string or null`,
          400,
          'INVALID_WORKFLOW_META',
        );
      }

      if (
        key === 'amountBand' &&
        value !== null &&
        value !== undefined &&
        !ALLOWED_AMOUNT_BANDS.has(value)
      ) {
        throw new WorkflowError(
          `expenditure workflow moduleMeta.amountBand must be one of: ${Array.from(
            ALLOWED_AMOUNT_BANDS,
          ).join(', ')}`,
          400,
          'INVALID_WORKFLOW_META',
        );
      }

      sanitized[key] = value ?? null;
    }

    return sanitized;
  },

  resolveStartFlow({ context, metadata }) {
    const beneficiaryType = String(
      metadata?.moduleMeta?.beneficiaryType || context?.beneficiaryType || '',
    )
      .trim()
      .toLowerCase();

    if (beneficiaryType === 'institution') {
      return [...EXPENDITURE_FLOW_INSTITUTION];
    }

    return [...EXPENDITURE_FLOW_DEFAULT];
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
