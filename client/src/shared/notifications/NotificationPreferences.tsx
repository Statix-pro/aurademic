/**
 * Per-user notification preferences: a type × channel grid, plus the browser
 * push opt-in.
 *
 * The server has already resolved each cell — catalog default with the user's
 * overrides applied — so this component never reimplements the precedence
 * rules. It sends back only the cells the user actually changed, which keeps
 * the preferences table sparse and means a later change to a catalog default
 * still reaches everyone who never expressed an opinion.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import notificationsApi from './notificationsApi';
import { disablePush, enablePush, getPushStatus, type PushStatus } from './pushClient';
import './notifications.css';
import { useToast } from '../components/ui/toast/ToastProvider';

import type { NotificationPreferences as Preferences } from './types';

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-app',
  web_push: 'Browser push',
};

const CATEGORY_LABELS: Record<string, string> = {
  finance: 'Finance',
  expenditure: 'Expenditure',
  budget: 'Budget',
  publications: 'Publications',
  projects: 'Projects',
  edit_requests: 'Edit requests',
  events: 'Events',
  access: 'Access & roles',
};

const PUSH_MESSAGES: Record<PushStatus, string> = {
  unsupported: 'This browser does not support push notifications.',
  unconfigured: 'Push notifications are not configured on the server yet.',
  denied:
    'Notifications are blocked for this site. You will need to allow them in your browser settings.',
  default: 'Get notified on this device even when the portal is closed.',
  subscribed: 'This browser is receiving push notifications.',
};

const NotificationPreferencesPanel: React.FC = () => {
  const toast = useToast();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>('default');
  const [pushBusy, setPushBusy] = useState(false);

  /** Only what the user touched, keyed `eventType|channel`. */
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await notificationsApi.getPreferences();
        if (!cancelled) setPreferences(data);
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
        if (!cancelled) {
          setError(
            axiosError.response?.data?.message ||
              axiosError.message ||
              'Failed to load notification preferences',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    void getPushStatus().then((status) => {
      if (!cancelled) setPushStatus(status);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!preferences) return [];
    const byCategory = new Map<string, Preferences['types']>();
    for (const type of preferences.types) {
      const list = byCategory.get(type.category) ?? [];
      list.push(type);
      byCategory.set(type.category, list);
    }
    return [...byCategory.entries()];
  }, [preferences]);

  const isEnabled = useCallback(
    (eventType: string, channel: string, serverValue: boolean) =>
      changes.get(`${eventType}|${channel}`) ?? serverValue,
    [changes],
  );

  const toggle = (eventType: string, channel: string, current: boolean) => {
    setChanges((previous) => {
      const next = new Map(previous);
      next.set(`${eventType}|${channel}`, !current);
      return next;
    });
  };

  const save = async () => {
    if (changes.size === 0) return;

    setSaving(true);
    try {
      await notificationsApi.savePreferences(
        [...changes.entries()].map(([key, isChannelEnabled]) => {
          const [eventType, channel] = key.split('|');
          return { eventType, channel, isEnabled: isChannelEnabled };
        }),
      );

      // Re-read rather than trusting the local edits: the server is the
      // authority on how a preference resolves.
      const data = await notificationsApi.getPreferences();
      setPreferences(data);
      setChanges(new Map());
      toast.success('Notification preferences saved');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(
        'Could not save preferences',
        axiosError.response?.data?.message || axiosError.message,
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      const failure = pushStatus === 'subscribed' ? await disablePush() : await enablePush();
      if (failure) {
        toast.warning('Push notifications', failure);
      } else {
        toast.success(
          pushStatus === 'subscribed'
            ? 'Push notifications turned off for this browser'
            : 'Push notifications enabled for this browser',
        );
      }
      setPushStatus(await getPushStatus());
    } finally {
      setPushBusy(false);
    }
  };

  if (loading) return <div className="notif-empty">Loading preferences…</div>;
  if (error) return <div className="notif-error">{error}</div>;
  if (!preferences) return null;

  const pushActionable = pushStatus === 'default' || pushStatus === 'subscribed';

  return (
    <div>
      <div className="notif-push-panel">
        <h3>Browser push notifications</h3>
        <p>{PUSH_MESSAGES[pushStatus]}</p>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => void togglePush()}
          // Only offered where it can actually work; the message above explains
          // why when it cannot.
          disabled={pushBusy || !pushActionable}
        >
          {pushBusy
            ? 'Working…'
            : pushStatus === 'subscribed'
              ? 'Turn off on this browser'
              : 'Enable on this browser'}
        </button>
      </div>

      {grouped.map(([category, types]) => (
        <div className="notif-prefs-group" key={category}>
          <h3>{CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ')}</h3>
          <table className="notif-prefs-table">
            <thead>
              <tr>
                <th>Notification</th>
                {preferences.channels.map((channel) => (
                  <th key={channel} className="notif-prefs-channel">
                    {CHANNEL_LABELS[channel] ?? channel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.eventType}>
                  <td>
                    <div className="notif-prefs-label">{type.label}</div>
                    <div className="notif-prefs-desc">{type.description}</div>
                  </td>
                  {preferences.channels.map((channel) => {
                    const current = isEnabled(
                      type.eventType,
                      channel,
                      Boolean(type.channels[channel]),
                    );
                    return (
                      <td key={channel} className="notif-prefs-channel">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={current}
                          aria-label={`${type.label} — ${CHANNEL_LABELS[channel] ?? channel}`}
                          onChange={() => toggle(type.eventType, channel, current)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => void save()}
        disabled={saving || changes.size === 0}
      >
        {saving ? 'Saving…' : `Save changes${changes.size > 0 ? ` (${changes.size})` : ''}`}
      </button>
    </div>
  );
};

export default NotificationPreferencesPanel;
