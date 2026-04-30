-- Migration: Fix v_authors to expose student register number in identifier field
-- Created: 2026-04-12

CREATE OR REPLACE VIEW v_authors AS
SELECT
    a.id AS author_id,
    a.author_id AS author_code,
    (
      CASE
        WHEN a.employee_id IS NOT NULL
          THEN TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')))
        ELSE a.name
      END
    ) AS author_name,
    (
      CASE
        WHEN a.employee_id IS NOT NULL THEN e.email
        ELSE a.email
      END
    ) AS email,
    (
      CASE
        WHEN a.employee_id IS NOT NULL THEN e.designation
        ELSE a.designation
      END
    ) AS designation,
    (
      CASE
        WHEN a.employee_id IS NOT NULL THEN d.name
        ELSE a.department
      END
    ) AS department,
    (
      CASE
        WHEN a.employee_id IS NOT NULL
          THEN 'K.S.Rangasamy College of Technology'
        ELSE a.organization
      END
    ) AS organization,
    (
      CASE
        WHEN a.employee_id IS NOT NULL THEN e.erp_id
        ELSE s.student_unique_id
      END
    ) AS erp_id,
    e.orcid_id AS orcid_id,
    e.scopus_id AS scopus_id,
    e.wos_researcher_id AS wos_researcher_id,
    e.google_scholar_id AS google_scholar_id,
    (
      CASE
        WHEN a.employee_id IS NOT NULL THEN 'Internal'
        ELSE 'External'
      END
    ) AS author_type,
    a.employee_id AS employee_id,
    a.student_ref AS student_ref,
    a.created_at AS created_at
FROM authors a
LEFT JOIN master_employees e ON a.employee_id = e.id
LEFT JOIN master_departments d ON e.department_id = d.id
LEFT JOIN author_students s ON a.student_ref = s.id;
