import db from '../../config/connection.js';

class RoleSyncService {
  /**
   * Synchronize all HOD roles from master_departments to user_entity_roles
   */
  static async syncHODRoles() {
    try {
      // Find the 'hod' role ID
      const [roleRows] = await db.execute(`SELECT id FROM roles WHERE role_code = 'hod' LIMIT 1`);
      if (roleRows.length === 0) return;
      const hodRoleId = roleRows[0].id;

      // Select all HOD emails from master_departments
      const [deptRows] = await db.execute(`
        SELECT d.id AS entity_id, d.email 
        FROM master_departments d 
        WHERE d.email IS NOT NULL AND d.email != ''
      `);

      for (const dept of deptRows) {
        // Find the user mapped to this email
        const [userRows] = await db.execute(
          `
          SELECT id FROM users 
          WHERE LOWER(email) = LOWER(TRIM(?))
          LIMIT 1
        `,
          [dept.email],
        );

        if (userRows.length > 0) {
          const userId = userRows[0].id;

          // Upsert the mapped user_entity_roles record seamlessly ignoring duplicates
          await db.execute(
            `
            INSERT IGNORE INTO user_entity_roles (user_id, entity_id, entity_type, role_id)
            VALUES (?, ?, 'DEPARTMENT', ?)
          `,
            [userId, dept.entity_id, hodRoleId],
          );
        }
      }
    } catch (error) {
      console.error('Error synchronizing HOD roles:', error);
    }
  }

  /**
   * Synchronize all Coordinator roles from master_entity_contacts to user_entity_roles
   */
  static async syncCoordinatorRoles() {
    try {
      // Find the generic coordinator role
      const [roleRows] = await db.execute(
        `SELECT id FROM roles WHERE role_code = 'coordinator' LIMIT 1`,
      );
      if (roleRows.length === 0) return;
      const coordRoleId = roleRows[0].id;

      const [contactRows] = await db.execute(`
        SELECT mec.entity_id, mec.email, met.code AS type
        FROM master_entity_contacts mec
        JOIN master_entities me ON mec.entity_id = me.id
        JOIN master_entity_types met ON me.entity_type_id = met.id
        WHERE mec.email IS NOT NULL AND mec.email != ''
      `);

      for (const contact of contactRows) {
        // Map master_entities string type to the ENUM values stored in user_entity_roles
        const rawType = (contact.type || '').toUpperCase().trim();
        let entityTypeEnum = 'CELL'; // Default fallback
        if (rawType.includes('CENTRE') || rawType.includes('CENTER')) entityTypeEnum = 'CENTRE';
        if (rawType.includes('CLUB')) entityTypeEnum = 'CLUB';
        if (rawType.includes('SECTION')) entityTypeEnum = 'SECTION';
        if (rawType.includes('PROFESSIONAL_BODY') || rawType.includes('PROFESSIONALBODY'))
          entityTypeEnum = 'PROFESSIONAL_BODY';

        const [userRows] = await db.execute(
          `
          SELECT id FROM users 
          WHERE LOWER(email) = LOWER(TRIM(?))
          LIMIT 1
        `,
          [contact.email],
        );

        if (userRows.length > 0) {
          const userId = userRows[0].id;

          await db.execute(
            `
            INSERT IGNORE INTO user_entity_roles (user_id, entity_id, entity_type, role_id)
            VALUES (?, ?, ?, ?)
          `,
            [userId, contact.entity_id, entityTypeEnum, coordRoleId],
          );
        }
      }
    } catch (error) {
      console.error('Error synchronizing Coordinator roles:', error);
    }
  }

  /**
   * Main entrypoint to be triggered by manual Admin UI sync requests
   */
  static async syncAllRoles() {
    console.log('[RoleSyncService] Starting manual auto-assignment synchronization...');
    await this.syncHODRoles();
    await this.syncCoordinatorRoles();
    console.log('[RoleSyncService] Synchronization complete.');
  }
}

export default RoleSyncService;
