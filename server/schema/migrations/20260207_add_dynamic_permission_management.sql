-- Migration: Enable Dynamic Permission Catalog Management
-- Author: Codex
-- Date: 2026-02-06
-- Description:
--   Allows custom permission CRUD while protecting system permissions.

ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS is_system TINYINT(1) NOT NULL DEFAULT 0
AFTER description;

UPDATE permissions
SET is_system = 1
WHERE permission_key IN (
  'admin_dashboard.read',
  'admin_dashboard.edit',
  'admin_dashboard.approve',
  'admin_dashboard.manage',
  'form_options.read',
  'form_options.edit',
  'form_options.manage',
  'finance.read',
  'finance.edit',
  'finance.approve',
  'publications.read',
  'publications.edit',
  'projects.read',
  'projects.edit',
  'events.read',
  'events.edit',
  'reports.read',
  'reports.manage',
  'access_control.read',
  'access_control.manage'
);
