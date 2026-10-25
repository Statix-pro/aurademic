/**
 * Cell readers shared by every source profile. Each one is strict about what it accepts and
 * says why it refused, because a refused value becomes an exception an admin reads.
 */

// Dashes of every width mean "none" in hand-kept sheets.
const BLANK = new Set(['', '-', '--', '–', '—', 'NA', 'N/A', 'NIL', 'NULL', 'NONE']);

export const isBlank = (value) =>
  BLANK.has(
    String(value ?? '')
      .trim()
      .toUpperCase(),
  );

/**
 * Trimmed text with runs of whitespace collapsed. SCImago does not escape quotes inside a
 * quoted field, so a lenient parse leaves that field wrapped in its own quotes; one wrapping
 * pair is removed.
 */
export const cleanText = (value) => {
  let text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > 1 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim();
  }
  return isBlank(text) ? '' : text;
};

/**
 * A plain decimal. SCImago writes `104,065` for 104.065, so `decimalComma` swaps the
 * separator; anything left that is not a number is reported as invalid, not guessed at.
 */
export const parseDecimal = (value, { decimalComma = false } = {}) => {
  if (isBlank(value)) return { value: null, valid: true };
  let text = String(value).trim();
  if (decimalComma) text = text.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return { value: null, valid: false };
  return { value: Number(text), valid: true };
};

/**
 * A metric typed by a person, e.g. the faculty sheet's Impact Factor column. Most cells
 * are a plain number; the rest are notes such as `8.1 (JCR, 2023)` or ranges such as
 * `1.5-1.9`. A note's leading number and year are offered back, but flagged unclean so an
 * admin confirms them; a range has no single value and is never collapsed into one.
 */
export const parseTypedMetric = (value) => {
  if (isBlank(value)) return { value: null, year: null, clean: true };

  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    return { value: Number(text), year: null, clean: true };
  }

  if (/^\d+(\.\d+)?\s*[-–]\s*\d+(\.\d+)?$/.test(text)) {
    return { value: null, year: null, clean: false, note: `"${text}" is a range, not one value` };
  }

  const leading = text.match(/^(\d+(?:\.\d+)?)/);
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  return {
    value: leading ? Number(leading[1]) : null,
    year: yearMatch ? Number(yearMatch[0]) : null,
    clean: false,
    note: `"${text}" is not a plain number`,
  };
};

/** Lower-case words with punctuation, `&` and the word "the" folded away. */
export const normalizeTitle = (title) =>
  String(title ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && word !== 'the')
    .join(' ');

const SUBTITLE_SEPARATOR = /\s*:\s*|\s+[-–—]\s+/;

/**
 * Splits a title into its main part, its bracketed parts and its subtitle, each normalised:
 * "Journal of Optics (India)" → main "journal of optics", brackets "india".
 */
const titleParts = (text) => {
  const brackets = normalizeTitle((text.match(/\(([^)]*)\)/g) ?? []).join(' '));
  const [main, ...rest] = text.replace(/\([^)]*\)/g, ' ').split(SUBTITLE_SEPARATOR);
  return { main: normalizeTitle(main), brackets, subtitle: normalizeTitle(rest.join(' ')) };
};

/**
 * Every way a title may be written. A slash separates alternative titles
 * ("Materialpruefung/Materials Testing"), each read on its own. Web of Science also appends a
 * qualifier after a bare hyphen ("BIOFUELS-UK", "CLUSTER COMPUTING-THE JOURNAL OF NETWORKS…"),
 * so that reading is offered too — only when what precedes the hyphen is at least two words,
 * which keeps "Geo-Marine" or "Non-Linear" whole.
 */
const titleVariants = (title) => {
  const variants = [];
  for (const alternative of String(title ?? '').split(/\s*\/\s*/)) {
    variants.push(titleParts(alternative));
    const bareHyphen = alternative.match(/^(.*?\S)-(\S.*)$/);
    if (bareHyphen && normalizeTitle(bareHyphen[1]).split(' ').length >= 2) {
      const qualified = titleParts(bareHyphen[1]);
      variants.push({
        ...qualified,
        subtitle: normalizeTitle(`${qualified.subtitle} ${bareHyphen[2]}`),
      });
    }
  }
  return variants.filter((variant) => variant.main);
};

/**
 * What qualifies the main title — its bracketed part and subtitle together, since the same
 * qualifier is written "(India)" by Scopus and "-INDIA" by Web of Science. Two titles agree
 * when either has none, or both have the same.
 */
const qualifier = (parts) => `${parts.brackets} ${parts.subtitle}`.trim();

const qualifiersAgree = (left, right) =>
  !qualifier(left) || !qualifier(right) || qualifier(left) === qualifier(right);

/**
 * Whether two titles name the same journal. Deliberately strict: in the real KSRCT data
 * "Materials Research" / "Materials Research Express" and "Journal of Plant Biotechnology" /
 * "Plant Biotechnology Journal" are different journals that any similarity score calls
 * near-identical, and a wrong ISSN in a hand-kept sheet would then attach another journal's
 * metrics. Titles match only when their main parts are the same and, if both carry a
 * qualifier (subtitle or bracketed part), it is the same — so "Journal of Optics" / "Journal
 * of Optics (India)", "JOURNAL OF OPTICS-INDIA" / "Journal of Optics (India)" and "Heat and
 * Mass Transfer" / "Heat and Mass Transfer/Waerme- und Stoffuebertragung" match, but "Journal
 * of Optics (India)" / "Journal of Optics (United Kingdom)" and "…(India): Series M" /
 * "…(India): Series S" do not. A renamed journal ("SN Applied Sciences" → "Discover Applied
 * Sciences") does not match either, and is left for a person.
 */
export const titlesMatch = (left, right) => {
  const fullLeft = normalizeTitle(left);
  const fullRight = normalizeTitle(right);
  if (!fullLeft || !fullRight) return false;
  if (fullLeft === fullRight) return true;

  const rightVariants = titleVariants(right);
  return titleVariants(left).some((a) =>
    rightVariants.some((b) => a.main === b.main && qualifiersAgree(a, b)),
  );
};

/**
 * KSRCT's own affiliation, as authors actually spell it in Scopus and Web of Science:
 * "K.S. Rangasamy College of Technology", "KSR College of Technology", "KSRCT", and the
 * misspellings found in the real export ("Rengasamy", "Ranagasamy", "Collage", "coll of
 * Tech", "Rangasamy, College Of Technology"). Sister institutions — K.S.R. College of Arts
 * and Science, K.S.R. College of Engineering, K.S. Rangasamy Institute of Technology — are
 * not KSRCT and never match, because none of them is a college of technology.
 */
const KSRCT_AFFILIATIONS = [
  /\bksrct\b/i,
  /r[ae]n?a?gasamy[\s,]*col{1,2}\w*\.?\s+(?:of\s+)?tech/i,
  /\bk\.?\s*s\.?\s*ramasamy[\s,]+col{1,2}\w*\.?\s+(?:of\s+)?tech/i,
  /\bk\.?\s*s\.?\s*r\.?[\s,]*col{1,2}\w*\.?\s+(?:of\s+)?tech/i,
];

export const isKsrctAffiliation = (text) =>
  KSRCT_AFFILIATIONS.some((pattern) => pattern.test(String(text ?? '')));
