/**
 * Module-scope store for the notification inbox.
 *
 * Deliberately the same shape as `shared/hooks/useBudgetCatalog.ts` — cached
 * value, in-flight de-duplication, a Set of subscribers — because that is the
 * one shared-state pattern this codebase already has, and a second idiom would
 * cost more in unfamiliarity than a library would save in lines.
 *
 * The store owns the transport. It knows nothing about how summaries arrive,
 * only that they do.
 */

import notificationsApi from './notificationsApi';
import { startTransport } from './notificationsTransport';

import type { AppNotification, NotificationSummary } from './types';

export interface NotificationsState {
  unreadCount: number;
  items: AppNotification[];
  nextCursor: number | null;
  loading: boolean;
  error: string | null;
  /** True once a first list load has completed, so the UI can tell empty from pending. */
  loaded: boolean;
}

const initialState: NotificationsState = {
  unreadCount: 0,
  items: [],
  nextCursor: null,
  loading: false,
  error: null,
  loaded: false,
};

let state: NotificationsState = initialState;
let listeners = new Set<() => void>();
let transport: ReturnType<typeof startTransport> | null = null;
let pendingList: Promise<void> | null = null;
/** Highest id we have seen, so a poll can tell "something new" from "no change". */
let lastSeenId = 0;
/**
 * Whether the first summary has landed.
 *
 * Without this, the first poll after a login sees `latestId` jump from 0 and
 * treats every notification the user already had as having just arrived —
 * someone returning to twenty unread items would be met with a burst of
 * toasts for things that happened last week. The first summary therefore only
 * establishes the baseline; nothing is announced until something arrives
 * *after* it.
 */
let primed = false;
/**
 * Which login this state belongs to.
 *
 * A request already in flight when the session ends still resolves, and its
 * `.then` would write the previous user's notifications into a store the next
 * user is looking at. `stopNotifications` bumps this; every write checks the
 * generation it started under and drops the result if it has moved on. Cheaper
 * and less error-prone than threading an AbortController through every call,
 * and it covers the rollback paths too, where the write happens in a `catch`.
 */
let generation = 0;

const emit = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('Notification store subscriber failed', error);
    }
  });
};

const setState = (patch: Partial<NotificationsState>) => {
  state = { ...state, ...patch };
  emit();
};

/** A writer bound to the session that was current when the request started. */
const sessionWriter = () => {
  const startedIn = generation;
  return {
    /** False once the session has ended — the caller must not write anything. */
    isCurrent: () => startedIn === generation,
    set: (patch: Partial<NotificationsState>) => {
      if (startedIn === generation) setState(patch);
    },
  };
};

export const getNotificationsState = (): NotificationsState => state;

export function subscribeNotifications(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Called when a notification arrives while the app is open, so the bell can
 * raise a toast. Registered by the provider rather than baked in here, keeping
 * this module free of UI concerns.
 */
type ArrivalHandler = (notifications: AppNotification[]) => void;
let onArrival: ArrivalHandler | null = null;

export const setArrivalHandler = (handler: ArrivalHandler | null) => {
  onArrival = handler;
};

const errorMessage = (error: unknown): string => {
  const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
  return axiosError.response?.data?.message || axiosError.message || 'Failed to load notifications';
};

/**
 * Loads the first page. Concurrent calls share one request — the bell opening
 * and a poll firing at the same moment must not produce two identical fetches.
 */
export function loadNotifications(force = false): Promise<void> {
  if (!force && pendingList) return pendingList;
  if (!force && state.loaded && !state.error) return Promise.resolve();

  setState({ loading: true, error: null });

  const writer = sessionWriter();

  pendingList = notificationsApi
    .list({ limit: 15 })
    .then((page) => {
      if (!writer.isCurrent()) return;
      writer.set({
        items: page.items,
        nextCursor: page.nextCursor,
        loading: false,
        loaded: true,
        error: null,
      });
      if (page.items.length > 0) {
        lastSeenId = Math.max(lastSeenId, page.items[0].id);
      }
    })
    .catch((error) => {
      writer.set({ loading: false, error: errorMessage(error) });
    })
    .finally(() => {
      if (writer.isCurrent()) pendingList = null;
    });

  return pendingList;
}

/** Appends the next page. No-op when there is nothing more. */
export async function loadMoreNotifications(): Promise<void> {
  if (!state.nextCursor || state.loading) return;

  setState({ loading: true });

  const writer = sessionWriter();

  try {
    const page = await notificationsApi.list({ limit: 15, cursor: state.nextCursor });
    writer.set({
      items: [...state.items, ...page.items],
      nextCursor: page.nextCursor,
      loading: false,
    });
  } catch (error) {
    writer.set({ loading: false, error: errorMessage(error) });
  }
}

/**
 * Marks one read. Updates locally first so the badge responds immediately, and
 * reverts if the server disagrees — a click that appears to do nothing for a
 * round-trip feels broken.
 */
export async function markNotificationRead(id: number): Promise<void> {
  const target = state.items.find((item) => item.id === id);
  if (!target || target.isRead) return;

  setState({
    items: state.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    unreadCount: Math.max(0, state.unreadCount - 1),
  });

  const writer = sessionWriter();

  try {
    await notificationsApi.markRead(id);
  } catch (error) {
    writer.set({
      items: state.items.map((item) => (item.id === id ? { ...item, isRead: false } : item)),
      unreadCount: state.unreadCount + 1,
      error: errorMessage(error),
    });
  }
}

export async function markAllNotificationsRead(category?: string | null): Promise<void> {
  const previousItems = state.items;
  const previousCount = state.unreadCount;

  setState({
    items: state.items.map((item) =>
      !category || item.category === category ? { ...item, isRead: true } : item,
    ),
    unreadCount: category ? previousCount : 0,
  });

  const writer = sessionWriter();

  try {
    await notificationsApi.markAllRead(category ?? null);
    // The count after a category-scoped clear is not derivable locally (unread
    // items may sit outside the loaded page), so ask the server.
    if (writer.isCurrent()) transport?.refreshNow();
  } catch (error) {
    writer.set({ items: previousItems, unreadCount: previousCount, error: errorMessage(error) });
  }
}

export async function archiveNotification(id: number): Promise<void> {
  const target = state.items.find((item) => item.id === id);
  if (!target) return;

  const previousItems = state.items;
  const previousCount = state.unreadCount;

  setState({
    items: state.items.filter((item) => item.id !== id),
    unreadCount: target.isRead ? state.unreadCount : Math.max(0, state.unreadCount - 1),
  });

  const writer = sessionWriter();

  try {
    await notificationsApi.archive(id);
  } catch (error) {
    writer.set({ items: previousItems, unreadCount: previousCount, error: errorMessage(error) });
  }
}

const handleSummary = (summary: NotificationSummary) => {
  setState({ unreadCount: summary.unreadCount });

  if (!primed) {
    // Baseline only — the badge is already showing the right count, and
    // nothing here is news.
    primed = true;
    lastSeenId = summary.latestId;
    return;
  }

  if (summary.latestId <= lastSeenId) return;

  const previousLastSeen = lastSeenId;
  lastSeenId = summary.latestId;

  // The summary only tells us the count changed. Fetch the list to find out
  // what actually arrived — but only if the inbox has been opened at least
  // once, or if someone is waiting to be told about arrivals. A user who never
  // opens the bell only ever pays for the summary poll.
  if (!state.loaded && !onArrival) return;

  const writer = sessionWriter();

  void notificationsApi
    .list({ limit: 15 })
    .then((page) => {
      if (!writer.isCurrent()) return;
      const arrivals = page.items.filter((item) => item.id > previousLastSeen);

      // A background refresh must not undo "Load older". Assigning `page.items`
      // straight to `items` would drop every page the user had paged in and
      // snap the list back to the newest fifteen, and resetting the cursor
      // would make their next "Load older" re-fetch page two. The fresh page is
      // authoritative for the newest rows — a notification read on another
      // device shows up through it — and everything already loaded below it is
      // kept in place. The cursor only moves while the user is still on the
      // first page; once they have paged deeper, theirs is the further one.
      const freshIds = new Set(page.items.map((item) => item.id));
      const olderItems = state.items.filter((item) => !freshIds.has(item.id));

      setState({
        items: [...page.items, ...olderItems],
        nextCursor: olderItems.length > 0 ? state.nextCursor : page.nextCursor,
        loaded: true,
      });
      if (arrivals.length > 0) onArrival?.(arrivals);
    })
    .catch(() => {
      // The next poll will try again; a failed background refresh is not
      // something to put in front of the user.
    });
};

/** Begins polling. Idempotent, so a re-render cannot start a second transport. */
export function startNotifications(): void {
  if (transport) return;
  transport = startTransport(handleSummary);
}

/**
 * Stops polling and clears everything. Called on logout: leaving one user's
 * notifications in a module-scope cache would show them to whoever logs in next
 * in the same tab.
 */
export function stopNotifications(): void {
  // Before anything else: this invalidates every request already in flight, so
  // none of them can write the departing user's data back into the store.
  generation += 1;
  transport?.stop();
  transport = null;
  pendingList = null;
  lastSeenId = 0;
  primed = false;
  state = initialState;
  emit();
}

/** Force an immediate summary poll. */
export function refreshNotifications(): void {
  transport?.refreshNow();
}

/** Test seam: drop every subscriber without touching the transport. */
export function __resetNotificationListeners(): void {
  listeners = new Set();
}
