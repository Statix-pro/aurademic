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
 * A channel also declares `maxDeliveryMs`: the longest one `deliver` call can
 * take. This is a promise, not a hint — the dispatcher will not begin a
 * delivery unless its lease on the event outlasts that number, which is what
 * guarantees no push is still in flight once another worker could have claimed
 * the event and started sending the same rows. A channel that talks to the
 * network keeps the promise the way the push channel does: a timeout on the
 * request, and a budget across any per-recipient fan-out, reporting whatever is
 * left as 'failed' so the retry ladder picks it up on the next pass. Declaring
 * a number and then overrunning it is the one way to reintroduce duplicate
 * notifications, so keep it honest and generous.
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
