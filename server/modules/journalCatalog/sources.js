import { parseIssn, parseIssnList } from './issn.js';
import {
  cleanText,
  isBlank,
  isKsrctAffiliation,
  parseDecimal,
  parseTypedMetric,
} from './values.js';

/**
 * One profile per file the college supplies. A profile names the columns it needs (by
 * header text, so a reordered or longer file still reads), and turns one row into either a
 * cleaned record or the reason the row was left out.
 *
 * Two kinds:
 *  - `seed` files say which journals KSRCT uses, and may add journals to the list;
 *  - `reference` files (Scopus Source List, SCImago) only enrich journals already in the
 *    list. Their other ~49,000 rows are counted and dropped, never stored.
 */

const column = (headers, { required = false, label } = {}) => ({
  headers: Array.isArray(headers) ? headers : [headers],
  required,
  label: label ?? (Array.isArray(headers) ? headers[0] : headers),
});

const excluded = (reason) => ({ excluded: reason });

/** Why rows were left out, as the preview words it. */
export const EXCLUSION_REASONS = {
  blank: 'Blank row',
  not_journal: 'Not a journal article (conference paper, book or chapter)',
  no_issn: 'Paper has no ISSN (conference volume or book)',
  not_ksrct: 'No KSRCT author affiliation',
  not_in_list: 'Not a KSRCT journal — skipped, not stored',
  not_journal_source: 'Not a journal (book series, conference proceedings, trade journal)',
  retracted: 'Retracted paper',
  erratum: 'Erratum (a correction notice, not a paper)',
  type_not_on_form: 'A document type the publication form has no option for (Letter, Data paper)',
  no_scopus_id: 'No Scopus Author ID given',
};

const readIssns = (cells) => {
  const issns = [];
  const invalidIssns = [];
  const correctedIssns = [];
  for (const [raw, kind] of cells) {
    const parsed = parseIssn(raw);
    if (!parsed) continue;
    if (!parsed.valid) {
      invalidIssns.push(parsed.raw);
      continue;
    }
    if (parsed.corrected) correctedIssns.push(parsed.raw);
    if (!issns.some((entry) => entry.issn === parsed.issn)) issns.push({ issn: parsed.issn, kind });
  }
  return { issns, invalidIssns, correctedIssns };
};

const readLevel = (value) => {
  const text = cleanText(value).toLowerCase();
  if (text === 'national') return 'National';
  if (text === 'international') return 'International';
  return null;
};

const ksrctMaster = {
  key: 'ksrct_master',
  label: 'KSRCT journal master sheet',
  description:
    'The faculty-kept list of KSRCT journals with level, ISSNs, Impact Factor and CiteScore. Choose the year its Impact Factor and CiteScore values belong to.',
  kind: 'seed',
  fileTypes: ['.csv'],
  delimiter: ',',
  metricYear: 'required',
  columns: {
    name: column('Journal Name', { required: true }),
    level: column('Level'),
    publisher: column('Publisher'),
    website: column('Website'),
    printIssn: column('Print ISSN', { required: true }),
    onlineIssn: column(['E ISSN', 'EISSN', 'E-ISSN', 'Online ISSN'], { required: true }),
    impactFactor: column('Impact Factor'),
    citeScore: column(['Cite Score', 'CiteScore']),
  },
  toRecord(values, { metricYear }) {
    const name = cleanText(values.name);
    if (!name) return excluded('blank');

    const issues = [];
    const metrics = [];
    for (const [key, metric, label] of [
      ['impactFactor', 'impact_factor', 'Impact Factor'],
      ['citeScore', 'cite_score', 'CiteScore'],
    ]) {
      const parsed = parseTypedMetric(values[key]);
      if (!parsed.clean) issues.push(`${label} ${parsed.note}`);
      if (parsed.value !== null) {
        metrics.push({
          metric,
          metric_year: parsed.year ?? metricYear,
          source: 'faculty_master',
          value_decimal: parsed.value,
        });
      }
    }

    return {
      name,
      publisher: cleanText(values.publisher),
      website: cleanText(values.website),
      level: readLevel(values.level),
      levelSource: 'faculty',
      ...readIssns([
        [values.printIssn, 'print'],
        [values.onlineIssn, 'online'],
      ]),
      metrics,
      issues,
    };
  },
};

/** Scopus document types that are journal content; everything else is a book or conference. */
const SCOPUS_JOURNAL_TYPES = new Set([
  'article',
  'review',
  'letter',
  'note',
  'editorial',
  'erratum',
  'retracted',
  'data paper',
  'short survey',
]);

const scopusExport = {
  key: 'scopus_export',
  label: 'KSRCT Scopus export',
  description:
    'A CSV export of KSRCT publications from Scopus. Adds the journals KSRCT has published in; the papers themselves are not imported.',
  kind: 'seed',
  fileTypes: ['.csv'],
  delimiter: ',',
  metricYear: null,
  columns: {
    sourceTitle: column('Source title', { required: true }),
    issn: column('ISSN', { required: true }),
    publisher: column('Publisher'),
    documentType: column('Document Type', { required: true }),
    affiliations: column('Affiliations', { required: true }),
  },
  toRecord(values) {
    const name = cleanText(values.sourceTitle);
    if (!name) return excluded('blank');
    if (!SCOPUS_JOURNAL_TYPES.has(cleanText(values.documentType).toLowerCase())) {
      return excluded('not_journal');
    }
    if (!isKsrctAffiliation(values.affiliations)) return excluded('not_ksrct');

    // Scopus exports one ISSN per paper without saying which; the Source List labels it later.
    const issns = readIssns([[values.issn, 'unknown']]);
    // A paper typed "Article" in an IEEE conference volume or a book carries no ISSN; it is
    // not a journal the list should hold.
    if (issns.issns.length === 0 && issns.invalidIssns.length === 0) return excluded('no_issn');

    return {
      name,
      publisher: cleanText(values.publisher),
      website: '',
      level: null,
      levelSource: 'auto',
      ...issns,
      metrics: [],
      issues: [],
    };
  },
};

/**
 * Web of Science "Tab delimited file" export. Its header row uses two-letter field tags
 * (SO, SN, EI, DT, C1); the long names are accepted too, as a saved spreadsheet shows them.
 */
const wosExport = {
  key: 'wos_export',
  label: 'KSRCT Web of Science export',
  description:
    'A Web of Science export of KSRCT publications, saved as "Tab delimited file". Adds the journals KSRCT has published in and marks them Web of Science-indexed.',
  kind: 'seed',
  fileTypes: ['.txt', '.tsv'],
  delimiter: '\t',
  // Tab-delimited exports do not quote fields, and titles contain stray quote marks.
  quote: false,
  metricYear: null,
  columns: {
    sourceTitle: column(['SO', 'Source Title'], { required: true }),
    issn: column(['SN', 'ISSN'], { required: true }),
    eissn: column(['EI', 'eISSN'], { required: true }),
    publisher: column(['PU', 'Publisher']),
    documentType: column(['DT', 'Document Type'], { required: true }),
    addresses: column(['C1', 'Addresses', 'Affiliations']),
  },
  toRecord(values) {
    const name = cleanText(values.sourceTitle);
    if (!name) return excluded('blank');
    const documentType = cleanText(values.documentType).toLowerCase();
    if (!documentType || /proceedings paper|book chapter|meeting abstract/.test(documentType)) {
      return excluded('not_journal');
    }
    // Only checked when the export carries addresses; a search run by organisation already
    // limits the rows to KSRCT, and an export saved without the field would otherwise lose
    // every row.
    if (cleanText(values.addresses) && !isKsrctAffiliation(values.addresses)) {
      return excluded('not_ksrct');
    }
    const issns = readIssns([
      [values.issn, 'print'],
      [values.eissn, 'online'],
    ]);
    if (issns.issns.length === 0 && issns.invalidIssns.length === 0) return excluded('no_issn');

    return {
      name,
      publisher: cleanText(values.publisher),
      website: '',
      level: null,
      levelSource: 'auto',
      ...issns,
      metrics: [],
      issues: [],
      wosIndexed: true,
    };
  },
};

const scopusSourceList = {
  key: 'scopus_source_list',
  label: 'Scopus Source List',
  description:
    'Elsevier\'s monthly title list (ext_list_<Month>_<Year>.xlsx). Updates Scopus status, "discontinued by Scopus", Medline and print/online ISSNs for journals already in the list.',
  kind: 'reference',
  fileTypes: ['.xlsx', '.csv'],
  // The admin screen converts the workbook's main sheet to CSV in the browser.
  workbookSheet: /^Scopus Sources/i,
  delimiter: ',',
  metricYear: null,
  columns: {
    sourceId: column('Sourcerecord ID', { required: true }),
    title: column('Source Title', { required: true }),
    issn: column('ISSN', { required: true }),
    eissn: column('EISSN', { required: true }),
    status: column('Active or Inactive', { required: true }),
    discontinued: column('Titles Discontinued by Scopus', { required: true }),
    medline: column(/^medline-sourced title/, { label: 'Medline-sourced Title?' }),
    publisher: column('Publisher'),
    sourceType: column('Source Type'),
  },
  toRecord(values) {
    const title = cleanText(values.title);
    if (!title) return excluded('blank');
    const status = cleanText(values.status).toLowerCase();

    return {
      sourceId: cleanText(values.sourceId) || null,
      title,
      publisher: cleanText(values.publisher),
      ...readIssns([
        [values.issn, 'print'],
        [values.eissn, 'online'],
      ]),
      set: {
        scopus_status: status === 'active' || status === 'inactive' ? status : null,
        scopus_discontinued: /discontinued/i.test(values.discontinued) ? 1 : 0,
        medline: /medline/i.test(values.medline) ? 1 : 0,
      },
      labelsIssns: true,
      metrics: [],
    };
  },
};

const SCIMAGO_JOURNAL_TYPES = new Set(['journal']);

const scimago = {
  key: 'scimago',
  label: 'SCImago Journal Rank',
  description:
    'The yearly SCImago ranking CSV (scimagojr <year>.csv). Adds quartile, SJR and h-index for that year to journals already in the list. Source: SCImago Journal & Country Rank.',
  kind: 'reference',
  fileTypes: ['.csv'],
  delimiter: ';',
  // The year is in the header ("Total Docs. (2025)"), so it is read rather than asked for.
  metricYear: 'detect',
  detectMetricYear: (headers) => {
    for (const header of headers) {
      const match = String(header).match(/^Total Docs\.\s*\((\d{4})\)$/i);
      if (match) return Number(match[1]);
    }
    return null;
  },
  columns: {
    sourceId: column('Sourceid', { required: true }),
    title: column('Title', { required: true }),
    type: column('Type', { required: true }),
    issn: column('Issn', { required: true }),
    sjr: column('SJR', { required: true }),
    quartile: column('SJR Best Quartile', { required: true }),
    hIndex: column('H index'),
    country: column('Country'),
    publisher: column('Publisher'),
  },
  toRecord(values, { metricYear }) {
    const title = cleanText(values.title);
    if (!title) return excluded('blank');
    if (!SCIMAGO_JOURNAL_TYPES.has(cleanText(values.type).toLowerCase())) {
      return excluded('not_journal_source');
    }

    const metrics = [];
    const sjr = parseDecimal(values.sjr, { decimalComma: true });
    if (sjr.valid && sjr.value !== null) {
      metrics.push({
        metric: 'sjr',
        metric_year: metricYear,
        source: 'scimago',
        value_decimal: sjr.value,
      });
    }
    const quartile = cleanText(values.quartile).toUpperCase();
    if (/^Q[1-4]$/.test(quartile)) {
      metrics.push({
        metric: 'quartile',
        metric_year: metricYear,
        source: 'scimago',
        value_text: quartile,
      });
    }
    const hIndex = parseDecimal(values.hIndex);
    if (hIndex.valid && hIndex.value !== null) {
      metrics.push({
        metric: 'h_index',
        metric_year: metricYear,
        source: 'scimago',
        value_decimal: hIndex.value,
      });
    }

    return {
      sourceId: cleanText(values.sourceId) || null,
      title,
      publisher: cleanText(values.publisher),
      // SCImago lists a journal's ISSNs together without saying which is print.
      issns: parseIssnList(values.issn)
        .filter((entry) => entry.valid)
        .map((entry) => ({ issn: entry.issn, kind: 'unknown' })),
      invalidIssns: [],
      correctedIssns: [],
      set: { country: cleanText(values.country) || null },
      labelsIssns: false,
      metrics,
    };
  },
};

/**
 * Scopus document types as the publication form names them. Retracted papers and errata are
 * left out by the college's decision; Letter and Data paper have no type on the form, so
 * importing them would need a type the paper is not.
 */
const SCOPUS_PAPER_TYPES = {
  article: 'Article',
  review: 'Review',
  editorial: 'Editorial',
  note: 'Note',
  'conference paper': 'Conference paper',
  'book chapter': 'Book Chapter',
  book: 'Book',
};
const SCOPUS_SKIPPED_TYPES = { retracted: 'retracted', erratum: 'erratum' };

const splitList = (value) =>
  String(value ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Scopus gives three parallel lists per paper — full names with author ids, ids alone, and
 * name-plus-affiliation — joined by "; ". They line up by position; when the counts differ the
 * positions cannot be trusted, so no author is taken as KSRCT's and the paper is reviewed.
 */
const readScopusAuthors = (values) => {
  const fullNames = splitList(values.fullNames);
  const ids = splitList(values.authorIds);
  const withAffiliations = splitList(values.withAffiliations);
  const aligned = fullNames.length === ids.length && ids.length === withAffiliations.length;

  const authors = ids.map((id, index) => {
    const name = (fullNames[index] ?? '').replace(/\s*\(\d+\)\s*$/, '').trim();
    return {
      position: index + 1,
      scopusAuthorId: /^\d{5,15}$/.test(id) ? id : null,
      name: name || id,
      ksrct: aligned && isKsrctAffiliation(withAffiliations[index]),
      affiliation: aligned ? (withAffiliations[index] ?? '') : '',
    };
  });

  return {
    authors,
    issue: aligned
      ? null
      : `Scopus lists ${ids.length} author ids but ${withAffiliations.length} affiliations, so KSRCT's authors cannot be told apart`,
  };
};

const pageNumber = (value) => {
  const text = cleanText(value);
  return /^\d{1,9}$/.test(text) ? Number(text) : null;
};

const scopusPapers = {
  key: 'scopus_papers',
  label: 'KSRCT Scopus export — papers',
  description:
    'The same Scopus CSV export, read for KSRCT\'s papers. Each paper is added as an approved publication and credited to the staff whose Scopus Author ID is on file; papers with none are kept unassigned until an ID is added. Import the file as "KSRCT Scopus export" on the journal list first, so every journal is there.',
  kind: 'papers',
  fileTypes: ['.csv'],
  delimiter: ',',
  metricYear: null,
  columns: {
    fullNames: column('Author full names', { required: true }),
    authorIds: column('Author(s) ID', { required: true }),
    withAffiliations: column('Authors with affiliations', { required: true }),
    title: column('Title', { required: true }),
    year: column('Year', { required: true }),
    sourceTitle: column('Source title', { required: true }),
    volume: column('Volume'),
    issue: column('Issue'),
    articleNumber: column('Art. No.'),
    pageStart: column('Page start'),
    pageEnd: column('Page end'),
    doi: column('DOI'),
    abstract: column('Abstract'),
    keywords: column('Author Keywords'),
    publisher: column('Publisher'),
    conferenceName: column('Conference name'),
    conferenceDate: column('Conference date'),
    conferenceLocation: column('Conference location'),
    issn: column('ISSN', { required: true }),
    isbn: column('ISBN'),
    pubmedId: column('PubMed ID'),
    documentType: column('Document Type', { required: true }),
    openAccess: column('Open Access'),
    eid: column('EID', { required: true }),
  },
  toRecord(values) {
    const title = cleanText(values.title);
    if (!title) return excluded('blank');

    const scopusType = cleanText(values.documentType).toLowerCase();
    if (SCOPUS_SKIPPED_TYPES[scopusType]) return excluded(SCOPUS_SKIPPED_TYPES[scopusType]);
    const type = SCOPUS_PAPER_TYPES[scopusType];
    if (!type) return excluded('type_not_on_form');

    const { authors, issue: authorIssue } = readScopusAuthors(values);
    // Rows whose author lists do not line up are kept for review rather than read as non-KSRCT.
    if (!authorIssue && !authors.some((author) => author.ksrct)) return excluded('not_ksrct');

    const issues = authorIssue ? [authorIssue] : [];
    const notes = [];
    // The publication form stores the EID without Scopus's "2-s2.0-" prefix.
    const eid = cleanText(values.eid).match(/^2-s2\.0-(\d+)$/);
    if (!eid) issues.push(`"${cleanText(values.eid)}" is not a Scopus EID`);

    const pageStart = cleanText(values.pageStart);
    const pageEnd = cleanText(values.pageEnd);
    const pagesFrom = pageNumber(pageStart);
    const pagesTo = pageNumber(pageEnd);
    if ((pageStart && pagesFrom === null) || (pageEnd && pagesTo === null)) {
      notes.push(`Pages "${[pageStart, pageEnd].filter(Boolean).join('–')}" are not plain numbers`);
    }

    const year = Number.parseInt(cleanText(values.year), 10);
    const isbn = cleanText(values.isbn).split(';')[0]?.trim() ?? '';

    return {
      scopusId: eid ? eid[1] : null,
      type,
      title,
      year: Number.isInteger(year) ? year : null,
      sourceTitle: cleanText(values.sourceTitle),
      publisher: cleanText(values.publisher),
      ...readIssns([[values.issn, 'unknown']]),
      isbn,
      conference: {
        name: cleanText(values.conferenceName),
        dates: cleanText(values.conferenceDate),
        city: cleanText(values.conferenceLocation),
      },
      volume: cleanText(values.volume),
      issue: cleanText(values.issue),
      articleNumber: cleanText(values.articleNumber),
      pagesFrom,
      pagesTo,
      doi: cleanText(values.doi),
      abstract: cleanText(values.abstract),
      keywords: splitList(values.keywords).join('; '),
      openAccess: cleanText(values.openAccess) ? 'Yes' : 'No',
      pubmedId: cleanText(values.pubmedId),
      authors,
      issues,
      notes,
    };
  },
};

/** A Scopus Author ID as people paste it: the number, or a Scopus profile link that carries it. */
const readScopusAuthorIds = (value) => {
  const ids = [];
  const invalid = [];
  for (const part of String(value ?? '').split(/[;,\s]+/)) {
    const text = part.trim();
    if (!text || isBlank(text)) continue;
    const id = text.match(/authorId=(\d+)/i)?.[1] ?? text;
    if (/^\d{5,15}$/.test(id)) {
      if (!ids.includes(id)) ids.push(id);
    } else {
      invalid.push(text);
    }
  }
  return { ids, invalid };
};

const staffScopusIds = {
  key: 'staff_scopus_ids',
  label: 'Staff Scopus Author IDs',
  description:
    'A sheet with an "ERP ID" and a "Scopus Author ID" column, one staff member per row. Several IDs can go in one cell, separated by ";" — Scopus often splits one person over two profiles. Each ID is added to the staff member, and the imported papers it appears on as a KSRCT author are credited to them straight away.',
  kind: 'staff',
  fileTypes: ['.csv', '.xlsx'],
  delimiter: ',',
  metricYear: null,
  columns: {
    erpId: column('ERP ID', { required: true }),
    scopusIds: column('Scopus Author ID', { required: true }),
  },
  toRecord(values) {
    const erpId = cleanText(values.erpId);
    const { ids, invalid } = readScopusAuthorIds(values.scopusIds);
    if (!erpId && ids.length === 0 && invalid.length === 0) return excluded('blank');
    if (ids.length === 0 && invalid.length === 0) return excluded('no_scopus_id');
    return { erpId, scopusIds: ids, invalidIds: invalid };
  },
};

export const SOURCES = Object.fromEntries(
  [
    ksrctMaster,
    scopusExport,
    wosExport,
    scopusSourceList,
    scimago,
    scopusPapers,
    staffScopusIds,
  ].map((source) => [source.key, source]),
);

export const getSource = (key) => SOURCES[key] ?? null;

/** What the admin screen needs to offer each source, without the row logic. */
export const describeSources = () =>
  Object.values(SOURCES).map((source) => ({
    key: source.key,
    label: source.label,
    description: source.description,
    kind: source.kind,
    fileTypes: source.fileTypes,
    needsMetricYear: source.metricYear === 'required',
    workbookSheet: source.workbookSheet ? source.workbookSheet.source : null,
    requiredColumns: Object.values(source.columns)
      .filter((spec) => spec.required)
      .map((spec) => String(spec.label)),
  }));
