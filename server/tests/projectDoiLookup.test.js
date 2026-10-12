import { describe, expect, it, vi } from 'vitest';

import {
  DoiLookupUnavailableError,
  lookupCrossref,
  mapCrossrefWork,
} from '../modules/project/doiLookup.js';

// The publication Fetch button falls back to Crossref for a DOI the portal does
// not hold. These pin how a Crossref work becomes a publication row, and that
// "Crossref has no such DOI" stays distinct from "Crossref could not be asked" —
// the form tells the user to type the details by hand only in the second case.
describe('mapCrossrefWork', () => {
  it('maps a journal article onto the row fields', () => {
    expect(
      mapCrossrefWork({
        type: 'journal-article',
        title: ['Solar drying of millets'],
        'container-title': ['Journal of Food Engineering'],
        issued: { 'date-parts': [[2026, 3, 1]] },
      }),
    ).toEqual({
      source: 'crossref',
      journal_id: null,
      publication_type: 'journal',
      title: 'Solar drying of millets',
      venue: 'Journal of Food Engineering',
      publication_year: 2026,
    });
  });

  it('maps conference papers and book chapters, and leaves other types unset', () => {
    expect(mapCrossrefWork({ type: 'proceedings-article' }).publication_type).toBe('conference');
    expect(mapCrossrefWork({ type: 'book-chapter' }).publication_type).toBe('book_chapter');
    expect(mapCrossrefWork({ type: 'dataset' }).publication_type).toBeNull();
  });

  it('returns nulls for missing pieces rather than guessing', () => {
    expect(mapCrossrefWork({})).toMatchObject({ title: null, venue: null, publication_year: null });
  });
});

describe('lookupCrossref', () => {
  const reply = (status, body) =>
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    });

  it('encodes the DOI into the works URL and maps the reply', async () => {
    const fetchImpl = reply(200, { message: { type: 'journal-article', title: ['T'] } });

    const work = await lookupCrossref('10.1000/xyz123', { fetchImpl });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.crossref.org/works/10.1000%2Fxyz123');
    expect(work.title).toBe('T');
  });

  it('resolves null for a DOI Crossref does not know', async () => {
    await expect(lookupCrossref('10.1000/none', { fetchImpl: reply(404, {}) })).resolves.toBeNull();
  });

  it('rejects as unavailable on a network failure or a server error', async () => {
    const offline = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));

    await expect(lookupCrossref('10.1000/x', { fetchImpl: offline })).rejects.toBeInstanceOf(
      DoiLookupUnavailableError,
    );
    await expect(lookupCrossref('10.1000/x', { fetchImpl: reply(503, {}) })).rejects.toBeInstanceOf(
      DoiLookupUnavailableError,
    );
  });
});
