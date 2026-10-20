/**
 * Where the notification screens live.
 *
 * The preferences panel is a tab on the profile page rather than a route of
 * its own, so "open my notification settings" needs the query string as well
 * as the path — and every link to it must agree on the spelling, or it lands
 * on the profile tab instead.
 */

export const PROFILE_TAB_PARAM = 'tab';
export const PROFILE_NOTIFICATIONS_TAB = 'notifications';

export const INBOX_PATH = '/notifications';
export const PREFERENCES_PATH = `/profile?${PROFILE_TAB_PARAM}=${PROFILE_NOTIFICATIONS_TAB}`;
