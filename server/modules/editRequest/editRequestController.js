import editRequestModel from './editRequestModel.js';
import journalModel from '../journal/journalModel.js';
import { reviewerAudience, userAudience } from '../notification/audiences.js';
import notificationService from '../notification/notificationService.js';
import projectModel from '../project/projectModel.js';

const isRequesterAdmin = (requestUser = {}) => Boolean(requestUser.isAdmin ?? requestUser.is_admin);

const SUPPORTED_ENTITY_TYPES = ['journals', 'research_projects'];

const normalizeEntityType = (value) =>
  SUPPORTED_ENTITY_TYPES.includes(String(value || '').trim()) ? String(value).trim() : null;

/**
 * A new or resubmitted edit request, announced to the reviewers who can grant
 * it. Shared by both branches of `createEditRequest` so a resubmission is
 * described exactly like a first request.
 */
const notifyEditRequestSubmitted = ({ req, entityId, entityType, userId }) =>
  notificationService.emit({
    type: 'edit_request.submitted',
    actorUserId: userId,
    subject: { moduleKey: 'edit_request', recordId: Number(entityId), entityType },
    audience: [reviewerAudience()],
    data: { applicantName: req.user?.name || null },
    dedupeKey: `edit_request:${entityType}:${entityId}:submitted:${Date.now()}`,
  });

const editRequestController = {
  async createEditRequest(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const userId = req.user.id;

      // Validate user email exists (critical for journal workflow check)
      if (!req.user.email) {
        return res.status(401).json({
          success: false,
          message: 'User email is required for this action.',
        });
      }

      // Validate entityType
      if (!['journals', 'research_projects'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type.',
        });
      }

      // Validate entityId based on entityType
      let entityExists;
      let workflowAccess = null;
      switch (entityType) {
        case 'journals':
          workflowAccess = await journalModel.getJournalWorkflowAccess(
            entityId,
            userId,
            req.user.email,
          );
          entityExists = Boolean(workflowAccess);
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

      if (entityType === 'journals') {
        if (!isRequesterAdmin(req.user) && !workflowAccess.can_manage) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to request edit for this journal.',
          });
        }

        if (workflowAccess.admin_approval_status !== 'approved') {
          return res.status(400).json({
            success: false,
            message: 'Edit requests are available only after admin approval.',
          });
        }
      }

      // Check for an existing edit request
      const existingRequest = await editRequestModel.findEditRequest(entityId, userId, entityType);

      if (existingRequest && existingRequest.status === 'pending') {
        // Only block if the request is already pending
        return res.status(400).json({
          success: false,
          message: `You already have a pending edit request for this ${entityType.slice(0, -1)}.`,
        });
      } else if (
        existingRequest &&
        (existingRequest.status === 'none' || existingRequest.status === 'rejected')
      ) {
        // Resubmit by updating the status to 'pending'
        await editRequestModel.updateEditRequestStatusByEntity(
          entityId,
          entityType,
          'pending',
          userId,
        );
        await notifyEditRequestSubmitted({ req, entityId, entityType, userId });

        return res.status(200).json({
          success: true,
          message: 'Edit request resubmitted successfully.',
        });
      } else {
        // Create a new edit request record if none exists
        await editRequestModel.createEditRequest({
          entity_id: entityId,
          user_id: userId,
          entity_type: entityType,
        });

        await notifyEditRequestSubmitted({ req, entityId, entityType, userId });

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
      const request = await editRequestModel.findEditRequest(entityId, userId, entityType);

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
      const { status } = req.body;
      // The row to clear is always the caller's own. Taking the id from the body let a
      // client target another user's request, and a client that omitted it silently
      // matched nothing — leaving an approved request open for unlimited further edits.
      const userId = req.user.id;

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
        userId,
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

  /**
   * The admin dashboard lists entities, not edit requests, so `:requestId` on these routes
   * has always carried the journal/project id. The entity type has to come with it —
   * without it a journal decision could land on a project's request of the same id.
   */
  async decideEditRequest(req, res, status) {
    const { requestId: entityId } = req.params;
    const entityType = normalizeEntityType(req.body?.entityType);

    if (!entityType) {
      return res.status(400).json({
        success: false,
        message: 'entityType is required and must be journals or research_projects.',
      });
    }

    // The dashboard row carries the requester's id (`edit_request_user_id`). It is
    // optional so older clients keep working, but when present the decision is pinned to
    // that user's request instead of whichever row is newest for the entity.
    const requestedUserId = Number(req.body?.userId);
    const userId =
      Number.isInteger(requestedUserId) && requestedUserId > 0 ? requestedUserId : null;

    const result = await editRequestModel.updateLatestEditRequestStatus(
      entityId,
      entityType,
      status,
      userId,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'No pending edit request found for this publication.',
      });
    }

    // `userId` is optional on the route, so the recipient comes from the row the
    // model actually decided rather than from the request body.
    await notificationService.emit({
      type: status === 'approved' ? 'edit_request.approved' : 'edit_request.rejected',
      actorUserId: req.user?.id || null,
      subject: { moduleKey: 'edit_request', recordId: Number(entityId), entityType },
      audience: userAudience(userId || result.decidedUserId, 'applicant'),
      // A request can be raised, refused and raised again, so decisions are not
      // collapsed into one.
      dedupeKey: `edit_request:${entityType}:${entityId}:${status}:${Date.now()}`,
    });

    return res.status(200).json({
      success: true,
      message: `Edit request ${status}.`,
    });
  },

  async approveEditRequest(req, res) {
    try {
      return await editRequestController.decideEditRequest(req, res, 'approved');
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
      return await editRequestController.decideEditRequest(req, res, 'rejected');
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
