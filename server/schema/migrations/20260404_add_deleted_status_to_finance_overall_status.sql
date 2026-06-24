-- Migration: Add deleted status to finance overall_status
-- Date: 2026-04-04
-- Purpose:
--   1) Extend finance_requests.overall_status enum with 'deleted'
--   2) Backfill already soft-deleted records to overall_status='deleted'

ALTER TABLE finance_requests
  MODIFY COLUMN overall_status ENUM('pending','approved','rejected','archived','deleted') DEFAULT 'pending';

UPDATE finance_requests
SET overall_status = 'deleted'
WHERE LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.status')), ''))) = 'deleted';
