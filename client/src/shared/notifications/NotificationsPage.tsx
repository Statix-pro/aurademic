/**
 * The full inbox at `/notifications`.
 *
 * The bell panel is for triage; this is for going back through history and for
 * the case the panel cannot serve — filtering by category when one domain is
 * noisy.
 */

import { BellOff } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import NotificationItem from './NotificationItem';
import useNotifications from './useNotifications';
import './notifications.css';

import type { AppNotification } from './types';

const CATEGORY_LABELS: Record<string, string> = {
  finance: 'Finance',
  expenditure: 'Expenditure',
  budget: 'Budget',
  publications: 'Publications',
  projects: 'Projects',
  edit_requests: 'Edit requests',
  events: 'Events',
  access: 'Access',
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const {
    items,
    unreadCount,
    loading,
    error,
    loaded,
    nextCursor,
    load,
    loadMore,
    markRead,
    markAllRead,
    archive,
  } = useNotifications();

  useEffect(() => {
    void load(true);
  }, [load]);

  /**
   * Filtered client-side rather than by refetching. The store holds one page
   * set shared with the bell, and refetching per filter would fight it for the
   * same cache; the page sizes here are small enough that filtering locally is
   * both faster and simpler.
   */
  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (unreadOnly && item.isRead) return false;
        if (category && item.category !== category) return false;
        return true;
      }),
    [items, unreadOnly, category],
  );

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort(),
    [items],
  );

  const openNotification = (notification: AppNotification) => {
    void markRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div className="notif-page">
      <div className="notif-page-head">
        <h1>Notifications</h1>
        <button
          type="button"
          className="notif-link-btn"
          onClick={() => void markAllRead(category)}
          disabled={unreadCount === 0}
        >
          {category ? `Mark ${CATEGORY_LABELS[category] ?? category} read` : 'Mark all read'}
        </button>
      </div>

      <div className="notif-filters">
        <button
          type="button"
          className={`notif-chip ${!unreadOnly ? 'is-active' : ''}`}
          onClick={() => setUnreadOnly(false)}
        >
          All
        </button>
        <button
          type="button"
          className={`notif-chip ${unreadOnly ? 'is-active' : ''}`}
          onClick={() => setUnreadOnly(true)}
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>

        <span style={{ width: 10 }} />

        <button
          type="button"
          className={`notif-chip ${category === null ? 'is-active' : ''}`}
          onClick={() => setCategory(null)}
        >
          Every module
        </button>
        {categories.map((value) => (
          <button
            key={value}
            type="button"
            className={`notif-chip ${category === value ? 'is-active' : ''}`}
            onClick={() => setCategory(value)}
          >
            {CATEGORY_LABELS[value] ?? value.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {error ? <div className="notif-error">{error}</div> : null}

      <div className="notif-card">
        {visible.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onOpen={openNotification}
            onDismiss={(id) => void archive(id)}
          />
        ))}

        {!loading && loaded && visible.length === 0 ? (
          <div className="notif-empty">
            <BellOff size={30} className="notif-empty-icon" />
            <div>
              {items.length === 0
                ? 'You have no notifications yet.'
                : 'Nothing matches these filters.'}
            </div>
          </div>
        ) : null}

        {loading && items.length === 0 ? <div className="notif-empty">Loading…</div> : null}

        {nextCursor ? (
          <div className="notif-panel-foot">
            <button
              type="button"
              className="notif-link-btn"
              onClick={() => void loadMore()}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Load older notifications'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default NotificationsPage;
