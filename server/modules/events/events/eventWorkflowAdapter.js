import db from '../../../config/connection.js';
import { registerWorkflowModule } from '../../shared/workflow/workflowModuleRegistry.js';

const eventWorkflowAdapter = {
  async getRecordContext(recordId, { tx = db } = {}) {
    const [rows] = await tx.query(
      `SELECT id, created_by, workflow_state FROM events WHERE id = ?`,
      [recordId],
    );
    if (!rows.length) return null;
    const row = rows[0];
    let workflowState = row.workflow_state;
    if (typeof workflowState === 'string') {
      try {
        workflowState = JSON.parse(workflowState);
      } catch (e) {
        workflowState = null;
      }
    }
    return {
      id: row.id,
      applicantUserId: row.created_by,
      workflowState,
    };
  },

  async updateRecordWorkflowSnapshot(recordId, newState, { tx = db } = {}) {
    const workflowStatePayload = JSON.stringify(newState || null);
    const [result] = await tx.query(
      `UPDATE events SET workflow_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [workflowStatePayload, recordId],
    );
    return result.affectedRows > 0;
  },

  async listRecordsForQueue(stage, filters = {}, { tx = db } = {}) {
    const [rows] = await tx.query(
      `SELECT id, event_title AS title, workflow_state, created_at FROM events 
       WHERE is_deleted = 0 
         AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.currentStage')))) = ?`,
      [stage.toLowerCase()],
    );
    return rows;
  },

  async validateModuleMeta(moduleMeta) {
    return moduleMeta;
  },

  resolveStartFlow() {
    return ['level1', 'dof', 'principal'];
  },
};

registerWorkflowModule({
  moduleKey: 'events',
  tableName: 'events',
  idColumn: 'id',
  stateColumn: 'workflow_state',
  adapter: eventWorkflowAdapter,
});

export default eventWorkflowAdapter;
