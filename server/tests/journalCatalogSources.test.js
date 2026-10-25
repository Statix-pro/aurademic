/**
 * Each import source is read by header text, so a reordered or longer file still loads and a
 * file that is not what it claims is refused by name. These pin the format quirks of the real
 * files — SCImago's ";" and decimal commas and unescaped quotes, the Scopus workbook's header
 * on row 3, Web of Science's two-letter tags — and that a gzipped upload (how the admin screen
 * sends files, to stay under IIS's 30 MB limit) reads exactly like the plain one.
 *
 * Fixtures are a few made-up rows in each real layout; no real file is used.
 */

import zlib from 'zlib';

import { describe, expect, it } from 'vitest';

import { readSourceFile } from '../modules/journalCatalog/importReader.js';
import { getSource } from '../modules/journalCatalog/sources.js';

const csv = (lines) => Buffer.from(`${lines.join('\n')}\n`);

const MASTER = csv([
  'S.No.,Journal Name,Level,Publisher,Website,Print ISSN,E ISSN,Impact Factor,Cite Score',
  '1,3 Biotech,International,Springer Nature,https://example.org,2190-572X,2190-5738,2.9,6.1',
  '2,Chemosphere,International,Elsevier,,0045-6535,1879-1298,"8.1 (JCR, 2023)",15.8',
  '3,Some Indian Journal,National,Press,,,—,-,',
  '4,,,,,,,,',
]);

const SCIMAGO = csv([
  'Rank;Sourceid;Title;Type;Issn;Publisher;Open Access;SJR;SJR Best Quartile;H index;Total Docs. (2025);Country;Publisher',
  '1;28773;"Ca-A Cancer Journal for Clinicians";journal;"15424863, 00079235";"Wiley";No;104,065;Q1;236;48;United States;"Wiley"',
  '2;21101289973;"Advanced Engineering Letters";journal;"28129709";"Serbian "Academic" Center";Yes;0,437;Q2;10;20;Serbia;"x"',
  '3;12345;"Some Proceedings";conference and proceedings;"12345679";"x";No;0,1;-;1;5;India;"x"',
]);

describe('faculty master sheet', () => {
  it('asks for the year its Impact Factor and CiteScore belong to', async () => {
    await expect(readSourceFile(getSource('ksrct_master'), MASTER, {})).rejects.toThrow(
      /Choose the year/,
    );
  });

  it('reads ISSNs, level and metrics, and flags a metric typed as a note', async () => {
    const { records, excluded } = await readSourceFile(getSource('ksrct_master'), MASTER, {
      metricYear: 2024,
    });

    expect(excluded).toEqual({ blank: 1 });
    expect(records[0]).toMatchObject({
      name: '3 Biotech',
      level: 'International',
      issns: [
        { issn: '2190572X', kind: 'print' },
        { issn: '21905738', kind: 'online' },
      ],
      issues: [],
    });
    expect(records[0].metrics).toEqual([
      { metric: 'impact_factor', metric_year: 2024, source: 'faculty_master', value_decimal: 2.9 },
      { metric: 'cite_score', metric_year: 2024, source: 'faculty_master', value_decimal: 6.1 },
    ]);

    // The note's own year wins over the year chosen for the file, and the row is flagged.
    expect(records[1].metrics[0]).toMatchObject({ metric_year: 2023, value_decimal: 8.1 });
    expect(records[1].issues[0]).toMatch(/Impact Factor .* not a plain number/);

    // An em dash is an empty cell, not an invalid ISSN.
    expect(records[2]).toMatchObject({ level: 'National', issns: [], invalidIssns: [] });
  });

  it('names the missing column when the file is not the master sheet', async () => {
    const wrong = csv(['Journal Name,Publisher', 'A,B']);
    await expect(
      readSourceFile(getSource('ksrct_master'), wrong, { metricYear: 2024 }),
    ).rejects.toThrow(/Missing column\(s\): Print ISSN, E ISSN/);
  });
});

describe('SCImago', () => {
  it('reads the year from its header, decimal commas, and fields with unescaped quotes', async () => {
    const { records, excluded, metricYear } = await readSourceFile(getSource('scimago'), SCIMAGO);

    expect(metricYear).toBe(2025);
    expect(excluded).toEqual({ not_journal_source: 1 });
    expect(records[0]).toMatchObject({ sourceId: '28773', set: { country: 'United States' } });
    expect(records[0].issns.map((entry) => entry.issn)).toEqual(['15424863', '00079235']);
    expect(records[0].metrics).toEqual([
      { metric: 'sjr', metric_year: 2025, source: 'scimago', value_decimal: 104.065 },
      { metric: 'quartile', metric_year: 2025, source: 'scimago', value_text: 'Q1' },
      { metric: 'h_index', metric_year: 2025, source: 'scimago', value_decimal: 236 },
    ]);
    // The duplicated "Publisher" header resolves to the first column.
    expect(records[1].publisher).toBe('Serbian "Academic" Center');
  });

  it('drops rows the caller does not keep, counting them', async () => {
    const { records, excluded } = await readSourceFile(getSource('scimago'), SCIMAGO, {
      keep: (record) => record.sourceId === '28773',
    });
    expect(records).toHaveLength(1);
    expect(excluded).toEqual({ not_journal_source: 1, not_in_list: 1 });
  });

  it('reads a gzipped upload exactly like the plain file, with the same content hash', async () => {
    const plain = await readSourceFile(getSource('scimago'), SCIMAGO);
    const gzipped = await readSourceFile(getSource('scimago'), zlib.gzipSync(SCIMAGO));

    expect(gzipped.records).toEqual(plain.records);
    expect(gzipped.sha256).toBe(plain.sha256);
    expect(plain.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a damaged gzip upload with a message, not a server error', async () => {
    const damaged = zlib.gzipSync(SCIMAGO).subarray(0, 40);
    await expect(readSourceFile(getSource('scimago'), damaged)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('Scopus Source List', () => {
  it('finds the header below title rows and reads status, discontinued and Medline', async () => {
    const file = csv([
      'Scopus Sources Sep. 2026,,,,,,,,',
      'Notice: Scopus is owned by Elsevier B.V.,,,,,,,,',
      'Sourcerecord ID,Source Title,ISSN,EISSN,Active or Inactive,Titles Discontinued by Scopus,"Medline-sourced Title? (See additional details under separate tab.)",Source Type,Publisher',
      '21100902951,Skin research,00181390,,Inactive,Discontinued by Scopus,Medline,Journal,Osaka',
    ]);
    const { records } = await readSourceFile(getSource('scopus_source_list'), file);

    expect(records[0]).toMatchObject({
      line: 4,
      sourceId: '21100902951',
      issns: [{ issn: '00181390', kind: 'print' }],
      set: { scopus_status: 'inactive', scopus_discontinued: 1, medline: 1 },
      labelsIssns: true,
    });
  });
});

describe('KSRCT publication exports', () => {
  it('keeps journal papers by KSRCT authors and says why the rest were left out', async () => {
    const file = csv([
      'Source title,ISSN,Publisher,Document Type,Affiliations',
      'Journal A,2190572X,Springer,Article,"Dept, K.S. Rangasamy College of Technology, Tiruchengode"',
      'Conf B,,IEEE,Conference paper,"K.S. Rangasamy College of Technology"',
      'Proc C,,IEEE,Article,"K.S. Rangasamy College of Technology"',
      'Journal D,00181390,X,Article,"K.S.R. College of Arts and Science"',
    ]);
    const { records, excluded } = await readSourceFile(getSource('scopus_export'), file);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      name: 'Journal A',
      issns: [{ issn: '2190572X', kind: 'unknown' }],
    });
    expect(excluded).toEqual({ not_journal: 1, no_issn: 1, not_ksrct: 1 });
  });

  it('reads a Web of Science tab-delimited export by its field tags, quotes and all', async () => {
    const file = Buffer.from(
      [
        ['PT', 'AU', 'TI', 'SO', 'DT', 'SN', 'EI', 'PU'].join('\t'),
        [
          'J',
          'X',
          'A "quoted" title',
          'BIOFUELS-UK',
          'Article',
          '1759-7269',
          '1759-7277',
          'T&F',
        ].join('\t'),
        ['J', 'Y', 'Talk', 'SOME CONF', 'Proceedings Paper', '', '', ''].join('\t'),
      ].join('\n'),
    );
    const { records, excluded } = await readSourceFile(getSource('wos_export'), file);

    expect(excluded).toEqual({ not_journal: 1 });
    expect(records[0]).toMatchObject({
      name: 'BIOFUELS-UK',
      wosIndexed: true,
      issns: [
        { issn: '17597269', kind: 'print' },
        { issn: '17597277', kind: 'online' },
      ],
    });
  });
});
