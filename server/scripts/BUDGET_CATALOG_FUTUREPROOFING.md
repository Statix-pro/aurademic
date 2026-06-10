# Budget Catalog — Future-Proofing Notes

The May 2026 implementation moves the head / sub-head catalog into the DB and
stores stable catalog IDs alongside the old text snapshots. Workflow matching
now prefers those IDs, with normalized text matching only for rows that could
not be backfilled.

---

## Target design

**1. Catalog rows have stable identity.**

- `budget_heads.id` and `budget_sub_heads.id` are the real identity.
- Adding `code` (kebab-case slug) is optional but useful for cross-environment seeding and external integrations.
- Admin rename only changes `name` (display). `id` (and `code`) never change.
- Admin toggle uses `is_active`; admin delete is hidden-row soft delete using `is_active = 0` and `is_deleted = 1`. Physical delete is forbidden.

**2. Every record that references a head/sub-head stores both ID and snapshot text.**

```
budget_proposal_lines:
  budget_head_id           INT NULL       -- FK to budget_heads.id
  budget_sub_head_id       INT NULL       -- FK to budget_sub_heads.id
  budget_head              VARCHAR(255)   -- snapshot at time of submission
  sub_head                 VARCHAR(255)   -- snapshot at time of submission
```

- ID → future matching survives renames/reorgs.
- Snapshot → audit trail shows what the user actually saw and approved.

**3. Workflow matching prefers IDs, falls back to text only for legacy rows.**

When finance computes "how much of head X is already used":

```
1. JOIN budget_line_usage.budget_head_id with budget_proposal_lines.budget_head_id
   (the strong path; survives renames).
2. If budget_head_id IS NULL (legacy row), match by normalized text.
```

**4. Catalog availability respects context.**

- New budget proposal forms: show only `is_active = 1` heads/sub-heads.
- Finance / expenditure on an _existing_ approved budget: show whatever heads that budget actually used, even if now inactive — labelled `Civil Infrastructure (inactive)`. Never block submit on inactive-ness of a referenced head.
- Finance approved-budget dropdowns come from **approved budget rows**, not from the live catalog.

**5. Rename and deactivation are non-events.**

| Admin action                                  | Effect on old approved budget                                                                                          | Effect on new budget creation    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Rename `Civil Infrastructure` → `Civil Infra` | Snapshot keeps `Civil Infrastructure` in audit; dropdowns show `Civil Infra`; finance matching unchanged (ID is same). | Shows `Civil Infra`.             |
| Deactivate `Civil Infrastructure`             | Existing finance/expenditure flows continue. Display may add `(inactive)` suffix.                                      | Hidden from new-budget creation. |

---

## Current state (May 2026)

- `budget_heads` / `budget_sub_heads` tables exist with stable IDs ✅
- Admin soft-delete only for toggle, hidden rows use `is_deleted` ✅
- GET endpoint currently returns active rows unless `?includeInactive=true` (which is super-admin gated) ✅
- Budget, Finance, and Expenditure workflow tables store nullable catalog ID columns beside snapshot text ✅
- New Budget / Finance / Expenditure inserts resolve and store catalog IDs where possible ✅
- Old rows are backfilled by `20260521_add_catalog_refs_to_workflow_tables.sql` where text matches the catalog ✅
- Finance availability and Expenditure head-total validation prefer IDs and fall back to text for unbackfilled rows ✅
- Finance / Expenditure form dropdowns still primarily use the active catalog; deeper inactive-label wiring is the remaining UI polish item ⚠️

---

## Implemented Phases

These phases were implemented together in the catalog-ID hardening change.

### Phase 1 — Add nullable FK columns (schema only)

Migration `20260521_add_catalog_refs_to_workflow_tables.sql`:

```sql
ALTER TABLE budget_proposal_lines
  ADD COLUMN budget_head_id     INT NULL AFTER sub_head,
  ADD COLUMN budget_sub_head_id INT NULL AFTER budget_head_id,
  ADD INDEX  idx_bpl_head_id    (budget_head_id),
  ADD INDEX  idx_bpl_subhead_id (budget_sub_head_id);

ALTER TABLE finance_requests
  ADD COLUMN primary_head_id    INT NULL AFTER primary_head,
  ADD COLUMN event_sub_head_id  INT NULL AFTER event_sub_head;

ALTER TABLE finance_budget_breakup
  ADD COLUMN budget_head_id     INT NULL,
  ADD COLUMN budget_sub_head_id INT NULL;

ALTER TABLE expenditure_requests
  ADD COLUMN primary_head_id    INT NULL,
  ADD COLUMN event_sub_head_id  INT NULL;

ALTER TABLE expenditure_advance_rows     ADD COLUMN budget_head_id INT NULL, ADD COLUMN budget_sub_head_id INT NULL;
ALTER TABLE expenditure_settlement_rows  ADD COLUMN budget_head_id INT NULL, ADD COLUMN budget_sub_head_id INT NULL;
ALTER TABLE expenditure_line_rows        ADD COLUMN budget_head_id INT NULL, ADD COLUMN budget_sub_head_id INT NULL;
```

> No FK constraints (yet) so existing rows with NULL IDs don't break. We can add `FOREIGN KEY … ON DELETE SET NULL` once production rows are confirmed hydrated.

### Phase 2 — Write IDs on new submissions

Updated modules:

- `budget/budgetModel.js` — when inserting `budget_proposal_lines`, look up `budget_head_id` / `budget_sub_head_id` from the catalog by name and write both.
- `finance/financeModel.js` — same for `finance_requests` and `finance_budget_breakup`.
- `expenditure/expenditureModel.js` — same for `expenditure_requests`, `expenditure_advance_rows`, `expenditure_settlement_rows`, `expenditure_line_rows`.

Helper to put in `server/modules/budgetCatalog/budgetCatalogResolver.js`:

```js
export async function resolveCatalogIds(connection, headName, subHeadName) {
  const [[h]] = await connection.query('SELECT id FROM budget_heads WHERE name = ? LIMIT 1', [
    headName,
  ]);
  const headId = h?.id || null;
  let subId = null;
  if (headId && subHeadName) {
    const [[s]] = await connection.query(
      `SELECT id FROM budget_sub_heads
       WHERE name = ? AND scope = 'head-specific' AND head_id = ? LIMIT 1`,
      [subHeadName, headId],
    );
    subId = s?.id || null;
  }
  return { budget_head_id: headId, budget_sub_head_id: subId };
}
```

The backend resolver is the source of truth for now, so existing frontend
payload contracts stay intact.

### Phase 3 — Backfill old rows

One-time SQL (safe to run multiple times):

```sql
UPDATE budget_proposal_lines bpl
JOIN budget_heads h ON h.name = bpl.budget_head
SET bpl.budget_head_id = h.id
WHERE bpl.budget_head_id IS NULL;

UPDATE budget_proposal_lines bpl
JOIN budget_sub_heads s
  ON s.name = bpl.sub_head
 AND s.head_id = bpl.budget_head_id
 AND s.scope = 'head-specific'
SET bpl.budget_sub_head_id = s.id
WHERE bpl.budget_sub_head_id IS NULL AND bpl.budget_head_id IS NOT NULL;
```

…repeat for each table from Phase 1. Rows whose text doesn't match a current
catalog entry stay NULL; that's fine — they fall back to text matching.

### Phase 4 — Prefer IDs in matching queries

Update the joins in finance/expenditure availability calculations:

```sql
-- Before
JOIN budget_proposal_lines bpl ON bpl.budget_head = ? AND bpl.sub_head = ?

-- After
JOIN budget_proposal_lines bpl
  ON ( (? IS NOT NULL AND bpl.budget_head_id = ?)
       OR (? IS NULL AND bpl.budget_head IS NOT NULL AND
           LOWER(TRIM(bpl.budget_head)) = LOWER(TRIM(?))) )
```

Or, more pragmatically: try the ID join first in code; only fall back to text
when the ID is unknown (legacy proposal).

### Phase 5 — UI: inactive heads on existing records

- In the budget creation form, filter `is_active = 1` (already does this if
  using `budgetHeadGroups` from the hook).
- In finance / expenditure on an _existing_ approved budget, build the
  head/sub-head dropdown from **the budget's actual lines** (not from the live
  catalog), and tag any inactive heads with ` (inactive)` for clarity.
- Never block submit because a referenced head was deactivated post-approval.

Status: helper functions exist in the catalog store, but the finance and
expenditure form render sites are large and still need targeted inactive-label
wiring. This is UI-only; backend matching no longer depends on active names when
IDs exist.

### Phase 6 — Add `code` slug

Add `code VARCHAR(64) NULL` to both catalog tables. Useful for:

- Stable cross-environment references (`civil-infrastructure` in dev = prod).
- External system integration.
- Seed file readability.

Backfill with `LOWER(REPLACE(name, ' ', '-'))` then make admin UI auto-suggest.

---

## Non-goals / explicit constraints

- **Never delete catalog rows physically.** Always soft delete.
- **Never assume an active catalog row will exist for a referenced head/sub-head.** Always tolerate the inactive case.
- **Never let renaming a head invalidate audit trail.** Snapshot text on every reference.
- **Don't enforce FK constraints until Phase 3 backfill is done** — partial backfill + strict FK would prevent new inserts from succeeding when text matches no catalog row.

---

## Verification checklist (run after each phase)

- Apply migration on staging.
- Submit a new budget → check IDs are populated.
- Rename a head in `/admin/budget-catalog` → existing approved budget still finance-selectable; snapshot text unchanged.
- Deactivate a head → new budgets can't pick it; existing finance flows still work.
- Run availability calculation → numbers match pre-migration.
- Soft-delete a sub-head → vanishes from new dropdowns, retains in audit views.

---

## Duplicate head/sub-head lines (June 2026)

### The problem

`budget_proposal_lines` could hold **multiple lines with the same `budget_head` +
`sub_head`** within one proposal (e.g. the user added "Consumables / Chemicals"
on three separate rows). Nothing prevented it on submit. Downstream this forced
the Expenditure module to _group_ duplicate sub-heads in its dropdowns and then
_split_ an entered amount back across the underlying lines — fragile logic that
double-counted pre-advances and risked re-allocation drift on resubmit.

### Root-cause fix — server-side consolidation guard

The authoritative fix is to never **store** duplicates. `budget/budgetModel.js`
has a `consolidateProposalLines()` helper applied at the top of **both** `create`
and `update` transactions:

- Merges lines sharing `LOWER(TRIM(budget_head)) :: LOWER(TRIM(sub_head))`.
- Sums `unit_amount × quantity` into one line with `quantity = 1`.
- Concatenates distinct descriptions; sums month allocations per month.

Because it runs in the model (not the client), duplicates can't enter via the UI,
the API, other clients, or imports. The client `budget.tsx` also consolidates —
that's now defense-in-depth, not the guarantee.

Expenditure side: the amount-splitting logic was removed. A consolidated sub-head
now submits as a **single row** against the representative `budget_line_id`, and
the pre-advance summary is fetched once by head/sub (not per line), so legacy
duplicates still display/compute correctly without any data change.

### Legacy data — audited, NOT migrated (deliberate)

Read-only audit: `server/scripts/budget_duplicate_lines_audit.sql`.

Prod snapshot (June 2026): **113 duplicate groups**, **278 surplus lines**, across
**68 proposals**. ~109 groups are on `completed` proposals. Only **6** duplicate
lines carry financial references; zero `expenditure_budget_ledger` (RESTRICT) refs.

**Decision: no destructive prod migration.** Reasoning:

- The guard fixes all _future_ data; the Expenditure grouping handles _legacy_
  duplicates correctly with no DB change.
- Merging completed proposals would require rewriting **approved snapshot** data —
  `approved_unit_amount`, `approved_line_total`, and especially
  `approved_month_allocations_json` (a per-row JSON blob). A wrong JSON merge
  silently corrupts approved monthly figures on already-spent budgets. High risk,
  zero functional gain.

If a clean "no duplicates anywhere" invariant is ever wanted, the **only** safe
path is: restore a prod dump into dev → run the merge there → reconcile totals →
then (and only then) consider prod. Never first-run it on prod.

A correct merge must, per duplicate group (survivor = lowest `id`):

| Referencing table                                              | Cascade                          | Action on merge                                                                       |
| -------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| `budget_line_month_allocations`                                | CASCADE, unique `(line,month)`   | **SUM** per month into survivor, then delete others                                   |
| `finance_budget_line_usage`                                    | CASCADE, **PK = budget_line_id** | **SUM** `consumed_amount` into survivor (repoint alone = PK collision), delete others |
| `finance_budget_usage_ledger`                                  | CASCADE                          | repoint `budget_line_id` → survivor                                                   |
| `expenditure_line_rows` / `_advance_rows` / `_settlement_rows` | SET NULL                         | repoint → survivor                                                                    |
| `expenditure_budget_ledger`                                    | RESTRICT                         | repoint → survivor (0 in prod, but blocks delete if present)                          |

Then update the survivor `budget_proposal_lines` row: sum `line_total` **and
`approved_line_total` separately** (preserve approved figures), set `quantity = 1`,
merge `approved_month_allocations_json`, concat descriptions — all inside one
transaction with a before/after total-reconciliation assertion. Delete non-survivors last.

### Non-goals

- **Don't auto-merge prod history.** The guard + grouping make it unnecessary.
- **Don't overwrite `approved_*` snapshots with proposed sums** — approved totals
  may differ from proposed and are part of the audit record.
