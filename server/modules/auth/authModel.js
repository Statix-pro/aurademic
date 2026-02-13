// import db from '../../config/connection.js';
// const authModel = {
//     async findOrCreateUser(userData) {
//         try {
//             let user;
//             let authorId = null;
//             // Check if user exists
//             const [existingUsers] = await db.query(
//                 'SELECT * FROM users WHERE email = ?',
//                 [userData.email]
//             );

//             if (existingUsers.length > 0) {
//                 const user = existingUsers[0];

//                 // Update user information if needed
//                 await db.query(
//                     'UPDATE users SET name = ?, picture = ? WHERE id = ?',
//                     [userData.name, userData.picture, user.id]
//                 );
//             } else {
//                 // Create new user if doesn't exist
//                 const [result] = await db.query(
//                     `INSERT INTO users (email, name, picture, created_at)
//                      VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
//                     [userData.email, userData.name, userData.picture]
//                 );

//                 if (!result.insertId) {
//                     throw new Error('Failed to create new user');
//                 }
//                 // console.log("User found and updated:", user.id);

//                 // Ensure that `is_admin` is included in the returned user object
//                 return {
//                     id: user.id,
//                     email: user.email,
//                     name: user.name,
//                     picture: user.picture,
//                     is_admin: user.is_admin // Include is_admin here
//                 };
//             }

//             // Create new user if doesn't exist
//             const [result] = await db.query(
//                 `INSERT INTO users (email, name, picture, created_at)
//                  VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
//                 [userData.email, userData.name, userData.picture]
//             );

//             if (!result.insertId) {
//                 throw new Error('Failed to create new user');
//             }

//             // Return new user data with is_admin defaulted to false (0)
//             return {
//                 id: result.insertId,
//                 email: userData.email,
//                 name: userData.name,
//                 picture: userData.picture,
//                 is_admin: 0 // New users default to is_admin = 0
//             };
//         } catch (error) {
//             console.error('Database operation failed:', error);
//             throw new Error(`Database error: ${error.message}`);
//         }
//     },

//     async updateLastLogin(userId) {
//         try {
//             await db.query(
//                 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
//                 [userId]
//             );
//         } catch (error) {
//             console.error('Failed to update last login:', error);
//             throw new Error(`Failed to update last login: ${error.message}`);
//         }
//     }
// };

// export default authModel;

import db from '../../config/connection.js';
import accessControlModel from '../accessControl/accessControlModel.js';
const authModel = {
  async findOrCreateUser(userData) {
    try {
      let user;
      let employeeData = null; // Employee data from master_employees

      // Check if user exists
      const [existingUsers] = await db.query(
        'SELECT * FROM users WHERE email = ?',
        [userData.email]
      );

      if (existingUsers.length > 0) {
        user = existingUsers[0];

        // Update user information if needed (optional, keep if necessary)
        await db.query('UPDATE users SET name = ?, picture = ? WHERE id = ?', [
          userData.name,
          userData.picture,
          user.id,
        ]);
      } else {
        // Create new user if doesn't exist
        const [result] = await db.query(
          `INSERT INTO users (email, name, picture, created_at) 
                     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [userData.email, userData.name, userData.picture]
        );

        if (!result.insertId) {
          throw new Error('Failed to create new user');
        }
        // Get the newly created user's data
        user = {
          id: result.insertId,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          is_admin: 0, // New users default to is_admin = 0
        };
      }

      // Fetch employee data from master_employees
      try {
        const [employeeRows] = await db.query(
          `SELECT 
            e.id AS employee_id,
            e.erp_id,
            CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS full_name,
            e.designation,
            d.name AS department,
            e.orcid_id,
            e.scopus_id,
            e.google_scholar_id
          FROM master_employees e
          LEFT JOIN master_departments d ON e.department_id = d.id
          WHERE e.email = ? AND e.status = 'Active'
          LIMIT 1`,
          [user.email]
        );

        if (employeeRows.length > 0) {
          employeeData = employeeRows[0];

          // Link user_id to employee record if not already linked
          await db.query(
            'UPDATE master_employees SET user_id = ? WHERE id = ? AND user_id IS NULL',
            [user.id, employeeData.employee_id]
          );
        }
      } catch (employeeError) {
        // Log error but don't prevent login if employee lookup fails
        console.error(
          `Error fetching employee data for email ${user.email}:`,
          employeeError
        );
      }

      const authorization =
        await accessControlModel.getUserAuthorizationSnapshot(user.id);
      const computedIsAdmin = authorization.isAdmin || Boolean(user.is_admin);

      // Return combined user data including employee info
      return {
        id: user.id,
        email: user.email,
        name: employeeData?.full_name || user.name,
        picture: user.picture,
        is_admin: computedIsAdmin,
        is_super_admin: authorization.isSuperAdmin,
        roles: authorization.roles,
        permissions: authorization.permissions,
        // Employee-specific fields
        employee_id: employeeData?.employee_id || null,
        erp_id: employeeData?.erp_id || null,
        designation: employeeData?.designation || null,
        department: employeeData?.department || null,
        orcid_id: employeeData?.orcid_id || null,
        scopus_id: employeeData?.scopus_id || null,
        google_scholar_id: employeeData?.google_scholar_id || null,
      };
    } catch (error) {
      console.error('Database operation failed:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  },

  async updateLastLogin(userId) {
    try {
      await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Failed to update last login:', error);
      throw new Error(`Failed to update last login: ${error.message}`);
    }
  },
};

export default authModel;
