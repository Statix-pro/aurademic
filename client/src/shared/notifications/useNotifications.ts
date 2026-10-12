import { useEffect, useState } from 'react';

import {
  archiveNotification,
  getNotificationsState,
  loadMoreNotifications,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  refreshNotifications,
  subscribeNotifications,
} from './notificationsStore';

import type { NotificationsState } from './notificationsStore';

export interface UseNotifications extends NotificationsState {
  load: (force?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: (category?: string | null) => Promise<void>;
  archive: (id: number) => Promise<void>;
  refresh: () => void;
}

/**
 * Subscribes a component to the notification store.
 *
 * Reading through `getNotificationsState()` on every notification rather than
 * holding a copy keeps every consumer — bell, panel, inbox page — on one truth,
 * so marking something read in the panel updates the badge without either
 * component knowing about the other.
 */
export function useNotifications(): UseNotifications {
  const [state, setState] = useState<NotificationsState>(getNotificationsState);

  useEffect(() => {
    // Sync once on mount: the store may have been updated by a poll between
    // the initial render and this effect running.
    setState(getNotificationsState());
    return subscribeNotifications(() => setState(getNotificationsState()));
  }, []);

  return {
    ...state,
    load: loadNotifications,
    loadMore: loadMoreNotifications,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    archive: archiveNotification,
    refresh: refreshNotifications,
  };
}

export default useNotifications;
