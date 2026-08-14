# participantRegistration — handoff notes

Everything the public event site (`event-client/`) writes. Mounted at
`/api/participant`, guarded by `participantAuthMiddleware`, so `req.participant`
is always set and `req.user` never is.

## Status

**Done — do not change without a reason:**

- All routes wired and authenticated (`participantRegistrationRoutes.js`)
- Ownership check (`findOwnedRegistration`) and its use in every `/:id` handler
- Eligibility recomputation (`assertRegistrationOpen`)
- Accommodation pricing from the tariff table
- Payment proof insert, pinned to status `Submitted`
- Upload handling (`participantUploadMiddleware.js`) — per-category dirs, mime
  allow-lists, size caps, filename sanitising

**To implement** — every `TODO(intern)` in the controller and every method that
throws `Not implemented` in the model. They are all plain queries against tables
that already exist; the migrations are
`server/schema/migrations/20260812_events_module.sql` and
`20260813_event_participants_and_registration_delta.sql`.

## Four rules that must not be broken

1. **Never trust a client-supplied amount.** Registration fees come from
   `event_registration_fees` for the participant's type; accommodation comes from
   `event_accommodation_room_types`. If a request body contains `amount`, ignore
   it. `saveAccommodation` shows the pattern.

2. **A participant can never write `payment_status = 'Verified'`.** Only the staff
   handler behind `event.verify_payment` may, and it must set `verified_by` and
   `verified_at` at the same time. The database cannot enforce that pairing —
   MySQL rejects a CHECK on a column with a FK referential action — so the code
   is the only guard.

3. **Ownership before anything else.** Start every `/:id` handler with
   `loadOwnedRegistration`. It returns 404, not 403, so a probe cannot discover
   that someone else's registration exists.

4. **Files go through Multer to `server/uploads/`, never base64 into a column.**
   Store the returned web path. The event site currently keeps base64 data URLs in
   `localStorage`; that is what these endpoints replace.

## Useful constraints

The schema already rejects several mistakes — catch `ER_DUP_ENTRY` and translate
it into a 4xx rather than pre-checking:

| Constraint                       | Prevents                                    |
| -------------------------------- | ------------------------------------------- |
| `uq_event_participant`           | registering twice for one event             |
| `uq_registrations_ref_no`        | duplicate reference numbers                 |
| `uq_team_member_email`           | the same email twice in one team            |
| `uq_team_member_order`           | two members at the same position            |
| `uq_acc_registration`            | two accommodation requests per registration |
| `uq_event_feedback_registration` | duplicate feedback                          |

`event_registration_accommodation.nights` is a generated column derived from the
dates — do not try to write it.

## Response shape

Match the rest of the API: `{ success, data }` or `{ success: false, message }`.
The event site's `apiFetch` unwraps `data` and throws `ApiError` on
`success: false`, so a plain message is enough.

## Testing

`server/tests/participantAuthBoundary.test.js` covers the auth boundary. Add
tests per endpoint as you go — the ownership check and the fee computation are the
two worth covering first, since both are security-relevant.
