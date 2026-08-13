/**
 * Browser storage for participant-owned data.
 *
 * Every key is namespaced by the signed-in participant's email. This site is
 * routinely opened on shared machines — college labs, help desks, the
 * registration counter — and an unscoped key hands the next participant the
 * previous one's feedback, payment proof and profile. `clearAppStorage` runs on
 * logout so nothing outlives the session.
 *
 * This is a stop-gap. These records belong on the server; once the participant
 * endpoints exist the four call sites swap to `apiFetch` and this file goes away
 * entirely. The auth token is not kept here — it lives in `config/api.ts`.
 */

const PREFIX = 'ep_';

/**
 * Every store this app keeps. Named here rather than inline at each call site so
 * a reader and a writer of the same data cannot drift apart — `feedbacks` is
 * written by FeedbackPage and read by HomePage's progress bar.
 */
export const STORES = {
  feedbacks: 'feedbacks',
  personalStatus: 'personal_status',
  professionStatus: 'profession_status',
  accommodationPaymentProof: 'accommodation_payment_proof',
} as const;

/** `ep_<name>_<email>`, matching the convention the contexts already use. */
export const scopedKey = (name: string, email?: string | null) =>
  `${PREFIX}${name}_${email || 'guest'}`;

export function readScoped<T>(name: string, email: string | null | undefined, fallback: T): T {
  try {
    const stored = localStorage.getItem(scopedKey(name, email));
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback;
  }
}

export function writeScoped(name: string, email: string | null | undefined, value: unknown) {
  try {
    localStorage.setItem(scopedKey(name, email), JSON.stringify(value));
  } catch (err) {
    // Quota exceeded, or storage disabled. Nothing useful to do here — the data
    // is a cache, and the caller's state stays correct for this session.
    void err;
  }
}

/** Removes every key this app owns, for any participant. Called on logout. */
export function clearAppStorage() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    void err;
  }
}
