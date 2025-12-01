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
const authModel = {
  async findOrCreateUser(userData) {
    try {
      let user;
      let authorId = null; // Initialize authorId

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

      // --- BEGIN NEW CODE ---
      // Fetch author_id based on user's email
      // Adjust 'authors' table name and 'faculty_email' column name if different
      try {
        const [authorRows] = await db.query(
          'SELECT author_id FROM authors WHERE email = ? LIMIT 1',
          [user.email]
        );
        if (authorRows.length > 0) {
          authorId = authorRows[0].author_id;
        }
      } catch (authorError) {
        // Log error but don't prevent login if author lookup fails
        console.error(
          `Error fetching author_id for email ${user.email}:`,
          authorError
        );
      }
      // --- END NEW CODE ---

      // Return combined user data including author_id
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        is_admin: user.is_admin,
        author_id: authorId, // Include author_id here
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
