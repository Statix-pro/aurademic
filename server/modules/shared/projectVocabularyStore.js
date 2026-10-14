import db from '../../config/connection.js';

/**
 * The project form's curated lists — National Initiatives, Domains and each
 * project type's Categories — read from `project_vocabulary_options`, which
 * administrators edit on Form Management.
 *
 * Kept apart from `schemeVocabulary.js` so that module stays free of database
 * access: callers load the lists here and hand them to its checks.
 */

/** Matches the `project_vocabulary_options.list_key` enum. */
export const VOCABULARY_LISTS = ['national_initiative', 'domain', 'category'];

/**
 * The lists as names, in the order the form offers them.
 *
 * `activeOnly` is for choosing a new value — a retired entry is not offered.
 * Matching a value already stored reads every entry, so a retired one is
 * still recognised and stored in its curated case.
 */
export async function loadProjectVocabulary({ activeOnly = true } = {}) {
  const [rows] = await db.query(
    `SELECT list_key, project_type, name
       FROM project_vocabulary_options
      ${activeOnly ? 'WHERE is_active = 1' : ''}
      ORDER BY list_key, project_type, sort_order, name`,
  );

  const vocabulary = { nationalInitiatives: [], domains: [], categoriesByType: {} };
  for (const row of rows) {
    if (row.list_key === 'national_initiative') vocabulary.nationalInitiatives.push(row.name);
    else if (row.list_key === 'domain') vocabulary.domains.push(row.name);
    else if (row.list_key === 'category') {
      (vocabulary.categoriesByType[row.project_type] ??= []).push(row.name);
    }
  }
  return vocabulary;
}
