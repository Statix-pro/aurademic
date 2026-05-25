-- Migration: Add CoE Claims tag
-- Date: 2026-05-25
-- Purpose: Add "CoE Claims" tag to the budget_tags table

INSERT IGNORE INTO budget_tags (tag_name, is_active, sort_order)
VALUES ('CoE Claims', 1, 130);
