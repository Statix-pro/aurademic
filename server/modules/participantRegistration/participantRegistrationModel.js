import db from '../../config/connection.js';

/**
 * Marks a route that is mounted but not yet built.
 *
 * The controller maps this to 501, so a caller can tell "not written yet" from
 * "the server broke". Without it every unbuilt endpoint answers 500 with a stack
 * trace, which buries real failures in the same log line.
 */
export class NotImplementedError extends Error {
  constructor(method) {
    super(`Not implemented: ${method}`);
    this.name = 'NotImplementedError';
  }
}

// ---------------------------------------------------------------------------
// Profile completeness helpers
//
// Mirror the rules in ProfileContext.tsx so the DB timestamp is set by the
// same logic the client uses to render "complete" badges. Keeping both in sync
// prevents a mismatch where the client shows ✓ but the backend gate rejects.
// ---------------------------------------------------------------------------

function isPersonalComplete(d) {
  return !!(
    d.first_name?.trim() &&
    d.last_name?.trim() &&
    d.gender?.trim() &&
    d.date_of_birth?.trim() &&
    d.mobile_number?.trim() &&
    d.contact_email?.trim()
  );
}

function isProfessionComplete(d) {
  const type = d.profession_type;
  if (!type) return false;

  if (
    [
      'College Student',
      'Faculty Members',
      'School Student',
      'School Teacher',
      'Research Scholar',
    ].includes(type)
  ) {
    return !!d.institution?.trim();
  }

  if (type === 'Alumni') {
    return !!(d.register_number?.trim() && d.department?.trim() && d.graduation_year?.trim());
  }

  if (
    ['Scientist', 'Government Official', 'Industry Professional', 'Other Profession'].includes(type)
  ) {
    return !!d.organization?.trim();
  }

  if (type === 'General Public') {
    return !!(d.occupation?.trim() && d.city?.trim());
  }

  return true;
}

// Data access for participant-owned records.
//
// The helpers marked IMPLEMENTED below are the security-critical ones: ownership,
// eligibility and server-side pricing. Do not bypass them, and do not accept an
// amount or a payment status from the client.
const participantRegistrationModel = {
  // --- IMPLEMENTED: ownership -------------------------------------------------

  /**
   * Returns the registration only when it belongs to this participant.
   * Every /registrations/:id route must go through this before doing anything,
   * otherwise a participant can read or edit another participant's registration
   * just by changing the id in the URL.
   */
  async findOwnedRegistration(registrationId, participantId) {
    const [rows] = await db.query(
      `SELECT r.*, e.event_title
         FROM event_registrations r
         JOIN events e ON e.id = r.event_id
        WHERE r.id = ? AND r.participant_id = ? AND r.is_deleted = 0
        LIMIT 1`,
      [registrationId, participantId],
    );

    return rows[0] ?? null;
  },

  // --- IMPLEMENTED: eligibility ----------------------------------------------

  /**
   * Everything needed to decide whether this event can be registered for right
   * now. Recomputed server-side: the client's view of "Open" may be stale or
   * tampered with.
   */
  async getRegistrationContext(eventId) {
    const [rows] = await db.query(
      `SELECT e.id,
              e.event_title,
              e.workflow_status,
              e.is_active,
              e.is_deleted,
              s.registration_status,
              s.team_enabled,
              s.minimum_team_size,
              s.maximum_team_size,
              s.max_participants,
              s.waiting_list_enabled,
              s.open_to,
              COALESCE(s.extended_date, s.last_date, s.registration_deadline) AS closes_at,
              (SELECT COUNT(*) FROM event_registrations r
                WHERE r.event_id = e.id AND r.is_cancelled = 0 AND r.is_deleted = 0) AS registered_count
         FROM events e
         LEFT JOIN event_registration_settings s ON s.event_id = e.id AND s.is_deleted = 0
        WHERE e.id = ?
        LIMIT 1`,
      [eventId],
    );

    return rows[0] ?? null;
  },

  // --- IMPLEMENTED: pricing --------------------------------------------------

  /**
   * Resolves the fee row for a participant type. The caller must compute the
   * payable amount from this, never from a client-supplied number.
   *
   * Falls back to the event's type-agnostic row (participant_type_id IS NULL)
   * when no row matches the participant's type.
   */
  async findApplicableFee(eventId, participantTypeId) {
    const [rows] = await db.query(
      `SELECT individual_fee, team_fee, member_fee, additional_member_fee
         FROM event_registration_fees
        WHERE event_id = ?
          AND is_deleted = 0
          AND (participant_type_id = ? OR participant_type_id IS NULL)
        ORDER BY participant_type_id IS NULL
        LIMIT 1`,
      [eventId, participantTypeId ?? null],
    );

    return rows[0] ?? null;
  },

  /** Room tariffs for accommodation, used to price a stay server-side. */
  async findRoomType(roomTypeId, eventId) {
    const [rows] = await db.query(
      `SELECT id, room_type, price_per_night, max_occupants
         FROM event_accommodation_room_types
        WHERE id = ? AND event_id = ? AND is_active = 1 AND is_deleted = 0
        LIMIT 1`,
      [roomTypeId, eventId],
    );

    return rows[0] ?? null;
  },

  // --- IMPLEMENTED: payment proof --------------------------------------------

  /**
   * Records a submitted payment proof.
   *
   * Hardcodes status 'Submitted'. A participant can never write 'Verified' —
   * only the staff verification handler may, and it must also set verified_by
   * and verified_at (the DB cannot enforce that; see the migration notes).
   */
  async insertPaymentProof({
    registrationId,
    amount,
    billType,
    proofFilePath,
    transactionReference,
  }) {
    const [result] = await db.query(
      `INSERT INTO event_payments
         (registration_id, amount, bill_type, payment_status, transaction_reference,
          proof_file_path, proof_uploaded_at)
       VALUES (?, ?, ?, 'Submitted', ?, ?, CURRENT_TIMESTAMP)`,
      [registrationId, amount, billType, transactionReference ?? null, proofFilePath],
    );

    return result.insertId;
  },

  async listPayments(registrationId) {
    const [rows] = await db.query(
      `SELECT id, amount, bill_type AS billType, payment_status AS paymentStatus,
              transaction_reference AS transactionReference, receipt_number AS receiptNumber,
              proof_file_path AS proofFilePath, payment_date AS paymentDate,
              rejection_reason AS rejectionReason, verified_at AS verifiedAt
         FROM event_payments
        WHERE registration_id = ? AND is_deleted = 0
        ORDER BY created_at DESC`,
      [registrationId],
    );

    return rows;
  },

  // --- IMPLEMENTED: profile --------------------------------------------------

  /**
   * Returns the profile row for a participant, or null if it has not been
   * created yet. The returned object uses snake_case DB column names directly;
   * the controller maps them to camelCase before sending them to the client.
   */
  async findProfile(participantId) {
    const [rows] = await db.query(
      `SELECT title, first_name, last_name, gender, differently_abled,
              date_of_birth, mobile_number, whatsapp_number, contact_email,
              address, city, state, country, pin, photo_path,
              participant_type_id, profession_type, register_number,
              institution, department, designation, id_card_path,
              profession_details,
              personal_completed_at, profession_completed_at
         FROM event_participant_profiles
        WHERE participant_id = ?
        LIMIT 1`,
      [participantId],
    );

    return rows[0] ?? null;
  },

  /**
   * Upserts the personal section of a participant's profile.
   *
   * Uses INSERT … ON DUPLICATE KEY UPDATE so two concurrent first saves from
   * the same participant produce exactly one row (uq_profile_participant).
   *
   * Sets personal_completed_at when all six required fields are present;
   * clears it to NULL otherwise, so an incomplete re-save revokes the gate.
   *
   * Age is NEVER stored — date_of_birth is kept and age is derived on the client.
   */
  async upsertPersonalDetails(participantId, details) {
    // Map camelCase client keys to snake_case DB columns.
    const d = {
      first_name: details.firstName?.trim() ?? null,
      last_name: details.lastName?.trim() ?? null,
      gender: details.gender?.trim() ?? null,
      differently_abled: details.differentlyAbled ? 1 : 0,
      date_of_birth: details.dateOfBirth?.trim() || null,
      mobile_number: details.mobileNumber?.trim() ?? null,
      whatsapp_number: details.whatsappNumber?.trim() ?? null,
      contact_email: details.email?.trim() ?? null,
      address: details.address?.trim() ?? null,
      city: details.city?.trim() ?? null,
      state: details.state?.trim() ?? null,
      country: details.country?.trim() ?? null,
      pin: details.pin?.trim() ?? null,
      title: details.title?.trim() ?? null,
    };

    const completed = isPersonalComplete(d);
    const completedSql = completed ? 'CURRENT_TIMESTAMP' : 'NULL';

    await db.query(
      `INSERT INTO event_participant_profiles
         (participant_id, title, first_name, last_name, gender, differently_abled,
          date_of_birth, mobile_number, whatsapp_number, contact_email,
          address, city, state, country, pin, personal_completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${completedSql})
       ON DUPLICATE KEY UPDATE
         title                = VALUES(title),
         first_name           = VALUES(first_name),
         last_name            = VALUES(last_name),
         gender               = VALUES(gender),
         differently_abled    = VALUES(differently_abled),
         date_of_birth        = VALUES(date_of_birth),
         mobile_number        = VALUES(mobile_number),
         whatsapp_number      = VALUES(whatsapp_number),
         contact_email        = VALUES(contact_email),
         address              = VALUES(address),
         city                 = VALUES(city),
         state                = VALUES(state),
         country              = VALUES(country),
         pin                  = VALUES(pin),
         personal_completed_at = ${completedSql}`,
      [
        participantId,
        d.title,
        d.first_name,
        d.last_name,
        d.gender,
        d.differently_abled,
        d.date_of_birth,
        d.mobile_number,
        d.whatsapp_number,
        d.contact_email,
        d.address,
        d.city,
        d.state,
        d.country,
        d.pin,
      ],
    );

    return { personalComplete: isPersonalComplete(d) };
  },

  /**
   * Upserts the profession section of a participant's profile.
   *
   * Promoted columns (indexed in the DB) are written as real columns.
   * Everything else, keyed by the frontend's ProfessionDetails field names,
   * lands in profession_details JSON.
   */
  async upsertProfessionDetails(participantId, details) {
    // Promoted columns.
    const promoted = {
      profession_type: details.professionType?.trim() ?? null,
      register_number: details.registerNumber?.trim() ?? null,
      institution: details.institution?.trim() ?? null,
      department: details.department?.trim() ?? null,
      designation: details.designation?.trim() ?? null,
    };

    // Completeness check using the same keys the helper reads.
    const completenessInput = {
      ...promoted,
      // Additional fields needed by isProfessionComplete.
      graduation_year: details.graduationYear?.trim() ?? null,
      organization: details.organization?.trim() ?? null,
      occupation: details.occupation?.trim() ?? null,
      city: details.city?.trim() ?? null,
    };
    const profComplete = isProfessionComplete(completenessInput);

    // Everything not promoted goes into profession_details JSON.
    // Excluded: professionType (promoted), registerNumber (promoted),
    //   institution (promoted), department (promoted), designation (promoted).
    const PROMOTED_CLIENT_KEYS = new Set([
      'professionType',
      'registerNumber',
      'institution',
      'department',
      'designation',
    ]);
    const professionDetails = {};
    for (const [k, v] of Object.entries(details)) {
      if (!PROMOTED_CLIENT_KEYS.has(k)) {
        professionDetails[k] = v;
      }
    }

    const detailsJson = JSON.stringify(professionDetails);

    await db.query(
      `INSERT INTO event_participant_profiles
         (participant_id, profession_type, register_number, institution,
          department, designation, profession_details,
          profession_completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${profComplete ? 'CURRENT_TIMESTAMP' : 'NULL'})
       ON DUPLICATE KEY UPDATE
         profession_type         = VALUES(profession_type),
         register_number         = VALUES(register_number),
         institution             = VALUES(institution),
         department              = VALUES(department),
         designation             = VALUES(designation),
         profession_details      = VALUES(profession_details),
         profession_completed_at = ${profComplete ? 'CURRENT_TIMESTAMP' : 'NULL'}`,
      [
        participantId,
        promoted.profession_type,
        promoted.register_number,
        promoted.institution,
        promoted.department,
        promoted.designation,
        detailsJson,
      ],
    );

    return { professionComplete: profComplete };
  },

  /**
   * Writes a file path column after a Multer upload.
   *
   * Only photo_path and id_card_path are allowed — never any other column.
   * The profile row is created if it does not yet exist (a participant might
   * upload a photo before filling in any text fields).
   *
   * TODO: unlink the previously stored file so replacing a photo does not
   * leave orphans on disk.
   */
  async updateProfileFilePath(participantId, column, filePath) {
    const ALLOWED = new Set(['photo_path', 'id_card_path']);
    if (!ALLOWED.has(column)) {
      throw new Error(`updateProfileFilePath: column '${column}' is not allowed`);
    }

    await db.query(
      `INSERT INTO event_participant_profiles (participant_id, ${column})
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ${column} = VALUES(${column})`,
      [participantId, filePath],
    );
  },

  // --- IMPLEMENTED: registrations --------------------------------------------

  /**
   * Lists this participant's registrations with a summary of event name and
   * registration status. Returned in descending creation order.
   */
  async listRegistrations(participantId) {
    const [rows] = await db.query(
      `SELECT r.id,
              r.event_id        AS eventId,
              e.event_title     AS eventName,
              r.registration_status  AS registrationStatus,
              r.review_status        AS reviewStatus,
              r.registration_ref_no  AS refNo,
              r.is_cancelled,
              r.created_at,
              EXISTS(SELECT 1 FROM event_payments p
                      WHERE p.registration_id = r.id AND p.payment_status = 'Verified' AND p.is_deleted = 0) AS hasVerifiedPayment,
              EXISTS(SELECT 1 FROM event_payments p
                      WHERE p.registration_id = r.id AND p.payment_status = 'Submitted' AND p.is_deleted = 0) AS hasSubmittedPayment,
              (SELECT p.proof_file_path FROM event_payments p
                WHERE p.registration_id = r.id AND p.is_deleted = 0
                ORDER BY p.created_at DESC LIMIT 1) AS paymentProofPath,
              (SELECT p.bill_type FROM event_payments p
                WHERE p.registration_id = r.id AND p.is_deleted = 0
                ORDER BY p.created_at DESC LIMIT 1) AS paymentBillType,
              (SELECT p.proof_uploaded_at FROM event_payments p
                WHERE p.registration_id = r.id AND p.is_deleted = 0
                ORDER BY p.created_at DESC LIMIT 1) AS paymentProofUploadedAt,
              JSON_UNQUOTE(JSON_EXTRACT(r.documents, '$.documentPath')) AS documentPath,
              JSON_UNQUOTE(JSON_EXTRACT(r.documents, '$.documentTypeName')) AS documentTypeName,
              JSON_UNQUOTE(JSON_EXTRACT(r.documents, '$.documentUploadedAt')) AS documentUploadedAt,
              (r.feedback_answers IS NOT NULL AND r.feedback_answers != 'null') AS hasFeedback,
              r.team_members AS teamMembers
         FROM event_registrations r
         JOIN events e ON e.id = r.event_id
        WHERE r.participant_id = ? AND r.is_deleted = 0
        ORDER BY r.created_at DESC`,
      [participantId],
    );

    return rows;
  },

  /**
   * Creates a registration row for this participant and event.
   *
   * Generates a unique ref_no (format: EVT-<eventId>-<timestamp>). The UNIQUE
   * constraint uq_event_participant means a duplicate registration surfaces as
   * ER_DUP_ENTRY; the controller translates that into 409.
   */
  async createRegistration(participantId, eventId) {
    const refNo = `EVT-${eventId}-${Date.now()}`;

    const [result] = await db.query(
      `INSERT INTO event_registrations
         (participant_id, event_id, registration_status, review_status,
          registration_ref_no)
       VALUES (?, ?, 'Pending', 'Pending', ?)`,
      [participantId, eventId, refNo],
    );

    return result.insertId;
  },

  /**
   * Replaces all team members for a registration in a single transaction.
   * member_order starts at 1 (1 = team lead).
   * uq_team_member_email rejects duplicate emails within one registration;
   * the caller must catch ER_DUP_ENTRY and translate it to 400.
   */
  async replaceTeamMembers(registrationId, members) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Soft-delete existing rows first.
      await connection.query(
        `UPDATE event_registration_team_members
            SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
          WHERE registration_id = ? AND is_deleted = 0`,
        [registrationId],
      );

      // Re-insert fresh set.
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        await connection.query(
          `INSERT INTO event_registration_team_members
             (registration_id, member_order, email, name, organization, role)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            registrationId,
            i + 1,
            m.email.trim(),
            m.name.trim(),
            m.organization?.trim() ?? null,
            m.role?.trim() ?? null,
          ],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /** Upserts event_registration_accommodation + its room rows in a transaction. */
  async saveAccommodation(registrationId, accommodation) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [existing] = await connection.query(
        'SELECT id FROM event_registration_accommodation WHERE registration_id = ? LIMIT 1',
        [registrationId],
      );

      if (!accommodation.required) {
        if (existing[0]) {
          const headerId = existing[0].id;
          await connection.query(
            `UPDATE event_registration_accommodation
                SET accommodation_required = 0, check_in_date = NULL, check_out_date = NULL, total_amount = 0.00, hostel_status = 'Cancelled'
              WHERE id = ?`,
            [headerId],
          );
          await connection.query(
            'DELETE FROM event_registration_accommodation_rooms WHERE registration_accommodation_id = ?',
            [headerId],
          );
        } else {
          await connection.query(
            `INSERT INTO event_registration_accommodation
               (registration_id, accommodation_required, check_in_date, check_out_date, total_amount, hostel_status, is_active, is_deleted)
             VALUES (?, 0, NULL, NULL, 0.00, 'Cancelled', 1, 0)`,
            [registrationId],
          );
        }
      } else {
        let headerId;
        if (existing[0]) {
          headerId = existing[0].id;
          await connection.query(
            `UPDATE event_registration_accommodation
                SET accommodation_required = 1, check_in_date = ?, check_out_date = ?, total_amount = ?, hostel_status = 'Pending', is_active = 1, is_deleted = 0
              WHERE id = ?`,
            [
              accommodation.checkInDate,
              accommodation.checkOutDate,
              accommodation.totalAmount,
              headerId,
            ],
          );
        } else {
          const [insertRes] = await connection.query(
            `INSERT INTO event_registration_accommodation
               (registration_id, accommodation_required, check_in_date, check_out_date, total_amount, hostel_status, is_active, is_deleted)
             VALUES (?, 1, ?, ?, ?, 'Pending', 1, 0)`,
            [
              registrationId,
              accommodation.checkInDate,
              accommodation.checkOutDate,
              accommodation.totalAmount,
            ],
          );
          headerId = insertRes.insertId;
        }

        // Delete old rooms
        await connection.query(
          'DELETE FROM event_registration_accommodation_rooms WHERE registration_accommodation_id = ?',
          [headerId],
        );

        // Insert new rooms
        for (const room of accommodation.rooms) {
          await connection.query(
            `INSERT INTO event_registration_accommodation_rooms
               (registration_accommodation_id, room_type_id, room_type_name, price_per_night_snapshot, occupants, rooms_count, nights, amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              headerId,
              room.roomTypeId,
              room.roomTypeName,
              room.pricePerNightSnapshot,
              room.occupants,
              room.roomsCount,
              room.nights,
              room.amount,
            ],
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /** Inserts a registration document reference into the database. */
  async insertRegistrationDocument(registrationId, document) {
    await db.query(
      `INSERT INTO event_registration_documents
         (registration_id, document_type_id, file_path, verification_status, is_active, is_deleted)
       VALUES (?, ?, ?, 'Pending', 1, 0)`,
      [registrationId, document.documentTypeId, document.filePath],
    );
  },

  /** Inserts event_feedbacks + event_feedback_answers in a transaction. */
  async submitFeedback(registrationId, feedback) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Find the event_id from the registration
      const [regRows] = await connection.query(
        'SELECT event_id FROM event_registrations WHERE id = ?',
        [registrationId],
      );
      if (!regRows[0]) {
        throw new Error('Registration not found');
      }
      const eventId = regRows[0].event_id;

      // Check if feedback already exists for this registration
      const [existing] = await connection.query(
        'SELECT id FROM event_feedbacks WHERE registration_id = ? LIMIT 1',
        [registrationId],
      );

      let feedbackId;
      if (existing[0]) {
        feedbackId = existing[0].id;
        // Update submitted_at
        await connection.query(
          'UPDATE event_feedbacks SET submitted_at = CURRENT_TIMESTAMP WHERE id = ?',
          [feedbackId],
        );
        // Delete previous answers so we overwrite them
        await connection.query('DELETE FROM event_feedback_answers WHERE feedback_id = ?', [
          feedbackId,
        ]);
      } else {
        const [insertRes] = await connection.query(
          'INSERT INTO event_feedbacks (event_id, registration_id, submitted_at, is_active, is_deleted) VALUES (?, ?, CURRENT_TIMESTAMP, 1, 0)',
          [eventId, registrationId],
        );
        feedbackId = insertRes.insertId;
      }

      // Check for dynamic questions. If none, auto-create default ones.
      const [questions] = await connection.query(
        'SELECT id, question_text, question_type FROM event_feedback_questions WHERE event_id = ? AND is_deleted = 0',
        [eventId],
      );

      let ratingQuestionId;
      let commentQuestionId;
      if (questions.length === 0) {
        const [q1] = await connection.query(
          'INSERT INTO event_feedback_questions (event_id, question_text, question_type, display_order, is_required) VALUES (?, "Overall Rating", "rating", 1, 1)',
          [eventId],
        );
        const [q2] = await connection.query(
          'INSERT INTO event_feedback_questions (event_id, question_text, question_type, display_order, is_required) VALUES (?, "Review Comment", "text", 2, 0)',
          [eventId],
        );
        ratingQuestionId = q1.insertId;
        commentQuestionId = q2.insertId;
      } else {
        const q1 = questions.find(
          (q) => q.question_type === 'rating' || q.question_text.toLowerCase().includes('rating'),
        );
        const q2 = questions.find(
          (q) =>
            q.question_type === 'text' ||
            q.question_text.toLowerCase().includes('comment') ||
            q.question_text.toLowerCase().includes('review'),
        );
        ratingQuestionId = q1 ? q1.id : questions[0].id;
        commentQuestionId = q2 ? q2.id : questions[1] ? questions[1].id : questions[0].id;
      }

      // Insert rating
      const rating = Number(feedback.rating ?? 5);
      await connection.query(
        `INSERT INTO event_feedback_answers (feedback_id, question_id, rating_value, is_active, is_deleted)
         VALUES (?, ?, ?, 1, 0)`,
        [feedbackId, ratingQuestionId, rating],
      );

      // Insert comment
      const comment = String(feedback.comment ?? '').trim();
      if (comment) {
        await connection.query(
          `INSERT INTO event_feedback_answers (feedback_id, question_id, answer_text, is_active, is_deleted)
           VALUES (?, ?, ?, 1, 0)`,
          [feedbackId, commentQuestionId, comment],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Soft-cancels a registration (is_cancelled = 1).
   * Hard DELETE is never used — audit trail and FK integrity must be preserved.
   */
  async cancelRegistration(registrationId) {
    await db.query(
      `UPDATE event_registrations
          SET is_cancelled = 1,
              registration_status = 'Cancelled'
        WHERE id = ? AND is_deleted = 0`,
      [registrationId],
    );
  },
};

export default participantRegistrationModel;
