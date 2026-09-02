import { X } from 'lucide-react';
import React from 'react';

import type { AppNotification } from './types';

/** "3m ago" / "2h ago" / "5 Sep" — precise enough to judge, short enough to scan. */
export const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

interface NotificationItemProps {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  onDismiss: (id: number) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onOpen, onDismiss }) => (
  <div
    className={`notif-item ${notification.isRead ? 'is-read' : 'is-unread'}`}
    role="button"
    tabIndex={0}
    onClick={() => onOpen(notification)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(notification);
      }
    }}
  >
    <span className={`notif-dot ${notification.isRead ? 'is-read' : ''}`} aria-hidden="true" />

    <div className="notif-item-body">
      <div className="notif-item-title">{notification.title}</div>
      {notification.body ? <div className="notif-item-text">{notification.body}</div> : null}
      <div className="notif-item-meta">
        <span className={`notif-sev notif-sev--${notification.severity}`}>
          {notification.category.replace(/_/g, ' ')}
        </span>
      </div>
    </div>

    {/* Its own column beside the body rather than trailing the module badge:
        on the full-width inbox that keeps it aligned under the dismiss button
        instead of stranded in the middle of a very wide row. */}
    <span className="notif-item-time">{relativeTime(notification.createdAt)}</span>

    <button
      type="button"
      className="notif-dismiss"
      aria-label="Dismiss"
      onClick={(event) => {
        // Without this the row's own click handler would also fire and
        // navigate away from the list the user is tidying.
        event.stopPropagation();
        onDismiss(notification.id);
      }}
      // The row is a keyboard target too, and its handler calls
      // preventDefault. Reaching it from the focused button would open the
      // notification on Enter and swallow the button's own Space activation,
      // leaving no way to dismiss anything without a mouse.
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    >
      <X size={14} />
    </button>
  </div>
);

export default NotificationItem;
