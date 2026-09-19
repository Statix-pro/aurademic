import db from '../../config/connection.js';
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
        `INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn, impact_factor, cite_score, category) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      const [result] = await db.query(
        `UPDATE journal_options 
                 SET journal_name = ?, publisher = ?, website = ?, print_issn = ?, online_issn = ?, impact_factor = ?, cite_score = ?, category = ? 
                 WHERE id = ?`,
        [
          journalName,
          updatedData.publisher || '',
          updatedData.website || '',
          updatedData.print_issn || '',
          updatedData.online_issn || '',
          updatedData.impact_factor || null,
          updatedData.cite_score || null,
          updatedData.category || 'National',
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
            (SELECT COUNT(*) FROM project_grant_disbursements WHERE organization_id = ?)
            AS references_count`,
        [id, id, id, id, id],
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
        `SELECT ps.id, ps.organization_id, ps.name, ps.domain, ps.category, ps.website,
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
      const [result] = await db.query(
        `INSERT INTO project_schemes (organization_id, name, domain, category, website, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.organization_id,
          data.name,
          data.domain || null,
          data.category || null,
          toStoredWebsite(data.website),
          Number(data.sort_order) || 0,
        ],
      );
      return { id: result.insertId, ...data };
    } catch (error) {
      // A rejected website carries its own status; keep it instead of masking
      // a bad request as a server fault.
      if (error.statusCode) throw error;
      throw new Error(`Error adding project scheme: ${error.message}`);
    }
  },

  /**
   * Moving a scheme to another funding agency would strand every project that
   * already points at it: the project keeps its own funding_organization_id, so
   * its next save fails the "scheme belongs to a different funding agency"
   * check. The move is refused while such projects exist, in the same spirit as
   * `deleteProjectScheme` deactivating instead of deleting.
   */
  async updateProjectScheme(id, data) {
    try {
      const website = toStoredWebsite(data.website);
      const organizationId = Number(data.organization_id);

      const [[current]] = await db.query(
        'SELECT organization_id FROM project_schemes WHERE id = ? LIMIT 1',
        [id],
      );
      if (!current) return false;

      if (Number(current.organization_id) !== organizationId) {
        const [[usage]] = await db.query(
          'SELECT COUNT(*) AS references_count FROM research_projects WHERE scheme_id = ?',
          [id],
        );

        if (Number(usage.references_count) > 0) {
          const error = new Error(
            'This scheme is used by existing projects, so its funding agency cannot be changed. Deactivate it and add the scheme under the new agency instead.',
          );
          error.statusCode = 409;
          throw error;
        }
      }

      const [result] = await db.query(
        `UPDATE project_schemes
            SET organization_id = ?, name = ?, domain = ?, category = ?, website = ?,
                is_active = ?, sort_order = ?
          WHERE id = ?`,
        [
          organizationId,
          data.name,
          data.domain || null,
          data.category || null,
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
};

export default formOptionsModel;
