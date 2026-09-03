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
 *
 * `deliver` should also return in bounded time. The dispatcher heartbeats its
 * lease while a delivery is in flight, so a slow channel no longer risks having
 * its event reclaimed and re-sent — but a delivery that never returns still
 * blocks every recipient queued behind it. A channel that talks to the network
 * owns that bound: give the request a timeout, and cap any per-recipient
 * fan-out, reporting whatever is left as 'failed' so the retry ladder picks it
 * up on the next pass.
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
