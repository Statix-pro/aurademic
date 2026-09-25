import guesthouseModel from './guesthouseModel.js';
import { registerWorkflowModule } from '../shared/workflow/workflowModuleRegistry.js';

const guesthouseWorkflowAdapter = {
  // Keep archived bookings in their original scoped queue so they can be
  // unarchived by the actor who archived them (or by a super admin).
  preserveStageOnArchive: true,

  resolveStartFlow() {
    // Keep this in sync with 20260925_create_guesthouse_module.sql.
    return ['hod', 'guesthouse_incharge', 'principal', 'guesthouse_admin'];
  },

  async getRecordContext(recordId, options = {}) {
    return guesthouseModel.getGuesthouseRecordContext(recordId, options);
  },

  async updateRecordWorkflowSnapshot(recordId, newState, options = {}) {
    return guesthouseModel.updateGuesthouseWorkflowSnapshot(recordId, newState, options);
  },

  async listRecordsForQueue(stage, filters = {}, options = {}) {
    return guesthouseModel.listGuesthouseQueueRecords(stage, filters, options);
  },

  // Guest house has no per-record moduleMeta beyond the shared workflow_state shape.
  async validateModuleMeta(moduleMeta) {
    if (moduleMeta == null) return null;
    if (typeof moduleMeta !== 'object' || Array.isArray(moduleMeta)) {
      throw new Error('Guesthouse workflow metadata must be an object');
    }
    if (Object.keys(moduleMeta).some((key) => key !== 'route') ||
        (moduleMeta.route != null && (typeof moduleMeta.route !== 'string' || moduleMeta.route.length > 200))) {
      throw new Error('Invalid guesthouse workflow metadata');
    }
    return moduleMeta;
  },

  // Keep the explicit resolver so every new request follows the HOD-first flow
  // even before the database configuration migration has been applied.
};

registerWorkflowModule({
  moduleKey: 'guesthouse',
  tableName: 'guesthouse_bookings',
  idColumn: 'id',
  stateColumn: 'workflow_state',
  adapter: guesthouseWorkflowAdapter,
});

export default guesthouseWorkflowAdapter;
