import { registerWorkflowModule } from './workflowModuleRegistry.js';
import db from '../../../config/connection.js';

const DIRECTORY_FLOW = Object.freeze(['directory_admin']);

const buildAdapter = ({ tableName }) => ({
  async getRecordContext(recordId, { tx = db } = {}) {
    const [rows] = await tx.execute(`SELECT id, created_by FROM \`${tableName}\` WHERE id = ?`, [
      recordId,
    ]);
    if (!rows[0]) return null;
    return { applicantUserId: rows[0].created_by, beneficiaryType: 'directory', totalBudget: 0 };
  },

  async updateRecordWorkflowSnapshot(recordId, newState, { tx = db, actor = null } = {}) {
    const isActive = newState.status === 'completed' ? 1 : 0;
    const reviewerId = ['completed', 'rejected'].includes(newState.status)
      ? actor?.userId || null
      : null;
    const assignments = ['completed', 'rejected'].includes(newState.status)
      ? 'workflow_state = ?, is_active = ?, updated_by = ?'
      : 'workflow_state = ?, is_active = ?, updated_by = NULL';
    const values = ['completed', 'rejected'].includes(newState.status)
      ? [JSON.stringify(newState), isActive, reviewerId, recordId]
      : [JSON.stringify(newState), isActive, recordId];
    await tx.execute(`UPDATE \`${tableName}\` SET ${assignments} WHERE id = ?`, values);
  },

  async listRecordsForQueue() {
    return { items: [], total: 0, statusCounts: {} };
  },

  resolveStartFlow() {
    return [...DIRECTORY_FLOW];
  },
});

registerWorkflowModule({
  moduleKey: 'organization_directory',
  tableName: 'organizations',
  adapter: buildAdapter({ tableName: 'organizations' }),
});

registerWorkflowModule({
  moduleKey: 'resource_person_directory',
  tableName: 'directory_resource_persons',
  adapter: buildAdapter({ tableName: 'directory_resource_persons' }),
});
