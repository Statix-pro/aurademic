-- Migration: Normalize finance chairman stage by amount threshold
-- Date: 2026-05-03
-- Purpose:
--   1) Keep default finance approval flow at principal
--   2) Use chairman stage only for proposals above 10,000
--   3) Repair active workflow snapshots if chairman was previously applied globally

UPDATE approval_flow_config
SET flow = JSON_ARRAY('level1', 'dof', 'principal'),
    updated_at = CURRENT_TIMESTAMP
WHERE is_active = 1
  AND LOWER(TRIM(module_key)) = 'finance';

-- Active records above threshold: enforce chairman as final stage
UPDATE finance_requests fr
SET fr.workflow_state = JSON_SET(
  fr.workflow_state,
  '$.flow',
  JSON_ARRAY('level1', 'dof', 'principal', 'chairman')
)
WHERE fr.workflow_state IS NOT NULL
  AND JSON_VALID(fr.workflow_state)
  AND COALESCE(fr.total_budget, 0) > 10000
  AND LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('in_progress', 'returned');

-- Active records at or below threshold: enforce principal as final stage
UPDATE finance_requests fr
SET fr.workflow_state = JSON_SET(
  fr.workflow_state,
  '$.flow',
  JSON_ARRAY('level1', 'dof', 'principal')
)
WHERE fr.workflow_state IS NOT NULL
  AND JSON_VALID(fr.workflow_state)
  AND COALESCE(fr.total_budget, 0) <= 10000
  AND LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('in_progress', 'returned');

-- If low-value active records are currently at chairman, move them back to principal
UPDATE finance_requests fr
SET fr.workflow_state = JSON_SET(fr.workflow_state, '$.currentStage', 'principal')
WHERE fr.workflow_state IS NOT NULL
  AND JSON_VALID(fr.workflow_state)
  AND COALESCE(fr.total_budget, 0) <= 10000
  AND LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) = 'in_progress'
  AND LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.currentStage')), ''))) = 'chairman';
