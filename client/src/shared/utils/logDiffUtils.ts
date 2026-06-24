/**
 * Normalizes text for logging purposes, handling null/undefined.
 */
export const normalizeLogText = (value: any): string => String(value ?? '').trim();

/**
 * Formats an array of row numbers into a string of ranges (e.g., [1, 2, 3, 5] -> "1-3, 5").
 */
export const formatRowRanges = (rows: number[]): string => {
  if (!rows.length) return '';
  const ranges: string[] = [];
  const sortedRows = [...rows].sort((a, b) => a - b);
  let start = sortedRows[0];
  let prev = sortedRows[0];

  for (let i = 1; i < sortedRows.length; i += 1) {
    const current = sortedRows[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = current;
    prev = current;
  }

  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(', ');
};

/**
 * Summarizes changes across multiple lines, providing both compact and full detail formats.
 */
export interface LineChangeSummary {
  compact: string;
  full: string;
}

export const summarizeLineChanges = (lines: any[]): LineChangeSummary => {
  const normalizedLines = Array.isArray(lines) ? lines : [];
  let added = 0;
  let removed = 0;
  let updated = 0;
  const detailPreview: string[] = [];
  const detailFull: string[] = [];

  normalizedLines.forEach((line: any, lineIdx: number) => {
    const lineNo =
      Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no) || lineIdx + 1;
    const rawChanges = line?.changes;
    const changeList = Array.isArray(rawChanges)
      ? rawChanges.map((change: any) => normalizeLogText(change)).filter(Boolean)
      : normalizeLogText(rawChanges)
        ? [normalizeLogText(rawChanges)]
        : [];

    const lowered = changeList.map((change: string) => change.toLowerCase());
    const isOnlyAdded =
      changeList.length === 1 && (lowered[0] === 'line added' || lowered[0] === 'added');
    const isOnlyRemoved =
      changeList.length === 1 && (lowered[0] === 'line removed' || lowered[0] === 'removed');
    const lineDetails = `Line ${lineNo}: ${changeList.join('; ') || 'Updated'}`;
    detailFull.push(lineDetails);

    if (isOnlyAdded) added += 1;
    else if (isOnlyRemoved) removed += 1;
    else updated += 1;

    if (detailPreview.length < 4 && !isOnlyAdded && !isOnlyRemoved) {
      detailPreview.push(lineDetails);
    }
  });

  const summaryParts: string[] = [];
  if (added > 0) summaryParts.push(`${added} line(s) added`);
  if (removed > 0) summaryParts.push(`${removed} line(s) removed`);
  if (updated > 0) summaryParts.push(`${updated} line(s) updated`);

  const summary = summaryParts.join(', ');
  return {
    compact: [summary, detailPreview.join(' | ')].filter(Boolean).join(' | '),
    full: [summary, detailFull.join(' | ')].filter(Boolean).join(' | '),
  };
};
