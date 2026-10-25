import scopusClaimModel from './scopusClaimModel.js';

const respondWithError = (res, error, fallbackMessage) => {
  if (error.statusCode && error.statusCode < 500) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const scopusProfileController = {
  async getProfiles(req, res) {
    try {
      const data = await scopusClaimModel.getStaffProfiles(req.user.id);
      return res.json({ success: true, data });
    } catch (error) {
      return respondWithError(res, error, 'Failed to load your Scopus profiles');
    }
  },

  async claimProfile(req, res) {
    try {
      const result = await scopusClaimModel.claimForStaff(
        req.user.id,
        String(req.body?.scopusAuthorId ?? '').trim(),
      );
      return res.status(201).json({
        success: true,
        message: 'Scopus profile added to your record.',
        data: result,
      });
    } catch (error) {
      return respondWithError(res, error, 'Failed to add the Scopus profile');
    }
  },
};

export default scopusProfileController;
