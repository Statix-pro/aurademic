-- Migration: Scope organization names to their submitter
-- Author: Aurademic maintainers
-- Date: 2026-10-15
-- Description: Replace the global organization-name unique index with a
--              per-submitter unique index for the private directory.

SET @drop_global_organization_name_index = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'organizations'
        AND index_name = 'uq_organizations_name'
    ),
    'ALTER TABLE `organizations` DROP INDEX `uq_organizations_name`',
    'SELECT 1'
  )
);
PREPARE drop_global_organization_name_index_stmt
  FROM @drop_global_organization_name_index;
EXECUTE drop_global_organization_name_index_stmt;
DEALLOCATE PREPARE drop_global_organization_name_index_stmt;

SET @add_submitter_organization_name_index = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'organizations'
        AND index_name = 'uq_organizations_created_by_name'
    ),
    'SELECT 1',
    'ALTER TABLE `organizations` ADD UNIQUE KEY `uq_organizations_created_by_name` (`created_by`, `name`)'
  )
);
PREPARE add_submitter_organization_name_index_stmt
  FROM @add_submitter_organization_name_index;
EXECUTE add_submitter_organization_name_index_stmt;
DEALLOCATE PREPARE add_submitter_organization_name_index_stmt;

-- Rollback only after confirming no different submitters have reused names:
-- ALTER TABLE `organizations` DROP INDEX `uq_organizations_created_by_name`;
-- ALTER TABLE `organizations` ADD UNIQUE KEY `uq_organizations_name` (`name`);
