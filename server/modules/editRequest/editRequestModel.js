import db from '../../config/connection.js';

const editRequestModel = {
  async createEditRequest({ entity_id, user_id, entity_type }) {
    const [result] = await db.query(
      'INSERT INTO edit_requests (entity_id, user_id, entity_type, status) VALUES (?, ?, ?, ?)',
      [entity_id, user_id, entity_type, 'pending'],
    );
    return result;
  },

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
  /**
   * Decides one pending edit request.
   *
   * Only pending rows are eligible, so a repeated or stale click cannot re-decide a
   * request that was already approved or rejected. `userId` names whose request is being
   * decided: two users can have open requests on the same entity, and without it the
   * decision landed on whichever row happened to be newest rather than on the row the
   * admin acted on in the list.
   */
  async updateLatestEditRequestStatus(entityId, entityType, status, userId = null) {
    try {
      const params = [entityId, entityType];
      // `user_id` comes back so the caller can address a notification to
      // whoever asked, without having to guess which row was decided.
      let sql = `SELECT id, user_id FROM edit_requests
          WHERE entity_id = ? AND entity_type = ? AND status = 'pending'`;
      if (userId != null) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }
      sql += ' ORDER BY id DESC LIMIT 1';

      const [rows] = await db.query(sql, params);

      if (rows.length === 0) {
        return { affectedRows: 0 };
      }

      const [result] = await db.query(
        "UPDATE edit_requests SET status = ? WHERE id = ? AND status = 'pending'",
        [status, rows[0].id],
      );
      // Existing callers read `affectedRows`; `decidedUserId` is additive.
      return { ...result, decidedUserId: rows[0].user_id ?? null };
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
