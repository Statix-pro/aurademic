import formOptionsModel from './formOptionsModel.js';
const formOptionsController = {
    async getAllOptions(req, res) {
        try {
            const journals = await formOptionsModel.getJournalOptions();
            res.json({
                status: 'success',
                data: journals,
            });
        }
        catch (error) {
            console.error('Error in getAllOptions:', error);
            res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    },
    async addOption(req, res) {
        try {
            const newJournal = await formOptionsModel.addJournalOption(req.body);
            res.status(201).json({
                status: 'success',
                data: newJournal,
            });
        }
        catch (error) {
            console.error('Error in addOption:', error);
            res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    },
    async updateOption(req, res) {
        try {
            const { id } = req.params;
            const success = await formOptionsModel.updateJournalOption(id, req.body);
            if (success) {
                res.json({
                    status: 'success',
                    message: 'Journal option updated successfully',
                });
            }
            else {
                res.status(404).json({
                    status: 'error',
                    message: 'Journal option not found',
                });
            }
        }
        catch (error) {
            console.error('Error in updateOption:', error);
            res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    },
    async deleteOption(req, res) {
        try {
            const { id } = req.params;
            const success = await formOptionsModel.deleteJournalOption(id);
            if (success) {
                res.json({
                    status: 'success',
                    message: 'Journal option deleted successfully',
                });
            }
            else {
                res.status(404).json({
                    status: 'error',
                    message: 'Journal option not found',
                });
            }
        }
        catch (error) {
            console.error('Error in deleteOption:', error);
            res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    },
    // Project Agency Options Controllers
    async getProjectAgencyOptions(req, res) {
        try {
            const options = await formOptionsModel.getProjectAgencyOptions();
            res.json({ status: 'success', data: options });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async addProjectAgencyOption(req, res) {
        try {
            const newOption = await formOptionsModel.addProjectAgencyOption(req.body);
            res.status(201).json({ status: 'success', data: newOption });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async updateProjectAgencyOption(req, res) {
        try {
            const success = await formOptionsModel.updateProjectAgencyOption(req.params.id, req.body);
            if (success) {
                res.json({
                    status: 'success',
                    message: 'Agency option updated successfully',
                });
            }
            else {
                res
                    .status(404)
                    .json({ status: 'error', message: 'Agency option not found' });
            }
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async deleteProjectAgencyOption(req, res) {
        try {
            const success = await formOptionsModel.deleteProjectAgencyOption(req.params.id);
            if (success) {
                res.json({
                    status: 'success',
                    message: 'Agency option deleted successfully',
                });
            }
            else {
                res
                    .status(404)
                    .json({ status: 'error', message: 'Agency option not found' });
            }
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    // Project Scheme Options Controllers
    async getProjectSchemeOptions(req, res) {
        try {
            const options = await formOptionsModel.getProjectSchemeOptions();
            res.json({ status: 'success', data: options });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async addProjectSchemeOption(req, res) {
        try {
            const newOption = await formOptionsModel.addProjectSchemeOption(req.body);
            res.status(201).json({ status: 'success', data: newOption });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async updateProjectSchemeOption(req, res) {
        try {
            const success = await formOptionsModel.updateProjectSchemeOption(req.params.id, req.body);
            if (success) {
                res.json({
                    status: 'success',
                    message: 'Scheme option updated successfully',
                });
            }
            else {
                res
                    .status(404)
                    .json({ status: 'error', message: 'Scheme option not found' });
            }
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async deleteProjectSchemeOption(req, res) {
        try {
            const success = await formOptionsModel.deleteProjectSchemeOption(req.params.id);
            if (success) {
                res.json({
                    status: 'success',
                    message: 'Scheme option deleted successfully',
                });
            }
            else {
                res
                    .status(404)
                    .json({ status: 'error', message: 'Scheme option not found' });
            }
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    // Project Agency Type Options Controllers
    async getProjectAgencyTypeOptions(req, res) {
        try {
            const options = await formOptionsModel.getProjectAgencyTypeOptions();
            res.json({ status: 'success', data: options });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async addProjectAgencyTypeOption(req, res) {
        try {
            const newOption = await formOptionsModel.addProjectAgencyTypeOption(req.body);
            res.status(201).json({ status: 'success', data: newOption });
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async updateProjectAgencyTypeOption(req, res) {
        try {
            const success = await formOptionsModel.updateProjectAgencyTypeOption(req.params.id, req.body);
            if (success) {
                res.json({
                    status: 'success',
                    message: 'Agency type option updated successfully',
                });
            }
            else {
                res
                    .status(404)
                    .json({ status: 'error', message: 'Agency type option not found' });
            }
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
    async deleteProjectAgencyTypeOption(req, res) {
        try {
            const success = await formOptionsModel.deleteProjectAgencyTypeOption(req.params.id);
            if (success) {
                res.json({
                    status: 'success',
                    message: 'Agency type option deleted successfully',
                });
            }
            else {
                res
                    .status(404)
                    .json({ status: 'error', message: 'Agency type option not found' });
            }
        }
        catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    },
};
export default formOptionsController;
