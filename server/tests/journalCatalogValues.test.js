/**
 * The journal-list import decides on its own whether a row is the same journal, so these pin
 * the cleaning rules against the shapes the real KSRCT files arrive in: three ISSN formats
 * and a spreadsheet-stripped leading zero, journal titles that look alike but are different
 * journals, KSRCT's affiliation as authors actually misspell it, and metrics typed as notes.
 */

import { describe, expect, it } from 'vitest';

import { formatIssn, parseIssn, parseIssnList } from '../modules/journalCatalog/issn.js';
import {
  cleanText,
  isKsrctAffiliation,
  parseDecimal,
  parseTypedMetric,
  titlesMatch,
} from '../modules/journalCatalog/values.js';

describe('ISSN cleaning', () => {
  it('reads hyphenated, bare and lower-case-x ISSNs to the same bare value', () => {
    expect(parseIssn('2190-572X').issn).toBe('2190572X');
    expect(parseIssn('2190572X').issn).toBe('2190572X');
    expect(parseIssn(' 2190-572x ').issn).toBe('2190572X');
  });

  it('refuses a value whose check digit is wrong instead of storing it', () => {
    // "Evergreen" in the faculty sheet: one digit off.
    expect(parseIssn('2189-9727')).toMatchObject({ valid: false, issn: null });
  });

  it('restores a leading zero a spreadsheet dropped, only when the check digit then passes', () => {
    // "International Journal of Biological Macromolecules" was entered as 1418130.
    expect(parseIssn('1418130')).toMatchObject({ valid: true, issn: '01418130', corrected: true });
    expect(parseIssn('1234567')).toMatchObject({ valid: false });
  });

  it('does not take an ISBN for an ISSN', () => {
    expect(parseIssn('978-1-85573-588-0').valid).toBe(false);
  });

  it('treats dashes of every width, N/A and None as an empty cell, not an invalid ISSN', () => {
    // "None" used to be blank everywhere except here, so it raised a needless exception.
    for (const blank of ['', '-', '—', '–', 'N/A', 'None']) expect(parseIssn(blank)).toBeNull();
  });

  it("splits SCImago's two-to-a-cell ISSNs", () => {
    expect(parseIssnList('15424863, 00079235').map((entry) => entry.issn)).toEqual([
      '15424863',
      '00079235',
    ]);
  });

  it('formats for display with a hyphen', () => {
    expect(formatIssn('2190572X')).toBe('2190-572X');
  });
});

describe('titlesMatch', () => {
  it.each([
    ['Journal of Optics', 'Journal of Optics (India)'],
    ['INDIAN JOURNAL OF FIBRE & TEXTILE RESEARCH', 'Indian Journal of Fibre and Textile Research'],
    [
      'Management of Environmental Quality: An International Journal',
      'Management of Environmental Quality',
    ],
    ['Heat and Mass Transfer', 'Heat and Mass Transfer/Waerme- und Stoffuebertragung'],
    ['MATERIALS TESTING', 'Materialpruefung/Materials Testing'],
    [
      'CLUSTER COMPUTING-THE JOURNAL OF NETWORKS SOFTWARE TOOLS AND APPLICATIONS',
      'Cluster Computing',
    ],
    ['JOURNAL OF OPTICS-INDIA', 'Journal of Optics (India)'],
    ['INDIAN JOURNAL OF GEO-MARINE SCIENCES', 'Indian Journal of Geo-Marine Sciences'],
  ])('matches %s with %s', (left, right) => {
    expect(titlesMatch(left, right)).toBe(true);
  });

  // Each of these is a different journal in the real data, and a similarity score called
  // most of them near-identical — matching them would attach another journal's metrics.
  it.each([
    ['Materials Research', 'Materials Research Express'],
    ['Journal of Plant Biotechnology', 'Plant Biotechnology Journal'],
    [
      'Journal of Environmental Science and Engineering',
      'Journal of Environmental Engineering and Science',
    ],
    ['Journal of Optics (India)', 'Journal of Optics (United Kingdom)'],
    ['JOURNAL OF OPTICS-INDIA', 'Journal of Optics (United Kingdom)'],
    [
      'Journal of the Institution of Engineers (India): Series M',
      'Journal of The Institution of Engineers (India): Series S',
    ],
    ['Indian Journal of Marketing', 'Journal of Natural Fibers'],
    ['SN Applied Sciences', 'Discover Applied Sciences'],
  ])('does not match %s with %s', (left, right) => {
    expect(titlesMatch(left, right)).toBe(false);
  });
});

describe('KSRCT affiliation', () => {
  it.each([
    'Department of Mechatronics Engineering, K.S. Rangasamy College of Technology, Tiruchengode',
    'Department of Textile Technology, KSR College of Technology, Tiruchengode, India',
    'K S Rengasamy College of Technology, Tiruchengode',
    'K.S.Ranagasamy College of Technology, Nammakkal (Dt)',
    'Dept of ECE, K.S.Rangasamy coll of Tech Tiruchengode',
    'K S Rangasamy Collage of Technology, Tiruchengode',
    'Department of Biotechnology, K.S. Rangasamy, College of Technology, Tiruchengode',
    'Department of Civil Engineering, KSRCT, Tamil Nadu',
  ])('recognises "%s"', (text) => {
    expect(isKsrctAffiliation(text)).toBe(true);
  });

  // Sister institutions in the same group and town — not KSRCT.
  it.each([
    'Department of Chemistry, K.S.R College of Arts and Science College for Women, Namakkal',
    'K.S.R. College of Engineering, Department of Mechanical Engineering, Tiruchengode',
    'Department of Mechanical Engineering, K. S. Rangasamy Institute of Technology, Tiruchengode',
    'Department of Information Technology, K S Rangasamy College of Engineering, Tiruchengode',
    'Vivekanandha College of Technology for Women, Tiruchengode',
  ])('does not count "%s"', (text) => {
    expect(isKsrctAffiliation(text)).toBe(false);
  });
});

describe('cell values', () => {
  it("reads SCImago's decimal comma", () => {
    expect(parseDecimal('104,065', { decimalComma: true })).toEqual({
      value: 104.065,
      valid: true,
    });
    expect(parseDecimal('-', { decimalComma: true })).toEqual({ value: null, valid: true });
    expect(parseDecimal('n/a value').valid).toBe(false);
  });

  it('offers back the number and year of a metric typed as a note, flagged for review', () => {
    expect(parseTypedMetric('8.1 (JCR, 2023)')).toMatchObject({
      value: 8.1,
      year: 2023,
      clean: false,
    });
    expect(parseTypedMetric('2.9')).toEqual({ value: 2.9, year: null, clean: true });
    expect(parseTypedMetric('-')).toEqual({ value: null, year: null, clean: true });
  });

  it('never collapses a range into one value', () => {
    expect(parseTypedMetric('1.5-1.9')).toMatchObject({ value: null, clean: false });
  });

  it('removes the wrapping quotes a lenient parse leaves on an unescaped SCImago field', () => {
    expect(cleanText('"The Association … "The Serbian Academic Center" Novi Sad"')).toBe(
      'The Association … "The Serbian Academic Center" Novi Sad',
    );
  });
});
