import masterDataModel from './masterDataModel.js';

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
};

const parsePositiveId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeEmployeeScope = (payload = {}) => {
  const departmentId = parsePositiveId(payload.department_id);
  const entityId = parsePositiveId(payload.entity_id);

  if (departmentId && entityId) {
    const error = new Error('Employee can be mapped to either Department or Entity, not both');
    error.statusCode = 400;
    throw error;
  }

  return {
    ...payload,
    department_id: departmentId,
    entity_id: entityId,
  };
};

const masterDataController = {
  // ============================================
  // DEPARTMENTS
  // ============================================

  async getDepartments(req, res) {
    try {
      const { type, is_active, search } = req.query;
      const filters = {};
      if (type) filters.type = type;
      if (is_active !== undefined) filters.is_active = parseInt(is_active, 10);
      if (search) filters.search = search;

      const departments = await masterDataModel.getDepartments(filters);
      return res.json({ success: true, data: departments });
    } catch (error) {
      return handleError(res, error, 'Failed to fetch departments');
    }
  },

  async createDepartment(req, res) {
    try {
      const { name } = req.body || {};
      if (!name) {
        return res.status(400).json({ success: false, message: 'Department name is required' });
      }
      const department = await masterDataModel.createDepartment(req.body);
      return res.status(201).json({ success: true, data: department });
    } catch (error) {
      return handleError(res, error, 'Failed to create department');
    }
  },

  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const updated = await masterDataModel.updateDepartment(id, req.body || {});
      if (updated) {
        return res.json({ success: true, message: 'Department updated successfully' });
      }
      return res.status(404).json({ success: false, message: 'Department not found' });
    } catch (error) {
      return handleError(res, error, 'Failed to update department');
    }
  },

  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      const deactivated = await masterDataModel.deleteDepartment(id);
      if (deactivated) {
        return res.json({ success: true, message: 'Department deactivated successfully' });
      }
      return res.status(404).json({ success: false, message: 'Department not found' });
    } catch (error) {
      return handleError(res, error, 'Failed to delete department');
    }
  },

  // ============================================
  // ENTITY TYPES
  // ============================================

  async getEntityTypes(req, res) {
    try {
      const types = await masterDataModel.getEntityTypes();
      return res.json({ success: true, data: types });
    } catch (error) {
      return handleError(res, error, 'Failed to fetch entity types');
    }
  },

  // ============================================
  // ENTITIES
  // ============================================

  async getEntities(req, res) {
    try {
      const { entity_type_id, is_active, search } = req.query;
      const filters = {};
      if (entity_type_id) filters.entity_type_id = parseInt(entity_type_id, 10);
      if (is_active !== undefined) filters.is_active = parseInt(is_active, 10);
      if (search) filters.search = search;

      const entities = await masterDataModel.getEntities(filters);
      return res.json({ success: true, data: entities });
    } catch (error) {
      return handleError(res, error, 'Failed to fetch entities');
    }
  },

  async createEntity(req, res) {
    try {
      const { entity_type_id, name } = req.body || {};
      if (!entity_type_id || !name) {
        return res.status(400).json({
          success: false,
          message: 'entity_type_id and name are required',
        });
      }
      const entity = await masterDataModel.createEntity(req.body);
      return res.status(201).json({ success: true, data: entity });
    } catch (error) {
      return handleError(res, error, 'Failed to create entity');
    }
  },

  async updateEntity(req, res) {
    try {
      const { id } = req.params;
      const updated = await masterDataModel.updateEntity(id, req.body || {});
      if (updated) {
        return res.json({ success: true, message: 'Entity updated successfully' });
      }
      return res.status(404).json({ success: false, message: 'Entity not found' });
    } catch (error) {
      return handleError(res, error, 'Failed to update entity');
    }
  },

  async deleteEntity(req, res) {
    try {
      const { id } = req.params;
      const deactivated = await masterDataModel.deleteEntity(id);
      if (deactivated) {
        return res.json({ success: true, message: 'Entity deactivated successfully' });
      }
      return res.status(404).json({ success: false, message: 'Entity not found' });
    } catch (error) {
      return handleError(res, error, 'Failed to delete entity');
    }
  },

  // ============================================
  // EMPLOYEES
  // ============================================

  async getEmployees(req, res) {
    try {
      const { search, department_id, status, employee_type, page, limit } = req.query;
      const filters = {};
      if (search) filters.search = search;
      if (department_id) filters.department_id = parseInt(department_id, 10);
      if (status) filters.status = status;
      if (employee_type) filters.employee_type = employee_type;
      if (page) filters.page = page;
      if (limit) filters.limit = limit;

      const result = await masterDataModel.getEmployees(filters);
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleError(res, error, 'Failed to fetch employees');
    }
  },

  async createEmployee(req, res) {
    try {
      const { erp_id, first_name, email } = req.body || {};
      if (!erp_id || !first_name || !email) {
        return res.status(400).json({
          success: false,
          message: 'erp_id, first_name, and email are required',
        });
      }
      const normalizedPayload = normalizeEmployeeScope(req.body || {});
      const employee = await masterDataModel.createEmployee(normalizedPayload);
      return res.status(201).json({ success: true, data: employee });
    } catch (error) {
      return handleError(res, error, 'Failed to create employee');
    }
  },

  async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const normalizedPayload = normalizeEmployeeScope(req.body || {});
      const updated = await masterDataModel.updateEmployee(id, normalizedPayload);
      if (updated) {
        return res.json({ success: true, message: 'Employee updated successfully' });
      }
      return res.status(404).json({ success: false, message: 'Employee not found' });
    } catch (error) {
      return handleError(res, error, 'Failed to update employee');
    }
  },

  async deleteEmployee(req, res) {
    try {
      const { id } = req.params;
      const deactivated = await masterDataModel.deleteEmployee(id);
      if (deactivated) {
        return res.json({ success: true, message: 'Employee deactivated successfully' });
      }
      return res.status(404).json({ success: false, message: 'Employee not found' });
    } catch (error) {
      return handleError(res, error, 'Failed to delete employee');
    }
  },

  // Lightweight employee search for lookup dropdowns
  async searchEmployeesLookup(req, res) {
    try {
      const { search } = req.query;
      const employees = await masterDataModel.searchEmployeesForLookup(search || '');
      return res.json({ success: true, data: employees });
    } catch (error) {
      return handleError(res, error, 'Failed to search employees');
    }
  },
};

export default masterDataController;
