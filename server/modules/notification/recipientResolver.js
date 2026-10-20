/**
 * Turns the audience descriptors on a notification event into a concrete list
 * of user ids.
 *
 * Emitters describe WHO should be told in intent terms — "the applicant", "the
 * approvers of the dof stage for this record", "anyone who can review
 * publications" — and never in user ids. That keeps every call site honest when
 * the RBAC tables change, and it is the reason a role reassignment
 * automatically reroutes future notifications with no code change.
 */

import db from '../../config/connection.js';
import { resolveStageRecipients } from '../shared/workflow/workflowScopeResolver.js';

/**
 * A single event should never notify the whole institution. If a descriptor
 * resolves to more than this, something is wrong with the descriptor — we
 * deliver the capped set and log loudly rather than writing 400 rows.
 */
const MAX_RECIPIENTS_PER_EVENT = Number(process.env.NOTIFICATIONS_MAX_RECIPIENTS || 500);

/**
 * Why a person is being told, most personal first. When a user matches several
 * descriptors — an HOD who submitted their own department's request is both
 * applicant and approver — the strongest role wins, so the wording they see is
 * the one that matters to them rather than whichever descriptor happened to be
 * listed first.
 */
const RECIPIENT_ROLE_PRECEDENCE = [
  'applicant',
  'subject',
  'owner',
  'approver',
  'admin',
  'recipient',
];

const rolePrecedence = (role) => {
  const index = RECIPIENT_ROLE_PRECEDENCE.indexOf(String(role || '').trim());
  return index === -1 ? RECIPIENT_ROLE_PRECEDENCE.length : index;
};

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeText = (value) => String(value ?? '').trim();

const uniqueLower = (values = []) => [
  ...new Set(values.map((value) => normalizeText(value).toLowerCase()).filter(Boolean)),
];

/** No query needed — the ids are already the answer. */
function resolveByUserIds(userIds = []) {
  return new Set(userIds.map(toPositiveInt).filter(Boolean));
}

async function resolveByEmployeeIds(conn, employeeIds = []) {
  const ids = employeeIds.map(toPositiveInt).filter(Boolean);
  if (!ids.length) return new Set();

  const [rows] = await conn.query(
    `SELECT DISTINCT user_id
     FROM master_employees
     WHERE id IN (?) AND user_id IS NOT NULL`,
    [ids],
  );

  return new Set(rows.map((row) => toPositiveInt(row.user_id)).filter(Boolean));
}

async function resolveByRoleCodes(conn, roleCodes = []) {
  const codes = uniqueLower(roleCodes);
  if (!codes.length) return new Set();

  const [rows] = await conn.query(
    `SELECT DISTINCT combined.user_id
     FROM (
       SELECT user_id, role_id FROM user_roles
       UNION
       SELECT user_id, role_id FROM user_entity_roles
     ) combined
     JOIN roles r ON r.id = combined.role_id
     WHERE LOWER(TRIM(r.role_code)) IN (?)`,
    [codes],
  );

  return new Set(rows.map((row) => toPositiveInt(row.user_id)).filter(Boolean));
}

/**
 * Users holding any of the given permission keys, honouring the same trailing
 * `*` prefix wildcard that `permissionMiddleware` accepts — so a descriptor can
 * say `finance.workflow.*` and mean it.
 */
async function resolveByPermissions(conn, permissions = []) {
  const keys = [...new Set(permissions.map(normalizeText).filter(Boolean))];
  if (!keys.length) return new Set();

  const exact = keys.filter((key) => !key.endsWith('*'));
  const prefixes = keys.filter((key) => key.endsWith('*')).map((key) => key.slice(0, -1));

  const clauses = [];
  const params = [];

  if (exact.length) {
    clauses.push('p.permission_key IN (?)');
    params.push(exact);
  }

  for (const prefix of prefixes) {
    if (!prefix) {
      // A bare '*' would match every permission in the system. That is never a
      // deliberate audience, so it is ignored rather than honoured.
      console.warn('Notification recipient descriptor used a bare "*" permission; ignoring it.');
      continue;
    }
    clauses.push('p.permission_key LIKE ?');
    // Escape the LIKE metacharacters so a key containing _ or % stays literal.
    params.push(`${prefix.replace(/[%_\\]/g, (char) => `\\${char}`)}%`);
  }

  if (!clauses.length) return new Set();

  const [rows] = await conn.query(
    `SELECT DISTINCT combined.user_id
     FROM (
       SELECT user_id, role_id FROM user_roles
       UNION
       SELECT user_id, role_id FROM user_entity_roles
     ) combined
     JOIN role_permissions rp ON rp.role_id = combined.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ${clauses.join(' OR ')}`,
    params,
  );

  return new Set(rows.map((row) => toPositiveInt(row.user_id)).filter(Boolean));
}

async function resolveOne(conn, descriptor) {
  const kind = normalizeText(descriptor?.kind).toLowerCase();

  switch (kind) {
    case 'user':
      return resolveByUserIds([descriptor.userId]);

    case 'users':
      return resolveByUserIds(descriptor.userIds || []);

    case 'employee':
      return resolveByEmployeeIds(conn, [descriptor.employeeId]);

    case 'employees':
      return resolveByEmployeeIds(conn, descriptor.employeeIds || []);

    case 'role':
      return resolveByRoleCodes(conn, descriptor.roleCodes || []);

    case 'permission':
      return resolveByPermissions(conn, descriptor.permissions || []);

    case 'workflow_stage':
      return new Set(
        await resolveStageRecipients({
          conn,
          moduleKey: descriptor.moduleKey,
          stageKey: descriptor.stageKey,
          recordContext: {
            departmentId: descriptor.departmentId ?? null,
            beneficiaryEntityId: descriptor.entityId ?? null,
            beneficiaryType: descriptor.beneficiaryType ?? null,
          },
        }),
      );

    default:
      console.warn(`Unknown notification audience kind: ${kind || '(empty)'}`);
      return new Set();
  }
}

/**
 * Resolves every descriptor and merges the results.
 *
 * A descriptor that fails does not sink the event: the others still resolve,
 * because telling four of five people is better than telling nobody. The
 * failure is logged and reported back so the dispatcher can record it.
 *
 * @returns {Promise<{ recipients: Array<{userId:number, recipientRole:string}>, errors: string[], truncated: boolean }>}
 */
export async function resolveRecipients({
  conn = db,
  audience = [],
  actorUserId = null,
  excludeActor = true,
} = {}) {
  const descriptors = Array.isArray(audience) ? audience : [];
  const normalizedActorId = toPositiveInt(actorUserId);
  const byUser = new Map();
  const errors = [];

  for (const descriptor of descriptors) {
    let userIds;
    try {
      userIds = await resolveOne(conn, descriptor);
    } catch (error) {
      const message = `audience ${normalizeText(descriptor?.kind) || '(unknown)'}: ${error.message}`;
      console.error(`Notification recipient resolution failed for ${message}`, error);
      errors.push(message);
      continue;
    }

    const recipientRole = normalizeText(descriptor?.recipientRole) || 'recipient';

    for (const userId of userIds) {
      // Nobody should be told about something they just did themselves.
      if (excludeActor && normalizedActorId && userId === normalizedActorId) continue;

      const existing = byUser.get(userId);
      if (!existing || rolePrecedence(recipientRole) < rolePrecedence(existing)) {
        byUser.set(userId, recipientRole);
      }
    }
  }

  let recipients = [...byUser.entries()].map(([userId, recipientRole]) => ({
    userId,
    recipientRole,
  }));

  const truncated = recipients.length > MAX_RECIPIENTS_PER_EVENT;
  if (truncated) {
    console.warn(
      `Notification audience resolved to ${recipients.length} recipients, ` +
        `capping at ${MAX_RECIPIENTS_PER_EVENT}. Check the audience descriptors.`,
    );
    recipients = recipients.slice(0, MAX_RECIPIENTS_PER_EVENT);
  }

  return { recipients, errors, truncated };
}

export { MAX_RECIPIENTS_PER_EVENT, RECIPIENT_ROLE_PRECEDENCE };

export default { resolveRecipients };
