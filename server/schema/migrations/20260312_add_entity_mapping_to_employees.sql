-- Migration: Add entity mapping to employees
-- Author: Assistant
-- Date: 2026-03-12
-- Description: Allows employees to be mapped directly to Entities, Cells, Clubs, and Professional Bodies.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add entity_id column
ALTER TABLE master_employees 
ADD COLUMN entity_id INT NULL COMMENT 'FK to master_entities for non-departmental staff' AFTER department_id;

-- 2. Add Foreign Key
ALTER TABLE master_employees
ADD CONSTRAINT fk_emp_entity FOREIGN KEY (entity_id) 
    REFERENCES master_entities(id) ON DELETE SET NULL;

-- 3. Add Index
CREATE INDEX idx_emp_entity ON master_employees(entity_id);

-- 4. Recreate the employee view to include entity information
CREATE OR REPLACE VIEW v_employees AS
SELECT 
    e.id,
    e.erp_id,
    CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS full_name,
    e.first_name,
    e.last_name,
    e.email,
    e.mobile,
    e.designation,
    e.department_id,
    d.name AS department_name,
    d.code AS department_code,
    COALESCE(pd_emp.name, pd_dept.name) AS parent_department_name,
    e.entity_id,
    me.name AS entity_name,
    me.code AS entity_code,
    e.status,
    e.doj,
    e.orcid_id,
    e.scopus_id
FROM master_employees e
LEFT JOIN master_departments d ON e.department_id = d.id
LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
LEFT JOIN master_entities me ON e.entity_id = me.id;

SET FOREIGN_KEY_CHECKS = 1;
