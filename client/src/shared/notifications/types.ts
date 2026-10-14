/** Shapes returned by `/api/notifications`. */

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export type NotificationChannel = 'in_app' | 'web_push';

export interface AppNotification {
  id: number;
  eventType: string;
  category: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  /** Site-relative deep link, already validated server-side. */
  link: string | null;
  /** Why this person was told: applicant / approver / admin / subject. */
  recipientRole: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationSummary {
  unreadCount: number;
  /** Highest notification id the user has. Cheap change detector for polling. */
  latestId: number;
}

export interface NotificationListPage {
  items: AppNotification[];
  nextCursor: number | null;
}

export interface NotificationPreferenceType {
  eventType: string;
  category: string;
  label: string;
  description: string;
  severity: NotificationSeverity;
  defaultChannels: NotificationChannel[];
  /** Resolved server-side: catalog default with the user's overrides applied. */
  channels: Record<string, boolean>;
}

export interface NotificationPreferences {
  channels: NotificationChannel[];
  types: NotificationPreferenceType[];
}

export interface NotificationFilters {
  filter?: 'all' | 'unread';
  category?: string | null;
  limit?: number;
  cursor?: number | null;
}
