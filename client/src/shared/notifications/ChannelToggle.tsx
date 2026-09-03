/**
 * The one control used for every preference cell.
 *
 * Two states of the same control, deliberately one component: a leaf toggle is
 * on or off (`role="switch"`), while a category toggle summarising several
 * leaves can also be mixed — and ARIA's `switch` role has no mixed value, so
 * that variant announces itself as a checkbox instead. Same pixels, honest
 * semantics.
 */

import React from 'react';

export type ToggleState = 'on' | 'off' | 'mixed';

interface ChannelToggleProps {
  state: ToggleState;
  label: string;
  onChange: () => void;
  disabled?: boolean;
}

const ChannelToggle: React.FC<ChannelToggleProps> = ({ state, label, onChange, disabled }) => (
  <button
    type="button"
    role={state === 'mixed' ? 'checkbox' : 'switch'}
    aria-checked={state === 'mixed' ? 'mixed' : state === 'on'}
    aria-label={label}
    className="notif-toggle"
    data-state={state}
    disabled={disabled}
    onClick={(event) => {
      // Category toggles sit inside the accordion's header button; without
      // this, flipping a channel would also collapse the section.
      event.stopPropagation();
      onChange();
    }}
  >
    <span className="notif-toggle-knob" aria-hidden="true" />
  </button>
);

export default ChannelToggle;
