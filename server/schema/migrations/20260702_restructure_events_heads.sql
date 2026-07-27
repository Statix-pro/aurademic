-- Restructure Events & Engagement: promote sub-categories to heads.
-- Reverses migration 20260623_deactivate_redundant_budget_heads.sql.
--
-- Before: "Events & Competitions" and "Meetings & Audits" are selectable heads
--         under group label "Events & Engagement".
-- After:  "Events & Competitions" and "Meetings & Audits" become group labels,
--         their child items become the selectable heads.

-- 1. Reactivate the 13 child heads
UPDATE budget_heads
SET is_active = 1
WHERE name IN (
  'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
  'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions',
  'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings'
);

-- 2. Deactivate the parent heads (they become group labels only)
UPDATE budget_heads
SET is_active = 0
WHERE name IN ('Events & Competitions', 'Meetings & Audits');

-- 3. Update group_label for "Events & Competitions" child heads
UPDATE budget_heads
SET group_label = 'Events & Competitions'
WHERE name IN (
  'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
  'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions'
);

-- 4. Update group_label for "Meetings & Audits" child heads
UPDATE budget_heads
SET group_label = 'Meetings & Audits'
WHERE name IN (
  'Institutional Governance Meetings', 'Academic Governance Meetings',
  'Institutional Audits', 'Government Meetings'
);

-- 5. Reactivate the HOAC shared sub-heads (expense items like Food & Refreshment)
--    that were deactivated in the previous migration
UPDATE budget_sub_heads
SET is_active = 1
WHERE scope = 'hoac-shared'
  AND event_type IN ('Events & Competitions', 'Meetings & Audits');

-- 6. Deactivate category-name items that exist as hoac-shared sub-heads
--    but are now promoted to heads. These should NOT appear as expense sub-heads
--    in the budget table dropdown.
UPDATE budget_sub_heads
SET is_active = 0
WHERE scope = 'hoac-shared'
  AND name IN (
    'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
    'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions',
    'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings'
  );

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- UPDATE budget_heads
-- SET is_active = 0
-- WHERE name IN (
--   'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
--   'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions',
--   'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings'
-- );
--
-- UPDATE budget_heads
-- SET is_active = 1
-- WHERE name IN ('Events & Competitions', 'Meetings & Audits');
--
-- UPDATE budget_heads
-- SET group_label = 'Events & Engagement'
-- WHERE name IN (
--   'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
--   'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions',
--   'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings'
-- );
--
-- UPDATE budget_sub_heads
-- SET is_active = 0
-- WHERE scope = 'hoac-shared'
--   AND event_type IN ('Events & Competitions', 'Meetings & Audits')
--   AND name NOT IN (
--     'Academic Events', 'Club Activities', 'College Events', 'Conferences & Conclaves',
--     'Association Activities', 'Outreach Events', 'Cultural & Celebrations', 'Sports', 'Competitions',
--     'Institutional Governance Meetings', 'Academic Governance Meetings', 'Institutional Audits', 'Government Meetings'
--   );
