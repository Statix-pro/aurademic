import logger from '../../config/logger.js';
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
        ]
      );
      return { id: result.insertId, ...journal };
    } catch (error) {
      logger.error('Database error in addJournalOption:', error);
      throw new Error(`Error adding journal option: ${error.message}`);
    }
  },

  async getJournalOptions() {
    try {
      const [rows] = await db.query(
        'SELECT * FROM journal_options ORDER BY journal_name'
      );
      return rows;
    } catch (error) {
      logger.error('Database error in getJournalOptions:', error);
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
        ]
      );
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Database error in updateJournalOption:', error);
      throw new Error(`Error updating journal option: ${error.message}`);
    }
  },

  async deleteJournalOption(id) {
    try {
      const [result] = await db.query(
        'DELETE FROM journal_options WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Database error in deleteJournalOption:', error);
      throw new Error(`Error deleting journal option: ${error.message}`);
    }
  },

  // Project Agency Options
  async getProjectAgencyOptions() {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_agency_options ORDER BY name'
      );
      return rows;
    } catch (error) {
      throw new Error(`Error getting project agency options: ${error.message}`);
    }
  },

  async addProjectAgencyOption(data) {
    try {
      const [result] = await db.query(
        'INSERT INTO project_agency_options (name) VALUES (?)',
        [data.name]
      );
      return { id: result.insertId, name: data.name };
    } catch (error) {
      throw new Error(`Error adding project agency option: ${error.message}`);
    }
  },

  async updateProjectAgencyOption(id, data) {
    try {
      const [result] = await db.query(
        'UPDATE project_agency_options SET name = ? WHERE id = ?',
        [data.name, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error updating project agency option: ${error.message}`);
    }
  },

  async deleteProjectAgencyOption(id) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_agency_options WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting project agency option: ${error.message}`);
    }
  },

  // Project Scheme Options
  async getProjectSchemeOptions() {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_scheme_options ORDER BY name'
      );
      return rows;
    } catch (error) {
      throw new Error(`Error getting project scheme options: ${error.message}`);
    }
  },

  async addProjectSchemeOption(data) {
    try {
      const [result] = await db.query(
        'INSERT INTO project_scheme_options (name) VALUES (?)',
        [data.name]
      );
      return { id: result.insertId, name: data.name };
    } catch (error) {
      throw new Error(`Error adding project scheme option: ${error.message}`);
    }
  },

  async updateProjectSchemeOption(id, data) {
    try {
      const [result] = await db.query(
        'UPDATE project_scheme_options SET name = ? WHERE id = ?',
        [data.name, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error updating project scheme option: ${error.message}`);
    }
  },

  async deleteProjectSchemeOption(id) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_scheme_options WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting project scheme option: ${error.message}`);
    }
  },

  // Project Agency Type Options
  async getProjectAgencyTypeOptions() {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_agency_type_options ORDER BY name'
      );
      return rows;
    } catch (error) {
      throw new Error(
        `Error getting project agency type options: ${error.message}`
      );
    }
  },

  async addProjectAgencyTypeOption(data) {
    try {
      const [result] = await db.query(
        'INSERT INTO project_agency_type_options (name) VALUES (?)',
        [data.name]
      );
      return { id: result.insertId, name: data.name };
    } catch (error) {
      throw new Error(
        `Error adding project agency type option: ${error.message}`
      );
    }
  },

  async updateProjectAgencyTypeOption(id, data) {
    try {
      const [result] = await db.query(
        'UPDATE project_agency_type_options SET name = ? WHERE id = ?',
        [data.name, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(
        `Error updating project agency type option: ${error.message}`
      );
    }
  },

  async deleteProjectAgencyTypeOption(id) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_agency_type_options WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(
        `Error deleting project agency type option: ${error.message}`
      );
    }
  },
};

export default formOptionsModel;
