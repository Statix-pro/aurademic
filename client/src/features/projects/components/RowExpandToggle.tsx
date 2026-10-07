import { ChevronDown } from 'lucide-react';
import React from 'react';

interface RowExpandToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
  /** Id of the detail row this button shows and hides. */
  controls: string;
  /** What the strip holds, for the label: "facility details". */
  detailLabel: string;
  /**
   * Set while a field in the strip has an error: the row is held open, so the
   * control says so rather than offering to hide what it will not.
   */
  lockedLabel?: string;
}

/**
 * The chevron that opens a row's detail strip. It sits with the add / remove
 * buttons in `RowActions` (as `leading`), so it keeps their shape and uses the
 * ledger's `pf-ledger__toggle` rotation.
 */
const RowExpandToggle: React.FC<RowExpandToggleProps> = ({
  isExpanded,
  onToggle,
  controls,
  detailLabel,
  lockedLabel,
}) => (
  <button
    type="button"
    className={`pf-icon-btn pf-icon-btn--ghost pf-ledger__toggle ${isExpanded ? 'is-open' : ''}`.trim()}
    onClick={onToggle}
    disabled={Boolean(lockedLabel)}
    aria-expanded={isExpanded}
    aria-controls={controls}
    aria-label={lockedLabel ?? `${isExpanded ? 'Hide' : 'Show'} ${detailLabel}`}
    title={lockedLabel ?? (isExpanded ? 'Collapse' : 'Expand')}
  >
    <ChevronDown size={16} aria-hidden="true" />
  </button>
);

export default RowExpandToggle;
