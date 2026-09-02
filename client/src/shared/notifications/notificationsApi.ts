/**
 * HTTP for the notification inbox.
 *
 * `authenticityUtility`'s response interceptor unwraps `response.data`, so
 * every call here resolves to the API envelope itself rather than an Axios
 * response.
 */

import authenticityUtility from '../utils/authenticityUtility';

import type {
  NotificationListPage,
  NotificationPreferences,
  NotificationSummary,
  NotificationFilters,
} from './types';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const notificationsApi = {
  /** The poll target: two numbers, deliberately cheap. */
  async getSummary(): Promise<NotificationSummary> {
    const response = (await authenticityUtility.get(
      '/notifications/summary',
    )) as unknown as Envelope<NotificationSummary>;
    return response.data;
  },

  async list(filters: NotificationFilters = {}): Promise<NotificationListPage> {
    const params: Record<string, string | number> = {};
    if (filters.filter) params.filter = filters.filter;
    if (filters.category) params.category = filters.category;
    if (filters.limit) params.limit = filters.limit;
    if (filters.cursor) params.cursor = filters.cursor;

    const response = (await authenticityUtility.get('/notifications', {
      params,
    })) as unknown as Envelope<NotificationListPage>;
    return response.data;
  },

  async markRead(id: number): Promise<void> {
    await authenticityUtility.patch(`/notifications/${id}/read`);
  },

  async markAllRead(category?: string | null): Promise<number> {
    const response = (await authenticityUtility.post('/notifications/mark-all-read', {
      category: category ?? null,
    })) as unknown as Envelope<{ updated: number }>;
    return response.data?.updated ?? 0;
  },

  async archive(id: number): Promise<void> {
    await authenticityUtility.patch(`/notifications/${id}/archive`);
  },

  async getPreferences(): Promise<NotificationPreferences> {
    const response = (await authenticityUtility.get(
      '/notifications/preferences',
    )) as unknown as Envelope<NotificationPreferences>;
    return response.data;
  },

  async savePreferences(
    preferences: Array<{ eventType: string; channel: string; isEnabled: boolean }>,
  ): Promise<void> {
    await authenticityUtility.put('/notifications/preferences', { preferences });
  },

  async getPushPublicKey(): Promise<{ publicKey: string | null; enabled: boolean }> {
    const response = (await authenticityUtility.get(
      '/notifications/push/public-key',
    )) as unknown as Envelope<{ publicKey: string | null; enabled: boolean }>;
    return response.data;
  },

  async subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
    await authenticityUtility.post('/notifications/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    });
  },

  async unsubscribePush(endpoint: string): Promise<void> {
    await authenticityUtility.delete('/notifications/push/subscribe', {
      data: { endpoint },
    });
  },
};

export default notificationsApi;
