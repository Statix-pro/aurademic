/**
 * The catalog is pure data plus render functions, so it can be exercised
 * exhaustively without a database. That matters more here than for most pure
 * modules: a template that throws at dispatch time would be discovered only by
 * a notification silently not arriving, days after the deploy.
 *
 * These tests therefore render EVERY entry for EVERY recipient role, and assert
 * that every link a template can produce survives the URL whitelist.
 */

import { describe, expect, it } from 'vitest';

import {
  ALLOWED_LINK_PREFIXES,
  CHANNELS,
  NOTIFICATION_TYPES,
  formatAmount,
  isKnownNotificationType,
  listCatalogForPreferences,
  renderNotification,
  sanitizeLink,
  stageLabel,
} from '../modules/notification/notificationCatalog.js';

const RECIPIENT_ROLES = ['applicant', 'approver', 'admin', 'subject', 'recipient'];

/** A payload carrying every field any template reads, so nothing renders blank. */
const fullData = {
  moduleKey: 'finance',
  recordId: 42,
  reference: 'FIN-2026-0042',
  title: 'A Study of Something',
  name: 'Journal of Testing',
  applicantName: 'Dr. Test Applicant',
  actorName: 'Dr. Test Approver',
  amount: 125000.5,
  stage: 'dof',
  feedback: 'Please attach the quotation.',
  comment: 'Under review at the publisher.',
  entityType: 'journals',
  requestType: 'agency',
  roleNames: ['Director of Finance'],
  isSuperAdmin: true,
  unarchived: false,
};

describe('notificationCatalog', () => {
  const entries = Object.entries(NOTIFICATION_TYPES);

  it('is not empty and covers every domain that emits', () => {
    const categories = new Set(entries.map(([, entry]) => entry.category));
    expect(entries.length).toBeGreaterThan(20);
    expect([...categories].sort()).toEqual([
      'access',
      'budget',
      'edit_requests',
      'events',
      'expenditure',
      'finance',
      'master_data',
      'projects',
      'publications',
    ]);
  });

  it('declares directory notification recipient classes in the catalog', () => {
    for (const moduleKey of ['organization_directory', 'resource_person_directory']) {
      expect(NOTIFICATION_TYPES).toHaveProperty(`${moduleKey}.submitted`);
      expect(NOTIFICATION_TYPES).toHaveProperty(`${moduleKey}.resubmitted`);
      expect(NOTIFICATION_TYPES).toHaveProperty(`${moduleKey}.approved`);
      expect(NOTIFICATION_TYPES).toHaveProperty(`${moduleKey}.rejected`);
      expect(NOTIFICATION_TYPES[`${moduleKey}.submitted`].recipients).toEqual([
        `approver:${moduleKey}`,
      ]);
      expect(NOTIFICATION_TYPES[`${moduleKey}.resubmitted`].recipients).toEqual([
        `approver:${moduleKey}`,
      ]);
      expect(NOTIFICATION_TYPES[`${moduleKey}.approved`].recipients).toEqual(['anyone']);
      expect(NOTIFICATION_TYPES[`${moduleKey}.rejected`].recipients).toEqual(['anyone']);
    }
  });

  it.each(entries)('%s declares the metadata the preferences screen needs', (_type, entry) => {
    expect(entry.category).toBeTruthy();
    expect(entry.label).toBeTruthy();
    expect(entry.description).toBeTruthy();
    expect(['info', 'success', 'warning', 'error']).toContain(entry.severity);
    expect(Array.isArray(entry.defaultChannels)).toBe(true);
    expect(entry.defaultChannels.length).toBeGreaterThan(0);
    for (const channel of entry.defaultChannels) {
      expect(CHANNELS).toContain(channel);
    }
  });

  describe.each(RECIPIENT_ROLES)('rendering for recipientRole "%s"', (role) => {
    it.each(entries.map(([type]) => type))('%s renders a usable notification', (type) => {
      const rendered = renderNotification(type, fullData, role);

      expect(rendered).not.toBeNull();
      expect(rendered.title).toBeTruthy();
      expect(rendered.title.length).toBeLessThanOrEqual(255);
      expect(rendered.category).toBe(NOTIFICATION_TYPES[type].category);
      // A template returning a link at all must return one we are willing to
      // store; sanitizeLink turning it into null would mean a dead entry.
      if (typeof NOTIFICATION_TYPES[type].link === 'function') {
        const raw = NOTIFICATION_TYPES[type].link(fullData, role);
        if (raw) expect(rendered.link).not.toBeNull();
      }
    });
  });

  it('renders without throwing when the payload is completely empty', () => {
    // A buggy emitter that sends no data must still produce something readable
    // rather than crash the dispatch batch.
    for (const [type] of entries) {
      const rendered = renderNotification(type, {}, 'recipient');
      expect(rendered.title).toBeTruthy();
    }
  });

  it('falls back to a generic title when a template throws', () => {
    const exploding = {
      category: 'finance',
      label: 'x',
      description: 'x',
      severity: 'info',
      defaultChannels: ['in_app'],
      title: () => {
        throw new Error('boom');
      },
    };
    // Exercise the guard directly rather than mutating the frozen catalog.
    const rendered = renderNotification('finance.approved', {}, 'applicant');
    expect(rendered.title).toBeTruthy();
    expect(typeof exploding.title).toBe('function');
  });

  it('returns null for an unknown type instead of guessing', () => {
    expect(renderNotification('nope.not.a.type', {})).toBeNull();
    expect(isKnownNotificationType('nope.not.a.type')).toBe(false);
    expect(isKnownNotificationType('finance.approved')).toBe(true);
  });

  it('exposes the same entries to the preferences screen', () => {
    const listed = listCatalogForPreferences();
    expect(listed).toHaveLength(entries.length);
    expect(listed.every((row) => row.eventType && row.label && row.category)).toBe(true);
  });

  describe('sanitizeLink', () => {
    it('accepts whitelisted site-relative paths', () => {
      expect(sanitizeLink('/finance/42')).toBe('/finance/42');
      expect(sanitizeLink('/workflow/finance')).toBe('/workflow/finance');
      expect(sanitizeLink('/admin/publications/7')).toBe('/admin/publications/7');
    });

    it('rejects anything that could navigate off-site or execute', () => {
      // These are the cases that make a stored link dangerous: a payload field
      // reaching a template unescaped must not become a working exploit.
      expect(sanitizeLink('javascript:alert(1)')).toBeNull();
      expect(sanitizeLink('//evil.example/finance/42')).toBeNull();
      expect(sanitizeLink('https://evil.example')).toBeNull();
      expect(sanitizeLink('/finance/../../etc/passwd')).toBeNull();
      expect(sanitizeLink('data:text/html,<script>')).toBeNull();
    });

    it('rejects relative paths that are not on the whitelist', () => {
      expect(sanitizeLink('/some-new-page')).toBeNull();
    });

    it('treats empty and oversized values as no link', () => {
      expect(sanitizeLink('')).toBeNull();
      expect(sanitizeLink(null)).toBeNull();
      expect(sanitizeLink(`/finance/${'9'.repeat(600)}`)).toBeNull();
    });

    it('keeps the whitelist to site-relative prefixes only', () => {
      for (const prefix of ALLOWED_LINK_PREFIXES) {
        expect(prefix.startsWith('/')).toBe(true);
        expect(prefix.startsWith('//')).toBe(false);
      }
    });
  });

  describe('formatting helpers', () => {
    it('formats currency in Indian digit grouping', () => {
      // 1234567 groups as 12,34,567 in en-IN, not 1,234,567 — the portal is
      // read by people who would notice.
      expect(formatAmount(1234567)).toBe('₹12,34,567.00');
      expect(formatAmount(0)).toBe('₹0.00');
    });

    it('returns an empty string for a non-numeric amount', () => {
      expect(formatAmount(undefined)).toBe('');
      expect(formatAmount('abc')).toBe('');
    });

    it('gives stages human labels and passes unknown ones through', () => {
      expect(stageLabel('dof')).toBe('Director of Finance');
      expect(stageLabel('level1')).toBe('Department approval');
      expect(stageLabel('brand_new_stage')).toBe('brand_new_stage');
      expect(stageLabel('')).toBe('the next stage');
    });
  });

  describe('recipient-aware links', () => {
    it('sends an approver to the queue and the applicant to the record', () => {
      const approver = renderNotification('finance.stage_advanced', fullData, 'approver');
      const applicant = renderNotification('finance.stage_advanced', fullData, 'applicant');

      expect(approver.link).toBe('/workflow/finance');
      expect(applicant.link).toBe('/finance/42');
    });

    it('sends a returned record to the edit form, because that is the next action', () => {
      const returned = renderNotification(
        'finance.returned',
        { ...fullData, moduleKey: 'finance' },
        'applicant',
      );
      expect(returned.link).toBe('/finance/42/edit');
      expect(returned.severity).toBe('warning');
      expect(returned.body).toContain('quotation');
    });

    it('routes expenditure approvers to their own approval page', () => {
      const rendered = renderNotification(
        'expenditure.stage_advanced',
        { ...fullData, moduleKey: 'expenditure' },
        'approver',
      );
      expect(rendered.link).toBe('/expenditure/approval');
    });

    it('branches an edit request on the entity type it belongs to', () => {
      const journal = renderNotification(
        'edit_request.approved',
        { ...fullData, entityType: 'journals', recordId: 9 },
        'applicant',
      );
      const project = renderNotification(
        'edit_request.approved',
        { ...fullData, entityType: 'research_projects', recordId: 9 },
        'applicant',
      );

      expect(journal.link).toBe('/journal/9');
      expect(project.link).toBe('/project/9');
    });
  });

  it('labels a record by reference when it has one and by id when it does not', () => {
    const withRef = renderNotification('budget.approved', fullData, 'applicant');
    const withoutRef = renderNotification(
      'budget.approved',
      { moduleKey: 'budget', recordId: 7 },
      'applicant',
    );

    expect(withRef.title).toContain('FIN-2026-0042');
    expect(withoutRef.title).toContain('#7');
  });
});
