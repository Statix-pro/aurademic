import { readSourceFile } from './importReader.js';
import journalCatalogModel, {
  JOURNAL_FILTER_KEYS,
  validateOverrides,
} from './journalCatalogModel.js';
import paperImportModel from './paperImportModel.js';
import { planPapers } from './paperPlanner.js';
import { indexJournals, planImport } from './planner.js';
import scopusClaimModel from './scopusClaimModel.js';
import { describeSources, EXCLUSION_REASONS, getSource } from './sources.js';
import staffIdImportModel from './staffIdImportModel.js';
import { planStaffIds } from './staffIdPlanner.js';

const MAX_PER_PAGE = 100;

const pagination = (query, fallbackPerPage = 25) => ({
  page: Math.max(1, Number.parseInt(query.page, 10) || 1),
  perPage: Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number.parseInt(query.per_page, 10) || fallbackPerPage),
  ),
});

const positiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * A rejected request (a file in the wrong format, an import already applied) carries its own
 * status and a message meant for the admin; anything else is a server fault and is logged.
 */
const respondWithError = (res, error, fallbackMessage) => {
  if (error.statusCode && error.statusCode < 500) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.details ? { data: { failures: error.details } } : {}),
    });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

/** Paper and staff-ID imports write publications and staff records, through their own models. */
const MODEL_BY_KIND = { papers: paperImportModel, staff: staffIdImportModel };

const modelForBatch = async (batchId) => {
  const sourceKey = await journalCatalogModel.getBatchSourceKey(batchId);
  return MODEL_BY_KIND[getSource(sourceKey)?.kind] ?? journalCatalogModel;
};

const planFile = async ({ source, records, journals, excluded }) => {
  if (source.kind === 'papers') {
    return planPapers({
      records,
      journals,
      excluded,
      ...(await paperImportModel.loadPaperContext()),
    });
  }
  if (source.kind === 'staff') {
    return planStaffIds({ records, excluded, ...(await staffIdImportModel.loadStaffContext()) });
  }
  return planImport({ source, records, journals, excluded });
};

/** Reference files only keep rows for journals already in the list; the rest is never held. */
const keepListedJournals = (journals) => {
  const index = indexJournals(journals);
  return (record) =>
    (record.sourceId && index.bySourceId.has(record.sourceId)) ||
    record.issns.some(({ issn }) => index.byIssn.has(issn));
};

const journalCatalogController = {
  getSources(_req, res) {
    return res.json({
      success: true,
      data: { sources: describeSources(), exclusionReasons: EXCLUSION_REASONS },
    });
  },

  /**
   * Reads an uploaded file and stores the planned outcome per journal. The file lives only in
   * memory for this request — it is never written to disk — and nothing in the journal list
   * changes until the preview is applied.
   */
  async previewImport(req, res) {
    try {
      const source = getSource(req.params.source);
      if (!source) {
        return res.status(404).json({ success: false, message: 'Unknown import source.' });
      }
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ success: false, message: 'Choose a file to upload.' });
      }

      const journals = await journalCatalogModel.loadJournalSnapshot();
      const { records, excluded, rowsRead, metricYear, sha256 } = await readSourceFile(
        source,
        req.file.buffer,
        {
          metricYear: req.body?.metricYear,
          keep: source.kind === 'reference' ? keepListedJournals(journals) : undefined,
        },
      );

      // Re-applying a file is safe — every rule only fills, adds or refreshes — and is how
      // journals added since (from a later Scopus or Web of Science export) get their Scopus
      // status and quartile. So the earlier import is reported, not refused.
      const previouslyApplied = await journalCatalogModel.findAppliedBatch(source.key, sha256);
      const { rows, summary } = await planFile({ source, records, journals, excluded });

      const batchId = await journalCatalogModel.createPreviewBatch({
        sourceKey: source.key,
        fileName: req.file.originalname,
        sha256,
        metricYear,
        summary: {
          ...summary,
          rowsRead,
          previouslyApplied: previouslyApplied
            ? { id: previouslyApplied.id, appliedAt: previouslyApplied.applied_at }
            : null,
        },
        rows,
        userId: req.user.id,
      });

      return res.status(201).json({
        success: true,
        data: await journalCatalogModel.getBatch(batchId),
      });
    } catch (error) {
      return respondWithError(res, error, 'Failed to read the import file');
    }
  },

  async listImports(req, res) {
    try {
      const { page, perPage } = pagination(req.query, 20);
      const { rows, total } = await journalCatalogModel.listBatches({ page, perPage });
      return res.json({ success: true, data: { imports: rows, total, page, perPage } });
    } catch (error) {
      return respondWithError(res, error, 'Failed to load imports');
    }
  },

  async getImport(req, res) {
    try {
      const batchId = positiveId(req.params.id);
      const batch = batchId ? await journalCatalogModel.getBatch(batchId) : null;
      if (!batch) return res.status(404).json({ success: false, message: 'Import not found.' });
      return res.json({ success: true, data: batch });
    } catch (error) {
      return respondWithError(res, error, 'Failed to load the import');
    }
  },

  async listImportRows(req, res) {
    try {
      const batchId = positiveId(req.params.id);
      if (!batchId) return res.status(404).json({ success: false, message: 'Import not found.' });

      const outcome = ['add', 'update', 'unchanged', 'exception'].includes(req.query.outcome)
        ? req.query.outcome
        : null;
      const resolution = ['pending', 'applied', 'excluded'].includes(req.query.resolution)
        ? req.query.resolution
        : null;
      const search = String(req.query.search ?? '')
        .trim()
        .slice(0, 100);
      const { page, perPage } = pagination(req.query, 50);

      const { rows, total } = await journalCatalogModel.listBatchRows(batchId, {
        outcome,
        resolution,
        search,
        page,
        perPage,
      });
      return res.json({ success: true, data: { rows, total, page, perPage } });
    } catch (error) {
      return respondWithError(res, error, 'Failed to load import rows');
    }
  },

  async applyImport(req, res) {
    try {
      const batchId = positiveId(req.params.id);
      if (!batchId) return res.status(404).json({ success: false, message: 'Import not found.' });
      const model = await modelForBatch(batchId);
      const result = await model.applyBatch(batchId, req.user.id);
      return res.json({
        success: true,
        message: 'Import applied.',
        data: { result, import: await journalCatalogModel.getBatch(batchId) },
      });
    } catch (error) {
      return respondWithError(res, error, 'Failed to apply the import');
    }
  },

  async discardImport(req, res) {
    try {
      const batchId = positiveId(req.params.id);
      const discarded = batchId ? await journalCatalogModel.discardBatch(batchId) : false;
      if (!discarded) {
        return res.status(409).json({
          success: false,
          message: 'Only an import that has not been applied can be discarded.',
        });
      }
      return res.json({ success: true, message: 'Import discarded.' });
    } catch (error) {
      return respondWithError(res, error, 'Failed to discard the import');
    }
  },

  /** Bulk accept or exclude of exceptions, with optional per-row corrections when accepting. */
  async resolveExceptions(req, res) {
    try {
      const batchId = positiveId(req.params.id);
      if (!batchId) return res.status(404).json({ success: false, message: 'Import not found.' });

      const { action } = req.body ?? {};
      if (!['accept', 'exclude'].includes(action)) {
        return res
          .status(400)
          .json({ success: false, message: 'Action must be accept or exclude.' });
      }
      if (!Array.isArray(req.body.rowIds)) {
        return res.status(400).json({ success: false, message: 'Select between 1 and 500 rows.' });
      }
      const rowIds = [...new Set(req.body.rowIds.map(positiveId))];
      if (rowIds.length === 0 || rowIds.includes(null) || rowIds.length > 500) {
        return res.status(400).json({ success: false, message: 'Select between 1 and 500 rows.' });
      }

      const model = await modelForBatch(batchId);
      const overrides = {};
      // A paper is accepted as planned; corrections apply to journal-list rows only.
      if (action === 'accept' && model === journalCatalogModel) {
        for (const [rowId, raw] of Object.entries(req.body.overrides ?? {})) {
          const id = positiveId(rowId);
          if (!id || !rowIds.includes(id)) continue;
          if (!raw || typeof raw !== 'object') {
            return res
              .status(400)
              .json({ success: false, message: 'Each correction must be a set of fields.' });
          }
          overrides[id] = validateOverrides(raw);
        }
      }

      const result = await model.resolveExceptions(
        batchId,
        { rowIds, action, overrides },
        req.user.id,
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      return respondWithError(res, error, 'Failed to resolve the exceptions');
    }
  },

  /** Scopus IDs added beyond each staff record's own — from sheets and staff claims. */
  async listScopusIds(req, res) {
    try {
      const search = String(req.query.search ?? '')
        .trim()
        .slice(0, 100);
      const { page, perPage } = pagination(req.query, 25);
      const result = await scopusClaimModel.listClaims({ search, page, perPage });
      return res.json({ success: true, data: { ...result, page, perPage } });
    } catch (error) {
      return respondWithError(res, error, 'Failed to load the Scopus IDs');
    }
  },

  async removeScopusId(req, res) {
    try {
      const claimId = positiveId(req.params.id);
      if (!claimId)
        return res.status(404).json({ success: false, message: 'Scopus ID not found.' });
      const result = await scopusClaimModel.removeClaim(claimId);
      return res.json({ success: true, message: 'Scopus ID removed.', data: result });
    } catch (error) {
      return respondWithError(res, error, 'Failed to remove the Scopus ID');
    }
  },

  async listJournals(req, res) {
    try {
      const filter = JOURNAL_FILTER_KEYS.includes(req.query.filter) ? req.query.filter : null;
      const search = String(req.query.search ?? '')
        .trim()
        .slice(0, 100);
      const { page, perPage } = pagination(req.query, 25);
      const result = await journalCatalogModel.listJournals({ search, filter, page, perPage });
      return res.json({ success: true, data: { ...result, page, perPage } });
    } catch (error) {
      return respondWithError(res, error, 'Failed to load the journal list');
    }
  },
};

export default journalCatalogController;
