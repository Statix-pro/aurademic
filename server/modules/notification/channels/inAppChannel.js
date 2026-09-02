/**
 * The in-app channel.
 *
 * There is nothing to send: the `notifications` row the dispatcher just wrote
 * IS the delivery, and the bell reads it on its next poll. The channel exists
 * so that in-app is configurable and auditable on the same footing as every
 * other channel — a user can mute it per type, and its delivery row records
 * that the notification was made available.
 */

const inAppChannel = {
  key: 'in_app',
  label: 'In-app',

  isEnabled() {
    return true;
  },

  async deliver() {
    return { status: 'sent' };
  },
};

export default inAppChannel;
