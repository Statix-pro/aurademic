import { formatIssn, storedIssn } from './issn.js';
import { normalizeTitle, titlesMatch } from './values.js';

/**
 * Turns a file's cleaned records into one planned outcome per journal, against a snapshot of
 * the journal list. Pure: no database, so every rule here is pinned by unit tests.
 *
 * Outcomes:
 *  - `add` / `update` / `unchanged` apply without anyone looking at them;
 *  - `exception` carries a proposal plus the reason a person has to confirm it — a wrong or
 *    shared ISSN, a title that disagrees with the ISSN's journal, a value typed as text.
 *
 * Field rules (the same for every file):
 *  - the journal's name is never changed by an import;
 *  - publisher, website and ISSNs only fill blanks — a person's value is never replaced;
 *  - Scopus status, Medline, Web of Science and country are owned by their file and
 *    overwritten each time;
 *  - National/International follows `admin > faculty sheet > auto`; an `auto` default never
 *    changes an existing journal;
 *  - metrics are kept per year and source, so a new year is added beside the old one.
 */

const LEVEL_RANK = { auto: 1, faculty: 2, admin: 3 };

const FIELD_LABELS = {
  publisher: 'Publisher',
  website: 'Website',
  print_issn: 'Print ISSN',
  online_issn: 'Online ISSN',
  category: 'Level',
  scopus_source_id: 'Scopus source ID',
  scopus_status: 'Scopus status',
  scopus_discontinued: 'Discontinued by Scopus',
  medline: 'Medline',
  wos_indexed: 'Web of Science',
  country: 'Country',
};

const METRIC_LABELS = {
  impact_factor: 'Impact Factor',
  cite_score: 'CiteScore',
  sjr: 'SJR',
  quartile: 'Quartile',
  h_index: 'h-index',
};

export const metricKey = (metric) => `${metric.metric}|${metric.metric_year}|${metric.source}`;

const metricValue = (metric) => metric.value_text ?? metric.value_decimal ?? null;

const isEmpty = (value) => value === null || value === undefined || String(value).trim() === '';

/** Indexes the journal list by ISSN, Scopus source id and title; placeholders are not journals. */
export const indexJournals = (journals) => {
  const byIssn = new Map();
  const bySourceId = new Map();
  const byTitle = new Map();
  const byId = new Map();

  for (const journal of journals) {
    if (journal.is_placeholder) continue;
    byId.set(journal.id, journal);
    for (const issn of [storedIssn(journal.print_issn), storedIssn(journal.online_issn)]) {
      if (!issn) continue;
      if (!byIssn.has(issn)) byIssn.set(issn, new Set());
      byIssn.get(issn).add(journal.id);
    }
    if (journal.scopus_source_id) bySourceId.set(String(journal.scopus_source_id), journal.id);
    const title = normalizeTitle(journal.journal_name);
    if (title) {
      if (!byTitle.has(title)) byTitle.set(title, []);
      byTitle.get(title).push(journal.id);
    }
  }

  return { byIssn, bySourceId, byTitle, byId };
};

const journalIssns = (journal) =>
  [storedIssn(journal.print_issn), storedIssn(journal.online_issn)].filter(Boolean);

const ownersOf = (index, issns) => {
  const owners = new Set();
  for (const { issn } of issns) {
    for (const id of index.byIssn.get(issn) ?? []) owners.add(id);
  }
  return [...owners];
};

/**
 * Seed files list papers or journals; several rows can be one journal. Rows that share an
 * ISSN are merged when their titles agree. When they disagree, someone put one journal's
 * ISSN on another, and both rows are flagged rather than guessing which is right.
 */
const groupSeedRecords = (records) => {
  const groups = [];
  const groupByIssn = new Map();
  const groupByTitle = new Map();

  for (const record of records) {
    const sharedGroups = new Set(
      record.issns.map(({ issn }) => groupByIssn.get(issn)).filter((group) => group),
    );
    let target = null;
    let conflicted = false;
    const issues = [...record.issues];

    for (const group of sharedGroups) {
      if (titlesMatch(group.name, record.name)) {
        target ??= group;
      } else {
        const shared = record.issns.find(({ issn }) => groupByIssn.get(issn) === group);
        const issn = formatIssn(shared.issn);
        group.issues.add(`ISSN ${issn} is also given for "${record.name}" (line ${record.line})`);
        issues.push(`ISSN ${issn} is also given for "${group.name}" (line ${group.line})`);
        conflicted = true;
      }
    }
    if (conflicted) target = null;

    if (!target && !conflicted && record.issns.length === 0) {
      target = groupByTitle.get(normalizeTitle(record.name)) ?? null;
    }

    if (!target) {
      target = {
        line: record.line,
        name: record.name,
        publisher: record.publisher,
        website: record.website,
        level: record.level,
        levelSource: record.levelSource,
        issns: [],
        invalidIssns: [...record.invalidIssns],
        correctedIssns: [...record.correctedIssns],
        metrics: [...record.metrics],
        issues: new Set(issues),
        wosIndexed: Boolean(record.wosIndexed),
        rowCount: 0,
        conflicted,
      };
      groups.push(target);
      if (record.issns.length === 0) groupByTitle.set(normalizeTitle(record.name), target);
    } else {
      target.publisher ||= record.publisher;
      target.website ||= record.website;
      target.level ??= record.level;
      target.invalidIssns.push(...record.invalidIssns);
      target.correctedIssns.push(...record.correctedIssns);
      target.wosIndexed ||= Boolean(record.wosIndexed);
      for (const issue of issues) target.issues.add(issue);
      const known = new Set(target.metrics.map(metricKey));
      target.metrics.push(...record.metrics.filter((metric) => !known.has(metricKey(metric))));
    }

    target.rowCount += 1;
    for (const entry of record.issns) {
      // A conflicting record keeps its ISSN off the shared index so the next row with that
      // ISSN still joins the journal it was first seen with.
      if (!target.issns.some(({ issn }) => issn === entry.issn)) target.issns.push(entry);
      if (!target.conflicted && !groupByIssn.has(entry.issn)) groupByIssn.set(entry.issn, target);
    }
  }

  return groups;
};

/**
 * Whether a level from `incoming` may replace one set by `current`. An admin always may; an
 * import's `auto` default never changes an existing journal; otherwise the faculty sheet may
 * set or refresh what nobody, or only the default, decided.
 */
export const canSetLevel = (current, incoming) => {
  if (incoming === 'admin') return true;
  if (incoming === 'auto' || current === 'admin') return false;
  return (LEVEL_RANK[incoming] ?? 0) >= (LEVEL_RANK[current] ?? 0);
};

const levelChange = (journal, level, levelSource) => {
  if (!level || !canSetLevel(journal.level_source, levelSource)) return null;
  if (journal.category === level && journal.level_source === levelSource) return null;
  return { column: 'category', value: level, mode: 'level', levelSource };
};

/** Metric rows that are new or carry a different value than the journal already has. */
const changedMetrics = (journal, metrics) =>
  metrics.filter((metric) => {
    const existing = journal?.metrics?.[metricKey(metric)];
    return existing === undefined || String(existing) !== String(metricValue(metric));
  });

const describeMetricChanges = (journal, metrics) =>
  metrics.map((metric) => ({
    field: `${METRIC_LABELS[metric.metric]} ${metric.metric_year}`,
    from: journal?.metrics?.[metricKey(metric)] ?? null,
    to: metricValue(metric),
  }));

/** Flags stored as 0/1, shown to the admin as Yes/No. */
const YES_NO_COLUMNS = new Set(['scopus_discontinued', 'medline', 'wos_indexed']);

const displayValue = (column, value) => {
  if (value === null || value === undefined) return null;
  return YES_NO_COLUMNS.has(column) ? (Number(value) ? 'Yes' : 'No') : value;
};

const describeSetChanges = (journal, set) =>
  set.map((change) => ({
    field: FIELD_LABELS[change.column] ?? change.column,
    from: journal ? displayValue(change.column, journal[change.column]) : null,
    to: displayValue(change.column, change.value),
  }));

/**
 * Where a journal's new ISSNs go. Blanks only; an ISSN already on another journal in the
 * list is an exception, because one ISSN cannot be two journals.
 */
const issnFills = (journal, issns, index, issues) => {
  const set = [];
  const current = { print_issn: journal.print_issn, online_issn: journal.online_issn };
  const has = new Set(journalIssns(journal));

  for (const { issn, kind } of issns) {
    if (has.has(issn)) continue;
    const owners = [...(index.byIssn.get(issn) ?? [])].filter((id) => id !== journal.id);
    if (owners.length > 0) {
      const other = index.byId.get(owners[0]);
      issues.push(
        `ISSN ${formatIssn(issn)} is already on "${other.journal_name}" in the journal list`,
      );
      continue;
    }
    const slot =
      kind === 'online'
        ? 'online_issn'
        : kind === 'print'
          ? 'print_issn'
          : isEmpty(current.print_issn)
            ? 'print_issn'
            : 'online_issn';
    if (isEmpty(current[slot])) {
      current[slot] = formatIssn(issn);
      has.add(issn);
      set.push({ column: slot, value: formatIssn(issn), mode: 'fill' });
    }
  }
  return set;
};

const correctionNote = (group) =>
  group.correctedIssns.length > 0
    ? `Restored a dropped leading zero in ISSN ${[...new Set(group.correctedIssns)].join(', ')}`
    : null;

const planSeedGroup = (group, index) => {
  const issues = [...group.issues];
  for (const raw of new Set(group.invalidIssns)) issues.push(`"${raw}" is not a valid ISSN`);
  if (group.issns.length === 0) {
    issues.push('No valid ISSN, so the journal cannot be checked against Scopus or Web of Science');
  }

  let journal = null;
  const owners = ownersOf(index, group.issns);
  if (owners.length > 1) {
    const names = owners.map((id) => `"${index.byId.get(id).journal_name}"`).join(' and ');
    issues.push(`Its ISSNs belong to two journals in the list: ${names}`);
  } else if (owners.length === 1) {
    journal = index.byId.get(owners[0]);
    if (!titlesMatch(group.name, journal.journal_name)) {
      issues.push(`Its ISSN is on "${journal.journal_name}" in the journal list`);
    }
  } else {
    const sameTitle = index.byTitle.get(normalizeTitle(group.name)) ?? [];
    if (sameTitle.length > 1) {
      issues.push(`${sameTitle.length} journals in the list already have this name`);
    } else if (sameTitle.length === 1) {
      journal = index.byId.get(sameTitle[0]);
      if (journalIssns(journal).length > 0 && group.issns.length > 0) {
        const theirs = journalIssns(journal).map(formatIssn).join(', ');
        issues.push(`"${journal.journal_name}" is already in the list with ISSN ${theirs}`);
      }
    }
  }

  const notes = [correctionNote(group)].filter(Boolean);
  const issnList = group.issns.map(({ issn }) => issn);

  if (!journal) {
    const print = group.issns.find(({ kind }) => kind === 'print') ?? null;
    const online = group.issns.find(({ kind }) => kind === 'online') ?? null;
    const unknown = group.issns.filter(({ kind }) => kind === 'unknown');
    const printIssn = print?.issn ?? unknown.shift()?.issn ?? null;
    const onlineIssn = online?.issn ?? unknown.shift()?.issn ?? null;
    const create = {
      journal_name: group.name,
      publisher: group.publisher,
      website: group.website,
      print_issn: formatIssn(printIssn),
      online_issn: formatIssn(onlineIssn),
      category: group.level ?? 'International',
      level_source: group.level ? group.levelSource : 'auto',
      wos_indexed: group.wosIndexed ? 1 : 0,
    };
    return {
      outcome: issues.length > 0 ? 'exception' : 'add',
      journal_option_id: null,
      journal_name: group.name,
      reason: [...issues, ...notes].join('; ') || null,
      payload: { action: 'add', issns: issnList, create, metrics: group.metrics },
      changes: [
        ...Object.entries(create)
          .filter(([column, value]) => FIELD_LABELS[column] && !isEmpty(value) && value !== 0)
          .map(([column, value]) => ({
            field: FIELD_LABELS[column],
            from: null,
            to: displayValue(column, value),
          })),
        ...describeMetricChanges(null, group.metrics),
      ],
    };
  }

  const set = [];
  for (const column of ['publisher', 'website']) {
    if (!isEmpty(group[column]) && isEmpty(journal[column])) {
      set.push({ column, value: group[column], mode: 'fill' });
    }
  }
  set.push(...issnFills(journal, group.issns, index, issues));
  const level = levelChange(journal, group.level, group.levelSource);
  if (level) set.push(level);
  if (group.wosIndexed && !journal.wos_indexed) {
    set.push({ column: 'wos_indexed', value: 1, mode: 'overwrite' });
  }
  const metrics = changedMetrics(journal, group.metrics);

  const hasChanges = set.length > 0 || metrics.length > 0;
  return {
    outcome: issues.length > 0 ? 'exception' : hasChanges ? 'update' : 'unchanged',
    journal_option_id: journal.id,
    // An exception is read against the file, so it carries the file's name; the reason says
    // which journal in the list it collided with.
    journal_name: issues.length > 0 ? group.name : journal.journal_name,
    reason: [...issues, ...notes].join('; ') || null,
    payload: { action: 'update', journalOptionId: journal.id, issns: issnList, set, metrics },
    changes: [...describeSetChanges(journal, set), ...describeMetricChanges(journal, metrics)],
  };
};

/**
 * Scopus labels print and online ISSNs; when every ISSN the journal already has is one of
 * Scopus's, its two fields are set exactly as Scopus says — filling, swapping, or emptying a
 * slot Scopus has no ISSN for. Emptying never loses an ISSN: every one the journal holds is
 * one Scopus lists, so a cleared value is the copy Scopus files under the other kind. That is
 * the case of an ISSN a publication export left unlabelled and the import put under print,
 * which Scopus lists as online only — without clearing, the journal showed it twice.
 */
const issnLabels = (journal, record) => {
  const theirs = new Set(record.issns.map(({ issn }) => issn));
  if (!journalIssns(journal).every((issn) => theirs.has(issn))) return null;
  const set = [];
  for (const [kind, column] of [
    ['print', 'print_issn'],
    ['online', 'online_issn'],
  ]) {
    const wanted = record.issns.find((issn) => issn.kind === kind)?.issn ?? null;
    if (storedIssn(journal[column]) !== wanted) {
      set.push({ column, value: formatIssn(wanted), mode: 'overwrite' });
    }
  }
  return set;
};

const planReferenceRecord = (record, index, claimed) => {
  const issues = [];
  let journal = null;
  let matchedById = false;

  if (record.sourceId && index.bySourceId.has(record.sourceId)) {
    journal = index.byId.get(index.bySourceId.get(record.sourceId));
    matchedById = true;
  } else {
    const owners = ownersOf(index, record.issns);
    if (owners.length === 0) return null;
    if (owners.length > 1) {
      const names = owners.map((id) => `"${index.byId.get(id).journal_name}"`).join(' and ');
      issues.push(`Its ISSNs belong to two journals in the list: ${names}`);
      journal = index.byId.get(owners[0]);
    } else {
      journal = index.byId.get(owners[0]);
    }
  }

  if (!matchedById) {
    if (!titlesMatch(record.title, journal.journal_name)) {
      issues.push(`This file lists its ISSN as "${record.title}"`);
    }
    if (
      journal.scopus_source_id &&
      record.sourceId &&
      String(journal.scopus_source_id) !== record.sourceId
    ) {
      issues.push(`Already linked to a different Scopus source (${journal.scopus_source_id})`);
    }
  }
  if (claimed.has(journal.id)) {
    issues.push(`Also matched by line ${claimed.get(journal.id)} of this file`);
  } else {
    claimed.set(journal.id, record.line);
  }

  const set = [];
  if (record.sourceId && isEmpty(journal.scopus_source_id)) {
    set.push({ column: 'scopus_source_id', value: record.sourceId, mode: 'fill' });
  }
  for (const [column, value] of Object.entries(record.set)) {
    if (value !== null && value !== undefined && String(journal[column] ?? '') !== String(value)) {
      set.push({ column, value, mode: 'overwrite' });
    }
  }
  if (!isEmpty(record.publisher) && isEmpty(journal.publisher)) {
    set.push({ column: 'publisher', value: record.publisher, mode: 'fill' });
  }
  const labels = record.labelsIssns ? issnLabels(journal, record) : null;
  set.push(...(labels ?? issnFills(journal, record.issns, index, issues)));
  const metrics = changedMetrics(journal, record.metrics);

  const hasChanges = set.length > 0 || metrics.length > 0;
  return {
    outcome: issues.length > 0 ? 'exception' : hasChanges ? 'update' : 'unchanged',
    journal_option_id: journal.id,
    journal_name: journal.journal_name,
    reason: issues.join('; ') || null,
    payload: {
      action: 'update',
      journalOptionId: journal.id,
      issns: record.issns.map(({ issn }) => issn),
      set,
      metrics,
      referenceChecked: true,
    },
    changes: [...describeSetChanges(journal, set), ...describeMetricChanges(journal, metrics)],
  };
};

/**
 * Plans a whole file. `records` are profile outputs tagged with their line; `excluded` is the
 * count of rows the profile left out, by reason.
 */
export const planImport = ({ source, records, journals, excluded = {} }) => {
  const index = indexJournals(journals);
  const rows = [];
  const dropped = { ...excluded };

  if (source.kind === 'seed') {
    for (const group of groupSeedRecords(records)) {
      rows.push({ source_row: group.line, ...planSeedGroup(group, index) });
    }
  } else {
    const claimed = new Map();
    for (const record of records) {
      const planned = planReferenceRecord(record, index, claimed);
      if (!planned) {
        dropped.not_in_list = (dropped.not_in_list ?? 0) + 1;
        continue;
      }
      rows.push({ source_row: record.line, ...planned });
    }
  }

  const outcomes = { add: 0, update: 0, unchanged: 0, exception: 0 };
  for (const row of rows) outcomes[row.outcome] += 1;

  const summary = { outcomes, excluded: dropped };
  if (source.kind === 'reference') {
    const matched = new Set(rows.map((row) => row.journal_option_id));
    summary.journalsNotInFile = [...index.byId.keys()].filter((id) => !matched.has(id)).length;
  }
  return { rows, summary };
};
