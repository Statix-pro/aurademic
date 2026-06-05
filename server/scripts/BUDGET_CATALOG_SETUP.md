# Budget Catalog — Setup Guide

Moves hardcoded budget heads / sub-heads from the client into the DB so admins can edit them from `/admin/budget-catalog` without code changes.

SQL files do the work:

| File                                                                        | Purpose                                                                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `server/schema/migrations/20260520_create_budget_catalog.sql`               | Creates `budget_heads` and `budget_sub_heads` tables                                                      |
| `server/schema/migrations/20260520_seed_budget_catalog.sql`                 | Inserts ~75 heads and ~600 sub-heads (conditional inserts, safe to re-run)                                |
| `server/schema/migrations/20260521_add_catalog_refs_to_workflow_tables.sql` | Adds nullable catalog ID columns to Budget / Finance / Expenditure workflow tables and backfills old rows |
| `server/schema/migrations/20260522_add_catalog_deleted_flags.sql`           | Adds hidden/deleted flags so delete can hide from UI while toggle stays reversible                        |
| `server/schema/migrations/20260525_add_budget_tags_deleted_flag.sql`        | Adds hidden/deleted flag for editable budget tags                                                         |
| `server/schema/migrations/20260525_add_coe_claims_tag.sql`                  | Adds the CoE Claims tag                                                                                   |

Both are pure SQL — no Node needed at the target machine.

---

## Dev (your local machine)

```bash
# 1. Apply schema
mysql -u root -p research < server/schema/migrations/20260520_create_budget_catalog.sql

# 2. Apply seed
mysql -u root -p research < server/schema/migrations/20260520_seed_budget_catalog.sql

# 3. Add workflow catalog references + backfill
mysql -u root -p research < server/schema/migrations/20260521_add_catalog_refs_to_workflow_tables.sql

# 4. Add catalog deleted flags
mysql -u root -p research < server/schema/migrations/20260522_add_catalog_deleted_flags.sql

# 5. Add budget tag deleted flag + latest tag seed
mysql -u root -p research < server/schema/migrations/20260525_add_budget_tags_deleted_flag.sql
mysql -u root -p research < server/schema/migrations/20260525_add_coe_claims_tag.sql

# 6. Start the app
npm run dev
```

Open <http://localhost:3000/admin/budget-catalog> as a super-admin to verify the catalog renders and is editable.

> Alternative: `node server/scripts/seedBudgetCatalog.js` does the same thing programmatically (idempotent). Use whichever is convenient.

---

## Prod (AnyDesk / server without Node)

Copy the SQL files to the prod machine, then:

```bash
# 1. Schema
mysql -u <prod_user> -p <prod_db> < 20260520_create_budget_catalog.sql

# 2. Seed
mysql -u <prod_user> -p <prod_db> < 20260520_seed_budget_catalog.sql

# 3. Workflow references + backfill
mysql -u <prod_user> -p <prod_db> < 20260521_add_catalog_refs_to_workflow_tables.sql

# 4. Deleted flags for hide-vs-toggle behavior
mysql -u <prod_user> -p <prod_db> < 20260522_add_catalog_deleted_flags.sql

# 5. Budget tag deleted flag + latest tag seed
mysql -u <prod_user> -p <prod_db> < 20260525_add_budget_tags_deleted_flag.sql
mysql -u <prod_user> -p <prod_db> < 20260525_add_coe_claims_tag.sql
```

Then deploy the new server + client build so `/api/budget-catalog` and the admin page exist.
Do not deploy the new server before the third migration; the runtime now reads the new nullable ID columns.
Apply the deleted-flag migrations before exposing the delete/hide UI so the new `is_deleted` flags exist.

### Verify

```sql
SELECT COUNT(*) FROM budget_heads;       -- ~75
SELECT COUNT(*) FROM budget_sub_heads;   -- ~600+
SELECT COUNT(*) FROM budget_tags WHERE is_deleted = 0;
SELECT COUNT(*) FROM budget_proposal_lines WHERE budget_head_id IS NOT NULL;
SELECT COUNT(*) FROM finance_budget_breakup WHERE budget_head_id IS NOT NULL;
SELECT COUNT(*) FROM expenditure_advance_rows WHERE budget_head_id IS NOT NULL;
```

Open the live site, navigate to **Super Admin → Budget Catalog**, and confirm:

- Heads and sub-heads load.
- A test add / edit / delete works.
- The Budget, Expenditure, and Finance approval forms still show the dropdowns.
- Rename a catalog head used by an approved budget; finance/expenditure matching should continue through the stored IDs while old snapshot text remains unchanged.

### Rollback

```sql
-- Only use rollback before deploying the matching app code, or after rolling app code back.
ALTER TABLE budget_proposal_lines DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
ALTER TABLE finance_requests DROP COLUMN primary_head_id, DROP COLUMN event_sub_head_id;
ALTER TABLE finance_budget_breakup DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
ALTER TABLE expenditure_requests DROP COLUMN primary_head_id, DROP COLUMN event_sub_head_id;
ALTER TABLE expenditure_advance_rows DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
ALTER TABLE expenditure_settlement_rows DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
ALTER TABLE expenditure_line_rows DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
DROP TABLE IF EXISTS budget_sub_heads;
DROP TABLE IF EXISTS budget_heads;
```

---

## Editing the seed later

If the canonical list of heads/sub-heads changes in `server/scripts/seedBudgetCatalog.js`:

```bash
# On dev machine only — regenerates the SQL file
node server/scripts/generateBudgetCatalogSql.js
```

Commit the regenerated `20260520_seed_budget_catalog.sql` and re-apply on prod. Conditional inserts mean existing rows are untouched; only new entries are added. To remove rows, do it from the admin UI (soft delete) — don't edit the seed.

---

## Notes

- All four migration files are idempotent — safe to run multiple times.
- The seed wraps everything in a single transaction; any failure rolls back cleanly.
- The third migration uses guarded DDL because MySQL auto-commits schema changes; its data backfill is transactional.
- Reads from `GET /api/budget-catalog` are open to any authenticated user (every form needs them). Writes require super-admin.
- The catalog is cached client-side; after admin edits, the page calls a refresh that re-fetches and updates all three approval forms.
