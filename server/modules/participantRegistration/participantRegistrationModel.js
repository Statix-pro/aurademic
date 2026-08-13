import db from '../../config/connection.js';

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

  // --- TODO (intern) ---------------------------------------------------------
  // Each of these is a straightforward query against tables that already exist.
  // See the module README for the exact columns and the contract each must meet.

  /** TODO: SELECT profile + JSON profession_details for this participant. */
  async findProfile(_participantId) {
    throw new Error('Not implemented: findProfile');
  },

  /** TODO: INSERT ... ON DUPLICATE KEY UPDATE on event_participant_profiles. */
  async upsertPersonalDetails(_participantId, _details) {
    throw new Error('Not implemented: upsertPersonalDetails');
  },

  /** TODO: as above, writing promoted columns + profession_details JSON. */
  async upsertProfessionDetails(_participantId, _details) {
    throw new Error('Not implemented: upsertProfessionDetails');
  },

  /** TODO: UPDATE photo_path / id_card_path after a Multer upload. */
  async updateProfileFilePath(_participantId, _column, _filePath) {
    throw new Error('Not implemented: updateProfileFilePath');
  },

  /** TODO: list this participant's registrations with event + payment summary. */
  async listRegistrations(_participantId) {
    throw new Error('Not implemented: listRegistrations');
  },

  /**
   * TODO: INSERT into event_registrations.
   * Generate registration_ref_no (uq_registrations_ref_no is UNIQUE) and rely on
   * uq_event_participant to reject a duplicate registration.
   */
  async createRegistration(_participantId, _eventId) {
    throw new Error('Not implemented: createRegistration');
  },

  /** TODO: replace team rows in a transaction; member_order starts at 1. */
  async replaceTeamMembers(_registrationId, _members) {
    throw new Error('Not implemented: replaceTeamMembers');
  },

  /** TODO: upsert event_registration_accommodation + its room rows. */
  async saveAccommodation(_registrationId, _accommodation) {
    throw new Error('Not implemented: saveAccommodation');
  },

  /** TODO: INSERT into event_registration_documents (verification_status Pending). */
  async insertRegistrationDocument(_registrationId, _document) {
    throw new Error('Not implemented: insertRegistrationDocument');
  },

  /** TODO: INSERT event_feedbacks + event_feedback_answers in a transaction. */
  async submitFeedback(_registrationId, _answers) {
    throw new Error('Not implemented: submitFeedback');
  },

  /** TODO: soft-cancel (is_cancelled = 1), never a hard DELETE. */
  async cancelRegistration(_registrationId) {
    throw new Error('Not implemented: cancelRegistration');
  },
};

export default participantRegistrationModel;
