/**
 * Publisher names are unique under an accent- and case-insensitive collation, but that
 * collation is NO PAD: ' Elsevier' and 'Elsevier  Ltd' would still slip past the unique
 * key as new rows. Every writer (the publication form's Add Publisher and admin
 * Publication Management) stores names through this so the key catches the near-duplicates
 * it exists for.
 */
export const PUBLISHER_NAME_MAX_LENGTH = 255;

export const normalizePublisherName = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** Returns the normalized name, or throws a 400-coded error when it cannot be stored. */
export const assertValidPublisherName = (value) => {
  const name = normalizePublisherName(value);
  if (!name) {
    const error = new Error('Publisher name is required.');
    error.statusCode = 400;
    throw error;
  }
  if (name.length > PUBLISHER_NAME_MAX_LENGTH) {
    const error = new Error(
      `Publisher name must be at most ${PUBLISHER_NAME_MAX_LENGTH} characters.`,
    );
    error.statusCode = 400;
    throw error;
  }
  return name;
};

export const PUBLISHER_STATUSES = ['approved', 'pending', 'rejected'];
