/**
 * Per-user notification preferences.
 *
 * There are 40-odd notification types, which as one flat grid is a wall nobody
 * reads. So the screen is built around the unit of choice people actually have
 * an opinion about — the module — and only opens the per-type detail when
 * asked. A module row's toggle reports `mixed` when its types disagree, so
 * collapsing a section never hides that something inside it is off.
 *
 * The server has already resolved each cell — catalog default with the user's
 * overrides applied — so this component never reimplements the precedence
 * rules. It sends back only the cells the user actually changed, which keeps
 * the preferences table sparse and means a later change to a catalog default
 * still reaches everyone who never expressed an opinion.
 */

import { BellRing, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { byCategoryOrder, categoryIcon, categoryLabel } from './categories';
import ChannelToggle, { type ToggleState } from './ChannelToggle';
import notificationsApi from './notificationsApi';
import { disablePush, enablePush, getPushStatus, type PushStatus } from './pushClient';
import './notifications.css';
import { useToast } from '../components/ui/toast/ToastProvider';

import type { NotificationPreferences as Preferences, NotificationPreferenceType } from './types';

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-app',
  web_push: 'Browser push',
};

const PUSH_MESSAGES: Record<PushStatus, string> = {
  unsupported: 'This browser does not support push notifications.',
  unconfigured: 'Push notifications are not configured on the server yet.',
  denied:
    'Notifications are blocked for this site. You will need to allow them in your browser settings.',
  default: 'Get notified on this device even when the portal is closed.',
  subscribed: 'This browser is receiving push notifications.',
};

const PUSH_STATE_LABELS: Partial<Record<PushStatus, string>> = {
  subscribed: 'On',
  denied: 'Blocked',
  unsupported: 'Unavailable',
  unconfigured: 'Unavailable',
};

const NotificationPreferencesPanel: React.FC = () => {
  const toast = useToast();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    const byCategory = new Map<string, NotificationPreferenceType[]>();
    for (const type of preferences.types) {
      const list = byCategory.get(type.category) ?? [];
      list.push(type);
      byCategory.set(type.category, list);
    }
    return [...byCategory.entries()].sort((a, b) => byCategoryOrder(a[0], b[0]));
  }, [preferences]);

  const isEnabled = useCallback(
    (type: NotificationPreferenceType, channel: string) =>
      changes.get(`${type.eventType}|${channel}`) ?? Boolean(type.channels[channel]),
    [changes],
  );

  const setMany = (entries: Array<[NotificationPreferenceType, string, boolean]>) => {
    setChanges((previous) => {
      const next = new Map(previous);
      for (const [type, channel, value] of entries) {
        const key = `${type.eventType}|${channel}`;
        // Toggling back to what the server already holds is not a change —
        // dropping it keeps the save count honest and the payload minimal.
        if (Boolean(type.channels[channel]) === value) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  };

  /** `mixed` whenever the types inside a module disagree. */
  const categoryState = useCallback(
    (types: NotificationPreferenceType[], channel: string): ToggleState => {
      const on = types.filter((type) => isEnabled(type, channel)).length;
      if (on === 0) return 'off';
      if (on === types.length) return 'on';
      return 'mixed';
    },
    [isEnabled],
  );

  /** Mixed resolves to on: the useful move from "some" is "all of them". */
  const toggleCategory = (types: NotificationPreferenceType[], channel: string) => {
    const target = categoryState(types, channel) !== 'on';
    setMany(types.map((type) => [type, channel, target]));
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
  const pushStateLabel = PUSH_STATE_LABELS[pushStatus];

  return (
    <div className="notif-prefs">
      <section className={`notif-push-card is-${pushStatus}`}>
        <span className="notif-push-icon" aria-hidden="true">
          <BellRing size={20} />
        </span>

        <div className="notif-push-copy">
          <h3>
            Browser push notifications
            {pushStateLabel ? <span className="notif-push-state">{pushStateLabel}</span> : null}
          </h3>
          <p>{PUSH_MESSAGES[pushStatus]}</p>
        </div>

        <button
          type="button"
          className={`notif-btn ${pushStatus === 'subscribed' ? 'notif-btn--ghost' : 'notif-btn--primary'}`}
          onClick={() => void togglePush()}
          // Only offered where it can actually work; the message beside it
          // explains why when it cannot.
          disabled={pushBusy || !pushActionable}
        >
          {pushBusy
            ? 'Working…'
            : pushStatus === 'subscribed'
              ? 'Turn off here'
              : 'Enable on this browser'}
        </button>
      </section>

      <div className="notif-prefs-head">
        <div>
          <h3>What you are told about</h3>
          <p>
            Only the notifications your roles can actually receive are listed, so this changes if
            your roles do. Switch a whole module on or off, or open one to choose individual
            notifications. In-app notifications always appear on the bell; browser push also needs
            the switch above.
          </p>
        </div>
        <div className="notif-prefs-legend" aria-hidden="true">
          {preferences.channels.map((channel) => (
            <span key={channel}>{CHANNEL_LABELS[channel] ?? channel}</span>
          ))}
        </div>
      </div>

      <div className="notif-prefs-list">
        {grouped.map(([category, types]) => {
          const isOpen = expanded.has(category);
          const Icon = categoryIcon(category);
          const label = categoryLabel(category);

          return (
            <section className={`notif-acc ${isOpen ? 'is-open' : ''}`} key={category}>
              <div className="notif-acc-head">
                <button
                  type="button"
                  className="notif-acc-toggle"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setExpanded((previous) => {
                      const next = new Set(previous);
                      if (next.has(category)) next.delete(category);
                      else next.add(category);
                      return next;
                    })
                  }
                >
                  <ChevronRight size={16} className="notif-acc-chevron" />
                  {Icon ? (
                    <span className="notif-acc-icon" aria-hidden="true">
                      <Icon size={17} />
                    </span>
                  ) : null}
                  <span className="notif-acc-title">{label}</span>
                  {/* Just the size of the group. Any per-channel summary here
                      would contradict the other channel's toggle, and the
                      toggles already say on / off / mixed. */}
                  <span className="notif-acc-meta">
                    {types.length} {types.length === 1 ? 'notification' : 'notifications'}
                  </span>
                </button>

                <div className="notif-acc-switches">
                  {preferences.channels.map((channel) => (
                    <span className="notif-cell" key={channel}>
                      <ChannelToggle
                        state={categoryState(types, channel)}
                        label={`All ${label} notifications — ${CHANNEL_LABELS[channel] ?? channel}`}
                        onChange={() => toggleCategory(types, channel)}
                      />
                    </span>
                  ))}
                </div>
              </div>

              {isOpen ? (
                <div className="notif-acc-body">
                  {types.map((type) => (
                    <div className="notif-pref-row" key={type.eventType}>
                      <div className="notif-pref-copy">
                        <div className="notif-pref-label">{type.label}</div>
                        <div className="notif-pref-desc">{type.description}</div>
                      </div>
                      <div className="notif-acc-switches">
                        {preferences.channels.map((channel) => {
                          const current = isEnabled(type, channel);
                          return (
                            <span className="notif-cell" key={channel}>
                              <ChannelToggle
                                state={current ? 'on' : 'off'}
                                label={`${type.label} — ${CHANNEL_LABELS[channel] ?? channel}`}
                                onChange={() => setMany([[type, channel, !current]])}
                              />
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* Only present with something to save, so it never sits there as dead
          furniture at the bottom of a settings page. */}
      {changes.size > 0 ? (
        <div className="notif-savebar" role="status">
          <span className="notif-savebar-text">
            {changes.size} unsaved {changes.size === 1 ? 'change' : 'changes'}
          </span>
          <button
            type="button"
            className="notif-btn notif-btn--ghost"
            onClick={() => setChanges(new Map())}
            disabled={saving}
          >
            Discard
          </button>
          <button
            type="button"
            className="notif-btn notif-btn--primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationPreferencesPanel;
