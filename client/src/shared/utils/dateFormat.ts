const parseDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (date: Date, withYear: boolean) =>
  date.toLocaleDateString(
    'en-IN',
    withYear
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' },
  );

/** "16 Apr 2026", or an empty string when the value is missing/unparseable. */
export const formatFullDate = (value: unknown): string => {
  const date = parseDate(value);
  return date ? formatDate(date, true) : '';
};

/** "16 Apr 2026, 5:37 pm", or an empty string when the value is missing/unparseable. */
export const formatFullDateTime = (value: unknown): string => {
  const date = parseDate(value);
  return date
    ? date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
};

/**
 * The latest submission for an approval card's header -- "Resubmitted 30 Apr" once a
 * request has come back, else "Submitted 16 Apr" -- naming the year only when it is not
 * this one. The tooltip keeps every date in full; the (i) timeline has the whole history.
 * Both are empty when there is no submission date.
 */
export const formatSubmissionDates = (submittedAt: unknown, resubmittedAt?: unknown) => {
  const submitted = parseDate(submittedAt);
  if (!submitted) {
    return { text: '', title: '' };
  }

  const thisYear = new Date().getFullYear();
  const dates: Array<[string, Date]> = [['Submitted', submitted]];
  const resubmitted = parseDate(resubmittedAt);
  if (resubmitted) {
    dates.push(['Resubmitted', resubmitted]);
  }

  const [latestLabel, latestDate] = dates[dates.length - 1];
  return {
    text: `${latestLabel} ${formatDate(latestDate, latestDate.getFullYear() !== thisYear)}`,
    title: dates.map(([label, date]) => `${label} ${formatDate(date, true)}`).join(' · '),
  };
};
