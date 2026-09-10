import { Plus, Trash2 } from 'lucide-react';
import React from 'react';

interface RowActionsProps {
  /**
   * Rendered before the add / remove pair, inside the same row of controls —
   * the ledger's expand toggle, which belongs with them rather than beside them.
   */
  leading?: React.ReactNode;
  onAdd?: () => void;
  onRemove?: () => void;
  /** The design shows "+" only on the last row of a repeated group. */
  showAdd?: boolean;
  canRemove?: boolean;
  addDisabled?: boolean;
  disabled?: boolean;
  itemLabel: string;
}

/** The blue add / red remove pair that ends every repeatable row. */
const RowActions: React.FC<RowActionsProps> = ({
  leading,
  onAdd,
  onRemove,
  showAdd = true,
  canRemove = true,
  addDisabled = false,
  disabled = false,
  itemLabel,
}) => (
  <div className="pf-row-actions">
    {leading}

    {showAdd && onAdd && (
      <button
        type="button"
        className="pf-icon-btn pf-icon-btn--add"
        onClick={onAdd}
        disabled={disabled || addDisabled}
        aria-label={`Add ${itemLabel}`}
        title={addDisabled ? `Maximum number of ${itemLabel} rows reached` : `Add ${itemLabel}`}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    )}

    {onRemove && (
      <button
        type="button"
        className="pf-icon-btn pf-icon-btn--remove"
        onClick={onRemove}
        disabled={disabled || !canRemove}
        aria-label={`Remove ${itemLabel}`}
        title={canRemove ? `Remove ${itemLabel}` : `At least one ${itemLabel} is required`}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    )}
  </div>
);

export default RowActions;
