/**
 * Crossref lookup for the Outcomes tab's publication Fetch button.
 *
 * The portal's own `journals` records are searched first (see
 * `projectModel.findPublicationByDoi`); this is the fallback for a DOI the
 * portal does not hold yet. Only the DOI leaves the server, and only to
 * Crossref's public REST API, which needs no key.
 *
 * Kept free of database access, and `fetch` is injectable, so the mapping can
 * be unit tested without the network.
 */

const CROSSREF_WORKS_URL = 'https://api.crossref.org/works/';
const CROSSREF_TIMEOUT_MS = 5000;

/** Crossref's work types, mapped onto the form's three publication types. */
const CROSSREF_TYPES = {
  'journal-article': 'journal',
  'proceedings-article': 'conference',
  'book-chapter': 'book_chapter',
};

const firstText = (value) =>
  (Array.isArray(value) ? value : [value]).map((item) => String(item ?? '').trim()).find(Boolean) ??
  null;

/**
 * Reduces a Crossref `message` to the fields a publication row keeps. Missing
 * pieces come back null rather than guessed.
 */
export function mapCrossrefWork(work = {}) {
  const dateParts = work.issued?.['date-parts']?.[0] ?? work.published?.['date-parts']?.[0] ?? null;
  const year = Number(dateParts?.[0]);

  return {
    source: 'crossref',
    journal_id: null,
    publication_type: CROSSREF_TYPES[work.type] ?? null,
    title: firstText(work.title)?.slice(0, 500) ?? null,
    venue: firstText(work['container-title'])?.slice(0, 255) ?? null,
    publication_year: Number.isInteger(year) ? year : null,
  };
}

export class DoiLookupUnavailableError extends Error {}

/**
 * Looks a bare DOI up on Crossref. Resolves to the mapped work, or null when
 * Crossref does not know the DOI; rejects with `DoiLookupUnavailableError` when
 * Crossref cannot be reached or answers with anything else, so the caller can
 * tell "not found" apart from "could not ask".
 */
export async function lookupCrossref(doi, { fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${CROSSREF_WORKS_URL}${encodeURIComponent(doi)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'KSRCT-Research-Portal' },
      signal: AbortSignal.timeout(CROSSREF_TIMEOUT_MS),
    });
  } catch (error) {
    throw new DoiLookupUnavailableError(`Crossref could not be reached: ${error.message}`);
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new DoiLookupUnavailableError(`Crossref answered ${response.status}.`);
  }

  const body = await response.json().catch(() => null);
  if (!body?.message) throw new DoiLookupUnavailableError('Crossref sent an unreadable reply.');
  return mapCrossrefWork(body.message);
}
