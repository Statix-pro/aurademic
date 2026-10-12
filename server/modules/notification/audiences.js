/**
 * Reusable audience builders.
 *
 * Audiences are described in intent terms — "the publication reviewers", "the
 * person who raised this" — rather than as user ids, so a role reassignment
 * reroutes future notifications with no code change. Collecting the recurring
 * ones here keeps a permission key like `admin_dashboard.approve` from being
 * spelled out (and eventually mis-spelled) in six controllers.
 */

/**
 * The people who review publications and master-data requests. Matches the
 * gate on the admin review routes (`admin_dashboard.approve` OR `.manage`), so
 * everyone who can act on the request is told about it and nobody who cannot is.
 */
export const PUBLICATION_REVIEW_PERMISSIONS = Object.freeze([
  'admin_dashboard.approve',
  'admin_dashboard.manage',
]);

/** Reviewers of publications, journal requests and project option requests. */
export const reviewerAudience = (recipientRole = 'admin') => ({
  kind: 'permission',
  permissions: [...PUBLICATION_REVIEW_PERMISSIONS],
  recipientRole,
});

/** One named person — the applicant, or the subject of an access change. */
export const userAudience = (userId, recipientRole = 'applicant') =>
  userId ? [{ kind: 'user', userId, recipientRole }] : [];

export default { reviewerAudience, userAudience, PUBLICATION_REVIEW_PERMISSIONS };
