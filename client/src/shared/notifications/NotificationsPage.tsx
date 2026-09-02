/**
 * The full inbox at `/notifications`.
 *
 * The bell panel is for triage; this is for going back through history and for
 * the case the panel cannot serve — narrowing to one module when another is
 * noisy. The module rail carries live counts, so it doubles as an at-a-glance
 * answer to "where is my attention needed", which is what stops the page from
 * being an empty box with a list glued to the top of it.
 */

import {
  CheckCheck,
  Inbox,
  Layers,
  RefreshCw,
  Settings,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { byCategoryOrder, categoryIcon, categoryLabel } from './categories';
import NotificationItem from './NotificationItem';
import { PREFERENCES_PATH } from './routes';
import useNotifications from './useNotifications';
import './notifications.css';

import type { AppNotification } from './types';

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

  /** One pass for the rail: how many loaded items each module holds, and how many are unread. */
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, { total: number; unread: number }>();
    for (const item of items) {
      const entry = counts.get(item.category) ?? { total: 0, unread: 0 };
      entry.total += 1;
      if (!item.isRead) entry.unread += 1;
      counts.set(item.category, entry);
    }
    return [...counts.entries()].sort((a, b) => byCategoryOrder(a[0], b[0]));
  }, [items]);

  const openNotification = (notification: AppNotification) => {
    void markRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  const activeLabel = category ? categoryLabel(category) : null;

  const railItem = (
    key: string,
    label: string,
    Icon: LucideIcon | null,
    count: number,
    isActive: boolean,
    onClick: () => void,
    accent = false,
  ) => (
    <button
      key={key}
      type="button"
      className={`notif-rail-item ${isActive ? 'is-active' : ''}`}
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
    >
      {Icon ? <Icon size={15} /> : <span className="notif-rail-spacer" aria-hidden="true" />}
      <span className="notif-rail-text">{label}</span>
      {count > 0 ? (
        <span className={`notif-rail-count ${accent ? 'is-accent' : ''}`}>{count}</span>
      ) : null}
    </button>
  );

  return (
    <div className="notif-page">
      <header className="notif-page-head">
        <div>
          <h1>Notifications</h1>
          <p className="notif-page-sub">
            {unreadCount > 0
              ? `${unreadCount} unread of ${items.length} loaded`
              : 'Everything is read'}
          </p>
        </div>

        <div className="notif-page-actions">
          <button
            type="button"
            className="notif-btn notif-btn--ghost"
            onClick={() => void markAllRead(category)}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={15} />
            {activeLabel ? `Mark ${activeLabel} read` : 'Mark all read'}
          </button>
          {/* Straight to the notifications tab; bare /profile opens the profile
              tab, which is not what "Settings" means from here. */}
          <Link to={PREFERENCES_PATH} className="notif-btn notif-btn--ghost">
            <Settings size={15} />
            Settings
          </Link>
        </div>
      </header>

      {/* With an empty list the card carries the failure and its retry, so a
          banner here would just say the same thing twice. */}
      {error && items.length > 0 ? <div className="notif-error">{error}</div> : null}

      <div className="notif-page-body">
        <nav className="notif-rail" aria-label="Filter notifications">
          {railItem('all', 'All', Inbox, items.length, !unreadOnly && !category, () => {
            setUnreadOnly(false);
            setCategory(null);
          })}
          {railItem(
            'unread',
            'Unread',
            Layers,
            unreadCount,
            unreadOnly,
            () => setUnreadOnly(true),
            true,
          )}

          {categoryCounts.length > 0 ? (
            <>
              <div className="notif-rail-heading">Modules</div>
              {categoryCounts.map(([value, counts]) =>
                railItem(
                  value,
                  categoryLabel(value),
                  categoryIcon(value),
                  counts.unread || counts.total,
                  category === value,
                  () => setCategory(category === value ? null : value),
                  counts.unread > 0,
                ),
              )}
            </>
          ) : null}
        </nav>

        <div className="notif-card">
          <div className="notif-list">
            {visible.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={openNotification}
                onDismiss={(id) => void archive(id)}
              />
            ))}

            {loading && items.length === 0 ? (
              <div className="notif-page-empty">
                <div className="notif-page-empty-text">Loading your notifications…</div>
              </div>
            ) : null}

            {/* `error` counts as settled alongside `loaded`: a failed first load
              leaves `loaded` false, and without this the card renders as a tall
              blank rectangle with the reason only in the banner above it. */}
            {!loading && (loaded || error) && visible.length === 0 ? (
              <div className="notif-page-empty">
                <span className="notif-page-empty-icon" aria-hidden="true">
                  {error && items.length === 0 ? <WifiOff size={26} /> : <Inbox size={26} />}
                </span>
                {error && items.length === 0 ? (
                  <>
                    <h2>Could not load your notifications</h2>
                    <p>{error}</p>
                    <button
                      type="button"
                      className="notif-btn notif-btn--ghost"
                      onClick={() => void load(true)}
                    >
                      <RefreshCw size={15} />
                      Try again
                    </button>
                  </>
                ) : items.length === 0 ? (
                  <>
                    <h2>You are all caught up</h2>
                    <p>
                      Approvals, rejections and requests that need you will show up here — and on
                      the bell in the top bar.
                    </p>
                    <Link to={PREFERENCES_PATH} className="notif-btn notif-btn--ghost">
                      <Settings size={15} />
                      Choose what you are told about
                    </Link>
                  </>
                ) : (
                  <>
                    <h2>Nothing here</h2>
                    <p>
                      No {unreadOnly ? 'unread ' : ''}notifications
                      {activeLabel ? ` in ${activeLabel}` : ''}.
                    </p>
                    <button
                      type="button"
                      className="notif-btn notif-btn--ghost"
                      onClick={() => {
                        setUnreadOnly(false);
                        setCategory(null);
                      }}
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>

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
    </div>
  );
};

export default NotificationsPage;
