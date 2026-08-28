import db from '../../config/connection.js';

const formOptionsModel = {
  async addJournalOption(journal) {
    try {
      const [result] = await db.query(
        `INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn, impact_factor, cite_score, category) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          journal.journal_name,
          journal.publisher || '',
          journal.website || '',
          journal.print_issn || '',
          journal.online_issn || '',
          journal.impact_factor || null,
          journal.cite_score || null,
          journal.category || 'National',
        ],
      );
      return { id: result.insertId, ...journal };
    } catch (error) {
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
      const [result] = await db.query(
        `UPDATE journal_options 
                 SET journal_name = ?, publisher = ?, website = ?, print_issn = ?, online_issn = ?, impact_factor = ?, cite_score = ?, category = ? 
                 WHERE id = ?`,
        [
          updatedData.journal_name,
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
          data.website || null,
          data.is_funding_agency === undefined ? 1 : Number(Boolean(data.is_funding_agency)),
          Number(data.sort_order) || 0,
        ],
      );
      return { id: result.insertId, ...data };
    } catch (error) {
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
          data.website || null,
          data.is_funding_agency === undefined ? 1 : Number(Boolean(data.is_funding_agency)),
          data.is_active === undefined ? 1 : Number(Boolean(data.is_active)),
          Number(data.sort_order) || 0,
          id,
        ],
      );
      return result.affectedRows > 0;
    } catch (error) {
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
          data.website || null,
          Number(data.sort_order) || 0,
        ],
      );
      return { id: result.insertId, ...data };
    } catch (error) {
      throw new Error(`Error adding project scheme: ${error.message}`);
    }
  },

  async updateProjectScheme(id, data) {
    try {
      const [result] = await db.query(
        `UPDATE project_schemes
            SET organization_id = ?, name = ?, domain = ?, category = ?, website = ?,
                is_active = ?, sort_order = ?
          WHERE id = ?`,
        [
          data.organization_id,
          data.name,
          data.domain || null,
          data.category || null,
          data.website || null,
          data.is_active === undefined ? 1 : Number(Boolean(data.is_active)),
          Number(data.sort_order) || 0,
          id,
        ],
      );
      return result.affectedRows > 0;
    } catch (error) {
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
};

export default formOptionsModel;
