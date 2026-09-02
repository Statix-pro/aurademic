/**
 * The channel registry.
 *
 * Adding a channel — email, SMS — means writing one module with this shape and
 * listing it here, then naming its key in a catalog entry's `defaultChannels`.
 * Nothing else in the system needs to change, which is the whole point of the
 * outbox sitting between "something happened" and "someone was told".
 *
 * A channel is `{ key, label, isEnabled(), deliver(notification, recipient) }`
 * where `deliver` resolves to `{ status: 'sent' | 'skipped' | 'failed', error? }`
 * and must never throw.
 */

import inAppChannel from './inAppChannel.js';
import webPushChannel from './webPushChannel.js';

const CHANNELS = [inAppChannel, webPushChannel];

const CHANNELS_BY_KEY = new Map(CHANNELS.map((channel) => [channel.key, channel]));

export const listChannels = () => [...CHANNELS];

export const getChannel = (key) => CHANNELS_BY_KEY.get(String(key || '')) || null;

/** Channel keys the deployment can actually deliver on right now. */
export const listEnabledChannelKeys = () =>
  CHANNELS.filter((channel) => {
    try {
      return channel.isEnabled();
    } catch (error) {
      console.error(`Notification channel ${channel.key} failed its enablement check`, error);
      return false;
    }
  }).map((channel) => channel.key);

export default { listChannels, getChannel, listEnabledChannelKeys };
