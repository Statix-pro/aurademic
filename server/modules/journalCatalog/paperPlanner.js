import { formatIssn } from './issn.js';
import { indexJournals } from './planner.js';
import { normalizeTitle, titlesMatch } from './values.js';

/**
 * Plans a Scopus export as papers: one outcome per paper, against snapshots of the journal
 * list, the publications already in the portal and the staff Scopus Author IDs on file. Pure,
 * like the journal planner, so its rules are pinned by unit tests.
 *
 * Outcomes:
 *  - `add` — a paper the portal does not have; it is added as an approved publication;
 *  - `update` — the portal has it (same Scopus EID, DOI, or title and year): blank fields are
 *    filled and staff not yet credited are added; nothing a person typed is replaced;
 *  - `unchanged` — the portal already has everything this row would give it;
 *  - `exception` — something a person has to look at first.
 *
 * Staff are credited by Scopus Author ID only. The plan names them for the preview, but the
 * apply step matches again against the IDs on file at that moment.
 */

/** Types filed under a stand-in journal row, as on the publication form. */
const PLACEHOLDER_TYPES = new Set(['Conference paper', 'Book Chapter', 'Book']);

/** Column widths of `journals`; a longer value would be cut, so it is reviewed instead. */
export const FIELD_LIMITS = {
  title: ['Title', 255],
  book_chapter_title: ['Book name', 255],
  volume: ['Volume', 50],
  issue: ['Issue', 50],
  article_number: ['Article number', 50],
  doi: ['DOI', 255],
  pubmed_pmid: ['PubMed ID', 100],
};

/** Fields an import may fill on a publication that already exists — blanks only. */
const FILL_FIELDS = {
  scopus_id: 'Scopus EID',
  doi: 'DOI',
  year: 'Year',
  volume: 'Volume',
  issue: 'Issue',
  article_number: 'Article number',
  pages_from: 'Page from',
  pages_to: 'Page to',
  abstract: 'Abstract',
  keywords: 'Keywords',
  open_access: 'Open access',
  pubmed_pmid: 'PubMed ID',
};

const isEmpty = (value) => value === null || value === undefined || String(value).trim() === '';

export const normalizeDoi = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/, '');

export const titleYearKey = (title, year) => `${normalizeTitle(title)}|${year ?? ''}`;

const preview = (value) => {
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
};

/** Publications already in the portal, by Scopus EID, DOI, and title with year. */
export const indexPublications = (publications) => {
  const byId = new Map();
  const byScopusId = new Map();
  const byDoi = new Map();
  const byTitleYear = new Map();
  for (const publication of publications) {
    byId.set(publication.id, publication);
    if (!isEmpty(publication.scopus_id))
      byScopusId.set(String(publication.scopus_id).trim(), publication.id);
    const doi = normalizeDoi(publication.doi);
    if (doi && !byDoi.has(doi)) byDoi.set(doi, publication.id);
    const key = titleYearKey(publication.title, publication.year);
    if (!byTitleYear.has(key)) byTitleYear.set(key, []);
    byTitleYear.get(key).push(publication.id);
  }
  return { byId, byScopusId, byDoi, byTitleYear };
};

/** The publications row a paper becomes, in the shape the publication form saves. */
const toPublication = (record) => {
  const isConference = record.type === 'Conference paper';
  const publication = {
    title: record.title,
    type: record.type,
    year: record.year ? String(record.year) : null,
    volume: record.volume || null,
    issue: record.issue || null,
    article_number: record.articleNumber || null,
    pages_from: record.pagesFrom,
    pages_to: record.pagesTo,
    doi: record.doi || null,
    abstract: record.abstract || null,
    keywords: record.keywords || null,
    open_access: record.openAccess,
    pubmed_pmid: record.pubmedId || null,
    scopus_id: record.scopusId,
    book_chapter_title: record.type === 'Book Chapter' ? record.sourceTitle || null : null,
    publication_details: null,
  };
  if (PLACEHOLDER_TYPES.has(record.type)) {
    publication.publication_details = {
      conference_title: isConference ? record.conference.name || record.sourceTitle : '',
      source: record.sourceTitle,
      publisher: record.publisher,
      publisher_id: null,
      print_isbn: record.isbn,
      online_isbn: '',
      ...(isConference ? { city: record.conference.city, dates: record.conference.dates } : {}),
    };
  }
  return publication;
};

/**
 * Where the paper is filed. A journal paper goes on its journal in the list, found by ISSN and
 * confirmed by title; a conference paper, book or chapter gets a stand-in row named the way the
 * form names one (the conference, or the work's own title).
 */
const planJournal = (record, journalIndex, issues) => {
  if (PLACEHOLDER_TYPES.has(record.type)) {
    const name =
      record.type === 'Conference paper'
        ? record.conference.name || record.sourceTitle || record.title
        : record.title;
    return { kind: 'placeholder', name: name.slice(0, 255), journalOptionId: null };
  }

  for (const raw of record.invalidIssns) issues.push(`"${raw}" is not a valid ISSN`);
  const owners = new Set();
  for (const { issn } of record.issns) {
    for (const id of journalIndex.byIssn.get(issn) ?? []) owners.add(id);
  }
  const issns = record.issns.map(({ issn }) => issn);
  const notListed = `"${record.sourceTitle}" is not in the journal list — import this file as "KSRCT Scopus export" on the journal list first`;

  if (owners.size > 1) {
    const names = [...owners].map((id) => `"${journalIndex.byId.get(id).journal_name}"`);
    issues.push(`Its ISSN belongs to two journals in the list: ${names.join(' and ')}`);
    return { kind: 'journal', name: record.sourceTitle, issns, journalOptionId: null };
  }
  if (owners.size === 1) {
    const journal = journalIndex.byId.get([...owners][0]);
    if (!titlesMatch(record.sourceTitle, journal.journal_name)) {
      issues.push(
        `Scopus files it in "${record.sourceTitle}", but ISSN ${formatIssn(issns[0])} is on "${journal.journal_name}" in the list`,
      );
    }
    return { kind: 'journal', name: journal.journal_name, issns, journalOptionId: journal.id };
  }
  const sameTitle = journalIndex.byTitle.get(normalizeTitle(record.sourceTitle)) ?? [];
  if (sameTitle.length === 1 && issns.length === 0) {
    const journal = journalIndex.byId.get(sameTitle[0]);
    return { kind: 'journal', name: journal.journal_name, issns, journalOptionId: journal.id };
  }
  issues.push(notListed);
  return { kind: 'journal', name: record.sourceTitle, issns, journalOptionId: null };
};

const findExisting = (record, publicationIndex, issues, notes) => {
  if (record.scopusId && publicationIndex.byScopusId.has(record.scopusId)) {
    return publicationIndex.byId.get(publicationIndex.byScopusId.get(record.scopusId));
  }
  const doi = normalizeDoi(record.doi);
  if (doi && publicationIndex.byDoi.has(doi)) {
    const existing = publicationIndex.byId.get(publicationIndex.byDoi.get(doi));
    if (!isEmpty(existing.scopus_id) && String(existing.scopus_id).trim() !== record.scopusId) {
      issues.push(
        `Publication #${existing.id} has the same DOI but Scopus EID 2-s2.0-${existing.scopus_id}`,
      );
    }
    return existing;
  }
  const sameTitle = publicationIndex.byTitleYear.get(titleYearKey(record.title, record.year)) ?? [];
  if (sameTitle.length > 1) {
    issues.push(`${sameTitle.length} publications in the portal have this title and year`);
    return null;
  }
  if (sameTitle.length === 1) {
    const existing = publicationIndex.byId.get(sameTitle[0]);
    const theirDoi = normalizeDoi(existing.doi);
    if ((theirDoi && doi && theirDoi !== doi) || !isEmpty(existing.scopus_id)) {
      issues.push(
        `Publication #${existing.id} has the same title and year but a different DOI or Scopus EID`,
      );
      return null;
    }
    notes.push(`Matched publication #${existing.id} by title and year`);
    return existing;
  }
  return null;
};

const describeCredit = (authors, employeesByScopusId) => {
  const credited = [];
  for (const author of authors) {
    if (!author.ksrct || !author.scopusAuthorId) continue;
    const employee = employeesByScopusId.get(author.scopusAuthorId);
    if (employee && !credited.some((entry) => entry.id === employee.id)) credited.push(employee);
  }
  return credited;
};

const planPaper = (record, context, seen) => {
  const issues = [...record.issues];
  const notes = [...record.notes];

  const doi = normalizeDoi(record.doi);
  if (doi && seen.byDoi.has(doi)) {
    issues.push(`Same DOI as line ${seen.byDoi.get(doi)} of this file`);
  } else if (doi) {
    seen.byDoi.set(doi, record.line);
  }

  const publication = toPublication(record);
  for (const [column, [label, limit]] of Object.entries(FIELD_LIMITS)) {
    const value = publication[column];
    if (value && String(value).length > limit) {
      issues.push(`${label} is ${String(value).length} characters; the publication holds ${limit}`);
    }
  }

  // A paper already in the portal keeps its own journal, so the file's journal only matters
  // for a paper being added.
  const journalIssues = [];
  const journal = planJournal(record, context.journalIndex, journalIssues);
  const existing = findExisting(record, context.publicationIndex, issues, notes);
  const credited = describeCredit(record.authors, context.employeesByScopusId);
  const ksrctAuthors = record.authors.filter((author) => author.ksrct).length;
  const creditLine = {
    field: 'Credited to',
    from: null,
    to:
      credited.length > 0
        ? credited.map((employee) => employee.name).join(', ')
        : `Unassigned — ${ksrctAuthors} KSRCT author${ksrctAuthors === 1 ? '' : 's'}, none with a Scopus ID on file`,
  };

  const base = {
    journal_option_id: journal.journalOptionId,
    journal_name: record.title,
    credited: credited.length,
  };
  const payloadBase = { journal, authors: record.authors, pubmed: Boolean(record.pubmedId) };

  if (!existing) {
    issues.push(...journalIssues);
    return {
      ...base,
      outcome: issues.length > 0 ? 'exception' : 'add',
      publication_id: null,
      reason: [...issues, ...notes].join('; ') || null,
      payload: { action: 'add', ...payloadBase, publication },
      changes: [
        { field: 'Type', from: null, to: record.type },
        { field: 'Year', from: null, to: record.year },
        {
          field: journal.kind === 'journal' ? 'Journal' : 'Filed under',
          from: null,
          to: journal.name,
        },
        creditLine,
      ],
    };
  }

  const set = {};
  for (const column of Object.keys(FILL_FIELDS)) {
    if (!isEmpty(publication[column]) && isEmpty(existing[column]))
      set[column] = publication[column];
  }
  const linked = new Set(existing.linkedEmployeeIds ?? []);
  const newlyCredited = credited.filter((employee) => !linked.has(employee.id));
  const addsScopusAuthors = !existing.hasScopusAuthors;
  const hasChanges = Object.keys(set).length > 0 || newlyCredited.length > 0 || addsScopusAuthors;

  return {
    ...base,
    journal_option_id: existing.journal_options_id ?? journal.journalOptionId,
    outcome: issues.length > 0 ? 'exception' : hasChanges ? 'update' : 'unchanged',
    publication_id: existing.id,
    reason: [...issues, ...notes].join('; ') || null,
    payload: { action: 'update', ...payloadBase, publicationId: existing.id, set },
    changes: [
      ...Object.entries(set).map(([column, value]) => ({
        field: FILL_FIELDS[column],
        from: null,
        to: preview(value),
      })),
      ...(newlyCredited.length > 0
        ? [
            {
              field: 'Credited to',
              from: null,
              to: newlyCredited.map((employee) => employee.name).join(', '),
            },
          ]
        : []),
    ],
  };
};

/**
 * Plans a whole export. `publications` carry `linkedEmployeeIds` (staff already credited) and
 * `hasScopusAuthors`; `employees` are staff with a Scopus Author ID on file.
 */
export const planPapers = ({ records, journals, publications, employees, excluded = {} }) => {
  const employeesByScopusId = new Map();
  for (const employee of employees) {
    const id = String(employee.scopus_id ?? '').trim();
    if (/^\d{5,15}$/.test(id)) employeesByScopusId.set(id, employee);
  }
  const context = {
    journalIndex: indexJournals(journals),
    publicationIndex: indexPublications(publications),
    employeesByScopusId,
  };

  const seen = { byDoi: new Map() };
  const rows = records.map((record) => ({
    source_row: record.line,
    ...planPaper(record, context, seen),
  }));

  // Counted over the papers being added, so a paper still waiting for review is not reported
  // as credited, and a re-run of a file already applied reports nothing.
  const outcomes = { add: 0, update: 0, unchanged: 0, exception: 0 };
  const papers = { credited: 0, unassigned: 0 };
  for (const row of rows) {
    outcomes[row.outcome] += 1;
    if (row.outcome === 'add') papers[row.credited > 0 ? 'credited' : 'unassigned'] += 1;
  }

  return {
    rows: rows.map(({ credited: _credited, ...row }) => row),
    summary: { outcomes, excluded, papers },
  };
};
