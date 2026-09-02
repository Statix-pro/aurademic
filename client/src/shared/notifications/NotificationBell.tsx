/**
 * The topbar bell and its dropdown.
 *
 * Lives in `topbar-right` beside the avatar. The panel is fixed-position rather
 * than nested in the topbar's flex row, because `.topbar` is a 56px-high
 * overflow-hidden bar and an in-flow dropdown would be clipped by it.
 */

import { Bell, BellOff } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import NotificationItem from './NotificationItem';
import useNotifications from './useNotifications';
import './notifications.css';

import type { AppNotification } from './types';

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { items, unreadCount, loading, error, loaded, load, markRead, markAllRead, archive } =
    useNotifications();

  // Fetch on open rather than on mount: a user who never opens the bell pays
  // only for the summary poll, not for a list they will not read.
  useEffect(() => {
    if (open) void load(true);
  }, [open, load]);

  // Close on an outside click or Escape — a dropdown that traps the user is
  // worse than no dropdown.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = useCallback(
    (notification: AppNotification) => {
      void markRead(notification.id);
      setOpen(false);
      if (notification.link) navigate(notification.link);
    },
    [markRead, navigate],
  );

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`notif-bell ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          // Capped so a long-neglected inbox cannot stretch the badge across
          // the topbar.
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <span className="notif-panel-title">Notifications</span>
            <div className="notif-panel-actions">
              <button
                type="button"
                className="notif-link-btn"
                onClick={() => void markAllRead()}
                disabled={unreadCount === 0}
              >
                Mark all read
              </button>
            </div>
          </div>

          {error ? <div className="notif-error">{error}</div> : null}

          <div className="notif-list">
            {items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={openNotification}
                onDismiss={(id) => void archive(id)}
              />
            ))}

            {/* `loaded` distinguishes "nothing to show" from "not fetched yet",
                so the panel never flashes an empty state during its first load. */}
            {!loading && loaded && items.length === 0 ? (
              <div className="notif-empty">
                <BellOff size={26} className="notif-empty-icon" />
                <div>You are all caught up.</div>
              </div>
            ) : null}

            {loading && items.length === 0 ? <div className="notif-empty">Loading…</div> : null}
          </div>

          {/* No paging here on purpose: the panel is for triage of what just
              happened, and "See all notifications" below is the way deeper. */}

          <div className="notif-panel-foot">
            <button
              type="button"
              className="notif-link-btn"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              See all notifications
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;
