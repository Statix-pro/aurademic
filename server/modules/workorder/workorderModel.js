import db from '../../config/connection.js';

const normalizeText = (value) => String(value || '').trim();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const safeParseJSON = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeWorkflowState = (rawState) => {
  if (!rawState) return null;
  return safeParseJSON(rawState, rawState);
};

const normalizeWorkflowStatus = (workflowState) => {
  if (!workflowState) return 'in_progress';
  const status = normalizeText(workflowState.status).toLowerCase();
  return status || 'in_progress';
};

const mapWorkflowStatusToOverallStatus = (newState) => {
  const status = normalizeWorkflowStatus(newState);
  if (status === 'completed' || status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'archived') return 'archived';
  return 'pending';
};

// -------------------------------------------------------
// CATALOG
// -------------------------------------------------------

const workorderModel = {
  async getCatalog() {
    const [categories] = await db.query(
      `SELECT id, name, code, sort_order, is_active
         FROM work_order_categories
        WHERE is_active = 1
        ORDER BY sort_order, name`,
    );

    const [types] = await db.query(
      `SELECT id, category_id, name, sort_order, is_active
         FROM work_order_types
        WHERE is_active = 1
        ORDER BY category_id, sort_order, name`,
    );

    const [subtypes] = await db.query(
      `SELECT id, type_id, name, is_active
         FROM work_order_subtypes
        WHERE is_active = 1
        ORDER BY type_id, name`,
    );

    return { categories, types, subtypes };
  },

  async createCatalogItem(level, payload) {
    if (!['category', 'type', 'subtype'].includes(level)) throw new Error('Invalid catalog level');
    const name = normalizeText(payload.name);
    if (!name) throw new Error('Name is required');
    const sortOrder = Number.parseInt(payload.sort_order, 10) || 0;
    if (level === 'category') {
      const code = normalizeText(payload.code) || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'WO';
      const [result] = await db.query('INSERT INTO work_order_categories (name, code, sort_order, is_active) VALUES (?, ?, ?, 1)', [name, code, sortOrder]);
      return { id: result.insertId, name, code, sort_order: sortOrder };
    }
    const parentId = toPositiveInt(payload.parent_id);
    if (!parentId) throw new Error('Parent is required');
    const table = level === 'type' ? 'work_order_types' : 'work_order_subtypes';
    const parentColumn = level === 'type' ? 'category_id' : 'type_id';
    const parentTable = level === 'type' ? 'work_order_categories' : 'work_order_types';
    const [parentRows] = await db.query(`SELECT id FROM ${parentTable} WHERE id = ? AND is_active = 1 LIMIT 1`, [parentId]);
    if (!parentRows.length) throw new Error('Parent catalog item not found or inactive');
    const [result] = level === 'type'
      ? await db.query(`INSERT INTO ${table} (${parentColumn}, name, sort_order, is_active) VALUES (?, ?, ?, 1)`, [parentId, name, sortOrder])
      : await db.query(`INSERT INTO ${table} (${parentColumn}, name, is_active) VALUES (?, ?, 1)`, [parentId, name]);
    return { id: result.insertId, name, [parentColumn]: parentId, sort_order: sortOrder };
  },

  async updateCatalogItem(level, id, payload) {
    const itemId = toPositiveInt(id);
    const name = normalizeText(payload.name);
    if (!itemId || !name) throw new Error('Valid id and name are required');
    if (!['category', 'type', 'subtype'].includes(level)) throw new Error('Invalid catalog level');
    const table = level === 'category' ? 'work_order_categories' : level === 'type' ? 'work_order_types' : 'work_order_subtypes';
    const parentColumn = level === 'type' ? 'category_id' : level === 'subtype' ? 'type_id' : null;
    const parentId = parentColumn && payload.parent_id !== undefined ? toPositiveInt(payload.parent_id) : null;
    if (parentColumn && payload.parent_id !== undefined && !parentId) throw new Error('Valid parent is required');
    const setParts = ['name = ?', 'is_active = COALESCE(?, is_active)'];
    const params = [name, payload.is_active === undefined ? null : (payload.is_active ? 1 : 0)];
    if (parentColumn && parentId) {
      const parentTable = level === 'type' ? 'work_order_categories' : 'work_order_types';
      const [parentRows] = await db.query(`SELECT id FROM ${parentTable} WHERE id = ? AND is_active = 1 LIMIT 1`, [parentId]);
      if (!parentRows.length) throw new Error('Parent catalog item not found or inactive');
      setParts.push(`${parentColumn} = ?`); params.push(parentId);
    }
    params.push(itemId);
    const [result] = await db.query(`UPDATE ${table} SET ${setParts.join(', ')} WHERE id = ?`, params);
    if (!result.affectedRows) {
      const [existing] = await db.query(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [itemId]);
      if (!existing.length) throw new Error('Catalog item not found');
    }
    return { id: itemId, name };
  },

  async deleteCatalogItem(level, id) {
    const itemId = toPositiveInt(id);
    if (!itemId) throw new Error('Invalid catalog item');
    const table = level === 'category' ? 'work_order_categories' : level === 'type' ? 'work_order_types' : 'work_order_subtypes';
    await db.query(`UPDATE ${table} SET is_active = 0 WHERE id = ?`, [itemId]);
  },

  async getWorkOrderDeletionContext(id) {
    const normalizedId = toPositiveInt(id);
    if (!normalizedId) return null;
    const [rows] = await db.query(
      `SELECT id, created_by, overall_status, workflow_status, workflow_stage
         FROM work_orders WHERE id = ? LIMIT 1`,
      [normalizedId],
    );
    return rows[0] || null;
  },

  async getWorkOrderItemContext(itemId) {
    const normalizedId = toPositiveInt(itemId);
    if (!normalizedId) return null;
    const [rows] = await db.query(
      `SELECT woi.id, wo.created_by, wo.overall_status, wo.workflow_status
         FROM work_order_items woi JOIN work_orders wo ON wo.id = woi.work_order_id
        WHERE woi.id = ? LIMIT 1`,
      [normalizedId],
    );
    return rows[0] || null;
  },

  async getWorkOrderPhotoContext(filename) {
    const safeName = normalizeText(filename);
    if (!safeName) return null;
    const [rows] = await db.query(
      `SELECT p.id, wo.created_by, wo.overall_status
         FROM work_order_item_photos p
         JOIN work_order_items woi ON woi.id = p.work_order_item_id
         JOIN work_orders wo ON wo.id = woi.work_order_id
        WHERE p.storage_name = ? OR p.file_path = ?
        LIMIT 1`,
      [safeName, `/uploads/workorder-photos/${safeName}`],
    );
    return rows[0] || null;
  },

  // -------------------------------------------------------
  // CREATE
  // -------------------------------------------------------

  async createWorkOrder(payload, userId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Accept category as a name string (from the form) or as a numeric category_id
      const categoryNameStr = normalizeText(payload.category || payload.category_name || '');
      const categoryIdFromPayload = toPositiveInt(payload.category_id);

      let categoryId = categoryIdFromPayload;
      let categoryCode = 'WO';

      if (!categoryId && categoryNameStr) {
        // Look up by name
        const [catByNameRows] = await conn.query(
          `SELECT id, code FROM work_order_categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_active = 1 LIMIT 1`,
          [categoryNameStr],
        );
        categoryId = toPositiveInt(catByNameRows[0]?.id);
        categoryCode = normalizeText(catByNameRows[0]?.code || 'WO');
      } else if (categoryId) {
        const [catCodeRows] = await conn.query(
          `SELECT code FROM work_order_categories WHERE id = ? LIMIT 1`,
          [categoryId],
        );
        categoryCode = normalizeText(catCodeRows[0]?.code || 'WO');
      }

      if (!categoryId) throw new Error('category is required and must be a valid category name or ID');

      // Generate wo_number: YY + category_code + 4-digit sequence
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);

      const [countRows] = await conn.query(
        `SELECT COUNT(*) AS cnt
           FROM work_orders
          WHERE category_id = ?
            AND YEAR(created_at) = YEAR(NOW())
          FOR UPDATE`,
        [categoryId],
      );
      const seq = Number(countRows[0]?.cnt || 0) + 1;
      const woNumber = `${yy}${categoryCode}${String(seq).padStart(4, '0')}`;

      // The form sends category as a name string (e.g. 'Carpentry'). Look up the ID.
      const [catByNameRows] = await conn.query(
        `SELECT id, code FROM work_order_categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_active = 1 LIMIT 1`,
        [normalizeText(payload.category || '') || catRows[0]?.name || ''],
      );
      const resolvedCategoryId = toPositiveInt(catByNameRows[0]?.id) || categoryId;

      let departmentId = toPositiveInt(payload.department_id);
      // Department beneficiaries are routed by the selected beneficiary
      // department, not by the applicant's home department.
      if (normalizeText(payload.beneficiary_type).toLowerCase() === 'department' && normalizeText(payload.beneficiary_value)) {
        departmentId = null;
        const [beneficiaryDepartmentRows] = await conn.query(
          `SELECT id FROM master_departments
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
              AND (is_active = 1 OR is_active IS NULL)
            LIMIT 1`,
          [normalizeText(payload.beneficiary_value)],
        );
        departmentId = toPositiveInt(beneficiaryDepartmentRows[0]?.id);
      }
      if (!departmentId && normalizeText(payload.department) && normalizeText(payload.beneficiary_type).toLowerCase() !== 'department') {
        const [departmentRows] = await conn.query(
          `SELECT id FROM master_departments
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
              AND (is_active = 1 OR is_active IS NULL)
            LIMIT 1`,
          [normalizeText(payload.department)],
        );
        departmentId = toPositiveInt(departmentRows[0]?.id);
      }
      if (['faculty', 'staff'].includes(normalizeText(payload.beneficiary_type).toLowerCase()) && toPositiveInt(payload.beneficiary_employee_id)) {
        const [employeeDepartmentRows] = await conn.query(
          `SELECT department_id FROM master_employees WHERE id = ? AND status = 'Active' LIMIT 1`,
          [toPositiveInt(payload.beneficiary_employee_id)],
        );
        departmentId = toPositiveInt(employeeDepartmentRows[0]?.department_id) || departmentId;
      }

      // Match the budget module: entity beneficiaries must be resolved from
      // their selected name, otherwise the submitter's department is the only
      // scope information available to the level-1 queue.
      let beneficiaryEntityId = toPositiveInt(payload.beneficiary_entity_id);
      const entityTypeCodes = {
        Centre: 'CENTRE',
        Cell: 'CELL',
        Club: 'CLUB',
        Section: 'SECTION',
        'Professional Body': 'PROFESSIONAL_BODY',
        'Professional Bodies': 'PROFESSIONAL_BODY',
      };
      const beneficiaryType = normalizeText(payload.beneficiary_type);
      const entityTypeCode = entityTypeCodes[beneficiaryType];
      if (!beneficiaryEntityId && entityTypeCode && normalizeText(payload.beneficiary_value)) {
        const [entityRows] = await conn.query(
          `SELECT me.id
             FROM master_entities me
             JOIN master_entity_types met ON met.id = me.entity_type_id
            WHERE me.is_active = 1
              AND UPPER(TRIM(met.code)) = ?
              AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
            LIMIT 1`,
          [entityTypeCode, normalizeText(payload.beneficiary_value)],
        );
        beneficiaryEntityId = toPositiveInt(entityRows[0]?.id);
      }
      // Some configured beneficiary names (for example Consultancy) use a
      // custom beneficiary type. Resolve those names across the entity master
      // as the budget module does, instead of falling back to the applicant's
      // department.
      if (!beneficiaryEntityId && normalizeText(payload.beneficiary_value)) {
        const [genericEntityRows] = await conn.query(
          `SELECT me.id
             FROM master_entities me
            WHERE me.is_active = 1
              AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
            LIMIT 1`,
          [normalizeText(payload.beneficiary_value)],
        );
        beneficiaryEntityId = toPositiveInt(genericEntityRows[0]?.id);
      }

      const [result] = await conn.query(
        `INSERT INTO work_orders (
           wo_number, employee_id, applicant_name, department, department_id,
           designation, email, mobile, request_date, beneficiary_type,
           beneficiary_value, beneficiary_employee_id, beneficiary_entity_id,
           budget_tag, category_id, created_by, overall_status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [
          woNumber,
          toPositiveInt(payload.employee_id) || null,
          normalizeText(payload.applicantName || payload.applicant_name),
          normalizeText(payload.department) || null,
          departmentId,
          normalizeText(payload.designation) || null,
          normalizeText(payload.email) || null,
          normalizeText(payload.mobile) || null,
          payload.date || payload.request_date || null,
          normalizeText(payload.beneficiary_type) || null,
          normalizeText(payload.beneficiary_value) || null,
          toPositiveInt(payload.beneficiary_employee_id) || null,
          beneficiaryEntityId || null,
          normalizeText(payload.budget_tag) || null,
          resolvedCategoryId,
          toPositiveInt(userId) || null,
        ],
      );

      const workOrderId = result.insertId;

      // The form sends workItems with type/subType as name strings. Resolve to IDs.
      const rawItems = Array.isArray(payload.workItems)
        ? payload.workItems
        : Array.isArray(payload.items)
          ? payload.items
          : [];

      for (let i = 0; i < rawItems.length; i++) {
        const item = rawItems[i];

        // Resolve type_id by name within this category
        const typeName = normalizeText(item.type || item.type_name || '');
        const subTypeName = normalizeText(item.subType || item.sub_type || item.sub_type_name || '');

        let typeId = toPositiveInt(item.type_id);
        let subTypeId = toPositiveInt(item.sub_type_id);

        if (!typeId && typeName) {
          const [typeRows] = await conn.query(
            `SELECT id FROM work_order_types WHERE category_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
            [resolvedCategoryId, typeName],
          );
          typeId = toPositiveInt(typeRows[0]?.id);
        }

        if (!subTypeId && subTypeName && typeId) {
          const [subRows] = await conn.query(
            `SELECT id FROM work_order_subtypes WHERE type_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
            [typeId, subTypeName],
          );
          subTypeId = toPositiveInt(subRows[0]?.id);
        }

        if (!typeId || !subTypeId) {
          throw new Error(`Invalid type or subtype for work order item ${i + 1}`);
        }

        const [itemResult] = await conn.query(
          `INSERT INTO work_order_items (
             work_order_id, type_id, sub_type_id, item_index,
             block, floor, room_lab_no, description, target_date,
             qty, priority, status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW(), NOW())`,
          [
            workOrderId,
            typeId,
            subTypeId,
            i,
            normalizeText(item.block) || null,
            normalizeText(item.floor) || null,
            normalizeText(item.roomLabNo || item.room_lab_no) || null,
            normalizeText(item.description) || null,
            item.targetDate || item.target_date || null,
            Math.max(1, toPositiveInt(item.qty) || 1),
            ['Routine', 'High'].includes(item.priority) ? item.priority : 'Routine',
          ],
        );

        const uploadedPhotos = Array.isArray(item.locationPhotos) ? item.locationPhotos : [];
        for (let photoIndex = 0; photoIndex < uploadedPhotos.length; photoIndex++) {
            const photo = uploadedPhotos[photoIndex];
            const filePath = normalizeText(typeof photo === 'string' ? photo : photo?.file_path || photo?.url);
            if (!filePath.startsWith('/uploads/workorder-photos/')) continue;
            const storageName = normalizeText(typeof photo === 'string' ? filePath.split('/').pop() : photo?.storage_name || photo?.storageName || filePath.split('/').pop()) || null;
            const fileName = normalizeText(typeof photo === 'string' ? storageName : photo?.file_name || photo?.fileName) || storageName;
            const mimeType = normalizeText(typeof photo === 'string' ? '' : photo?.mime_type || photo?.mimeType) || null;
            const fileSize = Number(typeof photo === 'string' ? 0 : photo?.file_size || photo?.fileSize) || null;
            await conn.query(
            `INSERT INTO work_order_item_photos
              (work_order_item_id, file_name, storage_name, file_path, mime_type, file_size, sort_order, uploaded_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [itemResult.insertId, fileName, storageName, filePath, mimeType, fileSize, photoIndex, toPositiveInt(userId) || null],
          );
        }
      }

      await conn.commit();
      return { workOrderId, woNumber };
    } catch (error) {
      await conn.rollback();
      throw new Error(`Error creating work order: ${error.message}`);
    } finally {
      conn.release();
    }
  },

  // -------------------------------------------------------
  // READ
  // -------------------------------------------------------

  async getWorkOrderById(id) {
    const normalizedId = toPositiveInt(id);
    if (!normalizedId) return null;

    const [rows] = await db.query(
      `SELECT
         wo.id,
         wo.wo_number,
         wo.employee_id,
         wo.created_by,
         COALESCE(
           CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,'')),
           wo.applicant_name
         ) AS applicant_name,
         COALESCE(e.designation, wo.designation) AS designation,
         COALESCE(d.name, wo.department) AS department,
         wo.department_id,
         COALESCE(e.email, wo.email) AS email,
         COALESCE(e.mobile, wo.mobile) AS mobile,
         wo.request_date,
         wo.beneficiary_type,
         wo.beneficiary_value,
         wo.beneficiary_employee_id,
         wo.beneficiary_entity_id,
         wo.budget_tag,
         wo.category_id,
         woc.name AS category_name,
         woc.code AS category_code,
         wo.overall_status,
         wo.workflow_state,
         wo.workflow_status,
         wo.workflow_stage,
         wo.workflow_state,
         (SELECT wa.stage
            FROM workflow_actions wa
           WHERE wa.module_key = 'workorder' AND wa.record_id = wo.id
           ORDER BY wa.decided_at DESC, wa.id DESC LIMIT 1) AS workflow_action_stage,
         (SELECT wa.actor_role
            FROM workflow_actions wa
           WHERE wa.module_key = 'workorder' AND wa.record_id = wo.id
           ORDER BY wa.decided_at DESC, wa.id DESC LIMIT 1) AS workflow_action_role,
         wo.created_at,
         wo.updated_at
       FROM work_orders wo
       LEFT JOIN master_employees e ON wo.employee_id = e.id
       LEFT JOIN master_departments d ON wo.department_id = d.id
       LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
       WHERE wo.id = ?
       LIMIT 1`,
      [normalizedId],
    );

    if (!rows.length) return null;
    const wo = rows[0];
    wo.workflow_state = normalizeWorkflowState(wo.workflow_state);

    // Fetch items
    const [items] = await db.query(
      `SELECT
         woi.id,
         woi.work_order_id,
         woi.type_id,
         wot.name AS type_name,
         woi.sub_type_id,
         wos.name AS sub_type_name,
         woi.item_index,
         woi.block,
         woi.floor,
         woi.room_lab_no,
         woi.description,
         woi.target_date,
         woi.qty,
         woi.priority,
         woi.status,
         woi.assigned_to,
         woi.assigned_to_role,
         woi.reminder_date,
         woi.created_at,
         woi.updated_at
       FROM work_order_items woi
       LEFT JOIN work_order_types wot ON woi.type_id = wot.id
       LEFT JOIN work_order_subtypes wos ON woi.sub_type_id = wos.id
       WHERE woi.work_order_id = ?
       ORDER BY woi.item_index, woi.id`,
      [normalizedId],
    );

    // Fetch photos for each item
    const itemIds = items.map((i) => i.id).filter(Boolean);
    let photos = [];
    if (itemIds.length) {
      [photos] = await db.query(
        `SELECT id, work_order_item_id, file_name, file_path, mime_type, file_size, sort_order
           FROM work_order_item_photos
          WHERE work_order_item_id IN (?)
          ORDER BY work_order_item_id, sort_order`,
        [itemIds],
      );
    }

    const photosByItem = photos.reduce((acc, p) => {
      const key = p.work_order_item_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    wo.items = items.map((item) => ({
      ...item,
      locationPhotos: (photosByItem[item.id] || []).map((p) => p.file_path),
      photos: photosByItem[item.id] || [],
    }));

    return wo;
  },

  // -------------------------------------------------------
  // LIST (my work orders for the submitter) - returns StoredWorkOrderSubmission shape
  // -------------------------------------------------------

  async listMyWorkOrders(userId, filters = {}) {
    const normalizedUserId = toPositiveInt(userId);
    const listAll = Boolean(filters.all);
    if (!normalizedUserId && !listAll) return { success: true, data: [] };

    // NULL is the legacy/default status for valid submitted work orders.
    // `NULL != 'deleted'` evaluates to UNKNOWN in MySQL and hides those rows.
    const whereParts = [`(wo.overall_status IS NULL OR wo.overall_status != 'deleted')`];
    const whereParams = [];
    if (!listAll) {
      whereParts.unshift(`(wo.created_by = ? OR wo.employee_id = ?)`);
      whereParams.push(normalizedUserId, normalizedUserId);
    }

    const whereSQL = whereParts.join(' AND ');

    const [rows] = await db.query(
      `SELECT
         wo.id,
         wo.wo_number,
         COALESCE(
           CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,'')),
           wo.applicant_name
         ) AS applicant_name,
         COALESCE(d.name, wo.department) AS department,
         COALESCE(e.designation, wo.designation) AS designation,
         COALESCE(e.email, wo.email) AS email,
         COALESCE(e.mobile, wo.mobile) AS mobile,
         wo.request_date,
         wo.beneficiary_type,
         wo.beneficiary_value,
         wo.budget_tag,
         wo.overall_status,
         wo.workflow_status,
         wo.workflow_stage,
         wo.workflow_state,
         (SELECT wa.stage
            FROM workflow_actions wa
           WHERE wa.module_key = 'workorder' AND wa.record_id = wo.id
           ORDER BY wa.decided_at DESC, wa.id DESC LIMIT 1) AS workflow_action_stage,
         (SELECT wa.actor_role
            FROM workflow_actions wa
           WHERE wa.module_key = 'workorder' AND wa.record_id = wo.id
           ORDER BY wa.decided_at DESC, wa.id DESC LIMIT 1) AS workflow_action_role,
         woc.name AS category_name,
         wo.created_at
       FROM work_orders wo
       LEFT JOIN master_employees e ON wo.employee_id = e.id
       LEFT JOIN master_departments d ON wo.department_id = d.id
       LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
       WHERE ${whereSQL}
       ORDER BY wo.created_at DESC`,
      whereParams,
    );

    if (!rows.length) return { success: true, data: [] };

    // Fetch all items for these work orders in one query
    const woIds = rows.map((r) => r.id);
    const [items] = await db.query(
      `SELECT
         woi.work_order_id,
         woi.id,
         wot.name AS type,
         wos.name AS subType,
         woi.block,
         woi.floor,
         woi.room_lab_no AS roomLabNo,
         woi.description,
         woi.target_date AS targetDate,
         woi.reminder_date AS reminderDate,
         woi.qty,
         woi.priority,
         woi.status,
         woi.assigned_to AS assignedTo,
         woi.assigned_to_role AS assignedToRole
       FROM work_order_items woi
       LEFT JOIN work_order_types wot ON woi.type_id = wot.id
       LEFT JOIN work_order_subtypes wos ON woi.sub_type_id = wos.id
       WHERE woi.work_order_id IN (?)`,
      [woIds],
    );

    // Fetch photos for all items
    const itemIds = items.map((i) => i.id).filter(Boolean);
    let photos = [];
    if (itemIds.length) {
      [photos] = await db.query(
        `SELECT work_order_item_id, file_path FROM work_order_item_photos
          WHERE work_order_item_id IN (?) ORDER BY sort_order`,
        [itemIds],
      );
    }

    const photosByItem = photos.reduce((acc, p) => {
      if (!acc[p.work_order_item_id]) acc[p.work_order_item_id] = [];
      acc[p.work_order_item_id].push(p.file_path);
      return acc;
    }, {});

    const itemsByWo = items.reduce((acc, item) => {
      if (!acc[item.work_order_id]) acc[item.work_order_id] = [];
      acc[item.work_order_id].push({
        id: String(item.id),
        type: item.type || '',
        subType: item.subType || '',
        block: item.block || '',
        floor: item.floor || '',
        roomLabNo: item.roomLabNo || '',
        description: item.description || '',
        targetDate: item.targetDate ? new Date(item.targetDate).toISOString().slice(0, 10) : '',
        reminderDate: item.reminderDate ? new Date(item.reminderDate).toISOString().slice(0, 10) : '',
        qty: Number(item.qty) || 1,
        priority: item.priority || 'Routine',
        status: item.status || 'Pending',
        assignedTo: item.assignedTo || '',
        assignedToRole: item.assignedToRole || '',
        locationPhotos: photosByItem[item.id] || [],
      });
      return acc;
    }, {});

    // Map to StoredWorkOrderSubmission shape expected by WorkOrderDashboard
    const data = rows.map((wo) => ({
      id: wo.id,
      wo_number: wo.wo_number || '',
      applicantName: wo.applicant_name || '',
      date: (wo.request_date ? new Date(wo.request_date) : new Date(wo.created_at)).toISOString().slice(0, 10),
      department: wo.department || '',
      designation: wo.designation || '',
      email: wo.email || '',
      mobile: wo.mobile || '',
      category: wo.category_name || '',
      status: 'Pending',
      overall_status: wo.overall_status || 'pending',
      workflow_status: wo.workflow_status || null,
      workflow_state: normalizeWorkflowState(wo.workflow_state),
      workflow_action_stage: wo.workflow_action_stage || null,
      workflow_action_role: wo.workflow_action_role || null,
      submittedAt: new Date(wo.created_at).toISOString(),
      workItems: itemsByWo[wo.id] || [],
      budget_tag: wo.budget_tag || '',
      beneficiary_type: wo.beneficiary_type || '',
      beneficiary_value: wo.beneficiary_value || '',
    }));

    return { success: true, data };
  },

  // -------------------------------------------------------
  // DASHBOARD (admin / workflow view)
  // -------------------------------------------------------

  async listWorkOrdersDashboard(filters = {}) {
    const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const whereParts = [`(wo.overall_status IS NULL OR wo.overall_status != 'deleted')`];
    const whereParams = [];

    const searchTerm = normalizeText(filters.q || filters.search);
    if (searchTerm) {
      whereParts.push(`(wo.wo_number LIKE ? OR wo.applicant_name LIKE ? OR woc.name LIKE ?)`);
      whereParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    if (filters.category_id) {
      whereParts.push(`wo.category_id = ?`);
      whereParams.push(toPositiveInt(filters.category_id));
    }

    if (filters.overall_status) {
      whereParts.push(`wo.overall_status = ?`);
      whereParams.push(normalizeText(filters.overall_status));
    }

    if (filters.workflow_status) {
      whereParts.push(`wo.workflow_status = ?`);
      whereParams.push(normalizeText(filters.workflow_status));
    }

    if (filters.workflow_stage) {
      whereParts.push(`wo.workflow_stage = ?`);
      whereParams.push(normalizeText(filters.workflow_stage));
    }

    const whereSQL = whereParts.join(' AND ');

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
         FROM work_orders wo
         LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
        WHERE ${whereSQL}`,
      whereParams,
    );

    const [rows] = await db.query(
      `SELECT
         wo.id,
         wo.wo_number,
         COALESCE(
           CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,'')),
           wo.applicant_name
         ) AS applicant_name,
         COALESCE(d.name, wo.department) AS department,
         wo.beneficiary_type,
         wo.beneficiary_value,
         wo.request_date,
         wo.overall_status,
         wo.workflow_status,
         wo.workflow_stage,
         woc.name AS category_name,
         woc.code AS category_code,
         (SELECT COUNT(*) FROM work_order_items woi WHERE woi.work_order_id = wo.id) AS item_count,
         wo.created_at,
         wo.updated_at
       FROM work_orders wo
       LEFT JOIN master_employees e ON wo.employee_id = e.id
       LEFT JOIN master_departments d ON wo.department_id = d.id
       LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
       WHERE ${whereSQL}
       ORDER BY wo.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset],
    );

    return { items: rows, total: Number(total), page, limit };
  },

  // -------------------------------------------------------
  // UPDATE ITEM DASHBOARD FIELDS
  // -------------------------------------------------------

  async updateWorkOrderItemDashboard(itemId, payload) {
    const normalizedItemId = toPositiveInt(itemId);
    if (!normalizedItemId) return false;

    const allowedStatuses = ['Pending', 'Assigned', 'Procurement', 'On Hold', 'Completed'];
    const status = allowedStatuses.includes(payload.status) ? payload.status : null;

    const setClauses = [];
    const params = [];

    if (status) {
      setClauses.push('status = ?');
      params.push(status);
    }
    if (payload.assigned_to !== undefined) {
      setClauses.push('assigned_to = ?');
      params.push(normalizeText(payload.assigned_to) || null);
    }
    if (payload.assigned_to_role !== undefined) {
      setClauses.push('assigned_to_role = ?');
      params.push(normalizeText(payload.assigned_to_role) || null);
    }
    if (payload.reminder_date !== undefined) {
      setClauses.push('reminder_date = ?');
      params.push(payload.reminder_date || null);
    }

    if (!setClauses.length) return false;

    setClauses.push('updated_at = NOW()');
    params.push(normalizedItemId);

    const [result] = await db.query(
      `UPDATE work_order_items SET ${setClauses.join(', ')} WHERE id = ?`,
      params,
    );

    return result.affectedRows > 0;
  },

  // -------------------------------------------------------
  // SAVE PHOTO
  // -------------------------------------------------------

  async saveItemPhoto(workOrderItemId, photoData, userId) {
    const normalizedItemId = toPositiveInt(workOrderItemId);
    if (!normalizedItemId) throw new Error('Invalid work_order_item_id');

    const [result] = await db.query(
      `INSERT INTO work_order_item_photos
         (work_order_item_id, file_name, storage_name, file_path, mime_type, file_size, sort_order, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW())`,
      [
        normalizedItemId,
        normalizeText(photoData.originalName) || null,
        normalizeText(photoData.storageName) || null,
        normalizeText(photoData.filePath),
        normalizeText(photoData.mimeType) || null,
        toPositiveInt(photoData.fileSize) || null,
        toPositiveInt(userId) || null,
      ],
    );

    return result.insertId;
  },

  // -------------------------------------------------------
  // DELETE
  // -------------------------------------------------------

  async getWorkOrderOwner(id) {
    const normalizedId = toPositiveInt(id);
    if (!normalizedId) return null;

    const [[row]] = await db.query(
      `SELECT id, created_by FROM work_orders WHERE id = ? LIMIT 1`,
      [normalizedId],
    );
    return row || null;
  },

  async deleteWorkOrder(id) {
    const normalizedId = toPositiveInt(id);
    if (!normalizedId) return false;

    const [result] = await db.query(
      `UPDATE work_orders SET overall_status = 'deleted', updated_at = NOW() WHERE id = ?`,
      [normalizedId],
    );
    return result.affectedRows > 0;
  },

  // -------------------------------------------------------
  // WORKFLOW ADAPTER METHODS (required by workflowModuleRegistry)
  // -------------------------------------------------------

  async getWorkOrderRecordContext(recordId, { tx = db, forUpdate = false } = {}) {
    const normalizedId = toPositiveInt(recordId);
    if (!normalizedId) return null;

    const lockClause = forUpdate ? ' FOR UPDATE' : '';

    const [rows] = await tx.query(
      `SELECT
         wo.id,
         wo.created_by,
         wo.beneficiary_type,
         wo.beneficiary_entity_id,
         wo.department_id,
         wo.workflow_state
       FROM work_orders wo
       WHERE wo.id = ?${lockClause}`,
      [normalizedId],
    );

    if (!rows.length) return null;

    const row = rows[0];
    const workflowState = normalizeWorkflowState(row.workflow_state);

    return {
      beneficiaryType: normalizeText(row.beneficiary_type) || null,
      beneficiaryEntityId: toPositiveInt(row.beneficiary_entity_id),
      departmentId: toPositiveInt(row.department_id),
      applicantUserId: toPositiveInt(row.created_by),
      workflowState,
      workflowStatus: normalizeWorkflowStatus(workflowState),
    };
  },

  async getWorkOrderHodScope(userId, departmentId = null, departmentName = null) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId) {
      // The auth middleware may expose the account identifier as `userId`
      // rather than `id`. Do not hide level1 work orders for a recognized HOD
      // when that legacy identifier is absent.
      return { scopeType: 'department', departmentIds: [], beneficiaryEntityIds: [], forceAll: false, forceEmpty: true };
    }

    const [rows] = await db.query(
      `SELECT DISTINCT uer.entity_id, UPPER(TRIM(uer.entity_type)) AS entity_type
         FROM user_entity_roles uer
         JOIN roles r ON r.id = uer.role_id
        WHERE uer.user_id = ?
          AND LOWER(TRIM(r.role_code)) IN ('hod', 'coordinator', 'entity_approver')
          AND uer.entity_id IS NOT NULL`,
      [normalizedUserId],
    );

    if (rows.length === 0) {
      const [employeeRows] = await db.query(
        `SELECT department_id AS entity_id
           FROM master_employees
          WHERE user_id = ?
            AND status = 'Active'
            AND department_id IS NOT NULL
          ORDER BY id ASC
          LIMIT 1`,
        [normalizedUserId],
      );
      rows.push(...employeeRows.map((row) => ({ ...row, entity_type: 'DEPARTMENT' })));
    }

    // Some authenticated HOD accounts are not linked to master_employees yet.
    // Use the department claims on the authenticated user as the same scoped
    // fallback used by the other approval modules.
    const claimedDepartmentId = toPositiveInt(departmentId);
    if (claimedDepartmentId && !rows.some((row) => toPositiveInt(row.entity_id) === claimedDepartmentId && row.entity_type === 'DEPARTMENT')) {
      rows.push({ entity_id: claimedDepartmentId, entity_type: 'DEPARTMENT' });
    }

    const departmentIds = rows
      .filter((row) => row.entity_type === 'DEPARTMENT')
      .map((row) => toPositiveInt(row.entity_id)).filter(Boolean);
    const beneficiaryEntityIds = rows
      .filter((row) => row.entity_type !== 'DEPARTMENT')
      .map((row) => toPositiveInt(row.entity_id)).filter(Boolean);
    let departmentNames = [];
    if (departmentIds.length) {
      const [departmentRows] = await db.query(
        'SELECT name FROM master_departments WHERE id IN (?)',
        [departmentIds],
      );
      departmentNames = departmentRows.map((row) => normalizeText(row.name)).filter(Boolean);
    }

    const claimedDepartmentName = normalizeText(departmentName);
    if (claimedDepartmentName && !departmentNames.some((name) => name.toLowerCase() === claimedDepartmentName.toLowerCase())) {
      departmentNames.push(claimedDepartmentName);
    }

    return {
      scopeType: 'department',
      departmentIds,
      beneficiaryEntityIds,
      departmentNames,
      // Never expose all beneficiary requests when an approver has no valid
      // department/entity assignment. Super admins are handled separately.
      forceAll: false,
      forceEmpty: rows.length === 0 && departmentNames.length === 0,
    };
  },

  async updateWorkOrderWorkflowSnapshot(recordId, newState, { tx = db } = {}) {
    const normalizedId = toPositiveInt(recordId);
    if (!normalizedId) return false;

    const workflowStatePayload = JSON.stringify(newState || null);
    const overallStatus = mapWorkflowStatusToOverallStatus(newState);

    const [result] = await tx.query(
      `UPDATE work_orders
          SET workflow_state = ?,
              overall_status = ?,
              updated_at = NOW()
        WHERE id = ?`,
      [workflowStatePayload, overallStatus, normalizedId],
    );

    return result.affectedRows > 0;
  },

  async restoreWorkOrderFromArchive(recordId) {
    const normalizedId = toPositiveInt(recordId);
    if (!normalizedId) return null;

    const [actions] = await db.query(
      `SELECT snapshot_before
         FROM workflow_actions
        WHERE module_key = 'workorder'
          AND record_id = ?
          AND decision = 'archived'
        ORDER BY id DESC
        LIMIT 1`,
      [normalizedId],
    );
    if (!actions.length || !actions[0].snapshot_before) return null;

    let previousState;
    try {
      previousState = typeof actions[0].snapshot_before === 'string'
        ? JSON.parse(actions[0].snapshot_before)
        : actions[0].snapshot_before;
    } catch {
      return null;
    }

    const restoredState = normalizeWorkflowState(previousState);
    const overallStatus = mapWorkflowStatusToOverallStatus(restoredState);
    await db.query(
      `UPDATE work_orders
          SET workflow_state = ?, overall_status = ?, updated_at = NOW()
        WHERE id = ?`,
      [JSON.stringify(restoredState), overallStatus, normalizedId],
    );
    return restoredState;
  },

  async listWorkOrderQueueRecords(stage, filters = {}, { tx = db } = {}) {
    const normalizedStage = normalizeText(stage).toLowerCase();
    const workflowStatus = normalizeText(filters.workflowStatus).toLowerCase() || 'in_progress';

    const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    // Older work orders may predate workflow_state. Treat them as newly
    // submitted HOD-stage requests so they can enter the approval queue.
    // `workflow_state` was introduced after some work orders already existed.
    // On those databases it may be NULL/blank (or, when the legacy column is
    // TEXT, malformed JSON). Guard JSON_EXTRACT so one old row cannot make the
    // complete queue request fail with a 500.
    const WORKFLOW_STAGE_EXPR = `LOWER(TRIM(COALESCE(JSON_UNQUOTE(CASE WHEN JSON_VALID(wo.workflow_state) THEN JSON_EXTRACT(wo.workflow_state, '$.currentStage') END), 'level1')))`;
    const WORKFLOW_STATUS_EXPR = `LOWER(TRIM(COALESCE(JSON_UNQUOTE(CASE WHEN JSON_VALID(wo.workflow_state) THEN JSON_EXTRACT(wo.workflow_state, '$.status') END), 'in_progress')))`;
    const statusCategory = normalizeText(filters.statusCategory).toLowerCase();

    const whereParts = [`(wo.overall_status IS NULL OR wo.overall_status != 'deleted')`];
    const whereParams = [];

    // Approved records advance to the next workflow stage, so they no longer
    // match the current-stage/status predicate used by the pending queue.
    // Filter them by their approval action instead.
    if (statusCategory === 'total') {
      // Stage total includes records currently at this stage and records that
      // already passed through this stage. It must not include other stages.
      whereParts.push(`(
        ${WORKFLOW_STAGE_EXPR} = ?
        OR EXISTS (
          SELECT 1 FROM workflow_actions wa
          WHERE wa.module_key = 'workorder'
            AND wa.record_id = wo.id
            AND LOWER(TRIM(wa.stage)) = ?
        )
      )`);
      whereParams.push(normalizedStage, normalizedStage);
    } else if (statusCategory === 'approved') {
      whereParts.push(`EXISTS (
        SELECT 1 FROM workflow_actions wa
        WHERE wa.module_key = 'workorder'
          AND wa.record_id = wo.id
          AND LOWER(TRIM(wa.stage)) = ?
          AND wa.decision = 'approved'
      )`);
      whereParams.push(normalizedStage);
    } else if (statusCategory === 'archived') {
      // Archived records are terminal, so they must not also be constrained by
      // the default `workflowStatus = in_progress` queue filter.
      // Their current workflow stage is null; scope and current status below
      // determine whether the archived record belongs in this queue.
    } else if (workflowStatus === 'all') {
      whereParts.push(
        `( (${WORKFLOW_STAGE_EXPR} = ? AND ${WORKFLOW_STATUS_EXPR} IN ('in_progress', 'returned'))
           OR EXISTS (
             SELECT 1 FROM workflow_actions wa
             WHERE wa.module_key = 'workorder'
               AND wa.record_id = wo.id
               AND LOWER(TRIM(wa.stage)) = ?
               AND wa.decision IN ('approved','returned','rejected','archived')
           )
         )`,
      );
      whereParams.push(normalizedStage, normalizedStage);
    } else {
      whereParts.push(`${WORKFLOW_STAGE_EXPR} = ?`, `${WORKFLOW_STATUS_EXPR} = ?`);
      whereParams.push(normalizedStage, workflowStatus);
    }

    const scopeFilters = filters.scopeFilters || {};
    if (!scopeFilters.forceAll) {
      if (scopeFilters.scopeType === 'department') {
        const departmentIds = Array.from(scopeFilters.departmentIds || [])
          .map(toPositiveInt)
          .filter(Boolean);
        const beneficiaryEntityIds = Array.from(scopeFilters.beneficiaryEntityIds || [])
          .map(toPositiveInt).filter(Boolean);
        if (scopeFilters.forceEmpty || (!departmentIds.length && !beneficiaryEntityIds.length)) {
          return { items: [], total: 0, page, limit };
        }
        const departmentNames = Array.from(scopeFilters.departmentNames || [])
          .map(normalizeText)
          .filter(Boolean);
        const scopedParts = [];
        if (departmentIds.length) {
          const departmentPart = departmentNames.length
            ? `(wo.beneficiary_entity_id IS NULL AND (wo.department_id IN (?) OR (LOWER(TRIM(wo.beneficiary_type)) COLLATE utf8mb4_unicode_ci = 'department' AND LOWER(TRIM(wo.beneficiary_value)) COLLATE utf8mb4_unicode_ci IN (?)) OR (LOWER(TRIM(wo.beneficiary_type)) COLLATE utf8mb4_unicode_ci IN ('faculty','staff') AND EXISTS (SELECT 1 FROM master_employees scoped_employee WHERE scoped_employee.department_id IN (?) AND LOWER(TRIM(CONCAT_WS(' ', scoped_employee.first_name, scoped_employee.last_name))) COLLATE utf8mb4_unicode_ci = REPLACE(REPLACE(REPLACE(LOWER(TRIM(wo.beneficiary_value)), 'mr ', ''), 'ms ', ''), 'mrs ', '') COLLATE utf8mb4_unicode_ci))))`
            : `(wo.beneficiary_entity_id IS NULL AND (wo.department_id IN (?) OR (LOWER(TRIM(wo.beneficiary_type)) COLLATE utf8mb4_unicode_ci IN ('faculty','staff') AND EXISTS (SELECT 1 FROM master_employees scoped_employee WHERE scoped_employee.department_id IN (?) AND LOWER(TRIM(CONCAT_WS(' ', scoped_employee.first_name, scoped_employee.last_name))) COLLATE utf8mb4_unicode_ci = REPLACE(REPLACE(REPLACE(LOWER(TRIM(wo.beneficiary_value)), 'mr ', ''), 'ms ', ''), 'mrs ', '') COLLATE utf8mb4_unicode_ci))))`;
          scopedParts.push(departmentPart);
          if (departmentNames.length) {
            whereParams.push(departmentIds);
            whereParams.push(departmentNames.map((name) => name.toLowerCase()));
            whereParams.push(departmentIds);
          } else {
            whereParams.push(departmentIds);
            whereParams.push(departmentIds);
          }
        }
        if (beneficiaryEntityIds.length) {
          scopedParts.push(`(
            wo.beneficiary_entity_id IN (?)
            OR EXISTS (
              SELECT 1
                FROM master_entities scoped_entity
               WHERE scoped_entity.id IN (?)
                 AND LOWER(TRIM(scoped_entity.name)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(wo.beneficiary_value)) COLLATE utf8mb4_unicode_ci
            )
          )`);
          whereParams.push(beneficiaryEntityIds);
          whereParams.push(beneficiaryEntityIds);
        }
        whereParts.push(`(${scopedParts.join(' OR ')})`);
      }

      if (scopeFilters.scopeType === 'entity') {
        const entityIds = Array.from(scopeFilters.entityIds || [])
          .map(toPositiveInt)
          .filter(Boolean);
        if (scopeFilters.forceEmpty || !entityIds.length) {
          return { items: [], total: 0, page, limit };
        }
        whereParts.push(`wo.beneficiary_entity_id IN (?)`);
        whereParams.push(entityIds);
      }
    }

    const searchTerm = normalizeText(filters.q || filters.search);
    if (searchTerm) {
      whereParts.push(`(
        wo.wo_number LIKE ? OR
        wo.applicant_name LIKE ? OR
        wo.beneficiary_type LIKE ? OR
        wo.beneficiary_value LIKE ? OR
        wo.department LIKE ?
      )`);
      const searchValue = `%${searchTerm}%`;
      whereParams.push(searchValue, searchValue, searchValue, searchValue, searchValue);
    }

    const fiscalYear = toPositiveInt(filters.fiscalYear);
    if (fiscalYear) {
      whereParts.push(
        `(wo.request_date >= CONCAT(?, '-04-01') AND wo.request_date < CONCAT(?, '-04-01'))`,
      );
      whereParams.push(fiscalYear, fiscalYear + 1);
    }

    const beneficiaryType = normalizeText(filters.beneficiaryType);
    if (beneficiaryType && beneficiaryType.toLowerCase() !== 'all beneficiary') {
      whereParts.push('LOWER(TRIM(wo.beneficiary_type)) = LOWER(TRIM(?))');
      whereParams.push(beneficiaryType);
    }

    if (statusCategory && statusCategory !== 'total') {
      const statusExpressions = {
        pending: `(${WORKFLOW_STATUS_EXPR} IN ('in_progress', 'returned') AND ${WORKFLOW_STAGE_EXPR} = ?)`,
        approved: `EXISTS (SELECT 1 FROM workflow_actions wa WHERE wa.module_key = 'workorder' AND wa.record_id = wo.id AND LOWER(TRIM(wa.stage)) = ? AND wa.decision = 'approved')`,
        returned: `EXISTS (SELECT 1 FROM workflow_actions wa WHERE wa.module_key = 'workorder' AND wa.record_id = wo.id AND LOWER(TRIM(wa.stage)) = ? AND wa.decision = 'returned')`,
        rejected: `EXISTS (SELECT 1 FROM workflow_actions wa WHERE wa.module_key = 'workorder' AND wa.record_id = wo.id AND LOWER(TRIM(wa.stage)) = ? AND wa.decision = 'rejected')`,
        // Archive is a current status, not a historical action. An unarchived
        // workorder still has its old archived action in the timeline. Keep
        // the result scoped to the requested workflow stage as well; otherwise
        // the archive tile reports archives belonging to other stages.
        archived: `(LOWER(TRIM(COALESCE(wo.overall_status, ''))) = 'archived'
          AND EXISTS (
            SELECT 1 FROM workflow_actions wa
            WHERE wa.module_key = 'workorder'
              AND wa.record_id = wo.id
              AND LOWER(TRIM(wa.stage)) = ?
              AND wa.decision = 'archived'
          ))`,
      };
      const statusExpression = statusExpressions[statusCategory];
      if (statusExpression) {
        whereParts.push(statusExpression);
        if (statusCategory === 'pending') whereParams.push(normalizedStage);
        else if (['approved', 'returned', 'rejected', 'archived'].includes(statusCategory)) whereParams.push(normalizedStage);
      }
    }

    const whereSQL = whereParts.join(' AND ');

    const [[{ total }]] = await tx.query(
      `SELECT COUNT(*) AS total FROM work_orders wo WHERE ${whereSQL}`,
      whereParams,
    );

    const [rows] = await tx.query(
      `SELECT
         wo.id,
         wo.wo_number,
         COALESCE(
           CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,'')),
           wo.applicant_name
         ) AS applicant_name,
         COALESCE(d.name, wo.department) AS department,
         wo.request_date,
         wo.overall_status,
         wo.workflow_state,
         wo.workflow_status,
         wo.workflow_stage,
         (SELECT wa.decision
            FROM workflow_actions wa
           WHERE wa.module_key = 'workorder'
             AND wa.record_id = wo.id
             AND LOWER(TRIM(wa.stage)) = ?
           ORDER BY wa.decided_at DESC, wa.id DESC
           LIMIT 1) AS workflow_stage_decision,
         (SELECT wa.decision
            FROM workflow_actions wa
           WHERE wa.module_key = 'workorder'
             AND wa.record_id = wo.id
           ORDER BY wa.decided_at DESC, wa.id DESC
           LIMIT 1) AS workflow_latest_decision,
         woc.name AS category_name,
         woc.code AS category_code,
         (SELECT wot.name FROM work_order_items woi2
            LEFT JOIN work_order_types wot ON woi2.type_id = wot.id
            WHERE woi2.work_order_id = wo.id ORDER BY woi2.item_index, woi2.id LIMIT 1) AS work_type,
         (SELECT wos.name FROM work_order_items woi3
            LEFT JOIN work_order_subtypes wos ON woi3.sub_type_id = wos.id
            WHERE woi3.work_order_id = wo.id ORDER BY woi3.item_index, woi3.id LIMIT 1) AS work_subtype,
         (SELECT woi4.assigned_to FROM work_order_items woi4
            WHERE woi4.work_order_id = wo.id ORDER BY woi4.item_index, woi4.id LIMIT 1) AS assigned_to,
         (SELECT woi5.status FROM work_order_items woi5
            WHERE woi5.work_order_id = wo.id ORDER BY woi5.item_index, woi5.id LIMIT 1) AS assignment_status,
         (SELECT woi6.target_date FROM work_order_items woi6
            WHERE woi6.work_order_id = wo.id ORDER BY woi6.item_index, woi6.id LIMIT 1) AS target_date,
         wo.beneficiary_type,
         wo.beneficiary_value,
         wo.created_at,
         wo.updated_at
       FROM work_orders wo
       LEFT JOIN master_employees e ON wo.employee_id = e.id
       LEFT JOIN master_departments d ON wo.department_id = d.id
       LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
       WHERE ${whereSQL}
       ORDER BY wo.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [normalizedStage, ...whereParams],
    );

    const normalizedItems =
      statusCategory === 'approved'
        ? rows.map((row) => ({ ...row, workflow_status: 'approved' }))
        : rows;

    return { items: normalizedItems, total: Number(total), page, limit };
  },

  // -------------------------------------------------------
  // TIMELINE / HISTORY
  // -------------------------------------------------------

  async getWorkOrderTimeline(id) {
    const normalizedId = toPositiveInt(id);
    if (!normalizedId) return [];

    const [rows] = await db.query(
      `SELECT * FROM (
         SELECT
           CONCAT('submission-', wo.id) AS id,
           'submission' AS stage,
           'submitted' AS decision,
           'Work order submitted' AS feedback,
           wo.created_at AS decided_at,
           wo.created_by AS actor_user_id,
           COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,''))), ''), u.name, 'Unknown') AS actor_name,
           COALESCE(e.email, u.email) AS actor_email,
           COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,''))), ''), u.name, 'Unknown') AS userName,
           COALESCE(e.email, u.email) AS actorEmail,
           wo.created_at AS createdAt,
           wo.created_at AS decidedAt
         FROM work_orders wo
         LEFT JOIN master_employees e ON wo.created_by = e.user_id
         LEFT JOIN users u ON wo.created_by = u.id
         WHERE wo.id = ?

         UNION ALL

         SELECT
           wa.id,
           wa.stage,
           wa.decision,
           wa.feedback,
           wa.decided_at,
           wa.actor_user_id,
           COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,''))), ''), u.name, 'Unknown') AS actor_name,
           COALESCE(e.email, u.email) AS actor_email,
           COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,''))), ''), u.name, 'Unknown') AS userName,
           COALESCE(e.email, u.email) AS actorEmail,
           wa.decided_at AS createdAt,
           wa.decided_at AS decidedAt
         FROM workflow_actions wa
         LEFT JOIN master_employees e ON wa.actor_user_id = e.user_id
         LEFT JOIN users u ON wa.actor_user_id = u.id
         WHERE wa.module_key = 'workorder'
           AND wa.record_id = ?
       ) timeline
       ORDER BY decidedAt ASC, id ASC`,
      [normalizedId, normalizedId],
    );

    return rows;
  },

  // -------------------------------------------------------
  // EMPLOYEE / USER HELPERS
  // -------------------------------------------------------

  async getCurrentEmployeeInfo(userId) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId) return null;

    const [rows] = await db.query(
      `SELECT
         e.id AS employee_id,
         e.erp_id,
         CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,'')) AS name,
         e.designation,
         COALESCE(d.name, ent.name) AS department,
         e.email,
         e.mobile,
         e.employee_type
       FROM master_employees e
       LEFT JOIN master_departments d ON e.department_id = d.id
       LEFT JOIN master_entities ent ON e.entity_id = ent.id
       WHERE e.user_id = ?
         AND e.status = 'Active'
       LIMIT 1`,
      [normalizedUserId],
    );

    return rows[0] || null;
  },

  async listWorkOrderAssignees(query = '') {
    const search = normalizeText(query);
    const params = [];
    let where = "e.status = 'Active'";
    if (search) {
      where += ` AND (CONCAT(e.first_name, ' ', COALESCE(e.last_name,'')) LIKE ? OR e.erp_id LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    const [rows] = await db.query(`SELECT e.id AS employee_id, CONCAT(COALESCE(e.title,''), ' ', e.first_name, ' ', COALESCE(e.last_name,'')) AS name, e.designation, COALESCE(d.name, ent.name) AS department FROM master_employees e LEFT JOIN master_departments d ON e.department_id = d.id LEFT JOIN master_entities ent ON e.entity_id = ent.id WHERE ${where} ORDER BY e.first_name, e.last_name LIMIT 100`, params);
    return rows;
  },
};

// Register the work-order workflow from this module so the adapter file is not
// a separate runtime dependency. The shared engine resolves the configured
export default workorderModel;
