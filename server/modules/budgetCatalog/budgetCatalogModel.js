import db from '../../config/connection.js';

const VALID_SCOPES = new Set(['head-specific', 'hoac-shared']);

const normalizeText = (value) => String(value ?? '').trim();
const nullableText = (value) => normalizeText(value) || null;
const toCodeSlug = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
const catalogCode = (name, id) => {
  const slug = toCodeSlug(name) || 'catalog';
  return `${slug}-${id}`;
};
const toPositiveInt = (value) => {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
};
const badRequest = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

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
                 AND (
                   s.scope <> 'head-specific'
                   OR (h.is_active = 1 AND h.is_deleted = 0)
                 )
               ORDER BY s.name`;
    const [heads] = await db.query(headsQuery);
    const [subHeads] = await db.query(subQuery);
    return { heads, subHeads };
  },

  async getTags({ includeInactive = false } = {}) {
    const query = includeInactive
      ? `SELECT id, tag_name, is_active, sort_order
                 FROM budget_tags
                WHERE is_deleted = 0
                ORDER BY tag_name`
      : `SELECT id, tag_name, is_active, sort_order
                 FROM budget_tags
                WHERE is_active = 1 AND is_deleted = 0
                ORDER BY tag_name ASC`;
    const [rows] = await db.query(query);
    return rows;
  },

  async createTag({ tag_name, sort_order = 0 }) {
    const normalizedName = normalizeText(tag_name);
    if (!normalizedName) {
      throw badRequest('tag_name is required');
    }
    const [result] = await db.query(
      'INSERT INTO budget_tags (tag_name, sort_order) VALUES (?, ?)',
      [normalizedName, sort_order],
    );
    return { id: result.insertId, tag_name: normalizedName, sort_order, is_active: 1 };
  },

  async updateTag(id, data) {
    const allowed = ['tag_name', 'sort_order', 'is_active'];
    const fields = [];
    const params = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (key === 'tag_name' && !normalizeText(data[key])) {
          throw badRequest('tag_name is required');
        }
        fields.push(`${key} = ?`);
        params.push(key === 'tag_name' ? normalizeText(data[key]) : data[key]);
      }
    }
    if (fields.length === 0) return false;
    params.push(id);
    const [result] = await db.query(
      `UPDATE budget_tags SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`,
      params,
    );
    return result.affectedRows > 0;
  },

  async softDeleteTag(id) {
    const [result] = await db.query(
      'UPDATE budget_tags SET is_active = 0, is_deleted = 1 WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  },

  async createHead({ name, code = null, group_label, sort_order = 0 }) {
    const normalizedName = normalizeText(name);
    const normalizedGroupLabel = normalizeText(group_label);
    if (!normalizedName || !normalizedGroupLabel) {
      throw badRequest('name and group_label are required');
    }
    let normalizedCode = nullableText(code);
    const [result] = await db.query(
      'INSERT INTO budget_heads (name, code, group_label, sort_order) VALUES (?, ?, ?, ?)',
      [normalizedName, normalizedCode, normalizedGroupLabel, sort_order],
    );
    if (!normalizedCode) {
      normalizedCode = catalogCode(normalizedName, result.insertId);
      await db.query('UPDATE budget_heads SET code = ? WHERE id = ?', [
        normalizedCode,
        result.insertId,
      ]);
    }
    return {
      id: result.insertId,
      name: normalizedName,
      code: normalizedCode,
      group_label: normalizedGroupLabel,
      sort_order,
      is_active: 1,
    };
  },

  async updateHead(id, data) {
    // `code` is a stable slug — admins can edit it but it should be
    // unique. `name` is the display label and can be changed freely.
    const allowed = ['name', 'code', 'group_label', 'sort_order', 'is_active'];
    const fields = [];
    const params = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if ((key === 'name' || key === 'group_label') && !normalizeText(data[key])) {
          throw badRequest(`${key} is required`);
        }
        fields.push(`${key} = ?`);
        params.push(
          ['name', 'group_label'].includes(key)
            ? normalizeText(data[key])
            : key === 'code'
              ? nullableText(data[key])
              : data[key],
        );
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
      throw badRequest(`Invalid scope: ${scope}`);
    }
    if (scope === 'head-specific' && !toPositiveInt(payload.head_id)) {
      throw badRequest('head_id is required for head-specific sub-heads');
    }
    if (scope === 'hoac-shared' && !normalizeText(payload.event_type)) {
      throw badRequest('event_type is required for hoac-shared sub-heads');
    }
    return scope;
  },

  async createSubHead(payload) {
    const name = normalizeText(payload.name);
    if (!name) {
      throw badRequest('name is required');
    }
    const scope = this.validateSubHeadPayload(payload);
    let code = nullableText(payload.code);
    const [result] = await db.query(
      `INSERT INTO budget_sub_heads
             (name, code, head_id, scope, event_type, group_label, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        code,
        scope === 'head-specific' ? toPositiveInt(payload.head_id) : null,
        scope,
        scope === 'head-specific' ? null : normalizeText(payload.event_type),
        scope === 'head-specific' ? null : nullableText(payload.group_label),
        payload.sort_order ?? 0,
      ],
    );
    if (!code) {
      code = catalogCode(name, result.insertId);
      await db.query('UPDATE budget_sub_heads SET code = ? WHERE id = ?', [code, result.insertId]);
    }
    return { id: result.insertId, ...payload, name, code, scope, is_active: 1 };
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
    const eventType = normalizeText(payload.event_type);
    const groupLabel = nullableText(payload.group_label);
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
        const contextParams =
          scope === 'head-specific'
            ? [name, scope, toPositiveInt(payload.head_id)]
            : [name, scope, eventType, groupLabel];
        const contextWhere =
          scope === 'head-specific'
            ? 'name = ? AND scope = ? AND head_id = ? AND is_deleted = 0'
            : 'name = ? AND scope = ? AND event_type = ? AND group_label <=> ? AND is_deleted = 0';
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
            scope === 'head-specific' ? toPositiveInt(payload.head_id) : null,
            scope,
            scope === 'head-specific' ? null : eventType,
            scope === 'head-specific' ? null : groupLabel,
            Number(payload.sort_order || 0) + index,
          ],
        );
        const code = catalogCode(name, result.insertId);
        await connection.query('UPDATE budget_sub_heads SET code = ? WHERE id = ?', [
          code,
          result.insertId,
        ]);
        created.push({ id: result.insertId, name, code });
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
    const [rows] = await db.query(
      'SELECT * FROM budget_sub_heads WHERE id = ? AND is_deleted = 0 LIMIT 1',
      [id],
    );
    const current = rows[0];
    if (!current) return false;

    const next = { ...current, ...data };
    if (data.name !== undefined) {
      next.name = normalizeText(data.name);
      if (!next.name) throw badRequest('name is required');
    }
    if (data.event_type !== undefined) {
      next.event_type = normalizeText(data.event_type);
    }
    if (data.group_label !== undefined) {
      next.group_label = nullableText(data.group_label);
    }

    const nextScope = this.validateSubHeadPayload(next);
    if (nextScope === 'head-specific') {
      next.head_id = toPositiveInt(next.head_id);
      next.event_type = null;
      next.group_label = null;
    } else {
      next.head_id = null;
      next.event_type = normalizeText(next.event_type);
    }

    const allowed = [
      'name',
      'code',
      'head_id',
      'scope',
      'event_type',
      'group_label',
      'sort_order',
      'is_active',
    ];
    const fields = [];
    const params = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(key === 'code' ? nullableText(data[key]) : next[key]);
      }
    }
    if (data.scope !== undefined) {
      if (!fields.includes('head_id = ?')) {
        fields.push('head_id = ?');
        params.push(next.head_id);
      }
      if (!fields.includes('event_type = ?')) {
        fields.push('event_type = ?');
        params.push(next.event_type);
      }
      if (!fields.includes('group_label = ?')) {
        fields.push('group_label = ?');
        params.push(next.group_label);
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
