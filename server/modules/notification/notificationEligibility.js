/**
 * Which notification types a given person can actually be sent.
 *
 * The preferences screen used to list all 44 types to everyone, which meant a
 * faculty member was offered a switch for "a new request has entered your
 * approval queue" — something they will never receive. This module answers the
 * inverse of that: given a user's roles and permissions, could they ever land
 * in this type's audience?
 *
 * It deliberately reads the same constants the emit sites use — `STAGE_ROLE_CODES`
 * for workflow stages, `PUBLICATION_REVIEW_PERMISSIONS` for reviewers — so the
 * filter cannot drift away from who is really notified.
 *
 * Where it is unsure it says yes. Showing a switch nobody needs is clutter;
 * hiding one for a notification that does arrive would leave a person unable
 * to turn it off, which is the worse failure.
 *
 * `isSuperAdmin` is deliberately not consulted here. That flag short-circuits
 * the permission gate (`permissionMiddleware`), answering "may I pass?" — but
 * notifications answer a different question, "whose queue is this?", and that
 * one has no sensible wildcard: a super admin holds no module or entity scope,
 * so honouring the flag would put every super admin in every approval audience
 * of all three workflow modules with no way to narrow it. `recipientResolver`
 * reads only the role and permission tables for the same reason, which keeps
 * the two sides consistent: a super admin with no functional role sees no
 * approver switches and is genuinely never addressed as an approver. Someone
 * who both administers the system and approves work is given their functional
 * role (`dof`, `principal`, ...) alongside `super_admin`; delivery and this
 * filter then follow with no code change. Note that granting the role its own
 * permission rows is not an option — `updateRolePermissions` refuses to modify
 * Super Admin.
 */

import { PUBLICATION_REVIEW_PERMISSIONS } from './audiences.js';
import {
  RECIPIENT_ANYONE,
  RECIPIENT_PAYEE_VERIFIER,
  RECIPIENT_REVIEWER,
} from './notificationCatalog.js';
import { STAGE_ROLE_CODES } from '../shared/workflow/workflowScopeResolver.js';

/**
 * Any stage role makes someone an approver on every workflow module:
 * `resolveStageRecipients` matches a stage's role codes regardless of module,
 * so an HOD is a level1 approver for finance, expenditure and budget alike.
 */
const APPROVER_ROLE_CODES = Object.freeze([...new Set(Object.values(STAGE_ROLE_CODES).flat())]);

/**
 * Permissions are module-scoped, so they narrow further than roles do.
 * Expenditure additionally honours `finance.workflow.*`, mirroring
 * `resolveStageRecipients` and `assertDecisionPermission`.
 */
const WORKFLOW_PERMISSION_PREFIXES = Object.freeze({
  finance: Object.freeze(['finance.workflow.']),
  expenditure: Object.freeze(['expenditure.workflow.', 'finance.workflow.']),
  budget: Object.freeze(['budget.workflow.']),
});

/** The payee directory is DoF-curated — see `createPayee`'s audience. */
const PAYEE_VERIFIER_ROLE_CODES = Object.freeze(['dof']);
const PAYEE_VERIFIER_PERMISSIONS = Object.freeze(['expenditure.workflow.dof']);

const toSet = (values) =>
  new Set(
    (Array.isArray(values) ? values : [])
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

/** Roles and permissions in one comparable shape, read once per request. */
export const userCapabilities = (user = {}) => ({
  roles: toSet(user.roles),
  permissions: toSet(user.permissions),
});

const hasAnyRole = (capabilities, roleCodes) =>
  roleCodes.some((code) => capabilities.roles.has(code));

const hasAnyPermission = (capabilities, keys) =>
  keys.some((key) => capabilities.permissions.has(key));

const hasPermissionWithPrefix = (capabilities, prefixes) =>
  [...capabilities.permissions].some((permission) =>
    prefixes.some((prefix) => permission.startsWith(prefix)),
  );

const canApproveModule = (capabilities, moduleKey) => {
  if (hasAnyRole(capabilities, APPROVER_ROLE_CODES)) return true;

  const prefixes = WORKFLOW_PERMISSION_PREFIXES[moduleKey];
  // An unknown module means the catalog grew a workflow this file has not been
  // taught about: show the switch rather than silently hide it.
  if (!prefixes) return true;

  return hasPermissionWithPrefix(capabilities, prefixes);
};

/** Resolves one recipient class from the catalog against one user. */
export const canReceiveRecipientClass = (recipientClass, capabilities) => {
  if (typeof recipientClass !== 'string' || !recipientClass) return true;

  if (recipientClass === RECIPIENT_ANYONE) return true;

  if (recipientClass === RECIPIENT_REVIEWER) {
    return hasAnyPermission(capabilities, PUBLICATION_REVIEW_PERMISSIONS);
  }

  if (recipientClass === RECIPIENT_PAYEE_VERIFIER) {
    return (
      hasAnyRole(capabilities, PAYEE_VERIFIER_ROLE_CODES) ||
      hasAnyPermission(capabilities, PAYEE_VERIFIER_PERMISSIONS)
    );
  }

  if (recipientClass.startsWith('approver:')) {
    return canApproveModule(capabilities, recipientClass.slice('approver:'.length));
  }

  // An unrecognised class is a catalog entry newer than this file. Show it.
  return true;
};

/**
 * True when any one of the entry's recipient classes fits the user — a type
 * addressed to both the applicant and the approvers reaches everybody.
 */
export const canReceiveNotificationType = (entry, capabilities) => {
  const classes = Array.isArray(entry?.recipients) ? entry.recipients : null;
  if (!classes || classes.length === 0) return true;
  return classes.some((recipientClass) => canReceiveRecipientClass(recipientClass, capabilities));
};

export default { userCapabilities, canReceiveNotificationType, canReceiveRecipientClass };
