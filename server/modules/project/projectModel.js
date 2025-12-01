import db from '../../config/connection.js';

const researchProjectModel = {
  async create(projectData) {
    try {
      if (!projectData || typeof projectData !== 'object') {
        throw new Error('Invalid project data');
      }

      // Ensure we're using the correct column names as per schema
      const validProjectData = {
        project_category: projectData.project_category,
        category: projectData.category,
        title: projectData.title,
        agency_id: projectData.agency_id,
        scheme_id: projectData.scheme_id,
        duration_years: projectData.duration_years,
        duration_months: projectData.duration_months,
        duration_days: projectData.duration_days,
        date_of_submission: projectData.date_of_submission || null,
        submission_status: projectData.submission_status,
        is_collaboration_enabled: projectData.is_collaboration_enabled,
        application_number: projectData.application_number,
        file_path: projectData.file_path,
      };

      // Filter out null/undefined values
      const filteredData = Object.fromEntries(
        Object.entries(validProjectData).filter(
          ([_, value]) => value !== null && value !== undefined
        )
      );

      const columns = Object.keys(filteredData).join(', ');
      const values = Object.values(filteredData)
        .map((value) => (typeof value === 'string' ? `'${value}'` : value))
        .join(', ');

      const query = `INSERT INTO research_projects (${columns}) VALUES (${values})`;
      const [result] = await db.query(query);
      return result;
    } catch (error) {
      throw new Error(`Error creating research project: ${error.message}`);
    }
  },

  async getById(id) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM research_projects WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      throw new Error(`Error retrieving research project: ${error.message}`);
    }
  },

  async update(id, projectData) {
    try {
      console.log('Updating project with ID:', id);
      console.log('Project data for update:', projectData);
      // Define the list of columns allowed in the research_projects table
      const allowedFields = [
        'project_category',
        'category',
        'title',
        'agency_id',
        'scheme_id',
        'duration_years',
        'duration_months',
        'duration_days',
        'date_of_submission',
        'submission_status',
        'is_collaboration_enabled',
        'application_number',
        'file_path',
      ];

      // Filter out any keys not in allowedFields and remove null/undefined values.
      const filteredData = Object.fromEntries(
        Object.entries(projectData).filter(
          ([key, value]) =>
            allowedFields.includes(key) && value !== null && value !== undefined
        )
      );

      const [result] = await db.query(
        'UPDATE research_projects SET ? WHERE id = ?',
        [filteredData, id]
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating research project: ${error.message}`);
    }
  },

  async updateProject(id, projectData) {
    try {
      const allowedFields = [
        'project_category',
        'category',
        'title',
        'agency_id',
        'scheme_id',
        'duration_years',
        'duration_months',
        'duration_days',
        'date_of_submission',
        'submission_status',
        'is_collaboration_enabled',
        'application_number',
        'file_path',
      ];

      // Only include properties that are actually present in projectData
      const filteredData = Object.fromEntries(
        Object.entries(projectData).filter(([key, value]) =>
          allowedFields.includes(key)
        )
      );

      // Proceed only if there is any fields to update
      if (Object.keys(filteredData).length === 0) {
        return { affectedRows: 0 };
      }

      const [result] = await db.query(
        'UPDATE research_projects SET ? WHERE id = ?',
        [filteredData, id]
      );
      return result;
    } catch (error) {
      console.error('Error during project update in model:', {
        message: error.message,
        stack: error.stack,
        projectId: id,
        data: projectData,
      });
      throw new Error(`Error updating research project: ${error.message}`);
    }
  },

  async delete(id) {
    try {
      const [result] = await db.query(
        'DELETE FROM research_projects WHERE id = ?',
        [id]
      );
      return result;
    } catch (error) {
      console.error('Error during project update in model:', {
        message: error.message,
        stack: error.stack,
        projectId: id,
        data: projectData,
      });
      throw new Error(`Error updating research project: ${error.message}`);
    }
  },

  async addFinancialContribution(projectId, contributionData) {
    try {
      // Get agency_type_id if agencyType is provided
      let agency_type_id = null;
      if (contributionData.agency_type || contributionData.agencyType) {
        const agencyTypeName =
          contributionData.agency_type || contributionData.agencyType;
        const [existingAgencyType] = await db.query(
          'SELECT id FROM project_agency_type_options WHERE name = ?',
          [agencyTypeName]
        );

        if (existingAgencyType.length > 0) {
          agency_type_id = existingAgencyType[0].id;
        } else {
          // Create new agency type if it doesn't exist
          const [newAgencyType] = await db.query(
            'INSERT INTO project_agency_type_options (name) VALUES (?)',
            [agencyTypeName]
          );
          agency_type_id = newAgencyType.insertId;
        }
      }

      // First check for any existing contribution with the same basic data
      const [existingContributions] = await db.query(
        `SELECT * FROM project_financial_contributions 
                 WHERE project_id = ? 
                 AND agency = ? 
                 AND amount = ?`,
        [projectId, contributionData.agency, contributionData.amount]
      );

      // If exists, update the existing record
      if (existingContributions.length > 0) {
        const existingContribution = existingContributions[0];
        const [updateResult] = await db.query(
          `UPDATE project_financial_contributions 
                     SET agency_type_id = ? 
                     WHERE id = ?`,
          [agency_type_id, existingContribution.id]
        );
        return { ...existingContribution, agency_type_id };
      }

      // If no existing contribution, insert new one
      const [result] = await db.query(
        `INSERT INTO project_financial_contributions 
                 (project_id, agency_type_id, agency, amount) 
                 VALUES (?, ?, ?, ?)`,
        [
          projectId,
          agency_type_id,
          contributionData.agency,
          contributionData.amount,
        ]
      );

      // Return the inserted contribution with agency type name
      const [insertedContribution] = await db.query(
        `SELECT 
                    pfc.*,
                    pato.name as agency_type_name
                 FROM project_financial_contributions pfc
                 LEFT JOIN project_agency_type_options pato ON pfc.agency_type_id = pato.id
                 WHERE pfc.id = ?`,
        [result.insertId]
      );

      return insertedContribution[0];
    } catch (error) {
      console.error('Detailed error:', error);
      throw new Error(`Error adding financial contribution: ${error.message}`);
    }
  },

  async getFinancialContributions(projectId) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_financial_contributions WHERE project_id = ?',
        [projectId]
      );
      return rows;
    } catch (error) {
      throw new Error(
        `Error retrieving financial contributions: ${error.message}`
      );
    }
  },

  async deleteFinancialContribution(contributionId) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_financial_contributions WHERE id = ?',
        [contributionId]
      );
      return result;
    } catch (error) {
      throw new Error(
        `Error deleting financial contribution: ${error.message}`
      );
    }
  },

  async deleteFinancialContributionsByProjectId(projectId) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_financial_contributions WHERE project_id = ?',
        [projectId]
      );
      return result;
    } catch (error) {
      throw new Error(
        `Error deleting financial contributions: ${error.message}`
      );
    }
  },

  async addCollaboration(projectId, collaborationData) {
    try {
      // Ensure collaborationData is properly structured
      const collaboration = {
        project_id: projectId,
        partner: collaborationData.partner,
        address: collaborationData.address,
        support: collaborationData.support,
      };

      // Check if a collaboration with the same data already exists
      const collabKey = `${collaboration.partner}-${collaboration.address}-${collaboration.support}`;
      const existingCollaboration = await this.getCollaborationByUniqueKey(
        projectId,
        collabKey
      );

      // If collaboration already exists, return it instead of creating a duplicate
      if (existingCollaboration && existingCollaboration.length > 0) {
        return { id: existingCollaboration[0].id, alreadyExists: true };
      }

      // If no existing collaboration found, insert a new one
      const [result] = await db.query(
        'INSERT INTO project_collaborations (project_id, partner, address, support) VALUES (?, ?, ?, ?)',
        [
          collaboration.project_id,
          collaboration.partner,
          collaboration.address,
          collaboration.support,
        ]
      );

      return result;
    } catch (error) {
      throw new Error(`Error adding collaboration: ${error.message}`);
    }
  },

  async updateCollaboration(collabId, collabData) {
    try {
      const { partner, address, support } = collabData;
      const [result] = await db.query(
        'UPDATE project_collaborations SET partner = ?, address = ?, support = ? WHERE id = ?',
        [partner, address, support, collabId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating collaboration: ${error.message}`);
    }
  },

  async deleteCollaboration(collabId) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_collaborations WHERE id = ?',
        [collabId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error deleting collaboration: ${error.message}`);
    }
  },

  async getCollaborations(projectId) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_collaborations WHERE project_id = ?',
        [projectId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving collaborations: ${error.message}`);
    }
  },

  async deleteCollaborationsByProjectId(projectId) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_collaborations WHERE project_id = ?',
        [projectId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error deleting collaborations: ${error.message}`);
    }
  },

  async addProjectDetails(projectId, detailsData) {
    try {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const projectDetails = {
        project_id: projectId,
        outcome_type: '',
      };

      // Handle nested format
      if (detailsData.dateOfPresentation !== undefined) {
        projectDetails.date_of_presentation =
          detailsData.dateOfPresentation?.value || null;
        projectDetails.date_of_result_announcement =
          detailsData.dateOfResultAnnouncement?.value || null;
        projectDetails.sanction_order_amount =
          detailsData.sanctionOrderAmount?.value || null;
        projectDetails.sanction_order_date =
          detailsData.sanctionOrderDate?.value || null;
        projectDetails.project_duration_start_date =
          detailsData.projectDurationStartDate?.value || null;
        projectDetails.project_duration_end_date =
          detailsData.projectDurationEndDate?.value || null;

        if (detailsData.outcome) {
          let outcome = detailsData.outcome;
          if (typeof outcome === 'string') {
            try {
              outcome = JSON.parse(outcome);
            } catch (error) {
              throw new Error('Invalid format for outcome field');
            }
          }

          projectDetails.outcome_type = Object.entries(outcome)
            .filter(([_, value]) => value === true)
            .map(([key]) => key)
            .join(', ');
        }
      }
      // Handle flat format
      else {
        projectDetails.date_of_presentation =
          detailsData.date_of_presentation || null;
        projectDetails.date_of_result_announcement =
          detailsData.date_of_result_announcement || null;
        projectDetails.sanction_order_amount =
          detailsData.sanction_order_amount || null;
        projectDetails.sanction_order_date =
          detailsData.sanction_order_date || null;
        projectDetails.project_duration_start_date =
          detailsData.project_duration_start_date || null;
        projectDetails.project_duration_end_date =
          detailsData.project_duration_end_date || null;
      }

      const [existingDetails] = await db.query(
        'SELECT id, outcome_type FROM project_details WHERE project_id = ?',
        [projectId]
      );

      const values = [
        projectDetails.date_of_presentation,
        projectDetails.date_of_result_announcement,
        projectDetails.sanction_order_amount,
        projectDetails.sanction_order_date,
        projectDetails.project_duration_start_date,
        projectDetails.project_duration_end_date,
        projectDetails.outcome_type || existingDetails?.[0]?.outcome_type || '',
        projectDetails.project_id,
      ];

      if (existingDetails?.length > 0) {
        return await db.query(
          `
                UPDATE project_details 
                SET 
                    date_of_presentation = ?,
                    date_of_result_announcement = ?,
                    sanction_order_amount = ?,
                    sanction_order_date = ?,
                    project_duration_start_date = ?,
                    project_duration_end_date = ?,
                    outcome_type = ?
                WHERE project_id = ?`,
          values
        );
      }

      return await db.query(
        `
            INSERT INTO project_details 
            (date_of_presentation, date_of_result_announcement, 
             sanction_order_amount, sanction_order_date, project_duration_start_date, 
             project_duration_end_date, outcome_type, project_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

        values
      );
    } catch (error) {
      throw new Error(`Error adding project details: ${error.message}`);
    }
  },

  async getProjectDetails(projectId) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_details WHERE project_id = ?',
        [projectId]
      );
      return rows[0];
    } catch (error) {
      throw new Error(`Error retrieving project details: ${error.message}`);
    }
  },

  async updateGrantDisbursement(disbursementId, disbursementData) {
    try {
      // Prepare data with null handling
      // disbursementId is expected to be a number here
      console.log(
        `Model: Updating grant disbursement ID: ${disbursementId} with data:`,
        disbursementData
      );

      // Filter out undefined properties from disbursementData to avoid setting columns to NULL unintentionally
      const validUpdateData = {};
      if (disbursementData.fiscal_year !== undefined)
        validUpdateData.fiscal_year = disbursementData.fiscal_year ?? null;
      if (disbursementData.agency !== undefined)
        validUpdateData.agency = disbursementData.agency ?? null;
      if (disbursementData.amount !== undefined)
        validUpdateData.amount = disbursementData.amount
          ? parseFloat(disbursementData.amount)
          : null;
      if (disbursementData.disbursement_date !== undefined)
        validUpdateData.disbursement_date =
          disbursementData.disbursement_date ?? null;
      if (disbursementData.sanction_letter_path !== undefined)
        validUpdateData.sanction_letter_path =
          disbursementData.sanction_letter_path ?? null;
      if (disbursementData.uc_and_soe_path !== undefined)
        validUpdateData.uc_and_soe_path =
          disbursementData.uc_and_soe_path ?? null;

      if (Object.keys(validUpdateData).length === 0) {
        console.log(
          'Model: No valid fields to update for grant disbursement.',
          disbursementData
        );
        return { affectedRows: 0, message: 'No fields to update.' };
      }

      console.log(
        `Model: Executing UPDATE for project_grant_disbursements SET ? WHERE id = ? with data:`,
        validUpdateData,
        `and ID:`,
        disbursementId
      );

      const [result] = await db.query(
        'UPDATE project_grant_disbursements SET ? WHERE id = ?',
        [validUpdateData, disbursementId]
      );

      console.log('Model: SQL Update result:', result);
      return result;
    } catch (error) {
      console.error('Error in model updateGrantDisbursement:', error);
      console.error('Failed data:', { disbursementId, disbursementData });
      throw new Error(
        `Error updating grant disbursement in model: ${error.message}`
      );
    }
  },

  async addGrantDisbursement(projectId, disbursementData) {
    try {
      // Prepare data, handling nulls explicitly.  Use optional chaining.
      const fiscal_year = disbursementData.fiscal_year ?? null;
      const agency = disbursementData.agency ?? null;
      // Ensure amount is a number or null.
      const amount = disbursementData.amount
        ? parseFloat(disbursementData.amount)
        : null;
      const disbursement_date = disbursementData.disbursement_date ?? null;
      const sanction_letter_path =
        disbursementData.sanction_letter_path ?? null;
      const uc_and_soe_path = disbursementData.uc_and_soe_path ?? null;

      // Check if project ID is valid (optional, but good for data integrity)
      if (!projectId) {
        throw new Error('Project ID is missing');
      }
      // Insert the disbursement using a parameterized query.
      const [result] = await db.query(
        `INSERT INTO project_grant_disbursements 
                (project_id, fiscal_year, agency, amount, disbursement_date, sanction_letter_path, uc_and_soe_path) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          fiscal_year,
          agency,
          amount,
          disbursement_date,
          sanction_letter_path,
          uc_and_soe_path,
        ]
      );

      console.log(
        `Successfully added grant disbursement with ID: ${result.insertId}`
      );
      return result;
    } catch (error) {
      console.error('Error in addGrantDisbursement:', error);
      throw new Error(`Error adding grant disbursement: ${error.message}`);
    }
  },

  async getGrantDisbursements(projectId) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_grant_disbursements WHERE project_id = ?',
        [projectId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving grant disbursements: ${error.message}`);
    }
  },

  async deleteGrantDisbursement(disbursementId) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_grant_disbursements WHERE id = ?',
        [disbursementId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error deleting grant disbursement: ${error.message}`);
    }
  },

  async deleteGrantDisbursementsByProjectId(projectId) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_grant_disbursements WHERE project_id = ?',
        [projectId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error deleting grant disbursements: ${error.message}`);
    }
  },

  async getCollaborationByUniqueKey(projectId, uniqueKey) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM project_collaborations
                 WHERE project_id = ? AND CONCAT(partner, '-', address, '-', support) = ?`,
        [projectId, uniqueKey]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving collaboration: ${error.message}`);
    }
  },
  // async getGrantDisbursementByUniqueKey(projectId, uniqueKey) {
  //     try {
  //         console.log(`Checking for grant disbursement with projectId: ${projectId} and key: ${uniqueKey}`);

  //         // Split the unique key into its components and handle the date properly
  //         const [fiscal_year, agency, amountStr, ...dateParts] = uniqueKey.split('-');

  //         // Reconstruct the date from the remaining parts
  //         const disbursement_date = dateParts.join('-'); // Rejoin date parts with '-'

  //         // Parse amount to float for comparison with DECIMAL field
  //         const amount = parseFloat(amountStr);

  //         // Construct the SQL query with explicit handling for NULL values and proper date format
  //         const [rows] = await db.query(
  //             `SELECT * FROM project_grant_disbursements
  //              WHERE project_id = ?
  //              AND (fiscal_year <=> ? OR (fiscal_year IS NULL AND ? IS NULL))
  //              AND (agency <=> ? OR (agency IS NULL AND ? IS NULL))
  //              AND (amount = ? OR (amount IS NULL AND ? IS NULL))
  //              AND (DATE(disbursement_date) <=> DATE(?) OR (disbursement_date IS NULL AND ? IS NULL))`,
  //             [projectId, fiscal_year, fiscal_year, agency, agency, amount, amount, disbursement_date, disbursement_date]
  //         );

  //         console.log("Result of getGrantDisbursementByUniqueKey query:", rows[0]);
  //         return rows[0];
  //     } catch (error) {
  //         console.error("Error in getGrantDisbursementByUniqueKey:", error);
  //         throw new Error(`Error retrieving grant disbursement: ${error.message}`);
  //     }
  // },

  async doesProjectExist(projectId) {
    const [rows] = await db.query(
      'SELECT 1 FROM research_projects WHERE id = ?',
      [projectId]
    );
    return rows.length > 0;
  },

  async addDocument(projectId, documentData) {
    try {
      const document = {
        project_id: projectId,
        document_type: documentData.document_type,
        file_path: documentData.file_path,
      };

      console.log('Adding document to database:', document);

      const [result] = await db.query(
        'INSERT INTO project_documents (project_id, document_type, file_path) VALUES (?, ?, ?)',
        [document.project_id, document.document_type, document.file_path]
      );

      // Verify the document was saved
      const [savedDocument] = await db.query(
        'SELECT * FROM project_documents WHERE id = ?',
        [result.insertId]
      );

      console.log('Saved document:', savedDocument[0]);

      if (!savedDocument[0]) {
        throw new Error('Document was not saved properly');
      }

      return result;
    } catch (error) {
      console.error('Error in addDocument:', error);
      throw new Error(`Error adding document: ${error.message}`);
    }
  },

  async updateDocuments(projectId, documents) {
    try {
      const currentDocuments = await this.getDocuments(projectId);
      const currentDocsMap = {};
      currentDocuments.forEach((doc) => {
        currentDocsMap[doc.document_type] = doc;
      });

      const updatedDocsMap = {};
      Object.entries(documents).forEach(([docType, docData]) => {
        if (docData.enabled && docData.filePath) {
          updatedDocsMap[docType] = docData.filePath;
        }
      });

      // Identify documents to delete
      for (const docType in currentDocsMap) {
        if (!updatedDocsMap[docType]) {
          await this.deleteDocument(currentDocsMap[docType].id);
        }
      }

      // Identify documents to add or update
      for (const docType in updatedDocsMap) {
        if (currentDocsMap[docType]) {
          await this.updateDocument(
            currentDocsMap[docType].id,
            updatedDocsMap[docType]
          );
        } else {
          await this.addDocument(projectId, {
            document_type: docType,
            file_path: updatedDocsMap[docType],
          });
        }
      }
    } catch (error) {
      throw new Error(`Error updating documents: ${error.message}`);
    }
  },

  async deleteDocument(documentId) {
    try {
      const [result] = await db.query(
        'DELETE FROM project_documents WHERE id = ?',
        [documentId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error deleting document: ${error.message}`);
    }
  },

  async updateDocument(documentId, filePath) {
    try {
      const [result] = await db.query(
        'UPDATE project_documents SET file_path = ? WHERE id = ?',
        [filePath, documentId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating document: ${error.message}`);
    }
  },

  async getDocuments(projectId) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_documents WHERE project_id = ?',
        [projectId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving documents: ${error.message}`);
    }
  },

  // Add an author to a project with PI or Co-PI designation
  async addAuthorToProject(projectId, authorData) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let authorId;
      const {
        designation,
        author_id,
        register_no,
        name,
        department,
        organization,
        country,
        email,
        is_principal,
        is_primary,
      } = authorData;

      if (designation === 'faculty') {
        if (!author_id) throw new Error('Faculty ID is required.');
        const [existingFaculty] = await connection.query(
          'SELECT id FROM authors WHERE author_id = ?',
          [author_id]
        );

        if (existingFaculty.length === 0) {
          // Insert new faculty author
          const [result] = await connection.query(
            'INSERT INTO authors (author_id, designation, name, department, organization, country, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              author_id,
              'faculty',
              name,
              department,
              organization,
              country,
              email || null,
            ]
          );
          authorId = result.insertId;
        } else {
          authorId = existingFaculty[0].id;
          // Optionally, update existing faculty details if they've changed
          await connection.query(
            'UPDATE authors SET name = ?, department = ?, organization = ?, country = ?, email = ? WHERE id = ?',
            [name, department, organization, country, email || null, authorId]
          );
        }
      } else if (designation === 'student') {
        if (!register_no)
          throw new Error('Student Register Number is required.');
        const [existingStudent] = await connection.query(
          'SELECT id FROM authors WHERE student_id = ?',
          [register_no]
        );

        if (existingStudent.length === 0) {
          // Insert new student author
          const [result] = await connection.query(
            'INSERT INTO authors (student_id, designation, name, department, organization, country, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              register_no,
              'student',
              name,
              department,
              organization,
              country,
              email || null,
            ]
          );
          authorId = result.insertId;
        } else {
          // For students, if they already exist, we should probably update their details
          authorId = existingStudent[0].id;
          await connection.query(
            'UPDATE authors SET name = ?, department = ?, organization = ?, country = ?, email = ? WHERE id = ?',
            [name, department, organization, country, email || null, authorId]
          );
        }
      } else {
        throw new Error('Invalid designation provided for investigator.');
      }

      // Check if association between author and project already exists
      const [existingAuthorProject] = await connection.query(
        'SELECT id FROM author_project WHERE author_id = ? AND project_id = ?',
        [authorId, projectId]
      );
      if (existingAuthorProject.length > 0) {
        // Association already exists, update PI/Co-PI status and return
        await connection.query(
          'UPDATE author_project SET is_principal = ?, is_primary = ? WHERE author_id = ? AND project_id = ?',
          [is_principal, is_primary || false, authorId, projectId]
        );
        await connection.commit();
        return { authorId };
      }

      // Insert into author_project table since no existing association was found
      await connection.query(
        `INSERT INTO author_project (author_id, project_id, is_principal, is_primary)
             VALUES (?, ?, ?, ?)`,
        [authorId, projectId, is_principal, is_primary || false]
      );

      await connection.commit();
      return { authorId };
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error adding author to project: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  // Retrieve all authors for a given project, including PI/Co-PI status
  async getAuthorsForProject(projectId) {
    try {
      const [rows] = await db.query(
        `SELECT a.*, ap.is_principal, ap.is_primary 
             FROM authors a
             JOIN author_project ap ON a.id = ap.author_id 
             WHERE ap.project_id = ?`,
        [projectId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving authors for project: ${error.message}`);
    }
  },

  // Remove an author from a project by project and author IDs
  async removeAuthorFromProject(projectId, authorId) {
    try {
      const [result] = await db.query(
        `DELETE FROM author_project 
             WHERE project_id = ? AND author_id = ?`,
        [projectId, authorId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error removing author from project: ${error.message}`);
    }
  },
  async search(query) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM research_projects WHERE title LIKE ? OR agency LIKE ? OR scheme LIKE ?',
        [`%${query}%`, `%${query}%`, `%${query}%`]
      );
      return rows;
    } catch (error) {
      throw new Error(
        `Error searching for research projects: ${error.message}`
      );
    }
  },

  async searchAgencies(query) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_agency_options WHERE name LIKE ? ORDER BY name LIMIT 10',
        [`%${query}%`]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error searching agencies: ${error.message}`);
    }
  },

  async searchSchemes(query) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_scheme_options WHERE name LIKE ? ORDER BY name LIMIT 10',
        [`%${query}%`]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error searching schemes: ${error.message}`);
    }
  },

  async searchAgencyTypes(query) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM project_agency_type_options WHERE name LIKE ? ORDER BY name LIMIT 10',
        [`%${query}%`]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error searching agency types: ${error.message}`);
    }
  },

  // Project Request methods
  async createProjectRequest(requestData) {
    try {
      const [result] = await db.query(
        `INSERT INTO project_requests (user_id, request_type, name, description, status) 
                     VALUES (?, ?, ?, ?, ?)`,
        [
          requestData.user_id,
          requestData.request_type,
          requestData.name,
          requestData.description,
          'pending', // Default status
        ]
      );

      // Return the created request
      const [request] = await db.query(
        'SELECT * FROM project_requests WHERE id = ?',
        [result.insertId]
      );

      return request[0];
    } catch (error) {
      throw new Error(`Error creating project request: ${error.message}`);
    }
  },

  async getUserProjectRequests(userId) {
    try {
      const [requests] = await db.query(
        'SELECT * FROM project_requests WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return requests;
    } catch (error) {
      throw new Error(`Error getting user project requests: ${error.message}`);
    }
  },

  async getProjectRequest(id, userId) {
    try {
      const [requests] = await db.query(
        'SELECT * FROM project_requests WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      return requests[0] || null;
    } catch (error) {
      throw new Error(`Error getting project request: ${error.message}`);
    }
  },

  async getAllProjectRequests() {
    try {
      const [rows] = await db.query(`
                    SELECT pr.*, u.name as user_name, u.email as user_email
                    FROM project_requests pr
                    JOIN users u ON pr.user_id = u.id
                    ORDER BY pr.created_at DESC
                `);
      return rows;
    } catch (error) {
      throw new Error(`Error getting all project requests: ${error.message}`);
    }
  },

  async updateProjectRequestStatus(id, status, adminComment = null) {
    try {
      const [result] = await db.query(
        `UPDATE project_requests 
                     SET status = ?, admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
        [status, adminComment, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(
        `Error updating project request status: ${error.message}`
      );
    }
  },

  async approveProjectRequest(id) {
    try {
      // Get the project request
      const [requestRows] = await db.query(
        'SELECT * FROM project_requests WHERE id = ?',
        [id]
      );

      if (requestRows.length === 0) {
        throw new Error('Project request not found');
      }

      const request = requestRows[0];

      // Add to appropriate table based on request type
      let result;
      if (request.request_type === 'agency') {
        result = await this.createAgency(request.name);
      } else if (request.request_type === 'scheme') {
        result = await this.createScheme(request.name);
      } else if (request.request_type === 'agency_type') {
        result = await this.createAgencyType(request.name);
      }

      // Update the request status
      await this.updateProjectRequestStatus(
        id,
        'approved',
        'Request approved and added to options'
      );

      return { id: result.insertId, name: request.name, status: 'approved' };
    } catch (error) {
      throw new Error(`Error approving project request: ${error.message}`);
    }
  },

  async rejectProjectRequest(id, adminComment) {
    try {
      const [result] = await db.query(
        `UPDATE project_requests 
                     SET status = 'rejected', admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
        [adminComment || 'Request rejected', id]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return { id: id, status: 'rejected' };
    } catch (error) {
      throw new Error(`Error rejecting project request: ${error.message}`);
    }
  },

  async getAgencyByName(name) {
    const [rows] = await db.query(
      'SELECT * FROM project_agency_options WHERE name = ?',
      [name]
    );
    return rows;
  },

  async createAgency(name) {
    const [result] = await db.query(
      'INSERT INTO project_agency_options (name) VALUES (?)',
      [name]
    );
    return result;
  },

  async getSchemeByName(name) {
    const [rows] = await db.query(
      'SELECT * FROM project_scheme_options WHERE name = ?',
      [name]
    );
    return rows;
  },

  async createScheme(name) {
    const [result] = await db.query(
      'INSERT INTO project_scheme_options (name) VALUES (?)',
      [name]
    );
    return result;
  },

  async getAgencyTypeByName(name) {
    const [rows] = await db.query(
      'SELECT * FROM project_agency_type_options WHERE name = ?',
      [name]
    );
    return rows;
  },

  async createAgencyType(name) {
    const [result] = await db.query(
      'INSERT INTO project_agency_type_options (name) VALUES (?)',
      [name]
    );
    return result;
  },

  async getProjectDetails(userId, projectId) {
    try {
      // First verify the user exists and get their email
      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [[user]] = await db.query(userQuery, [userId]);

      if (!user?.email) {
        console.error('No user found with ID:', userId);
        return null;
      }

      const query = `
                SELECT 
                    rp.*,
                    pd.*,
                    pao.name as agency_name,
                    pso.name as scheme_name,
                    
                    # Get investigators
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'author_id', a.author_id,
                                'student_id', a.student_id,
                                'name', a.name,
                                'designation', a.designation,
                                'department', a.department,
                                'organization', a.organization,
                                'country', a.country,
                                'is_principal', IF(ap.is_principal, true, false),
                                'is_primary', IF(ap.is_primary, true, false)
                            )
                        ), '[]'
                    ) FROM author_project ap 
                    JOIN authors a ON ap.author_id = a.id 
                    WHERE ap.project_id = rp.id) as investigators,

                    # Get financial contributions
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', pfc.id,
                                'agency_type', pato.name,
                                'agency', pfc.agency,
                                'amount', pfc.amount
                            )
                        ), '[]'
                    ) FROM project_financial_contributions pfc
                    LEFT JOIN project_agency_type_options pato ON pfc.agency_type_id = pato.id
                    WHERE pfc.project_id = rp.id) as financial_contributions,

                    # Get collaborations
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', pc.id,
                                'partner', pc.partner,
                                'address', pc.address,
                                'support', pc.support
                            )
                        ), '[]'
                    ) FROM project_collaborations pc
                    WHERE pc.project_id = rp.id) as collaborations,

                    # Get documents
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'document_type', pdoc.document_type,
                                'file_path', pdoc.file_path
                            )
                        ), '[]'
                    ) FROM project_documents pdoc
                    WHERE pdoc.project_id = rp.id) as documents,

                    # Get grant disbursements
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                               'id', pgd.id,
                                'fiscal_year', pgd.fiscal_year,
                                'agency', pgd.agency,
                                'amount', pgd.amount,
                                'disbursement_date', DATE_FORMAT(pgd.disbursement_date, '%Y-%m-%d'),
                                'sanction_letter_path', pgd.sanction_letter_path,
                                'uc_and_soe_path', pgd.uc_and_soe_path
                            )
                        ), '[]'
                    ) FROM project_grant_disbursements pgd
                    WHERE pgd.project_id = rp.id) as grant_disbursements

                FROM research_projects rp
                LEFT JOIN project_details pd ON rp.id = pd.project_id 
                LEFT JOIN project_agency_options pao ON rp.agency_id = pao.id
                LEFT JOIN project_scheme_options pso ON rp.scheme_id = pso.id
                WHERE rp.id = ? 
                AND EXISTS (
                    SELECT 1 FROM authors a2 
                    INNER JOIN author_project ap2 ON a2.id = ap2.author_id 
                    WHERE ap2.project_id = rp.id AND a2.email = ?
                )
                GROUP BY rp.id, pd.id, pao.name, pso.name
            `;

      const [result] = await db.query(query, [projectId, user.email]);

      if (!result[0]) {
        return null;
      }

      // Format dates
      if (result[0].date_of_submission) {
        result[0].date_of_submission = new Date(result[0].date_of_submission)
          .toISOString()
          .split('T')[0];
      }
      if (result[0].project_duration_start_date) {
        result[0].project_duration_start_date = new Date(
          result[0].project_duration_start_date
        )
          .toISOString()
          .split('T')[0];
      }
      if (result[0].project_duration_end_date) {
        result[0].project_duration_end_date = new Date(
          result[0].project_duration_end_date
        )
          .toISOString()
          .split('T')[0];
      }

      // Parse JSON fields
      const jsonFields = [
        'investigators',
        'financial_contributions',
        'collaborations',
        'documents',
        'grant_disbursements',
      ];
      jsonFields.forEach((field) => {
        try {
          if (result[0][field]) {
            // MySQL's JSON_ARRAYAGG already returns a JSON string, just parse it
            result[0][field] = JSON.parse(result[0][field]);
          } else {
            result[0][field] = [];
          }
        } catch (e) {
          console.error(`Error parsing ${field}:`, e);
          result[0][field] = [];
        }
      });

      return result[0];
    } catch (error) {
      console.error('Database error in getProjectDetails:', error);
      throw error;
    }
  },
};

export default researchProjectModel;
