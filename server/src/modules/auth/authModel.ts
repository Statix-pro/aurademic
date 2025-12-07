import db from '../../config/connection.js';
import { User, DbResult, Author } from '../../types/db.js';

interface UserData {
    email: string;
    name: string;
    picture?: string;
}

interface UserWithAuthor {
    id: number;
    email: string;
    name: string;
    picture?: string;
    is_admin: boolean;
    author_id?: string | null;
}

const authModel = {
  async findOrCreateUser(userData: UserData): Promise<UserWithAuthor> {
    try {
      let user: UserWithAuthor;
      let authorId: string | null = null; // Initialize authorId

      // Check if user exists
      const [existingUsers] = await db.query<User[]>(
        'SELECT * FROM users WHERE email = ?',
        [userData.email]
      );

      if (existingUsers.length > 0) {
        const existingUser = existingUsers[0];
        user = {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            picture: existingUser.picture,
            is_admin: !!existingUser.is_admin
        };

        // Update user information if needed (optional, keep if necessary)
        await db.query('UPDATE users SET name = ?, picture = ? WHERE id = ?', [
          userData.name,
          userData.picture,
          user.id,
        ]);
      } else {
        // Create new user if doesn't exist
        const [result] = await db.query<DbResult>(
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
          is_admin: false, // New users default to is_admin = 0
        };
      }

      // --- BEGIN NEW CODE ---
      // Fetch author_id based on user's email
      try {
        const [authorRows] = await db.query<Author[]>(
          'SELECT author_id FROM authors WHERE email = ? LIMIT 1',
          [user.email]
        );
        if (authorRows.length > 0) {
          authorId = authorRows[0].author_id || null;
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
        ...user,
        author_id: authorId, // Include author_id here
      };
    } catch (error: any) {
      console.error('Database operation failed:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  },

  async updateLastLogin(userId: number | string): Promise<void> {
    try {
      await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      );
    } catch (error: any) {
      console.error('Failed to update last login:', error);
      throw new Error(`Failed to update last login: ${error.message}`);
    }
  },
};

export default authModel;
