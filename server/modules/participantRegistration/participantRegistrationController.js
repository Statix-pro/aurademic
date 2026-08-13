import participantRegistrationModel from './participantRegistrationModel.js';
import {
  PARTICIPANT_UPLOAD_CATEGORIES,
  removeUploadedFile,
  toPublicUploadPath,
} from '../../middleware/participantUploadMiddleware.js';

const OPEN_REGISTRATION_STATUSES = new Set(['Ongoing', 'Extended']);

const fail = (res, status, message) => res.status(status).json({ success: false, message });

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
  if (!context) return 'Event not found';
  if (context.is_deleted || !context.is_active) return 'Event not found';
  if (context.workflow_status !== 'completed') return 'Event is not open to the public';
  if (!OPEN_REGISTRATION_STATUSES.has(context.registration_status)) {
    return 'Registration is not open for this event';
  }

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

const participantRegistrationController = {
  // ---- Registration lifecycle ----------------------------------------------

  async createRegistration(req, res) {
    try {
      const eventId = parseId(req.body?.eventId);

      if (!eventId) {
        return fail(res, 400, 'eventId is required');
      }

      const context = await participantRegistrationModel.getRegistrationContext(eventId);
      const problem = assertRegistrationOpen(context);

      if (problem) {
        return fail(res, 409, problem);
      }

      // TODO(intern): create the registration, then return it.
      // uq_event_participant makes a duplicate a 409 rather than a second row —
      // catch ER_DUP_ENTRY and translate it.
      const registrationId = await participantRegistrationModel.createRegistration(
        req.participant.id,
        eventId,
      );

      return ok(res, { registrationId });
    } catch (error) {
      console.error('createRegistration failed:', error);
      return fail(res, 500, 'Could not create registration');
    }
  },

  async listRegistrations(req, res) {
    try {
      // TODO(intern): shape rows to match the event site's RegistrationsPage.
      const registrations = await participantRegistrationModel.listRegistrations(
        req.participant.id,
      );

      return ok(res, { registrations });
    } catch (error) {
      console.error('listRegistrations failed:', error);
      return fail(res, 500, 'Could not load registrations');
    }
  },

  async cancelRegistration(req, res) {
    try {
      const registration = await loadOwnedRegistration(req, res);
      if (!registration) return undefined;

      // TODO(intern): refuse to cancel once a payment is Verified — refunds are
      // a staff action, not a participant one.
      await participantRegistrationModel.cancelRegistration(registration.id);

      return ok(res, { cancelled: true });
    } catch (error) {
      console.error('cancelRegistration failed:', error);
      return fail(res, 500, 'Could not cancel registration');
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

      // TODO(intern): persist. uq_team_member_email rejects duplicate emails
      // within one registration; translate ER_DUP_ENTRY into a 400.
      await participantRegistrationModel.replaceTeamMembers(registration.id, members);

      return ok(res, { saved: true });
    } catch (error) {
      console.error('saveTeamMembers failed:', error);
      return fail(res, 500, 'Could not save team members');
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
          amount: Number(tariff.price_per_night) * occupants * nights * roomsCount,
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
      return fail(res, 500, 'Could not save accommodation');
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

      const billType = req.body?.billType === 'Accommodation' ? 'Accommodation' : 'Registration';

      // TODO(intern): compute the amount server-side.
      //   Registration -> findApplicableFee(event, participant type) and pick
      //     individual_fee or team_fee + member_fee * (members - 1).
      //   Accommodation -> the stored total_amount for this registration.
      // The client must not supply the amount; if req.body.amount exists, ignore it.
      const amount = 0;

      const proofFilePath = toPublicUploadPath(
        PARTICIPANT_UPLOAD_CATEGORIES.paymentProof,
        req.file.filename,
      );

      const paymentId = await participantRegistrationModel.insertPaymentProof({
        registrationId: registration.id,
        amount,
        billType,
        proofFilePath,
        transactionReference: req.body?.transactionReference,
      });

      // Status is 'Submitted'. Staff move it to 'Verified' via event.verify_payment.
      return ok(res, { paymentId, paymentStatus: 'Submitted', proofFilePath });
    } catch (error) {
      console.error('submitPaymentProof failed:', error);
      return failUpload(req, res, 500, 'Could not submit payment proof');
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
      return fail(res, 500, 'Could not load payments');
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

      const filePath = toPublicUploadPath(
        PARTICIPANT_UPLOAD_CATEGORIES.registrationDocument,
        req.file.filename,
      );

      // TODO(intern): validate documentTypeId against m_document_type, then insert.
      await participantRegistrationModel.insertRegistrationDocument(registration.id, {
        documentTypeId: parseId(req.body?.documentTypeId),
        filePath,
      });

      return ok(res, { filePath });
    } catch (error) {
      console.error('uploadRegistrationDocument failed:', error);
      return failUpload(req, res, 500, 'Could not upload document');
    }
  },

  // ---- Profile -------------------------------------------------------------

  async getProfile(req, res) {
    try {
      // TODO(intern): return promoted columns plus the profession_details JSON,
      // flattened into the shape event-client/src/types PersonalDetails and
      // ProfessionDetails expect.
      const profile = await participantRegistrationModel.findProfile(req.participant.id);

      return ok(res, { profile });
    } catch (error) {
      console.error('getProfile failed:', error);
      return fail(res, 500, 'Could not load profile');
    }
  },

  async savePersonalDetails(req, res) {
    try {
      // TODO(intern): validate required fields, then upsert. Age is derived from
      // date_of_birth and must not be stored.
      await participantRegistrationModel.upsertPersonalDetails(req.participant.id, req.body ?? {});

      return ok(res, { saved: true });
    } catch (error) {
      console.error('savePersonalDetails failed:', error);
      return fail(res, 500, 'Could not save personal details');
    }
  },

  async saveProfessionDetails(req, res) {
    try {
      // TODO(intern): promoted columns (participant_type_id, profession_type,
      // institution, department, designation, register_number) become columns;
      // everything else goes into profession_details JSON.
      await participantRegistrationModel.upsertProfessionDetails(
        req.participant.id,
        req.body ?? {},
      );

      return ok(res, { saved: true });
    } catch (error) {
      console.error('saveProfessionDetails failed:', error);
      return fail(res, 500, 'Could not save profession details');
    }
  },

  async uploadProfileFile(req, res, column, category) {
    try {
      if (!req.file) {
        return fail(res, 400, 'A file is required');
      }

      const filePath = toPublicUploadPath(category, req.file.filename);

      // TODO(intern): also unlink the previously stored file, so replacing a
      // photo does not leave orphans on disk.
      await participantRegistrationModel.updateProfileFilePath(
        req.participant.id,
        column,
        filePath,
      );

      return ok(res, { filePath });
    } catch (error) {
      console.error('uploadProfileFile failed:', error);
      return failUpload(req, res, 500, 'Could not upload file');
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
      return fail(res, 500, 'Could not submit feedback');
    }
  },
};

export default participantRegistrationController;
