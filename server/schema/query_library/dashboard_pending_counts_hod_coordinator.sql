-- Dashboard Pending Count Validation + Breakdown Queries
-- Purpose:
-- 1) Match Admin Budget Dashboard pending cards (HOD / Coordinator / TOTAL)
-- 2) Show pending count by department (HOD scope)
-- 3) Show pending count by entity (Coordinator scope)
--
-- Usage:
-- - Set @fy to the fiscal year shown in dashboard.
-- - Set optional filters (@q, @beneficiaryType, @departmentFilter) to exactly match UI filters.

SET @fy := 2026;
SET @q := NULL;                 -- Example: 'CSE' or NULL
SET @beneficiaryType := NULL;   -- Example: 'Faculty', 'Centre', 'Department' or NULL
SET @departmentFilter := NULL;  -- Example: 'Mechanical Engineering', 'IIC' or NULL

-- ============================================================
-- A) Dashboard-Matching Pending Cards (HOD, Coordinator, TOTAL)
-- ============================================================
WITH pending_pool AS (
  SELECT
    bp.id,
    bp.proposal_ref,
    bp.status,
    bp.current_stage,
    bp.beneficiary_type,
    bp.beneficiary_entity_id,
    bp.beneficiary_value,
    bp.department_id,
    md.name AS department_name,
    me.id   AS entity_id,
    me.name AS entity_name,
    CASE
      WHEN (
        (LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NULL)
        OR LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) = 'department'
      ) THEN 'HOD'
      WHEN (
        LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) IN ('centre', 'cell', 'club', 'professional body')
        OR (LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NOT NULL)
      ) THEN 'Coordinator'
      ELSE 'Other'
    END AS scope
  FROM budget_proposals bp
  LEFT JOIN master_departments md ON md.id = bp.department_id
  LEFT JOIN master_entities me ON me.id = bp.beneficiary_entity_id
  LEFT JOIN master_employees applicant_emp
    ON applicant_emp.user_id = bp.user_id AND applicant_emp.status = 'Active'
  WHERE bp.fiscal_year = @fy
    AND LOWER(TRIM(COALESCE(bp.status, ''))) <> 'deleted'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT IN ('archived', 'archive')
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT LIKE '%rejected%'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT LIKE '%returned%'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT IN
      ('level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed')

    AND (
      @beneficiaryType IS NULL OR TRIM(@beneficiaryType) = ''
      OR LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) = LOWER(TRIM(@beneficiaryType))
    )

    AND (
      @q IS NULL OR TRIM(@q) = ''
      OR bp.proposal_ref LIKE CONCAT('%', @q, '%')
      OR bp.beneficiary_value LIKE CONCAT('%', @q, '%')
      OR md.name LIKE CONCAT('%', @q, '%')
      OR me.name LIKE CONCAT('%', @q, '%')
      OR applicant_emp.first_name LIKE CONCAT('%', @q, '%')
      OR applicant_emp.last_name LIKE CONCAT('%', @q, '%')
    )

    AND (
      @departmentFilter IS NULL OR TRIM(@departmentFilter) = ''
      OR (
        LOWER(TRIM(COALESCE(@beneficiaryType, ''))) IN ('centre', 'cell', 'club', 'professional body')
        AND LOWER(TRIM(COALESCE(me.name, ''))) = LOWER(TRIM(@departmentFilter))
      )
      OR (
        LOWER(TRIM(COALESCE(@beneficiaryType, ''))) IN ('faculty', 'staff', 'department')
        AND LOWER(TRIM(COALESCE(md.name, ''))) = LOWER(TRIM(@departmentFilter))
      )
      OR (
        (LOWER(TRIM(COALESCE(@beneficiaryType, ''))) = '' OR @beneficiaryType IS NULL)
        AND (
          LOWER(TRIM(COALESCE(md.name, ''))) = LOWER(TRIM(@departmentFilter))
          OR LOWER(TRIM(COALESCE(me.name, ''))) = LOWER(TRIM(@departmentFilter))
        )
      )
    )
)
SELECT scope, COUNT(*) AS pending_count
FROM pending_pool
WHERE scope IN ('HOD', 'Coordinator')
GROUP BY scope
UNION ALL
SELECT 'TOTAL' AS scope, COUNT(*) AS pending_count
FROM pending_pool
WHERE scope IN ('HOD', 'Coordinator');

-- ============================================================
-- B) HOD Pending by Department
-- ============================================================
WITH pending_pool AS (
  SELECT
    bp.id,
    md.id AS department_id,
    md.name AS department_name,
    bp.beneficiary_type,
    bp.beneficiary_entity_id,
    bp.status
  FROM budget_proposals bp
  LEFT JOIN master_departments md ON md.id = bp.department_id
  LEFT JOIN master_entities me ON me.id = bp.beneficiary_entity_id
  LEFT JOIN master_employees applicant_emp
    ON applicant_emp.user_id = bp.user_id AND applicant_emp.status = 'Active'
  WHERE bp.fiscal_year = @fy
    AND LOWER(TRIM(COALESCE(bp.status, ''))) <> 'deleted'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT IN ('archived', 'archive')
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT LIKE '%rejected%'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT LIKE '%returned%'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT IN
      ('level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed')
    AND (
      (LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NULL)
      OR LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) = 'department'
    )

    AND (
      @beneficiaryType IS NULL OR TRIM(@beneficiaryType) = ''
      OR LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) = LOWER(TRIM(@beneficiaryType))
    )

    AND (
      @q IS NULL OR TRIM(@q) = ''
      OR bp.proposal_ref LIKE CONCAT('%', @q, '%')
      OR bp.beneficiary_value LIKE CONCAT('%', @q, '%')
      OR md.name LIKE CONCAT('%', @q, '%')
      OR me.name LIKE CONCAT('%', @q, '%')
      OR applicant_emp.first_name LIKE CONCAT('%', @q, '%')
      OR applicant_emp.last_name LIKE CONCAT('%', @q, '%')
    )

    AND (
      @departmentFilter IS NULL OR TRIM(@departmentFilter) = ''
      OR (
        LOWER(TRIM(COALESCE(@beneficiaryType, ''))) IN ('faculty', 'staff', 'department')
        AND LOWER(TRIM(COALESCE(md.name, ''))) = LOWER(TRIM(@departmentFilter))
      )
      OR (
        (LOWER(TRIM(COALESCE(@beneficiaryType, ''))) = '' OR @beneficiaryType IS NULL)
        AND LOWER(TRIM(COALESCE(md.name, ''))) = LOWER(TRIM(@departmentFilter))
      )
    )
)
SELECT
  COALESCE(department_id, 0) AS department_id,
  COALESCE(department_name, 'Unknown') AS department_name,
  COUNT(*) AS pending_count
FROM pending_pool
GROUP BY COALESCE(department_id, 0), COALESCE(department_name, 'Unknown')
ORDER BY pending_count DESC, department_name;

-- ============================================================
-- C) Coordinator Pending by Entity
-- ============================================================
WITH pending_pool AS (
  SELECT
    bp.id,
    me.id AS entity_id,
    me.name AS entity_name,
    bp.beneficiary_type,
    bp.beneficiary_entity_id,
    bp.status,
    md.name AS department_name
  FROM budget_proposals bp
  LEFT JOIN master_departments md ON md.id = bp.department_id
  LEFT JOIN master_entities me ON me.id = bp.beneficiary_entity_id
  LEFT JOIN master_employees applicant_emp
    ON applicant_emp.user_id = bp.user_id AND applicant_emp.status = 'Active'
  WHERE bp.fiscal_year = @fy
    AND LOWER(TRIM(COALESCE(bp.status, ''))) <> 'deleted'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT IN ('archived', 'archive')
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT LIKE '%rejected%'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT LIKE '%returned%'
    AND LOWER(TRIM(COALESCE(bp.status, ''))) NOT IN
      ('level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed')
    AND (
      LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) IN ('centre', 'cell', 'club', 'professional body')
      OR (LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NOT NULL)
    )

    AND (
      @beneficiaryType IS NULL OR TRIM(@beneficiaryType) = ''
      OR LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) = LOWER(TRIM(@beneficiaryType))
    )

    AND (
      @q IS NULL OR TRIM(@q) = ''
      OR bp.proposal_ref LIKE CONCAT('%', @q, '%')
      OR bp.beneficiary_value LIKE CONCAT('%', @q, '%')
      OR md.name LIKE CONCAT('%', @q, '%')
      OR me.name LIKE CONCAT('%', @q, '%')
      OR applicant_emp.first_name LIKE CONCAT('%', @q, '%')
      OR applicant_emp.last_name LIKE CONCAT('%', @q, '%')
    )

    AND (
      @departmentFilter IS NULL OR TRIM(@departmentFilter) = ''
      OR (
        LOWER(TRIM(COALESCE(@beneficiaryType, ''))) IN ('centre', 'cell', 'club', 'professional body')
        AND LOWER(TRIM(COALESCE(me.name, ''))) = LOWER(TRIM(@departmentFilter))
      )
      OR (
        (LOWER(TRIM(COALESCE(@beneficiaryType, ''))) = '' OR @beneficiaryType IS NULL)
        AND LOWER(TRIM(COALESCE(me.name, ''))) = LOWER(TRIM(@departmentFilter))
      )
    )
)
SELECT
  COALESCE(entity_id, 0) AS entity_id,
  COALESCE(entity_name, 'Unknown Entity') AS entity_name,
  COUNT(*) AS pending_count
FROM pending_pool
GROUP BY COALESCE(entity_id, 0), COALESCE(entity_name, 'Unknown Entity')
ORDER BY pending_count DESC, entity_name;
