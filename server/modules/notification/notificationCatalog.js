/**
 * The notification type catalog.
 *
 * This lives in code rather than in a table on purpose: every entry carries
 * render functions, so a DB-backed catalog would still need code deployed
 * alongside it. Keeping it here means the catalog is versioned with the
 * feature, is type-checked by the linter, and can be exhaustively tested.
 * Per-user opt-outs live in `notification_preferences`; the entries below are
 * only the defaults.
 *
 * Every entry is rendered ONCE, at dispatch time, and the result is frozen
 * onto the `notifications` row. Re-rendering at read time would let a record
 * renamed next month silently rewrite the wording of last month's
 * notification.
 */

export const CHANNELS = Object.freeze(['in_app', 'web_push']);

const BOTH_CHANNELS = Object.freeze(['in_app', 'web_push']);
const IN_APP_ONLY = Object.freeze(['in_app']);

/**
 * Client route prefixes a notification link may point at. A link is built from
 * a payload that ultimately came from user-entered data, so it is matched
 * against this list before storage — that is what stops a crafted payload from
 * putting a `javascript:` or off-site URL into someone's notification bell.
 */
export const ALLOWED_LINK_PREFIXES = Object.freeze([
  '/dashboard',
  '/notifications',
  '/profile',
  '/finance/',
  '/financecard',
  '/expenditure/',
  '/expenditure/approval',
  '/expenditurecard',
  '/budget/',
  '/budgetcard',
  '/admin/budget',
  '/workflow/',
  '/journal/',
  '/journals',
  '/publications',
  '/admin/journals',
  '/admin/publications/',
  '/admin/form-management/project-options',
  '/project/',
  '/projects',
  '/event/',
  '/eventdashboard',
  '/access-control',
  '/admin/directory-approval',
  '/organizationdirectorydashboard',
  '/resourcepersondirectorydashboard',
]);

/**
 * A link must be a site-relative path on the allow-list. Anything else — an
 * absolute URL, a protocol-relative `//evil.example`, a traversal — becomes
 * null, and the notification simply renders without a link rather than with a
 * dangerous one.
 */
export const sanitizeLink = (value) => {
  const link = String(value ?? '').trim();
  if (!link) return null;
  if (!link.startsWith('/') || link.startsWith('//')) return null;
  if (link.includes('..')) return null;
  if (link.length > 500) return null;
  return ALLOWED_LINK_PREFIXES.some((prefix) => link.startsWith(prefix)) ? link : null;
};

const asText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

/** Indian-format currency, e.g. 1234567.5 -> "₹12,34,567.50". */
export const formatAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/** Stage keys are storage tokens; these are what a human should read. */
const STAGE_LABELS = Object.freeze({
  level1: 'Department approval',
  ithead: 'IT Head',
  dof: 'Director of Finance',
  principal: 'Principal',
  chairman: 'Chairman',
});

export const stageLabel = (stageKey) =>
  STAGE_LABELS[asText(stageKey).toLowerCase()] || asText(stageKey, 'the next stage');

/** Module keys are storage tokens; these are what a human should read. */
const MODULE_LABELS = Object.freeze({
  finance: 'Finance request',
  expenditure: 'Expenditure request',
  budget: 'Budget proposal',
  organization_directory: 'Organization directory submission',
  resource_person_directory: 'Resource-person directory submission',
});

export const moduleLabel = (moduleKey) =>
  MODULE_LABELS[asText(moduleKey).toLowerCase()] || 'Request';

/** "FIN-2026-0042" when there is a reference, "#42" when there is not. */
const recordName = (d) => asText(d.reference) || `#${asText(d.recordId, '?')}`;

/** The applicant's own view of a workflow record. */
const recordLink = (d) => {
  const moduleKey = asText(d.moduleKey).toLowerCase();
  if (moduleKey === 'finance') return `/finance/${d.recordId}`;
  if (moduleKey === 'expenditure') return `/expenditure/${d.recordId}`;
  if (moduleKey === 'budget') return `/budget/${d.recordId}`;
  if (moduleKey === 'organization_directory') return '/organizationdirectorydashboard';
  if (moduleKey === 'resource_person_directory') return '/resourcepersondirectorydashboard';
  return '/dashboard';
};

/** Where an approver goes to act. */
const queueLink = (d) => {
  const moduleKey = asText(d.moduleKey).toLowerCase();
  if (moduleKey === 'expenditure') return '/expenditure/approval';
  if (moduleKey === 'budget') return '/admin/budget';
  // The generic /workflow/:moduleKey queue is empty for directories: their adapter has
  // no queue listing, and reviewers work from the directory approval page, a tab each.
  if (moduleKey === 'organization_directory') return '/admin/directory-approval?tab=organization';
  if (moduleKey === 'resource_person_directory')
    return '/admin/directory-approval?tab=resource-person';
  return `/workflow/${moduleKey || 'finance'}`;
};

/** A returned record is meant to be edited, so send the applicant to the form. */
const editLink = (d) => {
  const moduleKey = asText(d.moduleKey).toLowerCase();
  if (moduleKey === 'budget') return `/budget/${d.recordId}/edit`;
  if (moduleKey === 'finance') return `/finance/${d.recordId}/edit`;
  if (moduleKey === 'expenditure') return `/expenditure/${d.recordId}/edit`;
  return recordLink(d);
};

/**
 * Names the record an edit request is about. Falls back to the entity type and
 * id rather than a vague "a record", so the notification is still actionable
 * when the caller had no title to hand.
 */
const editRequestLabel = (d) => {
  const title = asText(d.title);
  if (title) return `"${title}"`;
  const kind = asText(d.entityType) === 'research_projects' ? 'project' : 'publication';
  return `${kind} #${asText(d.recordId, '?')}`;
};

const applicantAndAmount = (d) => {
  const parts = [asText(d.applicantName)];
  if (Number.isFinite(Number(d.amount)) && Number(d.amount) > 0) parts.push(formatAmount(d.amount));
  return parts.filter(Boolean).join(' · ');
};

/**
 * The six workflow transitions, shared by every module that runs on the
 * generic engine. Defining them once means a module registered later via
 * `registerWorkflowModule()` is notified for free, and budget — which has its
 * own older engine — reuses the same wording rather than inventing a parallel
 * vocabulary.
 */
/**
 * Who a notification can ever reach, used to keep the preferences screen
 * honest: a faculty member who never approves anything should not be offered a
 * switch for "a new request has entered your approval queue".
 *
 * `anyone` covers every entry addressed to the person who raised, owns or is
 * the subject of the record — everybody submits things, so everybody can
 * receive those. The rest name a capability, and `notificationEligibility.js`
 * decides who holds it.
 *
 * Absent means `anyone`. Erring towards showing a switch is the safe
 * direction: an extra row is clutter, but a missing row would hide a
 * notification the user is actually being sent.
 */
export const RECIPIENT_ANYONE = 'anyone';
export const RECIPIENT_REVIEWER = 'reviewer';
export const RECIPIENT_PAYEE_VERIFIER = 'payee_verifier';
/** `approver:<moduleKey>` — an approver on that module's workflow. */
export const recipientApprover = (moduleKey) => `approver:${moduleKey}`;

const ANYONE = Object.freeze([RECIPIENT_ANYONE]);
const REVIEWERS = Object.freeze([RECIPIENT_REVIEWER]);

const workflowEntries = (moduleKey, category) => ({
  [`${moduleKey}.submitted`]: {
    category,
    recipients: [recipientApprover(moduleKey)],
    label: 'Submitted for approval',
    description: 'A new request has entered your approval queue.',
    severity: 'info',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `${moduleLabel(d.moduleKey)} ${recordName(d)} needs your approval`,
    body: (d) => applicantAndAmount(d) || null,
    link: (d, role) => (role === 'applicant' ? recordLink(d) : queueLink(d)),
  },

  [`${moduleKey}.stage_advanced`]: {
    category,
    recipients: ANYONE,
    label: 'Moved to the next stage',
    description: 'A request you submitted or must approve moved forward a stage.',
    severity: 'info',
    defaultChannels: BOTH_CHANNELS,
    title: (d, role) =>
      role === 'approver'
        ? `${moduleLabel(d.moduleKey)} ${recordName(d)} needs your approval`
        : `${moduleLabel(d.moduleKey)} ${recordName(d)} is now with ${stageLabel(d.stage)}`,
    body: (d, role) =>
      role === 'approver'
        ? applicantAndAmount(d) || null
        : `Approved by ${asText(d.actorName, 'the previous approver')}.`,
    link: (d, role) => (role === 'approver' ? queueLink(d) : recordLink(d)),
  },

  [`${moduleKey}.approved`]: {
    category,
    recipients: ANYONE,
    label: 'Fully approved',
    description: 'A request you submitted cleared its final approval stage.',
    severity: 'success',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `${moduleLabel(d.moduleKey)} ${recordName(d)} has been approved`,
    body: (d) => `Final approval by ${asText(d.actorName, 'the approver')}.`,
    link: (d) => recordLink(d),
  },

  [`${moduleKey}.rejected`]: {
    category,
    recipients: ANYONE,
    label: 'Rejected',
    description: 'A request you submitted was rejected.',
    severity: 'error',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `${moduleLabel(d.moduleKey)} ${recordName(d)} was rejected`,
    body: (d) => asText(d.feedback) || `Rejected at ${stageLabel(d.stage)}.`,
    link: (d) => recordLink(d),
  },

  [`${moduleKey}.returned`]: {
    category,
    recipients: ANYONE,
    label: 'Returned for changes',
    description: 'A request you submitted was sent back for edits.',
    severity: 'warning',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `${moduleLabel(d.moduleKey)} ${recordName(d)} was returned for changes`,
    body: (d) => asText(d.feedback) || `Returned at ${stageLabel(d.stage)}.`,
    link: (d) => editLink(d),
  },

  [`${moduleKey}.resubmitted`]: {
    category,
    recipients: [recipientApprover(moduleKey)],
    label: 'Resubmitted after changes',
    description: 'An applicant resubmitted a request waiting on you.',
    severity: 'info',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `${moduleLabel(d.moduleKey)} ${recordName(d)} was resubmitted`,
    body: (d) => applicantAndAmount(d) || null,
    link: (d, role) => (role === 'approver' ? queueLink(d) : recordLink(d)),
  },
});

export const NOTIFICATION_TYPES = Object.freeze({
  ...workflowEntries('finance', 'finance'),
  ...workflowEntries('expenditure', 'expenditure'),
  ...workflowEntries('budget', 'budget'),
  ...workflowEntries('organization_directory', 'master_data'),
  ...workflowEntries('resource_person_directory', 'master_data'),

  /* ---- budget-only transitions, which the generic engine has no analogue for ---- */

  'budget.amounts_updated': {
    recipients: ANYONE,
    category: 'budget',
    label: 'Approved amounts changed',
    description: 'An approver changed the amounts sanctioned on your proposal.',
    severity: 'warning',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Approved amounts changed on budget proposal ${recordName(d)}`,
    body: (d) => `Updated by ${asText(d.actorName, 'an approver')}.`,
    link: (d) => recordLink(d),
  },

  'budget.archived': {
    recipients: ANYONE,
    category: 'budget',
    label: 'Archived or restored',
    description: 'Your proposal was archived or brought back out of the archive.',
    severity: 'info',
    defaultChannels: IN_APP_ONLY,
    title: (d) =>
      d.unarchived
        ? `Budget proposal ${recordName(d)} was restored from the archive`
        : `Budget proposal ${recordName(d)} was archived`,
    body: (d) => asText(d.feedback) || null,
    link: (d) => recordLink(d),
  },

  'budget.deleted': {
    recipients: ANYONE,
    category: 'budget',
    label: 'Deleted',
    description: 'Your proposal was deleted.',
    severity: 'warning',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Budget proposal ${recordName(d)} was deleted`,
    body: (d) => `Deleted by ${asText(d.actorName, 'an administrator')}.`,
    link: () => '/budgetcard',
  },

  /* ---- deletion, for the two modules on the generic engine ----
     Budget already had budget.deleted; these keep finance and expenditure
     symmetrical with it. The generic workflowEntries() set covers the six
     stage transitions but not deletion, which is not a stage decision. */

  'finance.deleted': {
    recipients: ANYONE,
    category: 'finance',
    label: 'Deleted',
    description: 'A finance request you submitted was deleted.',
    severity: 'warning',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Finance request ${recordName(d)} was deleted`,
    body: (d) => `Deleted by ${asText(d.actorName, 'an administrator')}.`,
    link: () => '/financecard',
  },

  'expenditure.deleted': {
    recipients: ANYONE,
    category: 'expenditure',
    label: 'Deleted',
    description: 'An expenditure request you submitted was deleted.',
    severity: 'warning',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Expenditure request ${recordName(d)} was deleted`,
    body: (d) => `Deleted by ${asText(d.actorName, 'an administrator')}.`,
    link: () => '/expenditurecard',
  },

  /* ---- expenditure payee directory ----
     Payees have their own approval path, separate from the expenditure request
     workflow: a requester adds bank details, the DoF vets them, and only then
     can the payee be used for a payment. Filed under the `expenditure`
     category so muting that domain mutes these too. */

  'payee.submitted': {
    recipients: [RECIPIENT_PAYEE_VERIFIER],
    category: 'expenditure',
    label: 'Payee awaiting verification',
    description: 'Someone added or edited payee bank details that need vetting.',
    severity: 'info',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Payee "${asText(d.name, 'Unnamed')}" is awaiting verification`,
    body: (d) => `Added by ${asText(d.applicantName, 'a user')}.`,
    link: () => '/workflow/expenditure',
  },

  'payee.approved': {
    recipients: ANYONE,
    category: 'expenditure',
    label: 'Payee verified',
    description: 'Payee details you submitted were verified.',
    severity: 'success',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Payee "${asText(d.name, 'Unnamed')}" was verified`,
    body: () => 'You can now select this payee on an expenditure request.',
    link: () => '/expenditurecard',
  },

  'payee.rejected': {
    recipients: ANYONE,
    category: 'expenditure',
    label: 'Payee rejected',
    description: 'Payee details you submitted were rejected.',
    severity: 'error',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Payee "${asText(d.name, 'Unnamed')}" was rejected`,
    // The reason is the whole point here: it tells the requester which bank
    // detail to correct.
    body: (d) => asText(d.feedback) || 'Open the payee to see why.',
    link: () => '/expenditurecard',
  },

  /* ---- publications ---- */

  'journal.submitted': {
    recipients: REVIEWERS,
    category: 'publications',
    label: 'Publication submitted for review',
    description: 'A publication was submitted and is waiting for review.',
    severity: 'info',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Publication "${asText(d.title, 'Untitled')}" is awaiting review`,
    body: (d) => `Submitted by ${asText(d.applicantName, 'a user')}.`,
    link: (d, role) =>
      role === 'applicant' ? `/journal/${d.recordId}` : `/admin/publications/${d.recordId}`,
  },

  'journal.resubmitted': {
    recipients: REVIEWERS,
    category: 'publications',
    label: 'Publication resubmitted',
    description: 'A publication was edited and re-entered review.',
    severity: 'info',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Publication "${asText(d.title, 'Untitled')}" was resubmitted for review`,
    body: (d) => `Edited by ${asText(d.actorName, 'the author')}.`,
    link: (d, role) =>
      role === 'applicant' ? `/journal/${d.recordId}` : `/admin/publications/${d.recordId}`,
  },

  'journal.approved': {
    recipients: ANYONE,
    category: 'publications',
    label: 'Publication approved',
    description: 'Your publication was approved.',
    severity: 'success',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Publication "${asText(d.title, 'Untitled')}" was approved`,
    body: (d) => asText(d.feedback) || null,
    link: (d) => `/journal/${d.recordId}`,
  },

  'journal.rejected': {
    recipients: ANYONE,
    category: 'publications',
    label: 'Publication rejected',
    description: 'Your publication was rejected.',
    severity: 'error',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Publication "${asText(d.title, 'Untitled')}" was rejected`,
    body: (d) => asText(d.feedback) || 'Open the record to see the reviewer comment.',
    link: (d) => `/journal/${d.recordId}`,
  },

  'journal.request_submitted': {
    recipients: REVIEWERS,
    category: 'publications',
    label: 'New-journal request submitted',
    description: 'Someone asked for a journal to be added to the master list.',
    severity: 'info',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Request to add journal "${asText(d.name, 'Untitled')}"`,
    body: (d) => `Requested by ${asText(d.applicantName, 'a user')}.`,
    link: () => '/admin/journals',
  },

  // The requester can use the publisher at once, so this asks for a review rather than
  // unblocking anyone; it is what tells an admin there is something under Publishers.
  'journal.publisher_requested': {
    recipients: REVIEWERS,
    category: 'publications',
    label: 'New publisher added',
    description: 'Someone added a publisher to the master list from the publication form.',
    severity: 'info',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Publisher "${asText(d.name, 'Untitled')}" awaits review`,
    body: (d) => `Added by ${asText(d.applicantName, 'a user')}.`,
    link: () => '/admin/journals',
  },

  'journal.request_approved': {
    recipients: ANYONE,
    category: 'publications',
    label: 'New-journal request approved',
    description: 'A journal you asked for was added to the master list.',
    severity: 'success',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Journal "${asText(d.name, 'Untitled')}" was added`,
    body: (d) => asText(d.feedback) || 'You can now select it on the publication form.',
    link: () => '/publications',
  },

  'journal.request_rejected': {
    recipients: ANYONE,
    category: 'publications',
    label: 'New-journal request rejected',
    description: 'A journal you asked for was not added.',
    severity: 'warning',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Request to add journal "${asText(d.name, 'Untitled')}" was rejected`,
    body: (d) => asText(d.feedback) || null,
    link: () => '/publications',
  },

  'journal.status_update_posted': {
    recipients: REVIEWERS,
    category: 'publications',
    label: 'Publication progress update posted',
    description: 'An author posted a progress update on their publication.',
    severity: 'info',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Progress update on "${asText(d.title, 'Untitled')}"`,
    body: (d) => asText(d.comment) || `Posted by ${asText(d.applicantName, 'the author')}.`,
    link: (d) => `/admin/publications/${d.recordId}`,
  },

  'journal.status_update_replied': {
    recipients: ANYONE,
    category: 'publications',
    label: 'Reply to your progress update',
    description: 'An administrator replied to a progress update you posted.',
    severity: 'info',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Reply on your update for "${asText(d.title, 'Untitled')}"`,
    body: (d) => asText(d.comment) || null,
    link: (d) => `/journal/${d.recordId}`,
  },

  /* ---- project master-data requests ---- */

  'project.request_submitted': {
    recipients: REVIEWERS,
    category: 'projects',
    label: 'Project option request submitted',
    description: 'Someone asked for a new agency or scheme to be added.',
    severity: 'info',
    defaultChannels: IN_APP_ONLY,
    title: (d) =>
      `Request to add ${asText(d.requestType, 'an option')} "${asText(d.name, 'Untitled')}"`,
    body: (d) => `Requested by ${asText(d.applicantName, 'a user')}.`,
    link: () => '/admin/form-management/project-options',
  },

  'project.request_approved': {
    recipients: ANYONE,
    category: 'projects',
    label: 'Project option request approved',
    description: 'An option you asked for was added.',
    severity: 'success',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `"${asText(d.name, 'Untitled')}" was added to the project options`,
    body: (d) => asText(d.feedback) || 'You can now select it on the project form.',
    link: () => '/projects',
  },

  'project.request_rejected': {
    recipients: ANYONE,
    category: 'projects',
    label: 'Project option request rejected',
    description: 'An option you asked for was not added.',
    severity: 'warning',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Request to add "${asText(d.name, 'Untitled')}" was rejected`,
    body: (d) => asText(d.feedback) || null,
    link: () => '/projects',
  },

  /* ---- edit requests (unfreezing an approved record) ---- */

  'edit_request.submitted': {
    recipients: REVIEWERS,
    category: 'edit_requests',
    label: 'Edit access requested',
    description: 'Someone asked to unlock an approved record for editing.',
    severity: 'info',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Edit access requested for ${editRequestLabel(d)}`,
    body: (d) => `Requested by ${asText(d.applicantName, 'a user')}.`,
    link: (d) =>
      asText(d.entityType) === 'research_projects'
        ? `/project/${d.recordId}`
        : `/admin/publications/${d.recordId}`,
  },

  'edit_request.approved': {
    recipients: ANYONE,
    category: 'edit_requests',
    label: 'Edit access granted',
    description: 'Your request to edit an approved record was granted.',
    severity: 'success',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Edit access granted for ${editRequestLabel(d)}`,
    body: () => 'The record is unlocked. Saving your changes will send it back for review.',
    link: (d) =>
      asText(d.entityType) === 'research_projects'
        ? `/project/${d.recordId}`
        : `/journal/${d.recordId}`,
  },

  'edit_request.rejected': {
    recipients: ANYONE,
    category: 'edit_requests',
    label: 'Edit access refused',
    description: 'Your request to edit an approved record was refused.',
    severity: 'warning',
    defaultChannels: BOTH_CHANNELS,
    title: (d) => `Edit access refused for ${editRequestLabel(d)}`,
    body: (d) => asText(d.feedback) || null,
    link: (d) =>
      asText(d.entityType) === 'research_projects'
        ? `/project/${d.recordId}`
        : `/journal/${d.recordId}`,
  },

  /* ---- events ---- */

  'event.submitted': {
    recipients: REVIEWERS,
    category: 'events',
    label: 'Event submitted for approval',
    description: 'An event was submitted for approval.',
    severity: 'info',
    defaultChannels: IN_APP_ONLY,
    title: (d) => `Event "${asText(d.title, 'Untitled')}" was submitted for approval`,
    body: () => null,
    link: (d) => `/event/${d.recordId}`,
  },

  /* ---- access control ---- */

  'access.roles_updated': {
    recipients: ANYONE,
    category: 'access',
    label: 'Your roles changed',
    description: 'An administrator changed which roles you hold.',
    severity: 'info',
    defaultChannels: BOTH_CHANNELS,
    title: () => 'Your access has been updated',
    body: (d) => {
      const roles = Array.isArray(d.roleNames) ? d.roleNames.filter(Boolean) : [];
      return roles.length
        ? `You now hold: ${roles.join(', ')}. Sign out and back in to pick up the change.`
        : 'Your assigned roles were changed. Sign out and back in to pick up the change.';
    },
    link: () => '/profile',
  },

  'access.super_admin_changed': {
    recipients: ANYONE,
    category: 'access',
    label: 'Super-admin access changed',
    description: 'Super-admin access was granted to or removed from your account.',
    severity: 'warning',
    defaultChannels: BOTH_CHANNELS,
    title: (d) =>
      d.isSuperAdmin
        ? 'You were granted super-admin access'
        : 'Your super-admin access was removed',
    body: () => 'Sign out and back in to pick up the change.',
    link: () => '/profile',
  },
});

export const isKnownNotificationType = (type) =>
  Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, asText(type));

export const getNotificationType = (type) => NOTIFICATION_TYPES[asText(type)] || null;

/**
 * Renders one notification for one recipient. A template that throws must not
 * take down a whole dispatch batch — a notification with a plain fallback title
 * is far better than an approval nobody hears about — so each renderer is
 * guarded individually.
 */
export const renderNotification = (type, data = {}, recipientRole = 'recipient') => {
  const entry = getNotificationType(type);
  if (!entry) return null;

  const safely = (fn, fallback) => {
    if (typeof fn !== 'function') return fallback;
    try {
      const value = fn(data, recipientRole);
      return value === undefined || value === null ? fallback : value;
    } catch (error) {
      console.error(`Notification template failed for ${type}:`, error);
      return fallback;
    }
  };

  // Each renderer is called exactly once: `body` in particular may be a
  // template that reads a counter or logs, and calling it twice to test for
  // null would double that side effect.
  const body = entry.body ? safely(entry.body, null) : null;

  return {
    eventType: type,
    category: entry.category,
    severity: entry.severity || 'info',
    title: String(safely(entry.title, 'You have a new notification')).slice(0, 255),
    body: body === null ? null : String(body),
    link: sanitizeLink(safely(entry.link, null)),
    defaultChannels: entry.defaultChannels || IN_APP_ONLY,
  };
};

/** Shape the preferences screen renders: one row per type, grouped by category. */
export const listCatalogForPreferences = () =>
  Object.entries(NOTIFICATION_TYPES).map(([eventType, entry]) => ({
    eventType,
    category: entry.category,
    label: entry.label,
    description: entry.description,
    severity: entry.severity || 'info',
    defaultChannels: entry.defaultChannels || IN_APP_ONLY,
    recipients: entry.recipients || ANYONE,
  }));

export default NOTIFICATION_TYPES;
