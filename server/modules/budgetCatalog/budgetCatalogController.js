import budgetCatalogModel from './budgetCatalogModel.js';
import { clearResolverCache } from './budgetCatalogResolver.js';

const handleError = (res, error, fallback) => {
    console.error(fallback, error);
    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || fallback,
    });
};

const budgetCatalogController = {
    async getCatalog(req, res) {
        try {
            const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
            const data = await budgetCatalogModel.getCatalog({ includeInactive });
            return res.json({ success: true, data });
        } catch (error) {
            return handleError(res, error, 'Failed to fetch budget catalog');
        }
    },

    async createHead(req, res) {
        try {
            const { name, group_label } = req.body || {};
            if (!name || !group_label) {
                return res.status(400).json({
                    success: false,
                    message: 'name and group_label are required',
                });
            }
            const head = await budgetCatalogModel.createHead(req.body || {});
            clearResolverCache();
            return res.status(201).json({ success: true, data: head });
        } catch (error) {
            return handleError(res, error, 'Failed to create budget head');
        }
    },

    async updateHead(req, res) {
        try {
            const success = await budgetCatalogModel.updateHead(req.params.id, req.body || {});
            if (!success) {
                return res.status(404).json({ success: false, message: 'Budget head not found' });
            }
            clearResolverCache();
            return res.json({ success: true });
        } catch (error) {
            return handleError(res, error, 'Failed to update budget head');
        }
    },

    async deleteHead(req, res) {
        try {
            const success = await budgetCatalogModel.softDeleteHead(req.params.id);
            if (!success) {
                return res.status(404).json({ success: false, message: 'Budget head not found' });
            }
            clearResolverCache();
            return res.json({ success: true });
        } catch (error) {
            return handleError(res, error, 'Failed to delete budget head');
        }
    },

    async createSubHead(req, res) {
        try {
            const { name } = req.body || {};
            if (!name) {
                return res.status(400).json({ success: false, message: 'name is required' });
            }
            const subHead = await budgetCatalogModel.createSubHead(req.body || {});
            clearResolverCache();
            return res.status(201).json({ success: true, data: subHead });
        } catch (error) {
            return handleError(res, error, 'Failed to create sub-head');
        }
    },

    async createSubHeadsBulk(req, res) {
        try {
            const { names } = req.body || {};
            if (!Array.isArray(names) || names.filter((name) => String(name || '').trim()).length === 0) {
                return res.status(400).json({ success: false, message: 'names are required' });
            }
            const result = await budgetCatalogModel.createSubHeadsBulk(req.body || {});
            clearResolverCache();
            return res.status(201).json({ success: true, data: result });
        } catch (error) {
            return handleError(res, error, 'Failed to create sub-heads');
        }
    },

    async updateSubHead(req, res) {
        try {
            const success = await budgetCatalogModel.updateSubHead(req.params.id, req.body || {});
            if (!success) {
                return res.status(404).json({ success: false, message: 'Sub-head not found' });
            }
            clearResolverCache();
            return res.json({ success: true });
        } catch (error) {
            return handleError(res, error, 'Failed to update sub-head');
        }
    },

    async deleteSubHead(req, res) {
        try {
            const success = await budgetCatalogModel.softDeleteSubHead(req.params.id);
            if (!success) {
                return res.status(404).json({ success: false, message: 'Sub-head not found' });
            }
            clearResolverCache();
            return res.json({ success: true });
        } catch (error) {
            return handleError(res, error, 'Failed to delete sub-head');
        }
    },
};

export default budgetCatalogController;
