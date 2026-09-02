/**
 * Who is offered which notification preference.
 *
 * The preferences screen lists a switch per notification type, and listing all
 * 44 to everybody meant offering a faculty member control over "a new request
 * has entered your approval queue" — a notification they can never receive.
 *
 * The rule these tests pin is asymmetric on purpose: hiding a switch for a
 * notification that *does* arrive is a real bug (the person cannot turn it
 * off), while showing a spare switch is only clutter. So every assertion that
 * something is hidden is paired with the reason it can never be sent.
 */

import { describe, expect, it } from 'vitest';

import {
  listCatalogForPreferences,
  NOTIFICATION_TYPES,
  RECIPIENT_ANYONE,
} from '../modules/notification/notificationCatalog.js';
import {
  canReceiveNotificationType,
  userCapabilities,
} from '../modules/notification/notificationEligibility.js';

const catalog = new Map(listCatalogForPreferences().map((entry) => [entry.eventType, entry]));

/** The event types a user with these roles/permissions would be offered. */
const visibleTo = (user) => {
  const capabilities = userCapabilities(user);
  return new Set(
    [...catalog.values()]
      .filter((entry) => canReceiveNotificationType(entry, capabilities))
      .map((entry) => entry.eventType),
  );
};

const FACULTY = { roles: ['user'], permissions: [] };
const HOD = { roles: ['hod'], permissions: [] };
// The DoF stage has no role of its own in this database — it is carried by a
// permission — so a permission-only approver is the realistic case, not an edge one.
const DOF_BY_PERMISSION = { roles: ['finance_admin'], permissions: ['expenditure.workflow.dof'] };
const REVIEWER = { roles: ['admin'], permissions: ['admin_dashboard.approve'] };

describe('catalog recipient tagging', () => {
  it('tags every notification type', () => {
    // A type added without `recipients` would silently fall back to "show to
    // everyone", which is safe but defeats the point of the filter.
    const untagged = Object.entries(NOTIFICATION_TYPES)
      .filter(([, entry]) => !Array.isArray(entry.recipients) || entry.recipients.length === 0)
      .map(([eventType]) => eventType);

    expect(untagged).toEqual([]);
  });

  it('covers the whole catalog for someone holding every capability', () => {
    const everything = visibleTo({
      roles: ['hod', 'principal', 'chairman', 'dof', 'admin'],
      permissions: [
        'finance.workflow.level1',
        'expenditure.workflow.dof',
        'budget.workflow.level1',
        'admin_dashboard.approve',
      ],
    });

    expect(everything.size).toBe(catalog.size);
  });
});

describe('a user who only ever submits', () => {
  const visible = visibleTo(FACULTY);

  it('is offered the outcomes of their own requests', () => {
    for (const eventType of [
      'finance.approved',
      'finance.rejected',
      'finance.returned',
      'expenditure.approved',
      'budget.rejected',
      // stage_advanced reaches the applicant too — it says "now with the DoF".
      'finance.stage_advanced',
      'budget.amounts_updated',
      'finance.deleted',
      'payee.approved',
      'payee.rejected',
      'journal.approved',
      'journal.request_rejected',
      'project.request_approved',
      'edit_request.approved',
      'access.roles_updated',
    ]) {
      expect(visible.has(eventType), eventType).toBe(true);
    }
  });

  it('is not offered approval-queue switches, which only reach approvers', () => {
    for (const eventType of [
      'finance.submitted',
      'finance.resubmitted',
      'expenditure.submitted',
      'expenditure.resubmitted',
      'budget.submitted',
      'budget.resubmitted',
    ]) {
      expect(NOTIFICATION_TYPES[eventType].recipients).not.toContain(RECIPIENT_ANYONE);
      expect(visible.has(eventType), eventType).toBe(false);
    }
  });

  it('is not offered reviewer or payee-verification switches', () => {
    for (const eventType of [
      'journal.submitted',
      'journal.resubmitted',
      'journal.request_submitted',
      'journal.status_update_posted',
      'project.request_submitted',
      'edit_request.submitted',
      'event.submitted',
      'payee.submitted',
    ]) {
      expect(visible.has(eventType), eventType).toBe(false);
    }
  });
});

describe('workflow approvers', () => {
  it('gives an HOD every module, because a stage role is not module-scoped', () => {
    // resolveStageRecipients matches level1 by role code for finance,
    // expenditure and budget alike, so the switches must follow.
    const visible = visibleTo(HOD);

    expect(visible.has('finance.submitted')).toBe(true);
    expect(visible.has('expenditure.submitted')).toBe(true);
    expect(visible.has('budget.submitted')).toBe(true);
  });

  it('scopes a permission-only approver to the modules that permission covers', () => {
    const visible = visibleTo(DOF_BY_PERMISSION);

    expect(visible.has('expenditure.submitted')).toBe(true);
    // Not finance and not budget: `expenditure.workflow.dof` grants neither,
    // and finance_admin is not a stage role.
    expect(visible.has('finance.submitted')).toBe(false);
    expect(visible.has('budget.submitted')).toBe(false);
  });

  it('honours finance.workflow.* for expenditure, mirroring the decision gate', () => {
    const visible = visibleTo({ roles: [], permissions: ['finance.workflow.level1'] });

    expect(visible.has('finance.submitted')).toBe(true);
    expect(visible.has('expenditure.submitted')).toBe(true);
    expect(visible.has('budget.submitted')).toBe(false);
  });

  it('offers the payee check to the DoF only', () => {
    expect(visibleTo(DOF_BY_PERMISSION).has('payee.submitted')).toBe(true);
    expect(visibleTo({ roles: ['dof'], permissions: [] }).has('payee.submitted')).toBe(true);
    // An HOD approves requests but does not curate the payee directory.
    expect(visibleTo(HOD).has('payee.submitted')).toBe(false);
  });
});

describe('publication reviewers', () => {
  const visible = visibleTo(REVIEWER);

  it('is offered everything routed by the review permissions', () => {
    for (const eventType of [
      'journal.submitted',
      'journal.resubmitted',
      'journal.request_submitted',
      'journal.status_update_posted',
      'project.request_submitted',
      'edit_request.submitted',
      'event.submitted',
    ]) {
      expect(visible.has(eventType), eventType).toBe(true);
    }
  });

  it('does not gain workflow queues from the admin role alone', () => {
    // Admins are deliberately left out of workflow_stage audiences — they would
    // be flooded — so the switch must not appear either.
    expect(visible.has('finance.submitted')).toBe(false);
  });
});

describe('unknown values', () => {
  it('shows a type whose recipient class this module has not been taught', () => {
    const capabilities = userCapabilities(FACULTY);

    expect(canReceiveNotificationType({ recipients: ['something_new'] }, capabilities)).toBe(true);
    expect(canReceiveNotificationType({ recipients: ['approver:grants'] }, capabilities)).toBe(
      true,
    );
  });

  it('treats a missing or empty tag as visible', () => {
    const capabilities = userCapabilities(FACULTY);

    expect(canReceiveNotificationType({}, capabilities)).toBe(true);
    expect(canReceiveNotificationType({ recipients: [] }, capabilities)).toBe(true);
  });

  it('does not crash on a user with no roles or permissions at all', () => {
    expect(() => visibleTo({})).not.toThrow();
    expect(visibleTo({}).has('finance.approved')).toBe(true);
  });
});
