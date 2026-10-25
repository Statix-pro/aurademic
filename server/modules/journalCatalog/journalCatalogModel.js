import { formatIssn, parseIssn, storedIssn } from './issn.js';
import { canSetLevel, metricKey } from './planner.js';
import { normalizeTitle } from './values.js';
import db from '../../config/connection.js';

const JOURNAL_COLUMNS = `id, journal_name, publisher, website, print_issn, online_issn, scopus_source_id,
  scopus_status, scopus_discontinued, medline, wos_indexed, country, category, level_source,
  is_placeholder`;

const ROW_INSERT_CHUNK = 200;

const isEmpty = (value) => value === null || value === undefined || String(value).trim() === '';

const truncate = (text, length) =>
  text && text.length > length ? `${text.slice(0, length - 1)}…` : text;

const httpError = (statusCode, message, details) =>
  Object.assign(new Error(message), { statusCode, details });

/**
 * The journal list as the planner and the apply step see it, with every stored metric keyed
 * `metric|year|source`. Decimals come back from the driver as strings ("2.900"), so they are
 * read as numbers here; otherwise every re-import would report an unchanged value as changed.
 */
export const loadJournalSnapshot = async (executor = db, { lock = false } = {}) => {
  const [journals] = await executor.query(
    `SELECT ${JOURNAL_COLUMNS} FROM journal_options${lock ? ' FOR UPDATE' : ''}`,
  );
  const [metrics] = await executor.query(
    `SELECT journal_option_id, metric, metric_year, source, value_decimal, value_text
       FROM journal_metrics_yearly`,
  );

  const byId = new Map(journals.map((journal) => [journal.id, { ...journal, metrics: {} }]));
  for (const metric of metrics) {
    const journal = byId.get(metric.journal_option_id);
    if (!journal) continue;
    journal.metrics[metricKey(metric)] =
      metric.value_text ?? (metric.value_decimal === null ? null : Number(metric.value_decimal));
  }
  return [...byId.values()];
};

/**
 * The list as it stands inside the apply transaction, kept current as rows are written, so
 * every add re-checks that its ISSNs and name are still free.
 */
export const createLiveIndex = (journals) => {
  const byId = new Map();
  const byIssn = new Map();
  const bySourceId = new Map();
  const byTitle = new Map();

  const add = (journal) => {
    if (journal.is_placeholder) return;
    byId.set(journal.id, journal);
    for (const value of [journal.print_issn, journal.online_issn]) {
      const issn = storedIssn(value);
      if (issn && !byIssn.has(issn)) byIssn.set(issn, journal.id);
    }
    if (journal.scopus_source_id) bySourceId.set(String(journal.scopus_source_id), journal.id);
    const title = normalizeTitle(journal.journal_name);
    if (title && !byTitle.has(title)) byTitle.set(title, journal.id);
  };

  journals.forEach(add);
  return { byId, byIssn, bySourceId, byTitle, add };
};

const upsertMetrics = async (connection, journalOptionId, metrics, batchId) => {
  if (!metrics?.length) return;
  await connection.query(
    `INSERT INTO journal_metrics_yearly
       (journal_option_id, metric, metric_year, source, value_decimal, value_text, import_batch_id)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       value_decimal = VALUES(value_decimal),
       value_text = VALUES(value_text),
       import_batch_id = VALUES(import_batch_id)`,
    [
      metrics.map((metric) => [
        journalOptionId,
        metric.metric,
        metric.metric_year,
        metric.source,
        metric.value_decimal ?? null,
        metric.value_text ?? null,
        batchId,
      ]),
    ],
  );
};

/**
 * The column each yearly metric is mirrored to, and its sources from least to most official.
 * Code-controlled, so the column name below is never request text.
 */
const MIRRORED_METRICS = {
  impact_factor: {
    column: 'impact_factor',
    sources: ['faculty_master', 'faculty_entry', 'admin', 'jcr'],
  },
  cite_score: {
    column: 'cite_score',
    sources: ['faculty_master', 'faculty_entry', 'admin', 'citescore'],
  },
};

/** Records which journals an apply wrote a given metric for, so only those are refreshed. */
const noteWrittenMetrics = (written, journalOptionId, metrics = []) => {
  for (const { metric } of metrics) {
    if (!MIRRORED_METRICS[metric]) continue;
    if (!written.has(metric)) written.set(metric, new Set());
    written.get(metric).add(journalOptionId);
  }
};

/**
 * `journal_options.impact_factor` / `cite_score` are what the publication form copies, so
 * they follow the newest yearly value — but only for a metric this import wrote. A SCImago
 * file carries no Impact Factor, so it must not re-derive one: an admin may have typed a
 * newer value in Journal Management, which lives only in the column, and a refresh would
 * put an older yearly value back over it.
 */
const refreshLatestMetrics = async (connection, written) => {
  for (const [metric, journalOptionIds] of written) {
    const { column, sources } = MIRRORED_METRICS[metric];
    if (journalOptionIds.size === 0) continue;
    await connection.query(
      `UPDATE journal_options jo
          SET ${column} = COALESCE((
                SELECT m.value_decimal FROM journal_metrics_yearly m
                 WHERE m.journal_option_id = jo.id AND m.metric = ?
                   AND m.value_decimal IS NOT NULL
                 ORDER BY m.metric_year DESC, FIELD(m.source, ?) DESC
                 LIMIT 1), jo.${column})
        WHERE jo.id IN (?)`,
      [metric, sources, [...journalOptionIds]],
    );
  }
};

/**
 * Writes one planned journal. The plan was made at preview time; anything that has since
 * changed is checked again here, and a row that can no longer be applied as planned is
 * returned as `skipped` with the reason instead of being forced through.
 */
const applyPayload = async (connection, live, payload, batchId) => {
  if (payload.action === 'add') {
    const create = payload.create;
    for (const issn of payload.issns) {
      const owner = live.byIssn.get(issn);
      if (owner) {
        return {
          skipped: `ISSN ${formatIssn(issn)} is now on "${live.byId.get(owner).journal_name}" in the journal list`,
        };
      }
    }
    if (live.byTitle.has(normalizeTitle(create.journal_name))) {
      return { skipped: `"${create.journal_name}" is now in the journal list` };
    }

    const [result] = await connection.query('INSERT INTO journal_options SET ?', [create]);
    const journal = { id: result.insertId, is_placeholder: 0, ...create };
    live.add(journal);
    await upsertMetrics(connection, journal.id, payload.metrics, batchId);
    return { journalOptionId: journal.id, action: 'added' };
  }

  const journal = live.byId.get(payload.journalOptionId);
  if (!journal) return { skipped: 'The journal has been deleted from the list' };

  const updates = {};
  for (const change of payload.set) {
    if (change.mode === 'fill' && !isEmpty(journal[change.column])) continue;
    if (change.mode === 'level') {
      if (!canSetLevel(journal.level_source, change.levelSource)) continue;
      updates.category = change.value;
      updates.level_source = change.levelSource;
      continue;
    }
    if (change.column === 'print_issn' || change.column === 'online_issn') {
      const owner = live.byIssn.get(storedIssn(change.value));
      if (owner && owner !== journal.id) continue;
    }
    if (change.column === 'scopus_source_id') {
      const owner = live.bySourceId.get(String(change.value));
      if (owner && owner !== journal.id) continue;
    }
    updates[change.column] = change.value;
  }
  if (payload.referenceChecked) updates.reference_checked_at = new Date();

  if (Object.keys(updates).length > 0) {
    await connection.query('UPDATE journal_options SET ? WHERE id = ?', [updates, journal.id]);
    Object.assign(journal, updates);
    live.add(journal);
  }
  await upsertMetrics(connection, journal.id, payload.metrics, batchId);
  return { journalOptionId: journal.id, action: 'updated' };
};

/**
 * An admin's corrections to an exception before accepting it: the name and ISSNs of a journal
 * being added, the ISSNs of one being updated, and its level. A level set here is an admin
 * decision, which no later import overrides.
 */
export const validateOverrides = (raw = {}) => {
  const overrides = {};
  if (raw.journal_name !== undefined) {
    const name = String(raw.journal_name).replace(/\s+/g, ' ').trim();
    if (!name || name.length > 255) throw httpError(400, 'Journal name must be 1–255 characters.');
    overrides.journal_name = name;
  }
  for (const column of ['print_issn', 'online_issn']) {
    if (raw[column] === undefined) continue;
    if (String(raw[column]).trim() === '') {
      overrides[column] = '';
      continue;
    }
    const parsed = parseIssn(raw[column]);
    if (!parsed?.valid) throw httpError(400, `"${raw[column]}" is not a valid ISSN.`);
    overrides[column] = formatIssn(parsed.issn);
  }
  if (raw.category !== undefined) {
    if (!['National', 'International'].includes(raw.category)) {
      throw httpError(400, 'Level must be National or International.');
    }
    overrides.category = raw.category;
  }
  return overrides;
};

const withOverrides = (payload, overrides = {}) => {
  if (Object.keys(overrides).length === 0) return payload;

  if (payload.action === 'add') {
    const create = { ...payload.create };
    if (overrides.journal_name) create.journal_name = overrides.journal_name;
    if (overrides.print_issn !== undefined) create.print_issn = overrides.print_issn;
    if (overrides.online_issn !== undefined) create.online_issn = overrides.online_issn;
    if (overrides.category) {
      create.category = overrides.category;
      create.level_source = 'admin';
    }
    const issns = [create.print_issn, create.online_issn].map(storedIssn).filter(Boolean);
    return { ...payload, create, issns };
  }

  const set = payload.set.filter(
    (change) =>
      !(overrides.print_issn !== undefined && change.column === 'print_issn') &&
      !(overrides.online_issn !== undefined && change.column === 'online_issn') &&
      !(overrides.category && change.column === 'category'),
  );
  for (const column of ['print_issn', 'online_issn']) {
    if (overrides[column] !== undefined)
      set.push({ column, value: overrides[column], mode: 'overwrite' });
  }
  if (overrides.category) {
    set.push({
      column: 'category',
      value: overrides.category,
      mode: 'level',
      levelSource: 'admin',
    });
  }
  return { ...payload, set };
};

const markRowsApplied = async (connection, rowIds, userId) => {
  if (rowIds.length === 0) return;
  await connection.query(
    `UPDATE journal_import_rows
        SET resolution = 'applied', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id IN (?)`,
    [userId, rowIds],
  );
};

const BATCH_SELECT = `
  SELECT b.id, b.source_key, b.file_name, b.metric_year, b.status, b.summary, b.created_at,
         b.applied_at, b.discarded_at, b.created_by, creator.name AS created_by_name,
         b.applied_by, applier.name AS applied_by_name
    FROM journal_import_batches b
    LEFT JOIN users creator ON creator.id = b.created_by
    LEFT JOIN users applier ON applier.id = b.applied_by`;

/** Newest yearly value of one metric for the journal in the outer query, `jo`. */
const latestMetric = (metric, column) => `(
  SELECT m.${column} FROM journal_metrics_yearly m
   WHERE m.journal_option_id = jo.id AND m.metric = '${metric}'
   ORDER BY m.metric_year DESC LIMIT 1)`;

const LATEST_METRIC_YEAR = (metric) => `(
  SELECT MAX(m.metric_year) FROM journal_metrics_yearly m
   WHERE m.journal_option_id = jo.id AND m.metric = '${metric}')`;

const HAS_IMPACT_FACTOR = `(jo.impact_factor IS NOT NULL OR EXISTS (
  SELECT 1 FROM journal_metrics_yearly m
   WHERE m.journal_option_id = jo.id AND m.metric = 'impact_factor'))`;

const HAS_QUARTILE = `EXISTS (
  SELECT 1 FROM journal_metrics_yearly m
   WHERE m.journal_option_id = jo.id AND m.metric = 'quartile')`;

/**
 * The list screen's filters. Keys come from a fixed set, so the SQL fragments are never built
 * from request text.
 */
const JOURNAL_FILTERS = {
  if_needed: `NOT ${HAS_IMPACT_FACTOR}`,
  no_quartile: `NOT ${HAS_QUARTILE}`,
  discontinued: 'jo.scopus_discontinued = 1',
  not_scopus: 'jo.scopus_status IS NULL',
  wos: 'jo.wos_indexed = 1',
  national: "jo.category = 'National'",
};

export const JOURNAL_FILTER_KEYS = Object.keys(JOURNAL_FILTERS);

const journalCatalogModel = {
  loadJournalSnapshot,

  /** The KSRCT journal list with each journal's newest quartile and SJR, for the admin screen. */
  async listJournals({ search, filter, page, perPage }) {
    const where = ['jo.is_placeholder = 0'];
    const params = [];
    if (filter) where.push(JOURNAL_FILTERS[filter]);
    if (search) {
      // The ISSN comparison only runs for text that is an ISSN: a name reduces to '' here,
      // and '' equals every journal stored without an ISSN.
      const bare = search.toUpperCase().replace(/[^0-9X]/g, '');
      if (/^\d{7}[\dX]$/.test(bare)) {
        where.push(
          `(jo.journal_name LIKE ? OR REPLACE(jo.print_issn, '-', '') = ? OR REPLACE(jo.online_issn, '-', '') = ?)`,
        );
        params.push(`%${search}%`, bare, bare);
      } else {
        where.push('jo.journal_name LIKE ?');
        params.push(`%${search}%`);
      }
    }
    const clause = where.join(' AND ');

    // Independent reads, so they run side by side rather than one after another.
    const [[[{ total }]], [rows], [[counts]]] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total FROM journal_options jo WHERE ${clause}`, params),
      db.query(
        `SELECT jo.id, jo.journal_name, jo.publisher, jo.website, jo.print_issn, jo.online_issn,
              jo.category, jo.level_source, jo.scopus_source_id, jo.scopus_status,
              jo.scopus_discontinued, jo.medline, jo.wos_indexed, jo.country,
              jo.impact_factor, jo.cite_score, jo.reference_checked_at,
              ${latestMetric('quartile', 'value_text')} AS quartile,
              ${LATEST_METRIC_YEAR('quartile')} AS quartile_year,
              ${latestMetric('sjr', 'value_decimal')} AS sjr,
              ${LATEST_METRIC_YEAR('impact_factor')} AS impact_factor_year
         FROM journal_options jo
        WHERE ${clause}
        ORDER BY jo.journal_name, jo.id
        LIMIT ? OFFSET ?`,
        [...params, perPage, (page - 1) * perPage],
      ),
      db.query(
        `SELECT COUNT(*) AS total,
              ${JOURNAL_FILTER_KEYS.map((key) => `SUM(${JOURNAL_FILTERS[key]}) AS ${key}`).join(',\n              ')}
         FROM journal_options jo
        WHERE jo.is_placeholder = 0`,
      ),
    ]);

    return {
      rows,
      total: Number(total),
      counts: Object.fromEntries(
        Object.entries(counts).map(([key, value]) => [key, Number(value ?? 0)]),
      ),
    };
  },

  /** An earlier import of the very same file, if it was applied. */
  async findAppliedBatch(sourceKey, sha256) {
    const [rows] = await db.query(
      `SELECT id, applied_at FROM journal_import_batches
        WHERE source_key = ? AND file_sha256 = ? AND status = 'applied'
        ORDER BY id DESC LIMIT 1`,
      [sourceKey, sha256],
    );
    return rows[0] ?? null;
  },

  /**
   * Stores a preview: the batch (file name and hash, never the file) and its planned rows.
   * An older, unapplied preview of the same file is discarded so only one can be applied.
   */
  async createPreviewBatch({ sourceKey, fileName, sha256, metricYear, summary, rows, userId }) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE journal_import_batches
            SET status = 'discarded', discarded_at = CURRENT_TIMESTAMP
          WHERE source_key = ? AND file_sha256 = ? AND status = 'previewed'`,
        [sourceKey, sha256],
      );
      const [result] = await connection.query(
        `INSERT INTO journal_import_batches
           (source_key, file_name, file_sha256, metric_year, summary, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sourceKey, truncate(fileName, 255), sha256, metricYear, JSON.stringify(summary), userId],
      );
      const batchId = result.insertId;

      for (let start = 0; start < rows.length; start += ROW_INSERT_CHUNK) {
        const chunk = rows.slice(start, start + ROW_INSERT_CHUNK);
        await connection.query(
          `INSERT INTO journal_import_rows
             (batch_id, source_row, outcome, journal_option_id, publication_id, journal_name,
              reason, payload, changes)
           VALUES ?`,
          [
            chunk.map((row) => [
              batchId,
              row.source_row,
              row.outcome,
              row.journal_option_id,
              row.publication_id ?? null,
              truncate(row.journal_name, 255),
              truncate(row.reason, 500),
              JSON.stringify(row.payload),
              JSON.stringify(row.changes ?? []),
            ]),
          ],
        );
      }

      await connection.commit();
      return batchId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async listBatches({ page, perPage }) {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM journal_import_batches');
    const [rows] = await db.query(`${BATCH_SELECT} ORDER BY b.id DESC LIMIT ? OFFSET ?`, [
      perPage,
      (page - 1) * perPage,
    ]);
    return { rows, total };
  },

  async getBatchSourceKey(batchId) {
    const [rows] = await db.query('SELECT source_key FROM journal_import_batches WHERE id = ?', [
      batchId,
    ]);
    return rows[0]?.source_key ?? null;
  },

  async getBatch(batchId) {
    const [rows] = await db.query(`${BATCH_SELECT} WHERE b.id = ?`, [batchId]);
    if (rows.length === 0) return null;
    const [counts] = await db.query(
      `SELECT outcome, resolution, COUNT(*) AS total
         FROM journal_import_rows WHERE batch_id = ?
        GROUP BY outcome, resolution`,
      [batchId],
    );
    return {
      ...rows[0],
      rowCounts: counts.map((count) => ({ ...count, total: Number(count.total) })),
    };
  },

  async listBatchRows(batchId, { outcome, resolution, search, page, perPage }) {
    const where = ['batch_id = ?'];
    const params = [batchId];
    if (outcome) {
      where.push('outcome = ?');
      params.push(outcome);
    }
    if (resolution) {
      where.push('resolution = ?');
      params.push(resolution);
    }
    if (search) {
      where.push('journal_name LIKE ?');
      params.push(`%${search}%`);
    }
    const clause = where.join(' AND ');
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM journal_import_rows WHERE ${clause}`,
      params,
    );
    const [rows] = await db.query(
      `SELECT id, source_row, outcome, resolution, journal_option_id, publication_id,
              journal_name, reason, payload, changes, resolved_at
         FROM journal_import_rows
        WHERE ${clause}
        ORDER BY source_row, id
        LIMIT ? OFFSET ?`,
      [...params, perPage, (page - 1) * perPage],
    );
    return { rows, total: Number(total) };
  },

  /**
   * Applies every planned add and update of a previewed batch in one transaction. Exceptions
   * are left for a person; a row that can no longer be applied as planned becomes one.
   *
   * A preview applies once. The same file may be previewed and applied again later — that is
   * how journals added since pick up Scopus and SCImago data — and its rules only fill, add
   * or refresh, so a repeat changes nothing that is already right.
   */
  async applyBatch(batchId, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [[batch]] = await connection.query(
        'SELECT id, status FROM journal_import_batches WHERE id = ? FOR UPDATE',
        [batchId],
      );
      if (!batch) throw httpError(404, 'Import not found.');
      if (batch.status !== 'previewed')
        throw httpError(409, `This import is already ${batch.status}.`);

      const live = createLiveIndex(await loadJournalSnapshot(connection, { lock: true }));
      const [rows] = await connection.query(
        `SELECT id, outcome, journal_option_id, payload FROM journal_import_rows
          WHERE batch_id = ? AND resolution = 'pending' AND outcome <> 'exception'
          ORDER BY id`,
        [batchId],
      );

      const result = { added: 0, updated: 0, unchanged: 0, notApplied: 0 };
      const written = new Map();
      const unchangedRows = [];
      const checkedJournals = [];

      for (const row of rows) {
        if (row.outcome === 'unchanged') {
          unchangedRows.push(row.id);
          if (row.payload.referenceChecked && row.journal_option_id) {
            checkedJournals.push(row.journal_option_id);
          }
          result.unchanged += 1;
          continue;
        }

        const applied = await applyPayload(connection, live, row.payload, batchId);
        if (applied.skipped) {
          await connection.query(
            `UPDATE journal_import_rows SET outcome = 'exception', reason = ? WHERE id = ?`,
            [truncate(`Not applied: ${applied.skipped}`, 500), row.id],
          );
          result.notApplied += 1;
          continue;
        }

        await connection.query(
          `UPDATE journal_import_rows
              SET resolution = 'applied', journal_option_id = ?, resolved_by = ?,
                  resolved_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [applied.journalOptionId, userId, row.id],
        );
        noteWrittenMetrics(written, applied.journalOptionId, row.payload.metrics);
        result[applied.action] += 1;
      }

      await markRowsApplied(connection, unchangedRows, userId);
      if (checkedJournals.length > 0) {
        await connection.query(
          'UPDATE journal_options SET reference_checked_at = CURRENT_TIMESTAMP WHERE id IN (?)',
          [checkedJournals],
        );
      }
      await refreshLatestMetrics(connection, written);
      await connection.query(
        `UPDATE journal_import_batches
            SET status = 'applied', applied_by = ?, applied_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [userId, batchId],
      );

      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async discardBatch(batchId) {
    const [result] = await db.query(
      `UPDATE journal_import_batches
          SET status = 'discarded', discarded_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'previewed'`,
      [batchId],
    );
    return result.affectedRows > 0;
  },

  /**
   * Accepts or excludes exceptions of an applied batch, several at once. Accepting applies
   * each row's proposal (with the admin's corrections) in one transaction: if any of them can
   * no longer be applied, none are, and the reasons come back so the admin can fix them.
   */
  async resolveExceptions(batchId, { rowIds, action, overrides = {} }, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [[batch]] = await connection.query(
        'SELECT id, status FROM journal_import_batches WHERE id = ? FOR UPDATE',
        [batchId],
      );
      if (!batch) throw httpError(404, 'Import not found.');
      if (batch.status !== 'applied') {
        throw httpError(409, 'Apply the import before resolving its exceptions.');
      }

      const [rows] = await connection.query(
        `SELECT id, journal_name, payload FROM journal_import_rows
          WHERE batch_id = ? AND id IN (?) AND outcome = 'exception' AND resolution = 'pending'
          ORDER BY id FOR UPDATE`,
        [batchId, rowIds],
      );
      if (rows.length !== rowIds.length) {
        throw httpError(409, 'Some of the selected rows are not open exceptions of this import.');
      }

      if (action === 'exclude') {
        await connection.query(
          `UPDATE journal_import_rows
              SET resolution = 'excluded', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
            WHERE id IN (?)`,
          [userId, rowIds],
        );
        await connection.commit();
        return { excluded: rows.length };
      }

      const live = createLiveIndex(await loadJournalSnapshot(connection, { lock: true }));
      const failures = [];
      const written = new Map();
      for (const row of rows) {
        const payload = withOverrides(row.payload, overrides[row.id]);
        const applied = await applyPayload(connection, live, payload, batchId);
        if (applied.skipped) {
          failures.push({ rowId: row.id, journalName: row.journal_name, reason: applied.skipped });
          continue;
        }
        await connection.query(
          `UPDATE journal_import_rows
              SET resolution = 'applied', journal_option_id = ?, payload = ?, resolved_by = ?,
                  resolved_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [applied.journalOptionId, JSON.stringify(payload), userId, row.id],
        );
        noteWrittenMetrics(written, applied.journalOptionId, payload.metrics);
      }

      if (failures.length > 0) {
        throw httpError(409, 'Some rows could not be accepted; nothing was changed.', failures);
      }

      await refreshLatestMetrics(connection, written);
      await connection.commit();
      return { accepted: rows.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

export default journalCatalogModel;
