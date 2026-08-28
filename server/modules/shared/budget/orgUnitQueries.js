/**
 * Shared Org Unit & Entity DB Queries
 *
 * Read-only database queries for departments, entities, and org units
 * shared between budget/ and adminbudget/ modules.
 */

import { normalizeText, normalizeEntityTypeCode } from './budgetUtils.js';
import db from '../../../config/connection.js';

// =====================================================
// DEPARTMENTS
// =====================================================

export async function getDepartments() {
  const [rows] = await db.execute(
    `SELECT id, name, code, is_active
     FROM master_departments
     WHERE type = 'Academic' AND is_active = 1
     ORDER BY name ASC`,
  );

  return rows;
}

export async function getDepartmentByName(name, conn = db) {
  const normalized = normalizeText(name);

  if (!normalized) {
    return null;
  }

  const [rows] = await conn.execute(
    `SELECT id, name, code
     FROM master_departments
     WHERE is_active = 1 AND type = 'Academic'
    AND(
      LOWER(TRIM(name)) = LOWER(TRIM(?))
         OR LOWER(TRIM(code)) = LOWER(TRIM(?))
    )
     ORDER BY CASE WHEN LOWER(TRIM(name)) = LOWER(TRIM(?)) THEN 0 ELSE 1 END
     LIMIT 1`,
    [normalized, normalized, normalized],
  );

  return rows[0] || null;
}

// =====================================================
// ENTITIES
// =====================================================

export async function getEntitiesByType(typeCode) {
  const normalizedTypeCode = normalizeEntityTypeCode(typeCode);

  if (!normalizedTypeCode) {
    return [];
  }

  const [rows] = await db.execute(
    `SELECT me.id,
            me.code,
            me.name,
            me.is_active,
            met.code AS type_code,
            met.name AS type_name
     FROM master_entities me
     JOIN master_entity_types met ON me.entity_type_id = met.id
     WHERE met.code = ? AND me.is_active = 1
     ORDER BY me.sort_order ASC, me.name ASC`,
    [normalizedTypeCode],
  );

  return rows.map((entity) => ({
    id: entity.id,
    name: entity.name,
    short_code: entity.code,
    is_active: entity.is_active,
    type_code: entity.type_code,
    type_name: entity.type_name,
  }));
}

export async function getOrgUnitsByType(typeCode) {
  const normalizedTypeCode = normalizeEntityTypeCode(typeCode);

  if (normalizedTypeCode === 'DEPARTMENT' || normalizedTypeCode === 'DEPT') {
    const departments = await getDepartments();
    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      short_code: dept.code,
      is_active: dept.is_active,
      type_code: 'DEPARTMENT',
      type_name: 'Department',
    }));
  }

  if (!normalizedTypeCode) {
    return [];
  }

  return getEntitiesByType(normalizedTypeCode);
}

export async function getAllOrgUnits() {
  const departments = await getDepartments();

  const [entityRows] = await db.execute(
    `SELECT me.id,
            me.code,
            me.name,
            me.is_active,
            met.code AS type_code,
            met.name AS type_name
     FROM master_entities me
     JOIN master_entity_types met ON me.entity_type_id = met.id
     WHERE me.is_active = 1
     ORDER BY met.name ASC, me.sort_order ASC, me.name ASC`,
  );

  const departmentRows = departments.map((department) => ({
    id: department.id,
    name: department.name,
    short_code: department.code,
    is_active: department.is_active,
    type_code: 'DEPARTMENT',
    type_name: 'Department',
  }));

  const mappedEntities = entityRows.map((entity) => ({
    id: entity.id,
    name: entity.name,
    short_code: entity.code,
    is_active: entity.is_active,
    type_code: entity.type_code,
    type_name: entity.type_name,
  }));

  return [...departmentRows, ...mappedEntities];
}

export async function getOrgUnitEmails(orgUnitId) {
  const [rows] = await db.execute(
    `SELECT id, role, email, is_primary
     FROM master_entity_contacts
     WHERE entity_id = ?
     ORDER BY is_primary DESC, role ASC`,
    [orgUnitId],
  );

  return rows;
}

// =====================================================
// ENTITY LEVEL-1 ASSIGNEE FALLBACK
// =====================================================

/**
 * FALLBACK: entities whose Level-1 approver was assigned only through Access
 * Control (user_entity_roles) have no master_entity_contacts row, so the
 * contact-based Level-1 resolver returns null and approvals are blocked even
 * though the assignee already sees the proposal in their queue (the list
 * queries OR user_entity_roles).
 *
 * Resolves the entity's assigned approver from user_entity_roles instead.
 * Remove once every entity is guaranteed a master_entity_contacts row at
 * creation/assignment time.
 */
export async function resolveEntityLevel1AssigneeFallback(entityId, conn = db) {
  const parsedEntityId = Number(entityId);

  if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
    return null;
  }

  const fallbackMap = await resolveEntityLevel1AssigneeFallbackMap([parsedEntityId], conn);

  return fallbackMap.get(parsedEntityId) || null;
}

/**
 * FALLBACK: batch variant of resolveEntityLevel1AssigneeFallback. Returns a
 * Map<entityId, { id, role, email, is_primary }> shaped like a
 * master_entity_contacts row so callers can treat both sources alike.
 */
export async function resolveEntityLevel1AssigneeFallbackMap(entityIds = [], conn = db) {
  const uniqueEntityIds = [
    ...new Set(
      (Array.isArray(entityIds) ? entityIds : [])
        .map((entityId) => Number(entityId))
        .filter((entityId) => Number.isInteger(entityId) && entityId > 0),
    ),
  ];

  const fallbackMap = new Map();

  if (!uniqueEntityIds.length) {
    return fallbackMap;
  }

  const [rows] = await conn.query(
    `SELECT uer.entity_id, uer.id AS assignment_id, r.role_code, u.email
       FROM user_entity_roles uer
       JOIN users u ON u.id = uer.user_id
       LEFT JOIN roles r ON r.id = uer.role_id
       WHERE uer.entity_id IN (?)
         AND u.email IS NOT NULL
         AND TRIM(u.email) <> ''
       ORDER BY uer.entity_id ASC, uer.id ASC`,
    [uniqueEntityIds],
  );

  for (const row of rows) {
    const entityId = Number(row.entity_id);

    if (fallbackMap.has(entityId)) {
      continue;
    }

    fallbackMap.set(entityId, {
      id: Number(row.assignment_id),
      role: normalizeText(row.role_code).toLowerCase() || 'coordinator',
      email: normalizeText(row.email).toLowerCase(),
      is_primary: false,
    });
  }

  return fallbackMap;
}
