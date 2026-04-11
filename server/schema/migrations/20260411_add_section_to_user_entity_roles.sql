-- Migration: Add 'SECTION' to user_entity_roles entity_type ENUM
-- Date: 2026-04-11
-- Description: Fixes "Data truncated" error when assigning users to Sections.

ALTER TABLE user_entity_roles 
MODIFY COLUMN entity_type ENUM('DEPARTMENT', 'CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION') NOT NULL;
