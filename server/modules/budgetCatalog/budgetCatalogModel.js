import db from '../../config/connection.js';

const VALID_SCOPES = new Set(['head-specific', 'hoac-shared', 'event-specific']);

const budgetCatalogModel = {
    async getCatalog({ includeInactive = false } = {}) {
        const headsQuery = includeInactive
            ? 'SELECT * FROM budget_heads WHERE is_deleted = 0 ORDER BY name'
            : 'SELECT * FROM budget_heads WHERE is_active = 1 AND is_deleted = 0 ORDER BY name';
        const subQuery = includeInactive
            ? `SELECT s.*, h.name AS head_name
               FROM budget_sub_heads s
               LEFT JOIN budget_heads h ON h.id = s.head_id
               WHERE s.is_deleted = 0
               ORDER BY s.name`
            : `SELECT s.*, h.name AS head_name
               FROM budget_sub_heads s
               LEFT JOIN budget_heads h ON h.id = s.head_id
               WHERE s.is_active = 1
                 AND s.is_deleted = 0
               ORDER BY s.name`;
        const [heads] = await db.query(headsQuery);
        const [subHeads] = await db.query(subQuery);
        return { heads, subHeads };
    },

    async createHead({ name, code = null, group_label, sort_order = 0 }) {
        const normalizedCode = String(code || '').trim() || null;
        const [result] = await db.query(
            'INSERT INTO budget_heads (name, code, group_label, sort_order) VALUES (?, ?, ?, ?)',
            [name, normalizedCode, group_label, sort_order],
        );
        return { id: result.insertId, name, code: normalizedCode, group_label, sort_order, is_active: 1 };
    },

    async updateHead(id, data) {
        // `code` is a stable slug — admins can edit it but it should be
        // unique. `name` is the display label and can be changed freely.
        const allowed = ['name', 'code', 'group_label', 'sort_order', 'is_active'];
        const fields = [];
        const params = [];
        for (const key of allowed) {
            if (data[key] !== undefined) {
                fields.push(`${key} = ?`);
                params.push(key === 'code' ? String(data[key] || '').trim() || null : data[key]);
            }
        }
        if (fields.length === 0) return false;
        params.push(id);
        const [result] = await db.query(
            `UPDATE budget_heads SET ${fields.join(', ')} WHERE id = ?`,
            params,
        );
        return result.affectedRows > 0;
    },

    async softDeleteHead(id) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query(
                'UPDATE budget_heads SET is_active = 0, is_deleted = 1 WHERE id = ?',
                [id],
            );
            await connection.query(
                'UPDATE budget_sub_heads SET is_active = 0, is_deleted = 1 WHERE head_id = ?',
                [id],
            );
            await connection.commit();
            return result.affectedRows > 0;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    validateSubHeadPayload(payload) {
        const scope = payload.scope || 'head-specific';
        if (!VALID_SCOPES.has(scope)) {
            const err = new Error(`Invalid scope: ${scope}`);
            err.statusCode = 400;
            throw err;
        }
        if (scope === 'head-specific' && !payload.head_id) {
            const err = new Error('head_id is required for head-specific sub-heads');
            err.statusCode = 400;
            throw err;
        }
        if ((scope === 'hoac-shared' || scope === 'event-specific') && !payload.event_type) {
            const err = new Error(`event_type is required for ${scope} sub-heads`);
            err.statusCode = 400;
            throw err;
        }
        return scope;
    },

    async createSubHead(payload) {
        const scope = this.validateSubHeadPayload(payload);
        const [result] = await db.query(
            `INSERT INTO budget_sub_heads
             (name, code, head_id, scope, event_type, group_label, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.name,
                String(payload.code || '').trim() || null,
                scope === 'head-specific' ? payload.head_id : null,
                scope,
                scope === 'head-specific' ? null : payload.event_type,
                payload.group_label || null,
                payload.sort_order ?? 0,
            ],
        );
        return { id: result.insertId, ...payload, scope, is_active: 1 };
    },

    async createSubHeadsBulk(payload) {
        const names = Array.isArray(payload.names)
            ? payload.names.map((name) => String(name || '').trim()).filter(Boolean)
            : [];
        if (!names.length) {
            const err = new Error('names are required');
            err.statusCode = 400;
            throw err;
        }

        const scope = this.validateSubHeadPayload({ ...payload, name: names[0] });
        const seen = new Set();
        const uniqueNames = names.filter((name) => {
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const connection = await db.getConnection();
        const created = [];
        const skipped = [];
        try {
            await connection.beginTransaction();
            for (const [index, name] of uniqueNames.entries()) {
                const contextParams = scope === 'head-specific'
                    ? [name, scope, payload.head_id]
                    : [name, scope, payload.event_type, payload.group_label || null];
                const contextWhere = scope === 'head-specific'
                    ? 'name = ? AND scope = ? AND head_id = ?'
                    : 'name = ? AND scope = ? AND event_type = ? AND group_label <=> ?';
                const [existing] = await connection.query(
                    `SELECT id FROM budget_sub_heads WHERE ${contextWhere} LIMIT 1`,
                    contextParams,
                );
                if (existing.length) {
                    skipped.push({ name, id: existing[0].id, reason: 'Already exists' });
                    continue;
                }

                const [result] = await connection.query(
                    `INSERT INTO budget_sub_heads
                     (name, code, head_id, scope, event_type, group_label, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        name,
                        null,
                        scope === 'head-specific' ? payload.head_id : null,
                        scope,
                        scope === 'head-specific' ? null : payload.event_type,
                        payload.group_label || null,
                        Number(payload.sort_order || 0) + index,
                    ],
                );
                created.push({ id: result.insertId, name });
            }
            await connection.commit();
            return { created, skipped };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    async updateSubHead(id, data) {
        const allowed = ['name', 'code', 'head_id', 'scope', 'event_type', 'group_label', 'sort_order', 'is_active'];
        const fields = [];
        const params = [];
        for (const key of allowed) {
            if (data[key] !== undefined) {
                fields.push(`${key} = ?`);
                params.push(key === 'code' ? String(data[key] || '').trim() || null : data[key]);
            }
        }
        if (fields.length === 0) return false;
        params.push(id);
        const [result] = await db.query(
            `UPDATE budget_sub_heads SET ${fields.join(', ')} WHERE id = ?`,
            params,
        );
        return result.affectedRows > 0;
    },

    async softDeleteSubHead(id) {
        const [result] = await db.query(
            'UPDATE budget_sub_heads SET is_active = 0, is_deleted = 1 WHERE id = ?',
            [id],
        );
        return result.affectedRows > 0;
    },
};

export default budgetCatalogModel;
