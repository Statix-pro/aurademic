/**
 * The planner decides, per journal, what an import does to the KSRCT journal list without a
 * person looking — so these pin its rules: an import never replaces a value a person typed,
 * never overrides an admin's National/International, keeps every metric year beside the old
 * ones, and turns anything it cannot be sure of (a shared or mismatched ISSN) into an
 * exception instead of guessing.
 */

import { describe, expect, it } from 'vitest';

import { canSetLevel, planImport } from '../modules/journalCatalog/planner.js';
import { getSource } from '../modules/journalCatalog/sources.js';

const MASTER = getSource('ksrct_master');
const SCOPUS_EXPORT = getSource('scopus_export');
const SCIMAGO = getSource('scimago');
const SOURCE_LIST = getSource('scopus_source_list');

const journal = (overrides = {}) => ({
  id: 1,
  journal_name: '3 Biotech',
  publisher: '',
  website: '',
  print_issn: '2190-572X',
  online_issn: '',
  scopus_source_id: null,
  scopus_status: null,
  scopus_discontinued: 0,
  medline: 0,
  wos_indexed: 0,
  country: null,
  category: 'National',
  level_source: null,
  is_placeholder: 0,
  metrics: {},
  ...overrides,
});

const seedRecord = (overrides = {}) => ({
  line: 2,
  name: '3 Biotech',
  publisher: 'Springer Nature',
  website: '',
  level: 'International',
  levelSource: 'faculty',
  issns: [
    { issn: '2190572X', kind: 'print' },
    { issn: '21905738', kind: 'online' },
  ],
  invalidIssns: [],
  correctedIssns: [],
  metrics: [],
  issues: [],
  ...overrides,
});

const referenceRecord = (overrides = {}) => ({
  line: 5,
  sourceId: '21100000001',
  title: '3 Biotech',
  publisher: 'Springer',
  issns: [{ issn: '2190572X', kind: 'unknown' }],
  invalidIssns: [],
  correctedIssns: [],
  set: { country: 'Germany' },
  labelsIssns: false,
  metrics: [],
  ...overrides,
});

const plan = (source, records, journals) => planImport({ source, records, journals });

describe('seed files', () => {
  it('adds a journal that is not in the list, defaulting its level when the file has none', () => {
    const { rows, summary } = plan(
      SCOPUS_EXPORT,
      [seedRecord({ level: null, levelSource: 'auto' })],
      [],
    );

    expect(summary.outcomes).toEqual({ add: 1, update: 0, unchanged: 0, exception: 0 });
    expect(rows[0].payload.create).toMatchObject({
      journal_name: '3 Biotech',
      print_issn: '2190-572X',
      online_issn: '2190-5738',
      category: 'International',
      level_source: 'auto',
    });
  });

  it('only fills blanks: a publisher someone typed is never replaced', () => {
    const { rows } = plan(MASTER, [seedRecord()], [journal({ publisher: 'Springer' })]);
    const columns = rows[0].payload.set.map((change) => change.column);

    expect(columns).not.toContain('publisher');
    expect(columns).toContain('online_issn');
  });

  it('never changes a level an admin set', () => {
    const { rows } = plan(
      MASTER,
      [seedRecord()],
      [journal({ category: 'National', level_source: 'admin' })],
    );
    expect(rows[0].payload.set.find((change) => change.column === 'category')).toBeUndefined();
  });

  it('lets the faculty sheet set a level nobody chose, and shows it as a change', () => {
    const { rows } = plan(
      MASTER,
      [seedRecord()],
      [journal({ category: 'National', level_source: null })],
    );
    expect(rows[0].changes).toContainEqual({
      field: 'Level',
      from: 'National',
      to: 'International',
    });
  });

  it('never lets a default level change a journal that already exists', () => {
    expect(canSetLevel(null, 'auto')).toBe(false);
    expect(canSetLevel('auto', 'faculty')).toBe(true);
    expect(canSetLevel('admin', 'faculty')).toBe(false);
    expect(canSetLevel('admin', 'admin')).toBe(true);
  });

  it('merges a journal listed on many paper rows into one', () => {
    const records = [2, 3, 4].map((line) => seedRecord({ line, level: null, levelSource: 'auto' }));
    const { rows } = plan(SCOPUS_EXPORT, records, []);
    expect(rows).toHaveLength(1);
  });

  it('flags both rows when one ISSN is given for two different journals in the same file', () => {
    // The faculty sheet gave Journal of Natural Fibers' ISSN to Indian Journal of Marketing.
    const records = [
      seedRecord({
        line: 215,
        name: 'Indian Journal of Marketing',
        issns: [{ issn: '15440478', kind: 'print' }],
      }),
      seedRecord({
        line: 451,
        name: 'Journal of Natural Fibers',
        issns: [{ issn: '15440478', kind: 'print' }],
      }),
    ];
    const { rows } = plan(MASTER, records, []);

    expect(rows.map((row) => row.outcome)).toEqual(['exception', 'exception']);
    expect(rows[0].reason).toContain('"Journal of Natural Fibers" (line 451)');
    expect(rows[1].reason).toContain('"Indian Journal of Marketing" (line 215)');
  });

  it('raises an exception when the ISSN belongs to a differently named journal in the list', () => {
    const { rows } = plan(
      MASTER,
      [seedRecord({ name: 'Journal of Renewable and Sustainable Energy' })],
      [journal({ journal_name: 'Renewable and Sustainable Energy Reviews' })],
    );
    expect(rows[0]).toMatchObject({
      outcome: 'exception',
      journal_name: 'Journal of Renewable and Sustainable Energy',
    });
    expect(rows[0].reason).toContain('"Renewable and Sustainable Energy Reviews"');
  });

  it('reports a journal with no valid ISSN instead of adding it unchecked', () => {
    const { rows } = plan(MASTER, [seedRecord({ issns: [], invalidIssns: ['877-265X'] })], []);
    expect(rows[0].outcome).toBe('exception');
    expect(rows[0].reason).toContain('"877-265X" is not a valid ISSN');
  });

  it('notes, but applies, an ISSN whose dropped leading zero was restored', () => {
    const { rows } = plan(MASTER, [seedRecord({ correctedIssns: ['1418130'] })], []);
    expect(rows[0]).toMatchObject({
      outcome: 'add',
      reason: 'Restored a dropped leading zero in ISSN 1418130',
    });
  });
});

describe('metrics', () => {
  const impactFactor = (value, year = 2024) => ({
    metric: 'impact_factor',
    metric_year: year,
    source: 'faculty_master',
    value_decimal: value,
  });

  it('treats the same value as unchanged even though the database returns "2.900"', () => {
    const existing = journal({
      online_issn: '2190-5738',
      category: 'International',
      level_source: 'faculty',
      publisher: 'Springer Nature',
      metrics: { 'impact_factor|2024|faculty_master': 2.9 },
    });
    const { rows } = plan(MASTER, [seedRecord({ metrics: [impactFactor(2.9)] })], [existing]);
    expect(rows[0].outcome).toBe('unchanged');
  });

  it('adds a new year beside the old one rather than replacing it', () => {
    const existing = journal({ metrics: { 'impact_factor|2024|faculty_master': 2.9 } });
    const { rows } = plan(MASTER, [seedRecord({ metrics: [impactFactor(3.1, 2025)] })], [existing]);

    expect(rows[0].payload.metrics).toEqual([impactFactor(3.1, 2025)]);
    expect(rows[0].changes).toContainEqual({ field: 'Impact Factor 2025', from: null, to: 3.1 });
  });
});

describe('reference files', () => {
  it('ignores journals that are not in the list and counts them', () => {
    const { rows, summary } = plan(
      SCIMAGO,
      [referenceRecord({ issns: [{ issn: '00181390', kind: 'unknown' }] })],
      [journal()],
    );
    expect(rows).toHaveLength(0);
    expect(summary.excluded.not_in_list).toBe(1);
    expect(summary.journalsNotInFile).toBe(1);
  });

  it('links the Scopus source id and overwrites the fields the file owns', () => {
    const { rows } = plan(SCIMAGO, [referenceRecord()], [journal({ country: 'India' })]);
    expect(rows[0].payload.set).toEqual(
      expect.arrayContaining([
        { column: 'scopus_source_id', value: '21100000001', mode: 'fill' },
        { column: 'country', value: 'Germany', mode: 'overwrite' },
        { column: 'publisher', value: 'Springer', mode: 'fill' },
      ]),
    );
  });

  it('refuses to attach metrics when the ISSN names a different journal in the file', () => {
    // A wrong ISSN in the faculty sheet would otherwise give it another journal's quartile.
    const { rows } = plan(
      SCIMAGO,
      [referenceRecord({ title: 'Journal of Optics (United Kingdom)' })],
      [journal({ journal_name: 'Journal of Optics (India)' })],
    );
    expect(rows[0].outcome).toBe('exception');
    expect(rows[0].reason).toContain('"Journal of Optics (United Kingdom)"');
  });

  it('skips the title check once the journal is linked by its Scopus source id', () => {
    const { rows } = plan(
      SCIMAGO,
      [referenceRecord({ title: 'A Renamed Title' })],
      [journal({ scopus_source_id: 21100000001 })],
    );
    expect(rows[0].outcome).not.toBe('exception');
  });

  it('sets print and online ISSNs exactly as the Scopus list labels them', () => {
    const record = referenceRecord({
      title: '3 Biotech',
      issns: [
        { issn: '21905738', kind: 'print' },
        { issn: '2190572X', kind: 'online' },
      ],
      set: { scopus_status: 'active', scopus_discontinued: 0, medline: 0 },
      labelsIssns: true,
    });
    const { rows } = plan(SOURCE_LIST, [record], [journal()]);

    expect(rows[0].payload.set).toEqual(
      expect.arrayContaining([
        { column: 'print_issn', value: '2190-5738', mode: 'overwrite' },
        { column: 'online_issn', value: '2190-572X', mode: 'overwrite' },
      ]),
    );
  });

  it('never relabels when the journal has an ISSN Scopus does not list', () => {
    const record = referenceRecord({
      issns: [{ issn: '2190572X', kind: 'print' }],
      set: {},
      labelsIssns: true,
    });
    const { rows } = plan(SOURCE_LIST, [record], [journal({ online_issn: '0018-1390' })]);
    const columns = rows[0].payload.set.map((change) => change.column);
    expect(columns).not.toContain('online_issn');
  });

  it('moves an ISSN Scopus lists as online only out of the print slot, so it is not shown twice', () => {
    // ACS Applied Bio Materials: the Scopus export gave 2576-6422 unlabelled, the import put
    // it under print, and relabelling then filled online too — "2576-6422 · 2576-6422".
    const record = referenceRecord({
      title: '3 Biotech',
      issns: [{ issn: '21905738', kind: 'online' }],
      set: {},
      labelsIssns: true,
    });
    const { rows } = plan(SOURCE_LIST, [record], [journal({ print_issn: '2190-5738' })]);

    expect(rows[0].payload.set).toEqual(
      expect.arrayContaining([
        { column: 'print_issn', value: '', mode: 'overwrite' },
        { column: 'online_issn', value: '2190-5738', mode: 'overwrite' },
      ]),
    );
  });

  it('shows a flag change to the admin as Yes/No, while storing 0/1', () => {
    // The preview read "Medline 0 → 1" before; the stored value stays numeric.
    const record = referenceRecord({ set: { medline: 1 }, labelsIssns: true });
    const { rows } = plan(SOURCE_LIST, [record], [journal()]);

    expect(rows[0].changes).toContainEqual({ field: 'Medline', from: 'No', to: 'Yes' });
    expect(rows[0].payload.set).toContainEqual({ column: 'medline', value: 1, mode: 'overwrite' });
  });
});
