import participantRegistrationModel, {
  NotImplementedError,
} from './participantRegistrationModel.js';
import db from '../../config/connection.js';
import {
  PARTICIPANT_UPLOAD_CATEGORIES,
  removeUploadedFile,
  toPublicUploadPath,
} from '../../middleware/participantUploadMiddleware.js';
import participantAuthModel from '../participantAuth/participantAuthModel.js';
import { deleteUploadedFile } from '../shared/uploadPaths.js';

/** Sentinel so the caller can map "no such event" to 404 rather than 409. */
const EVENT_NOT_FOUND = 'Event not found';

const fail = (res, status, message) => res.status(status).json({ success: false, message });

/**
 * Chooses the status for a handler that threw.
 *
 * A route that is mounted but unbuilt answers 501, not 500: the endpoint exists
 * and is reachable, it just has no implementation yet. Keeping the two apart
 * means a real fault is visible in the logs instead of sitting among the
 * scaffold's noise.
 */
const failFromError = (res, error, message) => {
  if (error instanceof NotImplementedError) {
    return fail(res, 501, 'This feature is not available yet');
  }

  return fail(res, 500, message);
};

/**
 * Fails a request that had a file attached, deleting the file first.
 *
 * Multer writes to disk before the handler runs, so a handler that rejects or
 * throws leaves a file no DB row points at. Every upload handler must fail
 * through here rather than through `fail` directly.
 */
const failUpload = async (req, res, status, message) => {
  await removeUploadedFile(req.file);
  return fail(res, status, message);
};

/** failUpload + the 501/500 distinction, for an upload handler that threw. */
const failUploadFromError = async (req, res, error, message) => {
  await removeUploadedFile(req.file);
  return failFromError(res, error, message);
};

const ok = (res, data) => res.json({ success: true, data });

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Loads a registration and proves it belongs to the caller.
 * Returns null and writes the response when it does not.
 */
const loadOwnedRegistration = async (req, res) => {
  const registrationId = parseId(req.params.id);

  if (!registrationId) {
    fail(res, 400, 'Invalid registration id');
    return null;
  }

  const registration = await participantRegistrationModel.findOwnedRegistration(
    registrationId,
    req.participant.id,
  );

  if (!registration) {
    // 404 rather than 403: do not confirm that someone else's registration exists.
    fail(res, 404, 'Registration not found');
    return null;
  }

  return registration;
};

/** Recomputes eligibility server-side; never trust the client's "Open" badge. */
const assertRegistrationOpen = (context) => {
  if (!context) return EVENT_NOT_FOUND;
  if (context.is_deleted || !context.is_active) return EVENT_NOT_FOUND;
  if (context.closes_at && new Date(context.closes_at).getTime() < Date.now()) {
    return 'The registration deadline has passed';
  }

  const full =
    context.max_participants != null &&
    Number(context.registered_count) >= Number(context.max_participants);

  if (full && !context.waiting_list_enabled) {
    return 'This event is full';
  }

  return null;
};

/**
 * Reads the fresh completion flags from the DB and returns them as the
 * `personalComplete` / `professionComplete` booleans the client's AuthContext
 * expects. Used by both profile save handlers so the client can update its
 * auth state without a separate /me round-trip.
 */
const getCompletionFlags = async (participantId) => {
  const participant = await participantAuthModel.findParticipantWithProfileById(participantId);
  return {
    personalComplete: Boolean(participant?.personal_completed_at),
    professionComplete: Boolean(participant?.profession_completed_at),
  };
};

const participantRegistrationController = {
  // ---- Registration lifecycle ----------------------------------------------

  async createRegistration(req, res) {
    try {
      const eventId = parseId(req.body?.eventId);

      if (!eventId) {
        return fail(res, 400, 'eventId is required');
      }

      // ── Profile completeness gate ────────────────────────────────────────
      // Both personal and professional details must be saved and marked complete
      // before a registration can be created. Checking timestamps in the DB
      // (not the client's local state) prevents bypass by a crafted API request.
      const profile = await participantRegistrationModel.findProfile(req.participant.id);

      if (!profile?.personal_completed_at || !profile?.profession_completed_at) {
        return fail(
          res,
          422,
          'Please complete your Personal Details and Professional Details before registering.',
        );
      }

      const context = await participantRegistrationModel.getRegistrationContext(eventId);
      const problem = assertRegistrationOpen(context);

      if (problem) {
        // A missing event is a 404; an existing one that is closed, full or past
        // its deadline is a 409. Collapsing both into 409 tells the client the
        // event exists when it may not.
        return fail(res, problem === EVENT_NOT_FOUND ? 404 : 409, problem);
      }

      // uq_event_participant makes a duplicate a 409 rather than a second row.
      let registrationId;
      try {
        registrationId = await participantRegistrationModel.createRegistration(
          req.participant.id,
          eventId,
        );
      } catch (dupError) {
        if (dupError.code === 'ER_DUP_ENTRY') {
          return fail(res, 409, 'You are already registered for this event');
        }
        throw dupError;
      }

      return ok(res, { registrationId });
    } catch (error) {
      console.error('createRegistration failed:', error);
      return failFromError(res, error, 'Could not create registration');
    }
  },

  async listRegistrations(req, res) {
    try {
      const registrationsRaw = await participantRegistrationModel.listRegistrations(
        req.participant.id,
      );

      const registrations = registrationsRaw.map((r) => ({
        ...r,
        teamMembers: (() => {
          try {
            return typeof r.teamMembers === 'string'
              ? JSON.parse(r.teamMembers)
              : r.teamMembers || [];
          } catch (e) {
            return [];
          }
        })(),
      }));

      return ok(res, { registrations });
    } catch (error) {
      console.error('listRegistrations failed:', error);
      return failFromError(res, error, 'Could not load registrations');
    }
  },

  async cancelRegistration(req, res) {
    try {
      const registration = await loadOwnedRegistration(req, res);
      if (!registration) return undefined;

      const [payments] = await db.query(
        "SELECT COUNT(*) AS count FROM event_payments WHERE registration_id = ? AND payment_status = 'Verified' AND is_deleted = 0",
        [registration.id],
      );
      if (payments[0] && payments[0].count > 0) {
        return fail(
          res,
          400,
          'Cannot cancel registration after payment has been verified. Please contact staff for refund requests.',
        );
      }

      await participantRegistrationModel.cancelRegistration(registration.id);

      return ok(res, { cancelled: true });
    } catch (error) {
      console.error('cancelRegistration failed:', error);
      return failFromError(res, error, 'Could not cancel registration');
    }
  },

  // ---- Team ----------------------------------------------------------------

  async saveTeamMembers(req, res) {
    try {
      const registration = await loadOwnedRegistration(req, res);
      if (!registration) return undefined;

      const members = Array.isArray(req.body?.members) ? req.body.members : null;

      if (!members) {
        return fail(res, 400, 'members must be an array');
      }

      const context = await participantRegistrationModel.getRegistrationContext(
        registration.event_id,
      );

      if (!context?.team_enabled) {
        return fail(res, 409, 'This event does not accept team registrations');
      }

      // Team size limits come from the event, not from the client.
      const { minimum_team_size: min, maximum_team_size: max } = context;

      if (min != null && members.length < min) {
        return fail(res, 400, `This event needs at least ${min} team members`);
      }

      if (max != null && members.length > max) {
        return fail(res, 400, `This event allows at most ${max} team members`);
      }

      const invalid = members.find((member) => !member?.email?.trim() || !member?.name?.trim());

      if (invalid) {
        return fail(res, 400, 'Every team member needs a name and an email');
      }

      try {
        await participantRegistrationModel.replaceTeamMembers(registration.id, members);
      } catch (dupError) {
        if (dupError.code === 'ER_DUP_ENTRY') {
          return fail(res, 400, 'Each team member must have a unique email');
        }
        throw dupError;
      }

      return ok(res, { saved: true });
    } catch (error) {
      console.error('saveTeamMembers failed:', error);
      return failFromError(res, error, 'Could not save team members');
    }
  },

  // ---- Accommodation -------------------------------------------------------

  async saveAccommodation(req, res) {
    try {
      const registration = await loadOwnedRegistration(req, res);
      if (!registration) return undefined;

      const { required, checkInDate, checkOutDate, rooms } = req.body ?? {};

      if (!required) {
        // TODO(intern): store required = 0 and clear any existing room rows.
        await participantRegistrationModel.saveAccommodation(registration.id, { required: false });
        return ok(res, { saved: true });
      }

      if (!checkInDate || !checkOutDate) {
        return fail(res, 400, 'checkInDate and checkOutDate are required');
      }

      const nights = Math.round(
        (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86400000,
      );

      if (!Number.isFinite(nights) || nights < 1) {
        return fail(res, 400, 'checkOutDate must be after checkInDate');
      }

      if (!Array.isArray(rooms) || rooms.length === 0) {
        return fail(res, 400, 'At least one room is required');
      }

      // Price every room from the tariff table. The client sends a room type and
      // an occupant count, never an amount.
      const priced = [];

      for (const room of rooms) {
        const roomTypeId = parseId(room?.roomTypeId);

        if (!roomTypeId) {
          return fail(res, 400, 'Each room needs a valid roomTypeId');
        }

        const tariff = await participantRegistrationModel.findRoomType(
          roomTypeId,
          registration.event_id,
        );

        if (!tariff) {
          return fail(res, 400, 'Unknown room type for this event');
        }

        const occupants = Number(room.occupants ?? 1);
        const roomsCount = Number(room.roomsCount ?? 1);

        if (!Number.isInteger(occupants) || occupants < 1) {
          return fail(res, 400, 'occupants must be a positive whole number');
        }

        if (occupants > tariff.max_occupants) {
          return fail(
            res,
            400,
            `${tariff.room_type} allows at most ${tariff.max_occupants} occupants`,
          );
        }

        if (!Number.isInteger(roomsCount) || roomsCount < 1) {
          return fail(res, 400, 'roomsCount must be a positive whole number');
        }

        priced.push({
          roomTypeId: tariff.id,
          roomTypeName: tariff.room_type,
          pricePerNightSnapshot: Number(tariff.price_per_night),
          occupants,
          roomsCount,
          nights,
          // price_per_night is a per-ROOM rate: the tariff row carries it beside
          // max_occupants (the capacity of one room at that rate) and
          // total_rooms. occupants is validated against that capacity above but
          // must not multiply the price, or a 2-person room for 2 nights bills
          // at 4x the nightly rate.
          amount: Number(tariff.price_per_night) * nights * roomsCount,
        });
      }

      const totalAmount = priced.reduce((sum, room) => sum + room.amount, 0);

      // TODO(intern): persist header + room rows in one transaction.
      await participantRegistrationModel.saveAccommodation(registration.id, {
        required: true,
        checkInDate,
        checkOutDate,
        totalAmount,
        rooms: priced,
      });

      return ok(res, { saved: true, totalAmount, rooms: priced });
    } catch (error) {
      console.error('saveAccommodation failed:', error);
      return failFromError(res, error, 'Could not save accommodation');
    }
  },

  // ---- Payments ------------------------------------------------------------

  async submitPaymentProof(req, res) {
    try {
      const registration = await loadOwnedRegistration(req, res);
      if (!registration) {
        await removeUploadedFile(req.file);
        return undefined;
      }

      if (!req.file) {
        return fail(res, 400, 'A payment screenshot is required');
      }

      const rawBillType = req.body?.billType || 'Registration';
      const billType =
        rawBillType === 'accommodation bill' || rawBillType.toLowerCase().includes('accommodation')
          ? 'Accommodation'
          : 'Registration';

      let amount = 0.0;

      if (billType === 'Registration') {
        // Find participant profile and its participant_type_id
        const [profileRows] = await db.query(
          'SELECT participant_type_id FROM event_participant_profiles WHERE participant_id = ? LIMIT 1',
          [req.participant.id],
        );
        const participantTypeId = profileRows[0]?.participant_type_id ?? null;

        const feeRow = await participantRegistrationModel.findApplicableFee(
          registration.event_id,
          participantTypeId,
        );

        if (feeRow) {
          const context = await participantRegistrationModel.getRegistrationContext(
            registration.event_id,
          );
          if (context && context.team_enabled) {
            const [memberCountRow] = await db.query(
              'SELECT COUNT(*) AS count FROM event_registration_team_members WHERE registration_id = ? AND is_deleted = 0',
              [registration.id],
            );
            const memberCount = memberCountRow[0]?.count ?? 0;
            const teamFee = parseFloat(feeRow.team_fee) || 0;
            const memberFee = parseFloat(feeRow.member_fee) || 0;
            amount = teamFee + memberFee * Math.max(0, memberCount - 1);
          } else {
            amount = parseFloat(feeRow.individual_fee) || 0;
          }
        }
      } else {
        // Accommodation
        const [accRows] = await db.query(
          'SELECT total_amount FROM event_registration_accommodation WHERE registration_id = ? AND is_deleted = 0 LIMIT 1',
          [registration.id],
        );
        amount = accRows[0] ? parseFloat(accRows[0].total_amount) || 0.0 : 0.0;
      }

      const transactionReference = req.body?.transactionReference || null;
      const proofFilePath = toPublicUploadPath(
        PARTICIPANT_UPLOAD_CATEGORIES.paymentProof,
        req.file.filename,
      );

      const paymentId = await participantRegistrationModel.insertPaymentProof({
        registrationId: registration.id,
        amount,
        billType,
        proofFilePath,
        transactionReference,
      });

      // Update registration_status to 'Submitted' if it was 'Pending' and this is registration payment
      if (billType === 'Registration' && registration.registration_status === 'Pending') {
        await db.query(
          "UPDATE event_registrations SET registration_status = 'Submitted' WHERE id = ?",
          [registration.id],
        );
      }

      return ok(res, {
        paymentId,
        paymentStatus: 'Submitted',
        proofFilePath,
        amount,
      });
    } catch (error) {
      console.error('submitPaymentProof failed:', error);
      return failUploadFromError(req, res, error, 'Could not submit payment proof');
    }
  },

  async listPayments(req, res) {
    try {
      const registration = await loadOwnedRegistration(req, res);
      if (!registration) return undefined;

      const payments = await participantRegistrationModel.listPayments(registration.id);

      return ok(res, { payments });
    } catch (error) {
      console.error('listPayments failed:', error);
      return failFromError(res, error, 'Could not load payments');
    }
  },

  // ---- Documents -----------------------------------------------------------

  async uploadRegistrationDocument(req, res) {
    try {
      const registration = await loadOwnedRegistration(req, res);
      if (!registration) {
        await removeUploadedFile(req.file);
        return undefined;
      }

      if (!req.file) {
        return fail(res, 400, 'A file is required');
      }

      let documentTypeId = parseId(req.body?.documentTypeId);
      if (!documentTypeId && req.body?.documentType) {
        const [rows] = await db.query(
          'SELECT id FROM m_document_type WHERE document_name = ? AND is_active = 1 AND is_deleted = 0 LIMIT 1',
          [req.body.documentType],
        );
        if (rows[0]) {
          documentTypeId = rows[0].id;
        }
      }

      if (!documentTypeId) {
        await removeUploadedFile(req.file);
        return fail(res, 400, 'A valid documentTypeId or documentType name is required');
      }

      const [typeCheck] = await db.query(
        'SELECT id FROM m_document_type WHERE id = ? AND is_active = 1 AND is_deleted = 0 LIMIT 1',
        [documentTypeId],
      );
      if (!typeCheck[0]) {
        await removeUploadedFile(req.file);
        return fail(res, 400, 'The specified document type does not exist or is inactive');
      }

      // Unlink any existing registration document to prevent orphans
      const [oldDoc] = await db.query(
        'SELECT file_path FROM event_registration_documents WHERE registration_id = ? AND is_deleted = 0 LIMIT 1',
        [registration.id],
      );
      if (oldDoc[0] && oldDoc[0].file_path) {
        deleteUploadedFile(oldDoc[0].file_path);
        await db.query(
          'UPDATE event_registration_documents SET is_deleted = 1 WHERE registration_id = ?',
          [registration.id],
        );
      }

      const filePath = toPublicUploadPath(
        PARTICIPANT_UPLOAD_CATEGORIES.registrationDocument,
        req.file.filename,
      );

      await participantRegistrationModel.insertRegistrationDocument(registration.id, {
        documentTypeId,
        filePath,
      });

      return ok(res, { filePath });
    } catch (error) {
      console.error('uploadRegistrationDocument failed:', error);
      return failUploadFromError(req, res, error, 'Could not upload document');
    }
  },

  // ---- Profile -------------------------------------------------------------

  /**
   * Returns the participant's profile, mapping snake_case DB columns to the
   * camelCase shape PersonalDetails + ProfessionDetails expect on the client.
   */
  async getProfile(req, res) {
    try {
      const row = await participantRegistrationModel.findProfile(req.participant.id);

      if (!row) {
        // No profile row yet — first-time visitor. Return null so the client
        // renders a blank form rather than crashing on a missing shape.
        return ok(res, { profile: null });
      }

      // Flatten the JSON profession_details back into the top-level object.
      const profDetails = (() => {
        try {
          return typeof row.profession_details === 'string'
            ? JSON.parse(row.profession_details)
            : (row.profession_details ?? {});
        } catch {
          return {};
        }
      })();

      const profile = {
        // Personal
        title: row.title ?? '',
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        gender: row.gender ?? '',
        differentlyAbled: Boolean(row.differently_abled),
        dateOfBirth: row.date_of_birth
          ? new Date(row.date_of_birth).toISOString().slice(0, 10)
          : '',
        mobileNumber: row.mobile_number ?? '',
        whatsappNumber: row.whatsapp_number ?? '',
        email: row.contact_email ?? '',
        address: row.address ?? '',
        city: row.city ?? '',
        state: row.state ?? '',
        country: row.country ?? '',
        pin: row.pin ?? '',
        photoPath: row.photo_path ?? null,

        // Profession (promoted columns)
        professionType: row.profession_type ?? '',
        registerNumber: row.register_number ?? '',
        institution: row.institution ?? '',
        department: row.department ?? '',
        designation: row.designation ?? '',
        idCardPath: row.id_card_path ?? null,

        // Everything else from the JSON blob
        ...profDetails,

        // Completion sentinels (used by the client to drive UI indicators)
        personalComplete: Boolean(row.personal_completed_at),
        professionComplete: Boolean(row.profession_completed_at),
      };

      return ok(res, { profile });
    } catch (error) {
      console.error('getProfile failed:', error);
      return failFromError(res, error, 'Could not load profile');
    }
  },

  /**
   * Validates and saves the personal section of the profile.
   *
   * Required fields: firstName, lastName, gender, dateOfBirth, mobileNumber, email.
   * Returns updated completion flags so the client can refresh AuthContext
   * without a separate /me call.
   */
  async savePersonalDetails(req, res) {
    try {
      const body = req.body ?? {};

      // Server-side validation — these are the same fields isPersonalComplete checks.
      const required = [
        ['firstName', body.firstName],
        ['lastName', body.lastName],
        ['gender', body.gender],
        ['dateOfBirth', body.dateOfBirth],
        ['mobileNumber', body.mobileNumber],
        ['email', body.email],
      ];

      const missing = required.filter(([, v]) => !String(v ?? '').trim()).map(([k]) => k);

      if (missing.length) {
        return fail(res, 400, `Missing required personal fields: ${missing.join(', ')}`);
      }

      await participantRegistrationModel.upsertPersonalDetails(req.participant.id, body);

      // Return fresh completion flags so the client can update AuthContext.
      const flags = await getCompletionFlags(req.participant.id);

      return ok(res, { saved: true, ...flags });
    } catch (error) {
      console.error('savePersonalDetails failed:', error);
      return failFromError(res, error, 'Could not save personal details');
    }
  },

  /**
   * Validates and saves the profession section of the profile.
   *
   * Required: professionType. Additional required fields vary by profession type
   * and are validated by isProfessionComplete inside the model; if incomplete,
   * profession_completed_at stays NULL and the registration gate will block.
   */
  async saveProfessionDetails(req, res) {
    try {
      const body = req.body ?? {};

      if (!String(body.professionType ?? '').trim()) {
        return fail(res, 400, 'professionType is required');
      }

      await participantRegistrationModel.upsertProfessionDetails(req.participant.id, body);

      // Return fresh completion flags so the client can update AuthContext.
      const flags = await getCompletionFlags(req.participant.id);

      return ok(res, { saved: true, ...flags });
    } catch (error) {
      console.error('saveProfessionDetails failed:', error);
      return failFromError(res, error, 'Could not save profession details');
    }
  },

  async uploadProfileFile(req, res, column, category) {
    try {
      if (!req.file) {
        return fail(res, 400, 'A file is required');
      }

      // Unlink the previously stored file to prevent disk orphans
      const [profile] = await db.query(
        `SELECT photo_path, id_card_path FROM event_participant_profiles WHERE participant_id = ? LIMIT 1`,
        [req.participant.id],
      );
      if (profile[0] && profile[0][column]) {
        deleteUploadedFile(profile[0][column]);
      }

      const filePath = toPublicUploadPath(category, req.file.filename);

      await participantRegistrationModel.updateProfileFilePath(
        req.participant.id,
        column,
        filePath,
      );

      return ok(res, { filePath });
    } catch (error) {
      console.error('uploadProfileFile failed:', error);
      return failUploadFromError(req, res, error, 'Could not upload file');
    }
  },

  // ---- Feedback ------------------------------------------------------------

  async submitFeedback(req, res) {
    try {
      const registration = await loadOwnedRegistration(req, res);
      if (!registration) return undefined;

      // TODO(intern): validate answers against event_feedback_questions for this
      // event. uq_event_feedback_registration makes a resubmission a conflict:
      // decide whether to update or reject, and say which in the response.
      await participantRegistrationModel.submitFeedback(registration.id, req.body?.answers ?? []);

      return ok(res, { submitted: true });
    } catch (error) {
      console.error('submitFeedback failed:', error);
      return failFromError(res, error, 'Could not submit feedback');
    }
  },
};

export default participantRegistrationController;
