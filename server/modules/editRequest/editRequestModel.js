import db from '../../config/connection.js';

const editRequestModel = {
  async createEditRequest({ entity_id, user_id, entity_type }) {
    const [result] = await db.query(
      'INSERT INTO edit_requests (entity_id, user_id, entity_type, status) VALUES (?, ?, ?, ?)',
      [entity_id, user_id, entity_type, 'pending'],
    );
    return result;
  },

  // async findPendingEditRequest(entityId, userId, entityType) {
  //     const [rows] = await db.query(
  //         'SELECT * FROM edit_requests WHERE entity_id = ? AND user_id = ? AND entity_type = ? AND status = "pending"',
  //         [entityId, userId, entityType]
  //     );
  //     return rows[0];
  // },

  /**
   * The newest request wins. Without the ordering MySQL was free to hand back an older
   * row, so a user who re-requested after a rejection kept seeing "rejected" while a
   * pending row existed — and the journal workflow query, which already selects MAX(id),
   * disagreed with this one.
   */
  async findEditRequest(entityId, userId, entityType) {
    const [rows] = await db.query(
      `SELECT * FROM edit_requests
            WHERE entity_id = ? AND user_id = ? AND entity_type = ?
         ORDER BY id DESC
            LIMIT 1`,
      [entityId, userId, entityType],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Admin decision on the newest request for one entity.
   *
   * The previous version matched on `entity_id` alone while being handed what the route
   * still calls a "requestId", so approving a journal's request also flipped the request
   * belonging to the project (or the other user) that happened to share that id, and left
   * unrelated older rows for the same entity marked approved.
   */
  async updateLatestEditRequestStatus(entityId, entityType, status) {
    try {
      const [rows] = await db.query(
        `SELECT id FROM edit_requests
          WHERE entity_id = ? AND entity_type = ?
       ORDER BY id DESC
          LIMIT 1`,
        [entityId, entityType],
      );

      if (rows.length === 0) {
        return { affectedRows: 0 };
      }

      const [result] = await db.query('UPDATE edit_requests SET status = ? WHERE id = ?', [
        status,
        rows[0].id,
      ]);
      return result;
    } catch (error) {
      console.error('Error in updateLatestEditRequestStatus:', error);
      throw error;
    }
  },

  async updateEditRequestStatusByEntity(entityId, entityType, status, userId) {
    try {
      const [result] = await db.query(
        'UPDATE edit_requests SET status = ? WHERE entity_id = ? AND entity_type = ? AND user_id = ?',
        [status, entityId, entityType, userId],
      );
      return result;
    } catch (error) {
      console.error('Error in updateEditRequestStatusByEntity:', error);
      throw error;
    }
  },
};

export default editRequestModel;
