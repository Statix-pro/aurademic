import db from '../../config/connection.js';
import { VOCABULARY_LISTS, loadProjectVocabulary } from '../shared/projectVocabularyStore.js';
import {
  SCHEME_PROJECT_TYPES,
  toSchemeCategory,
  toSchemeDomain,
  toSchemeProjectType,
} from '../shared/schemeVocabulary.js';
import { toStoredWebsite } from '../shared/webUrl.js';

const formOptionsModel = {
  /**
   * Two entries with the same name make the publication form's journal picker ambiguous —
   * and because each holds its own National/International value, a publication could be
   * saved against the copy the user did not pick. Names are therefore kept unique here.
   *
   * Returns the trimmed name so callers store exactly what was checked: MySQL ignores
   * trailing spaces when comparing but not leading ones, so storing ' Nature' untrimmed
   * would let a later 'Nature' pass this guard and create the near-duplicate it exists
   * to prevent.
   */
  async assertJournalNameIsFree(journalName, excludeId = null) {
    const name = String(journalName || '').trim();
    if (!name) {
      const error = new Error('Journal name is required.');
      error.statusCode = 400;
      throw error;
    }

    const params = [name];
    let sql = 'SELECT id FROM journal_options WHERE journal_name = ?';
    if (excludeId) {
      sql += ' AND id <> ?';
      params.push(excludeId);
    }

    const [rows] = await db.query(sql, params);
    if (rows.length > 0) {
      const error = new Error(`A journal named "${name}" already exists.`);
      error.statusCode = 409;
      throw error;
    }

    return name;
  },

  async addJournalOption(journal) {
    try {
      const journalName = await formOptionsModel.assertJournalNameIsFree(journal.journal_name);
      const [result] = await db.query(
        // `level_source = 'admin'`: a level chosen here is never overridden by an import.
        `INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn, impact_factor, cite_score, category, level_source)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin')`,
        [
          journalName,
          journal.publisher || '',
          journal.website || '',
          journal.print_issn || '',
          journal.online_issn || '',
          journal.impact_factor || null,
          journal.cite_score || null,
          journal.category || 'National',
        ],
      );
      return { id: result.insertId, ...journal, journal_name: journalName };
    } catch (error) {
      // A rejected request (duplicate name, missing name) keeps its own status instead of
      // being reported as a server fault.
      if (error.statusCode) throw error;
      console.error('Database error in addJournalOption:', error);
      throw new Error(`Error adding journal option: ${error.message}`);
    }
  },

  async getJournalOptions() {
    try {
      const [rows] = await db.query('SELECT * FROM journal_options ORDER BY journal_name');
      return rows;
    } catch (error) {
      console.error('Database error in getJournalOptions:', error);
      throw new Error(`Error getting journal options: ${error.message}`);
    }
  },

  async updateJournalOption(id, updatedData) {
    try {
      const journalName = await formOptionsModel.assertJournalNameIsFree(
        updatedData.journal_name,
        id,
      );
      const category = updatedData.category || 'National';
      // The level counts as an admin's decision — one no journal-list import overrides —
      // only when this edit changes it. Fixing a website must not freeze a level nobody
      // chose. `level_source` is assigned first, so it compares against the old category:
      // MySQL applies an UPDATE's assignments left to right.
      const [result] = await db.query(
        `UPDATE journal_options
                 SET level_source = IF(category <=> ?, level_source, 'admin'), journal_name = ?, publisher = ?, website = ?, print_issn = ?, online_issn = ?, impact_factor = ?, cite_score = ?, category = ?
                 WHERE id = ?`,
        [
          category,
          journalName,
          updatedData.publisher || '',
          updatedData.website || '',
          updatedData.print_issn || '',
          updatedData.online_issn || '',
          updatedData.impact_factor || null,
          updatedData.cite_score || null,
          category,
          id,
        ],
      );
      return result.affectedRows > 0;
    } catch (error) {
      if (error.statusCode) throw error;
      console.error('Database error in updateJournalOption:', error);
      throw new Error(`Error updating journal option: ${error.message}`);
    }
  },

  async deleteJournalOption(id) {
    try {
      const [result] = await db.query('DELETE FROM journal_options WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Database error in deleteJournalOption:', error);
      throw new Error(`Error deleting journal option: ${error.message}`);
    }
  },

  // ==========================================================================
  // Publishers (Conference, Book and Book Chapter records)
  // ==========================================================================

  /** Pending first, since those are the ones waiting on an admin. */
  async getPublishers() {
    try {
      const [rows] = await db.query(
        `SELECT p.id, p.name, p.status, p.requested_by, p.reviewed_at, p.created_at,
                requester.name AS requested_by_name,
                (SELECT COUNT(*) FROM journals j
                  WHERE JSON_EXTRACT(j.publication_details, '$.publisher_id') = p.id) AS usage_count
           FROM publishers p
           LEFT JOIN users requester ON requester.id = p.requested_by
          ORDER BY p.status = 'pending' DESC, p.name`,
      );
      return rows;
    } catch (error) {
      throw new Error(`Error getting publishers: ${error.message}`);
    }
  },

  /** An admin's own add is approved on the spot; there is nobody else to review it. */
  async addPublisher(name, reviewerId) {
    try {
      const [result] = await db.query(
        `INSERT INTO publishers (name, status, reviewed_by, reviewed_at)
         VALUES (?, 'approved', ?, CURRENT_TIMESTAMP)`,
        [name, reviewerId],
      );
      return { id: result.insertId, name, status: 'approved' };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const duplicate = new Error(`A publisher named "${name}" already exists.`);
        duplicate.statusCode = 409;
        throw duplicate;
      }
      throw new Error(`Error adding publisher: ${error.message}`);
    }
  },

  /**
   * Renames and/or approves/rejects. A status change records who reviewed it and when;
   * a rename alone leaves the review stamp as it was.
   */
  async updatePublisher(id, { name, status }, reviewerId) {
    try {
      // MySQL applies SET assignments left to right, so the review stamps must come
      // before `status = ?` to compare against the status the row had.
      const [result] = await db.query(
        `UPDATE publishers
            SET reviewed_by = IF(status <> ?, ?, reviewed_by),
                reviewed_at = IF(status <> ?, CURRENT_TIMESTAMP, reviewed_at),
                name = ?,
                status = ?
          WHERE id = ?`,
        [status, reviewerId, status, name, status, id],
      );
      return result.affectedRows > 0;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const duplicate = new Error(`A publisher named "${name}" already exists.`);
        duplicate.statusCode = 409;
        throw duplicate;
      }
      throw new Error(`Error updating publisher: ${error.message}`);
    }
  },

  /**
   * Refuses once a publication links to the publisher: the record would be left holding
   * an id that resolves to nothing. Rejecting hides it from the picker instead.
   */
  async deletePublisher(id) {
    try {
      // publisher_id is a JSON number, and MySQL compares a JSON number with a string
      // as unequal — the route's '5' would count no references and delete a publisher
      // that records still point at. Bind it as a number.
      const [[usage]] = await db.query(
        `SELECT COUNT(*) AS references_count FROM journals
          WHERE JSON_EXTRACT(publication_details, '$.publisher_id') = ?`,
        [Number(id)],
      );

      if (Number(usage.references_count) > 0) {
        const error = new Error(
          `This publisher is used by ${usage.references_count} publication(s), so it cannot be deleted. Reject it to hide it from the picker instead.`,
        );
        error.statusCode = 409;
        throw error;
      }

      const [result] = await db.query('DELETE FROM publishers WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new Error(`Error deleting publisher: ${error.message}`);
    }
  },

  // ==========================================================================
  // Project organizations (funding agencies, collaborating institutes)
  // ==========================================================================

  async getProjectOrganizations() {
    try {
      const [rows] = await db.query(
        `SELECT id, name, short_name, category, city, state, country, website,
                is_funding_agency, is_internal, is_active, sort_order
           FROM project_organizations
          ORDER BY is_internal DESC, sort_order, name`,
      );
      return rows;
    } catch (error) {
      throw new Error(`Error getting project organizations: ${error.message}`);
    }
  },

  async addProjectOrganization(data) {
    try {
      const [result] = await db.query(
        `INSERT INTO project_organizations
          (name, short_name, category, city, state, country, website, is_funding_agency, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.short_name || null,
          data.category || null,
          data.city || null,
          data.state || null,
          data.country || 'India',
          toStoredWebsite(data.website),
          data.is_funding_agency === undefined ? 1 : Number(Boolean(data.is_funding_agency)),
          Number(data.sort_order) || 0,
        ],
      );
      return { id: result.insertId, ...data };
    } catch (error) {
      // A rejected website carries its own status; keep it instead of masking
      // a bad request as a server fault.
      if (error.statusCode) throw error;
      throw new Error(`Error adding project organization: ${error.message}`);
    }
  },

  async updateProjectOrganization(id, data) {
    try {
      const [result] = await db.query(
        `UPDATE project_organizations
            SET name = ?, short_name = ?, category = ?, city = ?, state = ?, country = ?,
                website = ?, is_funding_agency = ?, is_active = ?, sort_order = ?
          WHERE id = ?`,
        [
          data.name,
          data.short_name || null,
          data.category || null,
          data.city || null,
          data.state || null,
          data.country || 'India',
          toStoredWebsite(data.website),
          data.is_funding_agency === undefined ? 1 : Number(Boolean(data.is_funding_agency)),
          data.is_active === undefined ? 1 : Number(Boolean(data.is_active)),
          Number(data.sort_order) || 0,
          id,
        ],
      );
      return result.affectedRows > 0;
    } catch (error) {
      // A rejected website carries its own status; keep it instead of masking
      // a bad request as a server fault.
      if (error.statusCode) throw error;
      throw new Error(`Error updating project organization: ${error.message}`);
    }
  },

  /**
   * Deactivates instead of deleting once an organization is referenced: a
   * project keeps pointing at the agency that funded it, so removing the row
   * would erase that history.
   */
  async deleteProjectOrganization(id) {
    try {
      const [[usage]] = await db.query(
        `SELECT
            (SELECT COUNT(*) FROM research_projects WHERE funding_organization_id = ?) +
            (SELECT COUNT(*) FROM project_schemes WHERE organization_id = ?) +
            (SELECT COUNT(*) FROM project_collaborators WHERE organization_id = ?) +
            (SELECT COUNT(*) FROM project_finance_rows WHERE organization_id = ?) +
            (SELECT COUNT(*) FROM project_grant_disbursements WHERE organization_id = ?) +
            (SELECT COUNT(*) FROM project_budget_heads WHERE contribution_organization_id = ?) +
            (SELECT COUNT(*) FROM project_transactions WHERE contribution_organization_id = ?)
            AS references_count`,
        [id, id, id, id, id, id, id],
      );

      if (Number(usage.references_count) > 0) {
        const [result] = await db.query(
          'UPDATE project_organizations SET is_active = 0 WHERE id = ?',
          [id],
        );
        return result.affectedRows > 0 ? { deactivated: true } : false;
      }

      const [result] = await db.query('DELETE FROM project_organizations WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting project organization: ${error.message}`);
    }
  },

  // ==========================================================================
  // Project schemes
  // ==========================================================================

  async getProjectSchemes() {
    try {
      const [rows] = await db.query(
        `SELECT ps.id, ps.organization_id, ps.project_type, ps.name, ps.domain, ps.category,
                ps.website,
                ps.is_active, ps.sort_order, org.name AS organization_name
           FROM project_schemes ps
           JOIN project_organizations org ON ps.organization_id = org.id
          ORDER BY org.name, ps.sort_order, ps.name`,
      );
      return rows;
    } catch (error) {
      throw new Error(`Error getting project schemes: ${error.message}`);
    }
  },

  async addProjectScheme(data) {
    try {
      const projectType = toSchemeProjectType(data.project_type);
      // A new value must be one the lists still offer.
      const { domains, categoriesByType } = await loadProjectVocabulary();
      // Answered with what was stored — the curated spelling and the
      // normalized website — rather than echoing what was sent.
      const stored = {
        project_type: projectType,
        domain: toSchemeDomain(data.domain, projectType, domains),
        category: toSchemeCategory(data.category, projectType, categoriesByType),
        website: toStoredWebsite(data.website),
      };
      const [result] = await db.query(
        `INSERT INTO project_schemes
           (organization_id, project_type, name, domain, category, website, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.organization_id,
          stored.project_type,
          data.name,
          stored.domain,
          stored.category,
          stored.website,
          Number(data.sort_order) || 0,
        ],
      );
      return { id: result.insertId, ...data, ...stored };
    } catch (error) {
      // A rejected website carries its own status; keep it instead of masking
      // a bad request as a server fault.
      if (error.statusCode) throw error;
      throw new Error(`Error adding project scheme: ${error.message}`);
    }
  },

  /**
   * Moving a scheme to another funding agency or project type would strand
   * every project that already points at it: the project keeps its own
   * funding_organization_id and project_type, so its next save fails the
   * "scheme belongs to a different funding agency" (or type) check. The move is
   * refused while such projects exist, in the same spirit as
   * `deleteProjectScheme` deactivating instead of deleting.
   */
  async updateProjectScheme(id, data) {
    try {
      const website = toStoredWebsite(data.website);
      const organizationId = Number(data.organization_id);
      const projectType = toSchemeProjectType(data.project_type);

      const [[current]] = await db.query(
        `SELECT organization_id, project_type, domain, category
           FROM project_schemes WHERE id = ? LIMIT 1`,
        [id],
      );
      if (!current) return false;
      const typeChanged = current.project_type !== projectType;

      // A scheme may hold a value the lists no longer offer — one an
      // administrator has since renamed or retired, or free text saved before
      // the lists existed. Resubmitting that same value is let through, so
      // editing the scheme's name or website is not blocked by a field the
      // admin did not touch; changing it must pick a value the lists offer.
      // Only while the type is unchanged: under a new type the value is checked
      // against that type's list like any other.
      // Trimmed on both sides: free text could have been saved with a stray
      // space, which the form's select does not send back.
      const { domains, categoriesByType } = await loadProjectVocabulary();
      const keepStored = (value, stored, toListed) =>
        !typeChanged && stored && String(value ?? '').trim() === String(stored).trim()
          ? stored
          : toListed(value);
      const domain = keepStored(data.domain, current.domain, (value) =>
        toSchemeDomain(value, projectType, domains),
      );
      const category = keepStored(data.category, current.category, (value) =>
        toSchemeCategory(value, projectType, categoriesByType),
      );

      // A project's scheme must match both its agency and its type, so either
      // move strands the projects already on the scheme.
      const agencyChanged = Number(current.organization_id) !== organizationId;
      if (agencyChanged || typeChanged) {
        const [[usage]] = await db.query(
          'SELECT COUNT(*) AS references_count FROM research_projects WHERE scheme_id = ?',
          [id],
        );

        if (Number(usage.references_count) > 0) {
          const [what, where] = agencyChanged
            ? ['funding agency', 'agency']
            : ['project type', 'type'];
          const error = new Error(
            `This scheme is used by existing projects, so its ${what} cannot be changed. Deactivate it and add the scheme under the new ${where} instead.`,
          );
          error.statusCode = 409;
          throw error;
        }
      }

      const [result] = await db.query(
        `UPDATE project_schemes
            SET organization_id = ?, project_type = ?, name = ?, domain = ?, category = ?,
                website = ?, is_active = ?, sort_order = ?
          WHERE id = ?`,
        [
          organizationId,
          projectType,
          data.name,
          domain,
          category,
          website,
          data.is_active === undefined ? 1 : Number(Boolean(data.is_active)),
          Number(data.sort_order) || 0,
          id,
        ],
      );
      return result.affectedRows > 0;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new Error(`Error updating project scheme: ${error.message}`);
    }
  },

  /** Deactivates a scheme that projects already reference; see above. */
  async deleteProjectScheme(id) {
    try {
      const [[usage]] = await db.query(
        'SELECT COUNT(*) AS references_count FROM research_projects WHERE scheme_id = ?',
        [id],
      );

      if (Number(usage.references_count) > 0) {
        const [result] = await db.query('UPDATE project_schemes SET is_active = 0 WHERE id = ?', [
          id,
        ]);
        return result.affectedRows > 0 ? { deactivated: true } : false;
      }

      const [result] = await db.query('DELETE FROM project_schemes WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting project scheme: ${error.message}`);
    }
  },

  // ==========================================================================
  // Project budget heads
  //
  // The vocabulary the project form offers under "Budget Head(s)" — the heads a
  // funding agency recognises, which is a different list from the institution's
  // own `budget_heads` catalog (see
  // migrations/20260908_project_budget_heads_by_name.sql). A project stores the
  // head by name in three tables and holds no id, so everything here is about
  // what the form offers next, never about what a saved project already says.
  // ==========================================================================

  /**
   * A head is offered under a group, and the same name may belong to two of them
   * — `Consumables` is budgeted on a research grant and on a sponsored event
   * alike — so the duplicate guard is on the pair, matching
   * `uq_project_budget_head_options`.
   */
  async assertProjectBudgetHeadIsFree(name, headGroup, excludeId = null) {
    const headName = String(name || '').trim();
    const group = String(headGroup || '').trim();

    if (!headName) {
      const error = new Error('A budget head name is required.');
      error.statusCode = 400;
      throw error;
    }
    if (!group) {
      const error = new Error('A budget head group is required.');
      error.statusCode = 400;
      throw error;
    }

    const params = [group, headName];
    let sql = 'SELECT id FROM project_budget_head_options WHERE head_group = ? AND name = ?';
    if (excludeId) {
      sql += ' AND id <> ?';
      params.push(excludeId);
    }

    const [rows] = await db.query(sql, params);
    if (rows.length > 0) {
      const error = new Error(`"${headName}" is already a head under ${group}.`);
      error.statusCode = 409;
      throw error;
    }

    return { name: headName, head_group: group };
  },

  async getProjectBudgetHeads() {
    try {
      const [rows] = await db.query(
        `SELECT id, name, head_group, is_active, sort_order
           FROM project_budget_head_options
          ORDER BY head_group, sort_order, name`,
      );
      return rows;
    } catch (error) {
      throw new Error(`Error getting project budget heads: ${error.message}`);
    }
  },

  async addProjectBudgetHead(data) {
    try {
      const head = await formOptionsModel.assertProjectBudgetHeadIsFree(data.name, data.head_group);
      const [result] = await db.query(
        `INSERT INTO project_budget_head_options (name, head_group, is_active, sort_order)
         VALUES (?, ?, ?, ?)`,
        [
          head.name,
          head.head_group,
          data.is_active === undefined ? 1 : Number(Boolean(data.is_active)),
          Number(data.sort_order) || 0,
        ],
      );
      return { id: result.insertId, ...data, ...head };
    } catch (error) {
      if (error.statusCode) throw error;
      throw new Error(`Error adding project budget head: ${error.message}`);
    }
  },

  /**
   * Renaming a head changes only what the form offers from here on. The
   * projects already budgeted, funded and spent under the old name keep it —
   * they hold the name itself, not a reference — so a rename is a new head as
   * far as existing rows are concerned, and their allotments and ledger lines
   * stay grouped under what they were sanctioned as.
   */
  async updateProjectBudgetHead(id, data) {
    try {
      const head = await formOptionsModel.assertProjectBudgetHeadIsFree(
        data.name,
        data.head_group,
        id,
      );
      const [result] = await db.query(
        `UPDATE project_budget_head_options
            SET name = ?, head_group = ?, is_active = ?, sort_order = ?
          WHERE id = ?`,
        [
          head.name,
          head.head_group,
          data.is_active === undefined ? 1 : Number(Boolean(data.is_active)),
          Number(data.sort_order) || 0,
          id,
        ],
      );
      return result.affectedRows > 0;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new Error(`Error updating project budget head: ${error.message}`);
    }
  },

  /**
   * Deactivates instead of deleting once a project has budgeted, shared or
   * spent under the head. The name is all those rows hold, so the row here is
   * what says the head was a real one rather than a typo — and the form keeps
   * showing a stored head that is no longer offered.
   */
  async deleteProjectBudgetHead(id) {
    try {
      const [[head]] = await db.query(
        'SELECT name FROM project_budget_head_options WHERE id = ? LIMIT 1',
        [id],
      );
      if (!head) return false;

      const [[usage]] = await db.query(
        `SELECT
            (SELECT COUNT(*) FROM project_budget_heads WHERE budget_head_name = ?) +
            (SELECT COUNT(*) FROM project_finance_row_heads WHERE budget_head_name = ?) +
            (SELECT COUNT(*) FROM project_transactions
              WHERE head_kind = 'expenditure' AND head_name = ?)
            AS references_count`,
        [head.name, head.name, head.name],
      );

      if (Number(usage.references_count) > 0) {
        const [result] = await db.query(
          'UPDATE project_budget_head_options SET is_active = 0 WHERE id = ?',
          [id],
        );
        return result.affectedRows > 0 ? { deactivated: true } : false;
      }

      const [result] = await db.query('DELETE FROM project_budget_head_options WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting project budget head: ${error.message}`);
    }
  },

  // ==========================================================================
  // Project vocabulary — National Initiatives, Domains, Categories
  //
  // The curated lists the project form offers (`project_vocabulary_options`).
  // Like budget heads, a value is stored by name wherever it is used, so a
  // rename or retirement here changes only what is offered next; projects and
  // schemes that hold the old name keep it.
  // ==========================================================================

  /**
   * The entry as it will be stored, refused when it is blank or already on its
   * list. A category belongs to one project type's list; the other two lists
   * are not split by type and store ''.
   */
  async assertVocabularyEntryIsFree(listKey, data, excludeId = null) {
    if (!VOCABULARY_LISTS.includes(listKey)) {
      throw Object.assign(new Error('Unknown list.'), { statusCode: 400 });
    }

    const name = String(data.name ?? '').trim();
    if (!name) {
      throw Object.assign(new Error('A name is required.'), { statusCode: 400 });
    }
    if (name.length > 255) {
      throw Object.assign(new Error('The name is longer than 255 characters.'), {
        statusCode: 400,
      });
    }

    let projectType = '';
    if (listKey === 'category') {
      projectType = String(data.project_type ?? '').trim();
      if (!SCHEME_PROJECT_TYPES.includes(projectType)) {
        throw Object.assign(new Error('Choose the project type the category is for.'), {
          statusCode: 400,
        });
      }
    }

    const params = [listKey, projectType, name];
    let sql = `SELECT id FROM project_vocabulary_options
                WHERE list_key = ? AND project_type = ? AND name = ?`;
    if (excludeId) {
      sql += ' AND id <> ?';
      params.push(excludeId);
    }

    const [rows] = await db.query(sql, params);
    if (rows.length > 0) {
      throw Object.assign(new Error(`"${name}" is already on this list.`), { statusCode: 409 });
    }

    return { name, project_type: projectType };
  },

  async getProjectVocabulary(listKey) {
    try {
      const [rows] = await db.query(
        `SELECT id, list_key, project_type, name, is_active
           FROM project_vocabulary_options
          WHERE list_key = ?
          -- Alphabetical within a list. Categories are grouped by project type
          -- first, in the order the type picker offers them.
          ORDER BY FIELD(project_type, ?), name`,
        [listKey, SCHEME_PROJECT_TYPES],
      );
      return rows;
    } catch (error) {
      throw new Error(`Error getting project vocabulary: ${error.message}`);
    }
  },

  async addProjectVocabularyEntry(listKey, data) {
    try {
      const entry = await formOptionsModel.assertVocabularyEntryIsFree(listKey, data);
      const [result] = await db.query(
        `INSERT INTO project_vocabulary_options (list_key, project_type, name, is_active)
         VALUES (?, ?, ?, ?)`,
        [
          listKey,
          entry.project_type,
          entry.name,
          data.is_active === undefined ? 1 : Number(Boolean(data.is_active)),
        ],
      );
      return { id: result.insertId, list_key: listKey, ...data, ...entry };
    } catch (error) {
      if (error.statusCode) throw error;
      throw new Error(`Error adding project vocabulary entry: ${error.message}`);
    }
  },

  /** Renaming changes only what the form offers next; see the section note. */
  async updateProjectVocabularyEntry(listKey, id, data) {
    try {
      const entry = await formOptionsModel.assertVocabularyEntryIsFree(listKey, data, id);
      const [result] = await db.query(
        `UPDATE project_vocabulary_options
            SET project_type = ?, name = ?, is_active = ?
          WHERE id = ? AND list_key = ?`,
        [
          entry.project_type,
          entry.name,
          data.is_active === undefined ? 1 : Number(Boolean(data.is_active)),
          id,
          listKey,
        ],
      );
      return result.affectedRows > 0;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new Error(`Error updating project vocabulary entry: ${error.message}`);
    }
  },

  /**
   * Deactivates instead of deleting once a project or scheme holds the value,
   * the way budget heads do: the row here is what says the stored name was a
   * real entry rather than a typo, and it is still matched when that record
   * is saved again.
   */
  async deleteProjectVocabularyEntry(listKey, id) {
    try {
      const [[entry]] = await db.query(
        `SELECT name, project_type FROM project_vocabulary_options
          WHERE id = ? AND list_key = ? LIMIT 1`,
        [id, listKey],
      );
      if (!entry) return false;

      const usageSql = {
        national_initiative: `SELECT COUNT(*) AS references_count FROM project_tags
                               WHERE tag_type = 'national_initiative' AND tag_value = ?`,
        domain: `SELECT
                   (SELECT COUNT(*) FROM research_projects WHERE domain = ?) +
                   (SELECT COUNT(*) FROM project_schemes WHERE domain = ?)
                   AS references_count`,
        category: `SELECT COUNT(*) AS references_count FROM project_schemes
                    WHERE category = ? AND project_type = ?`,
      }[listKey];
      const usageParams = {
        national_initiative: [entry.name],
        domain: [entry.name, entry.name],
        category: [entry.name, entry.project_type],
      }[listKey];

      const [[usage]] = await db.query(usageSql, usageParams);

      if (Number(usage.references_count) > 0) {
        const [result] = await db.query(
          'UPDATE project_vocabulary_options SET is_active = 0 WHERE id = ?',
          [id],
        );
        return result.affectedRows > 0 ? { deactivated: true } : false;
      }

      const [result] = await db.query('DELETE FROM project_vocabulary_options WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting project vocabulary entry: ${error.message}`);
    }
  },
};

export default formOptionsModel;
