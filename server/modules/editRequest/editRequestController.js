import editRequestModel from './editRequestModel.js';
import journalModel from '../journal/journalModel.js';
import projectModel from '../project/projectModel.js';

const editRequestController = {
  async createEditRequest(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const userId = req.user.id;

      // Validate entityType
      if (!['journals', 'research_projects'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type.',
        });
      }

      // Validate entityId based on entityType
      let entityExists;
      switch (entityType) {
        case 'journals':
          entityExists = await journalModel.doesJournalExist(entityId);
          break;
        case 'research_projects':
          entityExists = await projectModel.doesProjectExist(entityId);
          break;
        // Add cases for other entity types as needed
      }

      if (!entityExists) {
        return res.status(404).json({
          success: false,
          message: 'Entity not found.',
        });
      }

      // Check for an existing edit request
      const existingRequest = await editRequestModel.findEditRequest(
        entityId,
        userId,
        entityType
      );

      if (existingRequest && existingRequest.status === 'pending') {
        // Only block if the request is already pending
        return res.status(400).json({
          success: false,
          message: `You already have a pending edit request for this ${entityType.slice(0, -1)}.`,
        });
      } else if (
        existingRequest &&
        (existingRequest.status === 'none' ||
          existingRequest.status === 'rejected')
      ) {
        // Resubmit by updating the status to 'pending'
        await editRequestModel.updateEditRequestStatusByEntity(
          entityId,
          entityType,
          'pending',
          userId
        );
        return res.status(200).json({
          success: true,
          message: 'Edit request resubmitted successfully.',
        });
      } else {
        // Create a new edit request record if none exists
        const newRequest = await editRequestModel.createEditRequest({
          entity_id: entityId,
          user_id: userId,
          entity_type: entityType,
        });
        return res.status(201).json({
          success: true,
          message: 'Edit request submitted for approval.',
        });
      }
    } catch (error) {
      console.error('Error creating edit request:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  },

  async checkEditRequestStatus(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const userId = req.user.id;

      // Validate entityType
      if (!['journals', 'research_projects'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type.',
        });
      }

      // const request = await editRequestModel.findPendingEditRequest(entityId, userId, entityType);
      const request = await editRequestModel.findEditRequest(
        entityId,
        userId,
        entityType
      );

      if (!request) {
        return res.status(200).json({ data: { status: 'none' } });
      }

      res.status(200).json({
        success: true,
        data: request ? { status: request.status } : { status: 'none' },
      });
    } catch (error) {
      console.error('Error checking edit request status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check edit request status',
      });
    }
  },

  async updateEditRequestStatus(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const { status, userId } = req.body;

      // Validate entityType
      if (!['journals', 'research_projects'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type.',
        });
      }

      // Validate status
      if (!['approved', 'rejected', 'pending', 'none'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status.',
        });
      }

      // Update edit request status
      const result = await editRequestModel.updateEditRequestStatusByEntity(
        entityId,
        entityType,
        status,
        userId
      );

      if (result.affectedRows === 0) {
        // console.log('Edit request not found or status already updated for entityId:', entityId);
        return res.status(404).json({
          success: false,
          message: 'Edit request not found or status already updated.',
        });
      }
      const responseData = {
        success: true,
        message: `Edit request status updated to ${status}.`,
      };
      res.status(200).json(responseData);
    } catch (error) {
      console.error('Error updating edit request status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update edit request status.',
      });
    }
  },

  async approveEditRequest(req, res) {
    try {
      const { requestId } = req.params;
      const result = await editRequestModel.updateEditRequestStatus(
        requestId,
        'approved'
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Edit request not found.',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Edit request approved.',
      });
    } catch (error) {
      console.error('Error approving edit request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve edit request.',
      });
    }
  },

  async rejectEditRequest(req, res) {
    try {
      const { requestId } = req.params;
      const result = await editRequestModel.updateEditRequestStatus(
        requestId,
        'rejected'
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Edit request not found.',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Edit request rejected.',
      });
    } catch (error) {
      console.error('Error rejecting edit request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject edit request.',
      });
    }
  },
};

export default editRequestController;
