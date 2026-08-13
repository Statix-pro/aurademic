import db from '../../config/connection.js';

// Public event participants. Never touches users/roles/master_employees.
const participantAuthModel = {
  // Matched on google_sub first (stable across email changes), then email.
  //
  // Deliberately matches soft-deleted rows too. `uq_participants_email` and
  // `uq_participants_google_sub` are unconditional, so skipping them would send a
  // returning soft-deleted participant down the INSERT path and fail on
  // ER_DUP_ENTRY — an unrecoverable 500 on every future sign-in. Instead the row
  // is returned as-is and the caller refuses the login with a real reason.
  async findOrCreateParticipant({ email, name, picture, googleSub, emailVerified }) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [bySub] = googleSub
        ? await connection.query('SELECT * FROM event_participants WHERE google_sub = ? LIMIT 1', [
            googleSub,
          ])
        : [[]];

      let participant = bySub[0] ?? null;

      if (!participant) {
        const [byEmail] = await connection.query(
          'SELECT * FROM event_participants WHERE email = ? LIMIT 1',
          [email],
        );
        participant = byEmail[0] ?? null;
      }

      // A removed account keeps its row (audit trail, and the FKs registrations
      // hold). Reviving it here would silently undo an admin's decision, so the
      // row is handed back untouched for the caller to reject.
      if (participant?.is_deleted) {
        await connection.commit();

        return {
          id: participant.id,
          email: participant.email,
          name: participant.name,
          picture: participant.picture,
          is_blocked: participant.is_blocked,
          is_active: participant.is_active,
          is_deleted: 1,
        };
      }

      if (participant) {
        await connection.query(
          `UPDATE event_participants
              SET name = ?,
                  picture = ?,
                  google_sub = COALESCE(google_sub, ?),
                  email_verified = ?,
                  last_login_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [name, picture, googleSub, emailVerified ? 1 : 0, participant.id],
        );
      } else {
        const [result] = await connection.query(
          `INSERT INTO event_participants
             (email, name, picture, google_sub, email_verified, last_login_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [email, name, picture, googleSub, emailVerified ? 1 : 0],
        );

        if (!result.insertId) {
          throw new Error('Failed to create participant');
        }

        participant = { id: result.insertId };
      }

      const [rows] = await connection.query(
        `SELECT p.id, p.email, p.name, p.picture, p.is_blocked, p.is_active, p.is_deleted,
                pr.id AS profile_id,
                pr.personal_completed_at,
                pr.profession_completed_at
           FROM event_participants p
           LEFT JOIN event_participant_profiles pr ON pr.participant_id = p.id
          WHERE p.id = ?
          LIMIT 1`,
        [participant.id],
      );

      await connection.commit();

      return rows[0] ?? null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async findParticipantWithProfileById(participantId) {
    const [rows] = await db.query(
      `SELECT p.id, p.email, p.name, p.picture, p.is_blocked,
              pr.personal_completed_at,
              pr.profession_completed_at
         FROM event_participants p
         LEFT JOIN event_participant_profiles pr ON pr.participant_id = p.id
        WHERE p.id = ? AND p.is_active = 1 AND p.is_deleted = 0
        LIMIT 1`,
      [participantId],
    );

    return rows[0] ?? null;
  },

  async findActiveParticipantById(participantId) {
    const [rows] = await db.query(
      `SELECT id, email, name, picture, is_blocked
         FROM event_participants
        WHERE id = ? AND is_active = 1 AND is_deleted = 0
        LIMIT 1`,
      [participantId],
    );

    return rows[0] ?? null;
  },
};

export default participantAuthModel;
