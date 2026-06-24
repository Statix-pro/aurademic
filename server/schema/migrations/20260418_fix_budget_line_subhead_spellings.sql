-- Fix budget line sub_head spellings to match dropdown values
UPDATE budget_proposal_lines SET sub_head = 'Registration fee' WHERE LOWER(TRIM(sub_head)) IN ('registration fee', 'registration fees');
UPDATE budget_proposal_lines SET sub_head = 'Travel Allowance' WHERE LOWER(TRIM(sub_head)) IN ('travel allowance', 'travel allowances');
UPDATE budget_proposal_lines SET sub_head = 'Travel Support' WHERE LOWER(TRIM(sub_head)) IN ('travel support', 'travel supports');
UPDATE budget_proposal_lines SET sub_head = 'Food & Refreshment' WHERE LOWER(TRIM(sub_head)) IN ('food & refreshment', 'food and refreshment', 'food & refreshments', 'food and refreshments');
UPDATE budget_proposal_lines SET sub_head = 'Accommodation' WHERE LOWER(TRIM(sub_head)) IN ('accommodation', 'accommodations');
UPDATE budget_proposal_lines SET sub_head = 'Daily Allowance' WHERE LOWER(TRIM(sub_head)) IN ('daily allowance', 'daily allowances');
UPDATE budget_proposal_lines SET sub_head = 'Membership Fees' WHERE LOWER(TRIM(sub_head)) IN ('membership fees', 'membership fee');
