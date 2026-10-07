import { useState } from 'react';

/**
 * Which one row of a table has its detail strip open, by row key — opening
 * another row closes it. Shared by the tables whose rows expand (Facility,
 * Manpower, and the Outcomes tab's publications and IPRs).
 *
 * `undefined` is the state before anyone has touched a toggle, which is not the
 * same as `null` — a row deliberately collapsed. It defers to the first row
 * rather than freezing a key at mount, because an edited project's rows arrive
 * after the table mounts, and a fresh table's only row still needs the fields
 * that live in its strip.
 *
 * A remembered key that no longer names a row falls back the same way. A save
 * rebuilds the form from the server with fresh row keys, and removing the open
 * row takes its key with it; either left every strip shut, the first row's
 * included.
 */
export function useSingleExpandedRow(rowKeys: string[]) {
  const [expandedRow, setExpandedRow] = useState<string | null | undefined>(undefined);
  const openRow =
    expandedRow === undefined || (expandedRow !== null && !rowKeys.includes(expandedRow))
      ? (rowKeys[0] ?? null)
      : expandedRow;

  return {
    openRow,
    /** Opens this row, closing whichever was open. */
    openOnly: (rowKey: string) => setExpandedRow(rowKey),
    toggleRow: (rowKey: string) => setExpandedRow(openRow === rowKey ? null : rowKey),
  };
}
