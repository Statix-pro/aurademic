import researchProjectModel from './projectModel.js';
import path from 'path';
import fs from 'fs';
import util from 'util';

const rename = util.promisify(fs.rename);

const researchProjectController = {
  async createProject(req, res) {
    try {
      const projectData = req.body;
      // console.log("Received project data:", projectData);

      // Look up or create agency ID
      let agencyId;
      if (projectData.agency) {
        const [existingAgency] = await researchProjectModel.getAgencyByName(
          projectData.agency
        );
        if (existingAgency) {
          agencyId = existingAgency.id;
        } else {
          const newAgency = await researchProjectModel.createAgency(
            projectData.agency
          );
          agencyId = newAgency.insertId;
        }
      }

      // Look up or create scheme ID
      let schemeId;
      if (projectData.scheme) {
        const [existingScheme] = await researchProjectModel.getSchemeByName(
          projectData.scheme
        );
        if (existingScheme) {
          schemeId = existingScheme.id;
        } else {
          const newScheme = await researchProjectModel.createScheme(
            projectData.scheme
          );
          schemeId = newScheme.insertId;
        }
      }

      // Parse financial contributions and handle agency types
      let financialContributions = [];
      if (projectData.financial_contributions) {
        financialContributions = JSON.parse(
          projectData.financial_contributions
        );
        for (let contribution of financialContributions) {
          if (contribution.agencyType) {
            const [existingAgencyType] =
              await researchProjectModel.getAgencyTypeByName(
                contribution.agencyType
              );
            contribution.agency_type_id = existingAgencyType
              ? existingAgencyType.id
              : (
                  await researchProjectModel.createAgencyType(
                    contribution.agencyType
                  )
                ).insertId;
          }
        }
      }

      // Parse `documents` and `grant_disbursements` if provided as JSON strings
      let {
        documents,
        grant_disbursements,
        collaborations,
        project_details,
        outcome,
      } = projectData;

      // Parse project_details if it's a string
      if (typeof project_details === 'string') {
        try {
          project_details = JSON.parse(project_details);
        } catch (error) {
          console.error('Error parsing project_details JSON:', error);
          return res
            .status(400)
            .json({ message: 'Invalid format for project_details field' });
        }
      }

      // Parse outcome if it's a string
      if (typeof outcome === 'string') {
        try {
          outcome = JSON.parse(outcome);
          // Add outcome to project_details
          project_details = {
            ...project_details,
            outcome: outcome,
          };
        } catch (error) {
          console.error('Error parsing outcome JSON:', error);
          return res
            .status(400)
            .json({ message: 'Invalid format for outcome field' });
        }
      }
      if (typeof documents === 'string') {
        try {
          documents = JSON.parse(documents);
        } catch (error) {
          console.error('Error parsing documents JSON:', error);
          return res
            .status(400)
            .json({ message: 'Invalid format for documents field' });
        }
      }

      if (typeof grant_disbursements === 'string') {
        try {
          grant_disbursements = JSON.parse(grant_disbursements);
        } catch (error) {
          console.error('Error parsing grant disbursements JSON:', error);
          return res
            .status(400)
            .json({ message: 'Invalid format for grant disbursements field' });
        }
      }

      // changed
      if (typeof financialContributions === 'string') {
        try {
          financialContributions = JSON.parse(financialContributions);
        } catch (error) {
          console.error('Error parsing financial contributions JSON:', error);
          return res
            .status(400)
            .json({
              message: 'Invalid format for financial contributions field',
            });
        }
      }

      if (typeof collaborations === 'string') {
        try {
          collaborations = JSON.parse(collaborations);
        } catch (error) {
          console.error('Error parsing collaborations JSON:', error);
          return res
            .status(400)
            .json({ message: 'Invalid format for collaborations field' });
        }
      }

      // Extract data for different tables
      const {
        project_category,
        category,
        title,
        duration_years,
        duration_months,
        duration_days,
        date_of_submission,
        submission_status,
        is_collaboration_enabled,
        file_path,
        application_number,
        ...otherData
      } = projectData;

      // Prepare the modified project data
      const modifiedProjectData = {
        project_category,
        category,
        title,
        agency_id: agencyId,
        scheme_id: schemeId,
        duration_years,
        duration_months,
        duration_days,
        date_of_submission,
        submission_status: submission_status || 'waiting',
        is_collaboration_enabled,
        file_path,
        application_number: application_number,
        financial_contributions: JSON.stringify(financialContributions),
      };

      // Create the project with the modified data
      const result = await researchProjectModel.create(modifiedProjectData);
      const projectId = result.insertId;

      // 2. Insert financial contributions if any
      if (financialContributions) {
        const contributions = Array.isArray(financialContributions)
          ? financialContributions
          : [financialContributions];

        for (const contribution of contributions) {
          if (contribution && typeof contribution === 'object') {
            try {
              const formattedContribution = {
                agency_type_id: contribution.agency_type_id || null, // Allow null
                agency: contribution.agency,
                amount: parseFloat(contribution.amount),
              };

              // Removed the check for agency_type_id
              await researchProjectModel.addFinancialContribution(
                projectId,
                formattedContribution
              );
            } catch (error) {
              console.error('Error adding financial contribution:', error);
            }
          }
        }
      }

      // 3. Insert collaborations if any
      if (collaborations) {
        for (const collab of collaborations) {
          if (collab && typeof collab === 'object') {
            try {
              await researchProjectModel.addCollaboration(projectId, collab);
            } catch (error) {
              console.error('Error adding collaboration:', error);
            }
          }
        }
      }

      // 4. Insert project details if any
      if (project_details) {
        try {
          await researchProjectModel.addProjectDetails(
            projectId,
            project_details
          );
        } catch (error) {
          console.error('Error adding project details:', error);
        }
      }

      // 5. Insert grant disbursements if any
      if (grant_disbursements) {
        const disbursements = Array.isArray(grant_disbursements)
          ? grant_disbursements
          : [grant_disbursements];
        for (const disbursement of disbursements) {
          if (disbursement && typeof disbursement === 'object') {
            const disbursementData = {
              project_id: projectId,
              fiscal_year: disbursement.fy || null,
              agency: disbursement.agency || null,
              amount: disbursement.amount || null,
              disbursement_date: disbursement.date || null,
              sanction_letter_path: disbursement.sanctionLetter?.enabled
                ? disbursement.sanctionLetter.filePath
                : null,
              uc_and_soe_path: disbursement.ucAndSoE?.enabled
                ? disbursement.ucAndSoE.filePath
                : null,
            };

            try {
              await researchProjectModel.addGrantDisbursement(
                projectId,
                disbursementData
              );
            } catch (error) {
              console.error(`Error adding grant disbursement:`, error);
            }
          }
        }
      }

      // 6. Insert documents if any
      if (documents) {
        for (const [docType, docData] of Object.entries(documents)) {
          if (docData.enabled && docData.filePath) {
            try {
              await researchProjectModel.addDocument(projectId, {
                document_type: docType,
                file_path: docData.filePath,
              });
            } catch (error) {
              console.error('Error adding document:', error);
            }
          }
        }
      }

      res.status(201).json({
        message: 'Research project created successfully',
        id: projectId,
      });
    } catch (error) {
      console.error('Error creating research project:', error);
      res.status(500).json({
        message: 'Error creating research project',
        error: error.message,
      });
    }
  },

  async getProject(req, res) {
    try {
      const id = req.params.id;
      const project = await researchProjectModel.getById(id);
      if (project) {
        res.status(200).json(project);
      } else {
        res.status(404).json({ message: 'Research project not found' });
      }
    } catch (error) {
      res
        .status(500)
        .json({
          message: 'Error retrieving research project',
          error: error.message,
        });
    }
  },

  async updateProject(req, res) {
    try {
      const { id: projectId } = req.params;
      const newData = req.body;

      // Fetch the existing project data
      const existingProject = await researchProjectModel.getById(projectId);
      if (!existingProject) {
        return res.status(404).json({ message: 'Research project not found' });
      }

      // Define allowed fields to update
      const allowedFields = [
        'project_category',
        'category',
        'title',
        'agency',
        'scheme',
        'duration_years',
        'duration_months',
        'duration_days',
        'date_of_submission',
        'submission_status',
        'is_collaboration_enabled',
        'application_number',
        'file_path',
      ];

      // Build diff: only update fields that have changed
      const changedData = {};
      allowedFields.forEach((field) => {
        if (
          newData[field] !== undefined &&
          newData[field] !== existingProject[field]
        ) {
          changedData[field] = newData[field];
        }
      });

      if (Object.keys(changedData).length === 0) {
        return res.status(200).json({ message: 'No changes detected' });
      }

      // Call model to update only changed data
      const result = await researchProjectModel.updateProject(
        projectId,
        changedData
      );
      if (result.affectedRows > 0) {
        res
          .status(200)
          .json({ message: 'Research project updated successfully' });
      } else {
        res.status(404).json({ message: 'Research project not found' });
      }
    } catch (error) {
      console.error('Error during project update:', {
        message: error.message,
        stack: error.stack,
        requestData: req.body,
      });
      res.status(500).json({
        message: 'Error updating research project',
        error: error.message,
        details: error.stack,
      });
    }
  },

  async deleteProject(req, res) {
    try {
      const id = req.params.id;
      const result = await researchProjectModel.delete(id);
      if (result.affectedRows > 0) {
        res
          .status(200)
          .json({ message: 'Research project deleted successfully' });
      } else {
        res.status(404).json({ message: 'Research project not found' });
      }
    } catch (error) {
      res
        .status(500)
        .json({
          message: 'Error deleting research project',
          error: error.message,
        });
    }
  },

  async addAuthor(req, res) {
    try {
      const { id: projectId } = req.params;
      const authorData = req.body;

      if (!authorData.author_id) {
        return res.status(400).json({
          message: 'Author ID is required',
          debug: { received: authorData },
        });
      }

      const result = await researchProjectModel.addAuthorToProject(
        projectId,
        authorData
      );

      res.status(201).json({
        message: 'Author added successfully to project',
        id: result.authorId,
      });
    } catch (error) {
      console.error('Error in addAuthor:', error);
      res.status(500).json({
        message: 'Error adding author to project',
        error: error.message,
      });
    }
  },

  async getAuthors(req, res) {
    try {
      const { id: projectId } = req.params;
      const authors =
        await researchProjectModel.getAuthorsForProject(projectId);
      res.status(200).json(authors);
    } catch (error) {
      res
        .status(500)
        .json({
          message: 'Error retrieving authors for project',
          error: error.message,
        });
    }
  },

  async removeAuthor(req, res) {
    try {
      const { id: projectId } = req.params;
      const { author_id } = req.body;

      if (!author_id) {
        return res
          .status(400)
          .json({ message: 'Author ID is required to remove author' });
      }

      const result = await projectModel.removeAuthorFromProject(
        projectId,
        author_id
      );
      res
        .status(200)
        .json({
          message: 'Author removed from project',
          affectedRows: result.affectedRows,
        });
    } catch (error) {
      res
        .status(500)
        .json({
          message: 'Error removing author from project',
          error: error.message,
        });
    }
  },

  async addFinancialContribution(req, res) {
    try {
      const { id: projectId } = req.params;
      const { agency, agencyType, amount } = req.body;

      // Directly create contribution with the provided data
      const contributionData = {
        project_id: projectId,
        agency_type: agencyType, // Use the agency type name directly
        agency: agency,
        amount: parseFloat(amount),
      };

      const result = await researchProjectModel.addFinancialContribution(
        projectId,
        contributionData
      );
      res.status(201).json({
        message: 'Financial contribution added successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error in addFinancialContribution:', error);
      res.status(500).json({
        message: 'Error adding financial contribution',
        error: error.message,
      });
    }
  },

  async getFinancialContributions(req, res) {
    try {
      const { id: projectId } = req.params;
      const contributions =
        await researchProjectModel.getFinancialContributions(projectId);
      res.status(200).json(contributions);
    } catch (error) {
      res
        .status(500)
        .json({
          message: 'Error retrieving financial contributions',
          error: error.message,
        });
    }
  },

  async deleteFinancialContribution(req, res) {
    try {
      const { contributionId } = req.params;
      // Validate contribution ID
      if (!contributionId || isNaN(contributionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid financial contribution ID',
        });
      }

      const result =
        await researchProjectModel.deleteFinancialContribution(contributionId);
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({
            success: false,
            message: 'Financial contribution not found',
          });
      }
      res.json({
        success: true,
        message: 'Financial contribution deleted successfully!',
      });
    } catch (error) {
      console.error('Error deleting financial contribution:', error);
      res
        .status(500)
        .json({
          success: false,
          message: 'Error deleting financial contribution',
          error: error.message,
        });
    }
  },

  async addCollaboration(req, res) {
    try {
      const { id: projectId } = req.params; // Get projectId from request params
      const collaborationData = req.body; // Get data from request body

      // Call the MODEL's method, not direct database queries
      const result = await researchProjectModel.addCollaboration(
        projectId,
        collaborationData
      );

      res.status(201).json({
        // Send a success response
        message: 'Collaboration added successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error in addCollaboration:', error);
      res.status(500).json({
        message: 'Error adding collaboration',
        error: error.message,
      });
    }
  },

  async updateCollaboration(req, res) {
    try {
      const { id: projectId, collabId } = req.params;
      const collaborationData = req.body;
      const result = await researchProjectModel.updateCollaboration(
        collabId,
        collaborationData
      );
      res.json({
        success: true,
        message: 'Collaboration updated successfully!',
        result,
      });
    } catch (error) {
      console.error('Error updating collaboration:', error);
      res
        .status(500)
        .json({
          success: false,
          message: 'Error updating collaboration',
          error: error.message,
        });
    }
  },

  async getCollaborations(req, res) {
    try {
      const projectId = req.params.id;
      const collaborations =
        await researchProjectModel.getCollaborations(projectId);
      res.status(200).json({ data: collaborations });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteCollaboration(req, res) {
    try {
      const { collabId } = req.params;
      // Validate collaboration ID
      if (!collabId || isNaN(collabId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid collaboration ID',
        });
      }

      const result = await researchProjectModel.deleteCollaboration(collabId);
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Collaboration not found' });
      }
      res.json({
        success: true,
        message: 'Collaboration deleted successfully!',
      });
    } catch (error) {
      console.error('Error deleting collaboration:', error);
      res
        .status(500)
        .json({
          success: false,
          message: 'Error deleting collaboration',
          error: error.message,
        });
    }
  },

  async addProjectDetails(req, res) {
    try {
      const projectId = req.params.id;
      const detailsData = req.body;
      const result = await researchProjectModel.addProjectDetails(
        projectId,
        detailsData
      );
      res
        .status(201)
        .json({ message: 'Project details added successfully', data: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getProjectDetails(req, res) {
    try {
      const projectId = req.params.id;
      if (isNaN(projectId)) {
        return res.status(400).json({
          message: 'Invalid project ID format',
          details: `Received: ${req.params.id}`,
        });
      }
      const projectDetails =
        await researchProjectModel.getProjectDetails(projectId);
      res.status(200).json({ data: projectDetails });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async addGrantDisbursement(req, res) {
    try {
      const projectId = req.params.id;
      const disbursementData = req.body;

      // Map client-side field names to server-side field names
      const formattedData = {
        project_id: projectId,
        fiscal_year: disbursementData.fy,
        agency: disbursementData.agency,
        amount: disbursementData.amount,
        disbursement_date: disbursementData.date,
        // Use optional chaining here
        sanction_letter_path: disbursementData.sanctionLetter?.filePath,
        uc_and_soe_path: disbursementData.ucAndSoE?.filePath,
      };
      // Validate required fields (optional, but good practice)
      if (!formattedData.project_id) {
        return res.status(400).json({ message: 'Missing project_id' });
      }

      const result = await researchProjectModel.addGrantDisbursement(
        projectId,
        formattedData
      );
      res
        .status(201)
        .json({
          message: 'Grant disbursement added successfully',
          data: result,
        });
    } catch (error) {
      console.error('Error in addGrantDisbursement:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getGrantDisbursements(req, res) {
    try {
      const projectId = req.params.id;
      const disbursements =
        await researchProjectModel.getGrantDisbursements(projectId);
      res.status(200).json({ data: disbursements });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateGrantDisbursement(req, res) {
    try {
      const { disbursementId } = req.params;
      const disbursementData = req.body;

      const result = await researchProjectModel.updateGrantDisbursement(
        disbursementId,
        disbursementData
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: 'Grant disbursement not found' });
      }

      res.json({
        message: 'Grant disbursement updated successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error updating grant disbursement:', error);
      res.status(500).json({
        message: 'Error updating grant disbursement',
        error: error.message,
      });
    }
  },

  async deleteGrantDisbursement(req, res) {
    try {
      const { disbursementId } = req.params;

      if (!disbursementId) {
        return res.status(400).json({
          success: false,
          message: 'Missing disbursement ID',
        });
      }

      const result =
        await researchProjectModel.deleteGrantDisbursement(disbursementId);

      if (result.affectedRows > 0) {
        res
          .status(200)
          .json({
            success: true,
            message: 'Grant disbursement deleted successfully',
          });
      } else {
        res
          .status(404)
          .json({ success: false, message: 'Grant disbursement not found' });
      }
    } catch (error) {
      console.error('Error deleting grant disbursement:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting grant disbursement',
        error: error.message,
      });
    }
  },

  async uploadFile(req, res) {
    try {
      const { id: projectId } = req.params;
      const { document_type: document_typeFromRequest } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: 'No file was uploaded.' });
      }
      if (!document_typeFromRequest) {
        return res.status(400).json({ message: 'document_type is required.' });
      }
      // if (!document_type) {
      //     return res.status(400).json({ message: 'document_type is required.' });
      // }
      const document_type_path_safe = document_typeFromRequest.replace(
        /\s+/g,
        ''
      );

      const file = req.file;
      const uploadDir = path.join(
        process.cwd(),
        'uploads',
        document_type_path_safe
      );

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Use the filename PROVIDED BY MULTER
      const finalPath = path.join(uploadDir, file.filename);

      try {
        // Rename (move) the file.  Keep the multer-generated name.
        await fs.promises.rename(file.path, finalPath);
      } catch (moveError) {
        console.error('Error moving file (rename failed):', moveError);

        try {
          await fs.promises.copyFile(file.path, finalPath);
          await fs.promises.unlink(file.path);
        } catch (copyError) {
          console.error('Error copying/deleting file:', copyError);
          return res.status(500).json({
            message: 'Error saving file (copy/delete failed)',
            error: copyError.message,
            stack:
              process.env.NODE_ENV === 'development'
                ? copyError.stack
                : undefined,
          });
        }
      }

      // Construct the database path using the MULTER-GENERATED filename
      const dbFilePath = path
        .join('uploads', document_type_path_safe, file.filename)
        .replace(/\\/g, '/');

      // --- MODIFICATION START ---
      if (document_type_path_safe === 'journal-article') {
        // Compare with path-safe version
        await researchProjectModel.update(projectId, { file_path: dbFilePath });
      } else {
        // Use the ORIGINAL type from request for ENUM validation
        // FIX: Use camelCase to match incoming request data
        const allowedDocTypes = [
          'sanctionOrder',
          'utilizationCertificate',
          'statementOfExpenditure',
          'projectReport',
          'bankStatement',
          'sanctionLetter',
          'ucAndSoE',
        ];
        if (!allowedDocTypes.includes(document_typeFromRequest)) {
          // Now this comparison will work
          console.error(
            `Invalid document_type '${document_typeFromRequest}' for project_documents table.`
          );
          // ... cleanup and error response ...
          try {
            await fs.promises.unlink(finalPath);
          } catch (unlinkErr) {
            console.error('Error deleting orphaned file:', unlinkErr);
          }
          return res
            .status(400)
            .json({
              message: `Invalid document type specified: ${document_typeFromRequest}`,
            });
        }

        // Insert into project_documents table for standard document types
        await researchProjectModel.addDocument(projectId, {
          document_type: document_typeFromRequest, // Use ORIGINAL type for ENUM column
          file_path: dbFilePath, // Use PATH-SAFE version for the path column
        });
      }

      res.json({
        message: 'File uploaded successfully!',
        filePath: dbFilePath,
      });
    } catch (error) {
      console.error('File upload error (outer catch):', error);
      res.status(500).json({
        message: 'Error uploading file',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  },

  async uploadDisbursementSanctionLetter(req, res) {
    try {
      const { projectId, disbursementId } = req.params; // disbursementId is a string here
      // In both upload functions, at the very start:
      console.log(
        'Upload request received for Sanction Letter:',
        req.file?.originalname
      );
      console.log('Request params (Sanction Letter):', req.params);
      console.log('File object (Sanction Letter):', req.file);

      if (!req.file) {
        return res
          .status(400)
          .json({ message: 'No file was uploaded for Sanction Letter.' });
      }
      // Convert disbursementId to integer for database operations if it's a number column
      const numericDisbursementId = parseInt(disbursementId, 10);
      if (isNaN(numericDisbursementId)) {
        console.error(
          'Invalid disbursement ID (Sanction Letter):',
          disbursementId
        );
        return res
          .status(400)
          .json({
            message: 'Invalid disbursement ID format for Sanction Letter.',
          });
      }

      const file = req.file;
      const multerFilename = file.filename;
      console.log('Using filename (Sanction Letter):', multerFilename);

      const uploadDir = path.join(process.cwd(), 'uploads', 'sanctionLetter');
      const finalPath = path.join(uploadDir, multerFilename);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      try {
        await fs.promises.rename(file.path, finalPath);
      } catch (moveError) {
        console.error(
          'Error moving file (Sanction Letter), attempting copy/delete:',
          moveError
        );
        try {
          await fs.promises.copyFile(file.path, finalPath);
          await fs.promises.unlink(file.path);
        } catch (copyError) {
          console.error(
            'Error in copy/delete fallback (Sanction Letter):',
            copyError
          );
          // It's important to return or throw here to stop execution
          return res
            .status(500)
            .json({
              message: 'Failed to save file (Sanction Letter).',
              error: copyError.message,
            });
        }
      }

      const dbFilePath = `/uploads/sanctionLetter/${multerFilename}`; // Make sure this path is what you intend to store

      console.log(
        'About to update DB for Sanction Letter with disbursementId:',
        numericDisbursementId,
        'and path:',
        dbFilePath
      );
      // Ensure the model function is called with the correct disbursementId
      const updateResult = await researchProjectModel.updateGrantDisbursement(
        numericDisbursementId,
        {
          sanction_letter_path: dbFilePath,
        }
      );
      console.log('DB update result (Sanction Letter):', updateResult);

      if (updateResult.affectedRows === 0) {
        console.warn(
          'DB update for Sanction Letter had no affected rows. Disbursement ID might not exist:',
          numericDisbursementId
        );
        // Optionally, you might want to delete the uploaded file if the DB update fails
        // try { await fs.promises.unlink(finalPath); } catch (e) { console.error('Failed to delete orphaned file:', finalPath, e); }
        // return res.status(404).json({ message: 'Grant disbursement record not found for Sanction Letter.' });
      }

      res.json({
        message: 'Sanction Letter uploaded successfully!',
        filePath: dbFilePath,
      });
    } catch (error) {
      console.error('Disbursement Sanction Letter upload error:', error);
      res.status(500).json({
        message: 'Error uploading Sanction Letter',
        error: error.message,
      });
    }
  },

  async uploadDisbursementUcAndSoe(req, res) {
    try {
      const { projectId, disbursementId } = req.params; // disbursementId is a string here
      console.log(
        'Upload request received for UC & SoE:',
        req.file?.originalname
      );
      console.log('Request params (UC & SoE):', req.params);
      console.log('File object (UC & SoE):', req.file);

      if (!req.file) {
        return res
          .status(400)
          .json({ message: 'No file was uploaded for UC & SoE.' });
      }
      // Convert disbursementId to integer
      const numericDisbursementId = parseInt(disbursementId, 10);
      if (isNaN(numericDisbursementId)) {
        console.error('Invalid disbursement ID (UC & SoE):', disbursementId);
        return res
          .status(400)
          .json({ message: 'Invalid disbursement ID format for UC & SoE.' });
      }

      const file = req.file;
      const multerFilename = file.filename;
      console.log('Using filename (UC & SoE):', multerFilename);

      const uploadDir = path.join(process.cwd(), 'uploads', 'ucAndSoE');
      const finalPath = path.join(uploadDir, multerFilename);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      try {
        await fs.promises.rename(file.path, finalPath);
      } catch (moveError) {
        console.error(
          'Error moving file (UC & SoE), attempting copy/delete:',
          moveError
        );
        try {
          await fs.promises.copyFile(file.path, finalPath);
          await fs.promises.unlink(file.path);
        } catch (copyError) {
          console.error('Error in copy/delete fallback (UC & SoE):', copyError);
          return res
            .status(500)
            .json({
              message: 'Failed to save file (UC & SoE).',
              error: copyError.message,
            });
        }
      }

      const dbFilePath = `/uploads/ucAndSoE/${multerFilename}`; // Make sure this path is what you intend to store

      console.log(
        'About to update DB for UC & SoE with disbursementId:',
        numericDisbursementId,
        'and path:',
        dbFilePath
      );
      const updateResult = await researchProjectModel.updateGrantDisbursement(
        numericDisbursementId,
        {
          uc_and_soe_path: dbFilePath,
        }
      );
      console.log('DB update result (UC & SoE):', updateResult);

      if (updateResult.affectedRows === 0) {
        console.warn(
          'DB update for UC & SoE had no affected rows. Disbursement ID might not exist:',
          numericDisbursementId
        );
        // Optionally, you might want to delete the uploaded file if the DB update fails
        // try { await fs.promises.unlink(finalPath); } catch (e) { console.error('Failed to delete orphaned file:', finalPath, e); }
        // return res.status(404).json({ message: 'Grant disbursement record not found for UC & SoE.' });
      }

      res.json({
        message: 'UC & SoE uploaded successfully!',
        filePath: dbFilePath,
      });
    } catch (error) {
      console.error('Disbursement UC & SoE upload error:', error);
      res.status(500).json({
        message: 'Error uploading UC & SoE',
        error: error.message,
      });
    }
  },

  async searchAgencies(req, res) {
    try {
      const { query } = req.query;
      const agencies = await researchProjectModel.searchAgencies(query);
      res.json(agencies);
    } catch (error) {
      console.error('Error searching agencies:', error);
      res.status(500).json({ error: 'Error searching agencies' });
    }
  },

  async searchSchemes(req, res) {
    try {
      const { query } = req.query;
      const schemes = await researchProjectModel.searchSchemes(query);
      res.json(schemes);
    } catch (error) {
      console.error('Error searching schemes:', error);
      res.status(500).json({ error: 'Error searching schemes' });
    }
  },

  async searchAgencyTypes(req, res) {
    try {
      const { query } = req.query;
      const agencyTypes = await researchProjectModel.searchAgencyTypes(query);
      res.json(agencyTypes);
    } catch (error) {
      console.error('Error searching agency types:', error);
      res.status(500).json({ error: 'Error searching agency types' });
    }
  },

  // Project Request methods
  async createProjectRequest(req, res) {
    try {
      const { request_type, name, description } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!request_type || !name || name.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Request type and name are required',
        });
      }

      // Validate request type
      if (!['agency', 'scheme', 'agency_type'].includes(request_type)) {
        return res.status(400).json({
          status: 'error',
          message:
            'Invalid request type. Must be agency, scheme, or agency_type',
        });
      }

      const request = await researchProjectModel.createProjectRequest({
        user_id: userId,
        request_type: request_type,
        name: name.trim(),
        description: description?.trim() || '',
      });

      res.status(201).json({
        status: 'success',
        message: `${request_type.replace('_', ' ')} request submitted successfully. It will be reviewed by an administrator.`,
        data: request,
      });
    } catch (error) {
      console.error('Error in createProjectRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getUserProjectRequests(req, res) {
    try {
      const userId = req.user.id;
      const requests =
        await researchProjectModel.getUserProjectRequests(userId);

      res.json({
        status: 'success',
        data: requests,
      });
    } catch (error) {
      console.error('Error in getUserProjectRequests:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getProjectRequest(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const request = await researchProjectModel.getProjectRequest(id, userId);

      if (!request) {
        return res.status(404).json({
          status: 'error',
          message: 'Project request not found',
        });
      }

      res.json({
        status: 'success',
        data: request,
      });
    } catch (error) {
      console.error('Error in getProjectRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getProjectDetails(req, res) {
    try {
      const projectId = parseInt(req.params.id);
      const project = await researchProjectModel.getProjectDetails(
        req.user.id,
        projectId
      );

      // Log the full project data for debugging
      // console.log('Project Data:', project);

      if (!project) {
        return res.status(404).json({
          status: 'error',
          message: 'Project not found',
        });
      }

      res.json({
        status: 'success',
        data: project,
      });
    } catch (error) {
      console.error('Error getting project details:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch project details',
      });
    }
  },
};

export default researchProjectController;
