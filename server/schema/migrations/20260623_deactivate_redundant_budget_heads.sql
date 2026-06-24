-- Remove 'Academic Events', 'Club Activities', etc. from the main selectable heads list.
-- Reactivate 'Events & Competitions' and 'Meetings & Audits' as the main selectable heads 
-- under 'Events & Engagement'.

UPDATE budget_heads 
SET is_active = 0 
WHERE name IN (
  'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
  'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions',
  'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings'
);

UPDATE budget_heads 
SET is_active = 1 
WHERE name IN ('Events & Competitions', 'Meetings & Audits');

-- Deactivate the old generic subheads for these groups
UPDATE budget_sub_heads
SET is_active = 0
WHERE event_type IN ('Events & Competitions', 'Meetings & Audits')
AND name NOT IN (
  'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
  'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions',
  'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings'
);

-- Note: To fully insert the new subheads, please run the seed script:
-- node server/scripts/seedBudgetCatalog.js

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- UPDATE budget_heads 
-- SET is_active = 1 
-- WHERE name IN (
--   'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
--   'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions',
--   'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings'
-- );
-- 
-- UPDATE budget_heads 
-- SET is_active = 0 
-- WHERE name IN ('Events & Competitions', 'Meetings & Audits');
-- 
-- UPDATE budget_sub_heads
-- SET is_active = 1
-- WHERE event_type IN ('Events & Competitions', 'Meetings & Audits');
