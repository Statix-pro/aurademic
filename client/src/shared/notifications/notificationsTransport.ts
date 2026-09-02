/**
 * THE TRANSPORT SEAM.
 *
 * How the browser learns something arrived. Everything above this file — the
 * store, the bell, the inbox — is transport-agnostic: it just receives
 * summaries. Moving to Server-Sent Events or WebSockets means rewriting this
 * one file and nothing else.
 *
 * Polling is the deliberate first choice, not a shortcut. Production runs
 * behind IIS with iisnode, which buffers responses and makes SSE unreliable and
 * WebSockets a per-server configuration exercise. A 45-second poll of an
 * endpoint that returns two integers costs almost nothing, works through every
 * proxy, and needs no server-side connection state.
 *
 * The refinements that make it cheap in practice:
 *   - nothing is polled while the tab is hidden, so a parked tab is free;
 *   - becoming visible or focused refreshes immediately, so returning to the
 *     tab feels instant rather than up-to-45-seconds stale;
 *   - errors back off, so a server restart does not turn every open tab into a
 *     retry storm.
 */

import notificationsApi from './notificationsApi';

import type { NotificationSummary } from './types';

const POLL_INTERVAL_MS = 45000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export type SummaryListener = (summary: NotificationSummary) => void;

interface TransportHandle {
  stop: () => void;
  /** Force an immediate poll, e.g. after the user acts on a notification. */
  refreshNow: () => void;
}

export function startTransport(onSummary: SummaryListener): TransportHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let failures = 0;

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const nextDelay = () => {
    if (failures === 0) return POLL_INTERVAL_MS;
    // 45s, 90s, 180s, ... capped. A server restart must not become a stampede.
    return Math.min(POLL_INTERVAL_MS * 2 ** failures, MAX_BACKOFF_MS);
  };

  const schedule = () => {
    clear();
    if (stopped) return;
    // A hidden tab is not rescheduled at all; visibilitychange restarts it.
    if (typeof document !== 'undefined' && document.hidden) return;
    timer = setTimeout(poll, nextDelay());
  };

  const poll = async () => {
    if (stopped) return;

    try {
      const summary = await notificationsApi.getSummary();
      failures = 0;
      if (!stopped) onSummary(summary);
    } catch {
      // Swallowed on purpose. A 401 has already triggered a logout in the
      // shared axios interceptor, and any other failure is transient — a
      // background poll is never worth surfacing to the user.
      failures += 1;
    } finally {
      schedule();
    }
  };

  const refreshNow = () => {
    if (stopped) return;
    failures = 0;
    clear();
    void poll();
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      clear();
      return;
    }
    // Back on screen: catch up at once rather than waiting out the interval.
    refreshNow();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', refreshNow);
  }

  void poll();

  return {
    stop: () => {
      stopped = true;
      clear();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', refreshNow);
      }
    },
    refreshNow,
  };
}

export { POLL_INTERVAL_MS };
