import db from '../../config/connection.js';
const editRequestModel = {
    async createEditRequest({ entity_id, user_id, entity_type }) {
        const [result] = await db.query('INSERT INTO edit_requests (entity_id, user_id, entity_type, status) VALUES (?, ?, ?, ?)', [entity_id, user_id, entity_type, 'pending']);
        return result;
    },
    // async findPendingEditRequest(entityId, userId, entityType) {
    //     const [rows] = await db.query(
    //         'SELECT * FROM edit_requests WHERE entity_id = ? AND user_id = ? AND entity_type = ? AND status = "pending"',
    //         [entityId, userId, entityType]
    //     );
    //     return rows[0];
    // },
    async findEditRequest(entityId, userId, entityType) {
        const [rows] = await db.query(`SELECT * FROM edit_requests
            WHERE entity_id = ? AND user_id = ? AND entity_type = ?
            LIMIT 1`, [entityId, userId, entityType]);
        return rows.length > 0 ? rows[0] : null;
    },
    async updateEditRequestStatus(requestId, status) {
        try {
            const query = 'UPDATE edit_requests SET status = ? WHERE entity_id = ?'; // Add this line
            const [result] = await db.query(query, [status, requestId]);
            return result;
        }
        catch (error) {
            console.error('Error in updateEditRequestStatus:', error);
            throw error;
        }
    },
    async updateEditRequestStatusByEntity(entityId, entityType, status, userId) {
        try {
            const [result] = await db.query('UPDATE edit_requests SET status = ? WHERE entity_id = ? AND entity_type = ? AND user_id = ?', [status, entityId, entityType, userId]);
            return result;
        }
        catch (error) {
            console.error('Error in updateEditRequestStatusByEntity:', error);
            throw error;
        }
    },
};
export default editRequestModel;
