# Fresh Deployment — Legacy Code Cleanup Guide

> **Purpose:** This document lists every backward-compatibility "safety net" in the
> codebase that exists only to support old data, old JWT shapes, old API field names,
> or pre-migration database schemas. On a **fresh deployment** with no historical
> data, all of these can be safely removed to simplify the codebase.
>
> Date: June 6, 2026

---

## Quick Summary

| #   | Module               | What                                                                   | Risk    |
| --- | -------------------- | ---------------------------------------------------------------------- | ------- |
| 1   | Access Control       | `LEGACY_ADMIN_PERMISSION_KEYS` constant                                | ✅ Safe |
| 2   | Access Control       | `legacyIsAdmin` / `fallbackPermissions` logic                          | ✅ Safe |
| 3   | Access Control       | `syncLegacyAdminFlag()` method                                         | ✅ Safe |
| 4   | Access Control       | `users.is_admin` boolean reads everywhere                              | ✅ Safe |
| 5   | Auth Middleware      | Dual-key JWT normalization (`id`/`userId`, `role`/`roles`, snake_case) | ✅ Safe |
| 6   | Auth Middleware      | `toRequestUser()` backward-compat aliases                              | ✅ Safe |
| 7   | Auth Controller      | `is_admin` baked into JWT via OR fallback                              | ✅ Safe |
| 8   | Auth Model           | Commented-out old `authModel` (lines 1–82)                             | ✔ Done  |
| 9   | Pre-Event Controller | Snake_case field name fallbacks                                        | ✅ Safe |
| 10  | Documents Controller | "Legacy mode" for missing `events.status` col                          | ✅ Safe |
| 11  | Budget Catalog       | Text-matching fallback when `budget_head_id IS NULL`                   | ✅ Safe |
| 12  | Budget Model         | Catalog ID resolver fallback to NULL                                   | ✅ Safe |
| 13  | Finance Model        | Text-based budget matching for old rows                                | ✅ Safe |
| 14  | Expenditure Model    | `createExpenditureLegacy()` function                                   | ✅ Safe |
| 15  | Expenditure Model    | `deriveLegacyAnchorRequestIds()` function                              | ✅ Safe |
| 16  | Expenditure Model    | `legacy_totals` text-matching SQL subquery                             | ✅ Safe |
| 17  | Expenditure Model    | `resolveCanonicalBeneficiaryOrg()` legacy payee name                   | ✅ Safe |
| 18  | Admin Budget Model   | Legacy text snapshot column reads                                      | ✅ Safe |
| 19  | Admin Budget Model   | `parent_dept_fallback` LEFT JOINs                                      | ⚠️ Keep |
| 20  | Role Sync Service    | Default `'CELL'` entity type fallback                                  | ⚠️ Keep |
| 21  | Client (types/utils) | `is_admin` / `is_super_admin` snake_case User fields                   | ✅ Safe |
| 22  | Client (4 pages)     | Super admin dual-key detection (`is_super_admin \|\| isSuperAdmin`)    | ✅ Safe |
| 23  | Client (budget)      | `is_admin ?? isAdmin ?? updated_by_admin ?? updatedByAdmin` quad-key   | ✅ Safe |
| 24  | Client (expenditure) | `legacy-head::` / `legacy-sub::` synthetic budget options              | ✅ Safe |
| 25  | Client (budget/exp)  | `FALLBACK_TAG_OPTIONS` hardcoded constants                             | ✅ Safe |
| 26  | Client (expenditure) | `FALLBACK_SUBCATEGORY_OPTIONS` institution-specific hardcoded list     | ✅ Safe |
| 27  | Client (workflow)    | `FALLBACK_BENEFICIARY_OPTIONS` hardcoded filter list                   | ✅ Safe |
| 28  | Client (finance)     | Legacy annexure flat-column fallback                                   | ✅ Safe |
| 29  | Client (workflow)    | `user.role` singular read                                              | ✅ Safe |
| 30  | Client (finance)     | `stageRoleFallback` role-name matching                                 | ⚠️ Keep |
| 31  | Expenditure (API)    | Bulk NEFT → Bulk Transaction rename aliases                            | ✅ Safe |

**Legend:** ✅ Safe = remove on fresh deploy. ⚠️ Keep = functional safety net, not just legacy
compat. ✔ Done = already removed.

---

## 1. Access Control — `LEGACY_ADMIN_PERMISSION_KEYS`

**File:** [accessControlModel.js](../../server/modules/accessControl/accessControlModel.js#L11-L29)

```js
const LEGACY_ADMIN_PERMISSION_KEYS = [
  'admin_dashboard.read',
  'admin_dashboard.edit',
  // ... 16 hardcoded permission keys
];
```

**Why it exists:** Before the RBAC system (`roles` + `permissions` + `user_roles` tables), admin status was a single `users.is_admin` boolean. This constant defines which permissions to grant if a user has `is_admin = 1` but has no RBAC role assignments.

**On fresh deploy:** All admins will have proper roles assigned. This constant is dead code.

**Cleanup:** Delete the constant and all references to it.

---

## 2. Access Control — `legacyIsAdmin` / `fallbackPermissions`

**File:** [accessControlModel.js](../../server/modules/accessControl/accessControlModel.js#L492-L569)

**What it does (3 fallback layers):**

1. **Line 500:** Reads `users.is_admin` boolean → `legacyIsAdmin`
2. **Line 501:** Pre-computes `fallbackPermissions` from `LEGACY_ADMIN_PERMISSION_KEYS` if `legacyIsAdmin` is true
3. **Lines 546–548:** If RBAC returns 0 permissions but `legacyIsAdmin` is true → injects legacy permissions
4. **Lines 559–565:** If RBAC tables don't exist at all (`ER_NO_SUCH_TABLE`) → falls back entirely to `legacyIsAdmin` + `fallbackPermissions`

**On fresh deploy:** RBAC tables always exist. All admins have proper role assignments. None of these branches execute.

**Cleanup:** Remove the `legacyIsAdmin` variable, `fallbackPermissions`, and the catch block for `ER_NO_SUCH_TABLE`. Simplify `isAdmin` to be derived purely from RBAC roles.

---

## 3. Access Control — `syncLegacyAdminFlag()`

**File:** [accessControlModel.js](../../server/modules/accessControl/accessControlModel.js#L1240-L1260)

```js
async syncLegacyAdminFlag(connection, userId) {
  // reads user's RBAC roles → writes back users.is_admin = 1|0
}
```

**Why it exists:** Keeps `users.is_admin` in sync with RBAC so that code still checking the old boolean column continues to work. Called from `updateUserRoles()` (line 1370) and `setUserSuperAdmin()` (line 1436).

**On fresh deploy:** Nothing reads `users.is_admin` if items 1–2 and 4 are also cleaned up.

**Cleanup:** Delete the method and its call sites. Optionally drop the `users.is_admin` column itself.

---

## 4. Access Control — `users.is_admin` reads everywhere

**File:** [accessControlModel.js](../../server/modules/accessControl/accessControlModel.js) — Lines 439, 492, 500, 1147, 1173, 1468

Every query that reads user data includes `u.is_admin` and exposes it in the returned objects (`groupUserRows`, `getUsersWithRoles`, `getUserByIdWithRoles`).

**On fresh deploy:** Admin status comes from RBAC roles. The column can be removed from SELECT statements.

**Cleanup:** Remove `is_admin` from all SELECT queries and return objects in this file. Coordinate with items 1–3 and 7.

---

## 5. Auth Middleware — Dual-Key JWT Normalization

**File:** [authMiddleware.js](../../server/middleware/authMiddleware.js#L57-L92)

Two functions handle old JWT shapes:

### `normalizeDecodedUser()` (Lines 57–73)

| Field            | Old shape                | Modern shape            |
| ---------------- | ------------------------ | ----------------------- |
| User ID          | `decoded.id`             | `decoded.userId`        |
| Roles            | `decoded.role` (string)  | `decoded.roles` (array) |
| Admin flag       | `decoded.is_admin`       | `decoded.isAdmin`       |
| Super admin flag | `decoded.is_super_admin` | `decoded.isSuperAdmin`  |

### `normalizeRequestUser()` (Lines 76–92)

Same pattern for `req.user` objects set by other middleware.

**On fresh deploy:** JWTs are always signed with `userId`, `isAdmin`, `isSuperAdmin`, `roles` (array). Old token shapes don't exist.

**Cleanup:** Simplify both functions to read only the modern field names. Remove `??` fallbacks and singular `role` handling.

---

## 6. Auth Middleware — `toRequestUser()` Backward-Compat Aliases

**File:** [authMiddleware.js](../../server/middleware/authMiddleware.js#L94-L107)

```js
const toRequestUser = (user) => ({
  // ... modern fields ...
  role: uniqueStringArray(user.roles)[0] || null, // singular alias
  // Backward compatibility for older handlers/components
  is_admin: Boolean(user.isAdmin),
  is_super_admin: Boolean(user.isSuperAdmin),
});
```

**Why it exists:** Old route handlers and frontend code read `req.user.role` (singular), `req.user.is_admin`, or `req.user.is_super_admin` instead of the camelCase equivalents.

**On fresh deploy:** Standardize all handlers to read camelCase fields.

**Cleanup:** Remove lines 101, 104–106. Audit all route handlers that read `req.user.role`, `req.user.is_admin`, or `req.user.is_super_admin`.

> **Client-side cleanup:** The following files read `is_admin` from the user object and should be updated to use `isAdmin`:
>
> - [ability.ts](../../client/src/shared/casl/ability.ts#L112) — `if (user.is_admin)`
> - [permissionUtils.ts](../../client/src/shared/utils/permissionUtils.ts#L49) — `user.is_admin`
> - [types/index.ts](../../client/src/types/index.ts#L16) — `is_admin: boolean` type definition
> - [adminbudget.tsx](../../client/src/features/admin/budget/budget-approval/adminbudget.tsx#L1177) — `edit.is_admin ?? edit.isAdmin` dual-key
> - [budgetdashboard.tsx](../../client/src/features/user-dashboard/budgetdashboard/budgetdashboard.tsx#L616) — `edit.is_admin ?? edit.isAdmin` dual-key

---

## 7. Auth Controller — `is_admin` Baked Into JWT

**File:** [authController.js](../../server/modules/auth/authController.js) — Lines 46–58, 120–132  
**File:** [authModel.js](../../server/modules/auth/authModel.js) — Line 163

```js
// authModel.js line 163
computedIsAdmin = authorization.isAdmin || Boolean(user.is_admin);
```

The `|| Boolean(user.is_admin)` is a fallback for users who have the old `is_admin = 1` flag but no RBAC admin role yet.

**On fresh deploy:** No user will have `is_admin = 1` set manually. The OR clause is always `false`.

**Cleanup:** Change to `computedIsAdmin = authorization.isAdmin;` and stop reading `is_admin` from the user row.

---

## 8. Auth Model — Commented-Out Old Version ✔ Done

**File:** [authModel.js](../../server/modules/auth/authModel.js)

Lines 1–82 held the entire old `authModel` implementation commented out. It returned `is_admin`
straight from the DB column with no RBAC integration.

**Cleanup:** Done — the commented-out block was deleted; the live `authModel` is untouched.

---

## 9. Pre-Event Controller — Snake_Case Field Name Fallbacks

**File:** [preEventController.js](../../server/modules/events/preevents/preEventController.js#L115-L128)

```js
// Handle legacy field names for backward compatibility
const event_type = eventType.length > 0 ? eventType : req.body.event_type || [];
const target_audience = targetAudience.length > 0 ? targetAudience : req.body.target_audience || [];
const start_date = startDate || req.body.start_date;
const end_date = endDate || req.body.end_date;
// ... 13 such fallbacks in createPreEvent() and updatePreEvent()
```

**Why it exists:** Old frontend versions sent snake_case field names (`event_type`, `start_date`). The current frontend sends camelCase (`eventType`, `startDate`).

**On fresh deploy:** Frontend always sends camelCase.

**Cleanup:** Remove the `||` fallbacks in both `createPreEvent()` (lines 115–128) and `updatePreEvent()` (lines 282–295). Use the destructured camelCase variables directly.

---

## 10. Documents Controller — "Legacy Mode" for Missing `events.status`

**File:** [documentsController.js](../../server/modules/events/documents/documentsController.js)

Three functions have identical catch blocks that handle the case where `events.status` column doesn't exist yet:

| Function              | Lines   | Legacy response message                                     |
| --------------------- | ------- | ----------------------------------------------------------- |
| `submitForApproval()` | 573–597 | `'Event submitted for approval successfully (legacy mode)'` |
| `requestEdit()`       | 637–662 | `'Edit request sent successfully (legacy mode)'`            |
| `getEventStatus()`    | 711–743 | Falls back to hardcoded `status: 'draft'`                   |

**Why it exists:** The `events.status` column was added in a migration. This catch block survives the case where the migration hasn't been applied yet.

**On fresh deploy:** The `events` table always has the `status` column from the schema.

**Cleanup:** Remove the `if (err.message.includes('Unknown column'))` catch blocks in all three functions. Let the error propagate normally.

---

## 11. Budget Catalog — Text-Matching Fallback for `budget_head_id IS NULL`

**File:** [budgetCatalogResolver.js](../../server/modules/budgetCatalog/budgetCatalogResolver.js#L1-L11)

```js
// LEGACY: if the catalog has no row matching the submitted name (e.g. older
// data that pre-dates the catalog), IDs come back as NULL and downstream code
// falls back to text matching — that is the documented legacy behavior.
```

The resolver returns `{ budget_head_id: null, budget_sub_head_id: null }` when the submitted text doesn't match any catalog row. Downstream code (finance, expenditure) then matches by comparing text strings instead of IDs.

**On fresh deploy:** The catalog is seeded and all new submissions go through the resolver. IDs are always populated.

**Cleanup:** The resolver itself is fine. The downstream text-matching fallbacks in finance and expenditure models (items 13, 16) are the actual code to remove.

---

## 12. Budget Model — Catalog ID Resolver Fallback

**File:** [budgetModel.js](../../server/modules/budget/budgetModel.js#L1719)

```js
// LEGACY: if the submitted head/sub_head doesn't exist in the catalog
// (old data), budget_head_id / budget_sub_head_id will be NULL
```

When inserting `budget_proposal_lines`, the model calls `resolveCatalogIds()` and gracefully stores `NULL` if the text doesn't match any catalog entry. This supports pre-catalog rows.

**On fresh deploy:** All budget heads exist in the catalog. IDs are always resolved.

**Cleanup:** After removing the text-matching fallbacks downstream, optionally add a validation that rejects submissions with unresolvable head names instead of silently storing NULL.

---

## 13. Finance Model — Text-Based Budget Matching

**File:** [financeModel.js](../../server/modules/finance/financeModel.js)

The budget availability calculation has a dual-path join:

1. **Primary path:** Match by `budget_head_id` (FK to catalog)
2. **Fallback path:** If `budget_head_id IS NULL`, match by `LOWER(TRIM(budget_head))` text comparison

This dual-path pattern appears in availability queries, usage rollup calculations, and carry-forward summaries.

**On fresh deploy:** All rows have catalog IDs populated. The text-matching branch never executes.

**Cleanup:** Remove the `OR (budget_head_id IS NULL AND ...)` text-matching clauses from availability and usage queries. Use ID-only joins.

---

## 14. Expenditure Model — `createExpenditureLegacy()`

**File:** [expenditureModel.js](../../server/modules/expenditure/expenditureModel.js#L2552)

A complete alternate creation function that inserts expenditure requests using the old schema (flat columns like `head`, `sub_head`, `amount`, `budget_line_id`) instead of the modern normalized rows (`expenditure_advance_rows`, `expenditure_line_rows`, etc.).

**On fresh deploy:** The modern `createExpenditure()` function handles all creation. The legacy function is dead code.

**Cleanup:** Delete `createExpenditureLegacy()` and its call site.

---

## 15. Expenditure Model — `deriveLegacyAnchorRequestIds()`

**File:** [expenditureModel.js](../../server/modules/expenditure/expenditureModel.js#L481-L515)

Derives the set of "anchor" expenditure request IDs that belong to the same finance request, using both the modern `expenditure_request_refs` table and a fallback direct `finance_request_id` column on the request.

**Why it exists:** Old expenditure requests stored the finance link as a direct FK column. New ones use the `expenditure_request_refs` junction table.

**On fresh deploy:** All links go through `expenditure_request_refs`.

**Cleanup:** Remove the fallback `finance_request_id` column path. Use only the refs table.

---

## 16. Expenditure Model — `legacy_totals` Text-Matching SQL

**File:** [expenditureModel.js](../../server/modules/expenditure/expenditureModel.js#L670-L870)

A large block that builds a SQL subquery (`legacy_totals`) to sum advance amounts from old-format expenditure requests that have flat `head`, `sub_head`, `budget_line_id`, and `amount` columns instead of the modern `expenditure_advance_rows` table.

Key variables: `hasLegacyBudgetLine`, `hasLegacyHead`, `hasLegacySubHead`, `legacyAmountExpr`, `legacyMatchClause`, `legacyMatchParams`.

The final query does: `COALESCE(row_totals.total, 0) + COALESCE(legacy_totals.total, 0)` to combine both sources.

**On fresh deploy:** No old-format rows exist. `legacy_totals` always returns 0.

**Cleanup:** Remove the entire `legacy_totals` subquery construction. Use only `row_totals` from the normalized tables.

---

## 17. Expenditure Model — `resolveCanonicalBeneficiaryOrg()`

**File:** [expenditureModel.js](../../server/modules/expenditure/expenditureModel.js#L59-L66)

```js
const resolveCanonicalBeneficiaryOrg = (beneficiaryOrg, legacyPayeeName) => {
  // If beneficiaryOrg is empty, tries to extract it from the old payee_name field
};
```

**Why it exists:** Old expenditure requests stored the beneficiary organization inside the `payee_name` field. Modern requests have a separate `beneficiary_org` column.

**On fresh deploy:** `beneficiary_org` is always populated.

**Cleanup:** Remove the `legacyPayeeName` parameter and fallback logic. Use `beneficiaryOrg` directly.

---

## 18. Admin Budget Model — Legacy Text Snapshot Reads

**File:** [adminBudgetModel.js](../../server/modules/adminbudget/adminBudgetModel.js#L2606)

```js
// LEGACY: text snapshot columns remain authoritative for old rows whose
// budget_head_id / budget_sub_head_id could not be backfilled.
```

Various queries in the admin budget model read both `budget_head` (text) and `budget_head_id` (FK), using `COALESCE` to prefer the ID-based join but fall back to the text column for display.

**On fresh deploy:** All rows have IDs populated. The text column is only needed for audit/display snapshots (which is a feature, not a fallback).

**Cleanup:** The `COALESCE` pattern for display is acceptable to keep. Remove the dual-path matching logic that uses text columns for computation.

---

## 19. ⚠️ KEEP — Admin Budget Model — `parent_dept_fallback` JOINs

**File:** [adminBudgetModel.js](../../server/modules/adminbudget/adminBudgetModel.js#L2922-L2933)  
**File:** [budgetModel.js](../../server/modules/budget/budgetModel.js#L1798-L1825)

```sql
COALESCE(emp_parent_dept.name, emp_parent_dept_fallback.name, emp_dept.name) AS user_department
LEFT JOIN master_departments emp_parent_dept_fallback
  ON emp_dept.parent_id = emp_parent_dept_fallback.id
```

**Why it exists:** The department hierarchy has two levels of parent lookups. This is a data model concern (not all departments have a grandparent), not a legacy compat issue.

**Verdict:** **KEEP.** This is functional logic for handling the department hierarchy, not a backward-compat safety net.

---

## 20. ⚠️ KEEP — Role Sync Service — Default `'CELL'` Entity Type

**File:** [roleSyncService.js](../../server/modules/accessControl/roleSyncService.js#L73)

```js
let entityTypeEnum = 'CELL'; // Default fallback
```

**Why it exists:** Maps `master_entity_types.code` → `user_entity_roles.entity_type` ENUM. Defaults to `CELL` if the code doesn't match any known pattern.

**Verdict:** **KEEP.** This is a defensive default for data integrity. On a fresh deploy, entity types may still have unexpected codes. Replace with proper validation later if desired.

---

## Frontend Legacy Patterns

---

### 21. Client — `is_admin` / `is_super_admin` Snake_Case Reads

Multiple frontend files read the legacy snake_case fields from the user object and API responses:

#### `is_admin` reads

| File                                                                       | Line    | Pattern                                                                 |
| -------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| [ability.ts](../../client/src/shared/casl/ability.ts#L112)                 | 112     | `if (user.is_admin)` — grants admin dashboard CASL abilities            |
| [permissionUtils.ts](../../client/src/shared/utils/permissionUtils.ts#L49) | 49, 143 | `user.is_admin` in `canAccessAdminArea()` and `isAdminOrWorkflowRole()` |
| [types/index.ts](../../client/src/types/index.ts#L16)                      | 16      | `is_admin: boolean` type definition on `User` interface                 |
| [shared/types/index.ts](../../client/src/shared/types/index.ts#L8)         | 8       | `//   is_admin: boolean;` (commented out, dead code)                    |

#### `is_super_admin` reads

| File                                                                       | Line | Pattern                                            |
| -------------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| [types/index.ts](../../client/src/types/index.ts#L17)                      | 17   | `is_super_admin?: boolean` type definition         |
| [ability.ts](../../client/src/shared/casl/ability.ts#L90)                  | 90   | `if (user.is_super_admin) return true`             |
| [permissionUtils.ts](../../client/src/shared/utils/permissionUtils.ts#L23) | 23   | `Boolean(user.is_super_admin)` in `isSuperAdmin()` |

**On fresh deploy:** Standardize the API to always return camelCase (`isAdmin`, `isSuperAdmin`). Update the `User` type and all reads.

**Cleanup:** Update the `User` interface in [types/index.ts](../../client/src/types/index.ts) to use `isAdmin` and `isSuperAdmin`. Update all reads across ability, permissionUtils, and other files.

---

### 22. Client — Super Admin Dual-Key Detection

Several components detect super admin status with a belt-and-suspenders approach, checking both snake_case and camelCase:

| File                                                                                           | Line | Code                                                                      |
| ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| [expenditureapproval.tsx](../../client/src/features/expenditure/expenditureapproval.tsx#L1066) | 1066 | `Boolean(user?.is_super_admin \|\| (user as any)?.isSuperAdmin)`          |
| [financeapproval.tsx](../../client/src/features/finance/financeapproval.tsx#L2498)             | 2498 | `Boolean(user?.is_super_admin \|\| (user as any)?.isSuperAdmin)`          |
| [financecard.tsx](../../client/src/features/user-dashboard/financecard/financecard.tsx#L130)   | 130  | `Boolean((user as any)?.is_super_admin \|\| (user as any)?.isSuperAdmin)` |
| [budget.tsx](../../client/src/features/budget/budget.tsx#L571)                                 | 571  | `Boolean(user?.is_super_admin) \|\| Boolean((user as any)?.isSuperAdmin)` |

**On fresh deploy:** After standardizing the `User` type to `isSuperAdmin`, simplify all these to `Boolean(user?.isSuperAdmin)`.

**Cleanup:** After item 21 is done, replace all dual-key super admin checks with the single camelCase property. Remove `(user as any)` casts.

---

### 23. Client — `is_admin ?? isAdmin ?? updated_by_admin ?? updatedByAdmin` Quad-Key Reads

Budget components use a 4-way fallback to detect whether an edit/approval was made by an admin:

| File                                                                                                     | Line       | Code                                                                                     |
| -------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| [adminbudget.tsx](../../client/src/features/admin/budget/budget-approval/adminbudget.tsx#L1177)          | 1177, 1283 | `Boolean(edit.is_admin ?? edit.isAdmin ?? edit.updated_by_admin ?? edit.updatedByAdmin)` |
| [budgetdashboard.tsx](../../client/src/features/user-dashboard/budgetdashboard/budgetdashboard.tsx#L616) | 616, 718   | Same 4-way fallback                                                                      |

**Why it exists:** The server API response format for budget audit logs changed from snake_case to camelCase at some point. Both old and new response shapes must be handled.

**On fresh deploy:** Standardize the API response to one format (camelCase).

**Cleanup:** After standardizing the server response, simplify to `Boolean(edit.isAdmin || edit.updatedByAdmin)`.

---

### 24. Client — `legacy-head::` / `legacy-sub::` Budget Option Values

The expenditure approval form creates synthetic dropdown options with `legacy-` prefixed values when an existing expenditure request references a budget head/sub-head that doesn't exist in the current approved budget options:

| File                                                                                                 | Lines     | Code                                                         |
| ---------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| [expenditureapproval.tsx](../../client/src/features/expenditure/expenditureapproval.tsx#L2157-L2166) | 2157–2166 | `value: \`legacy-head::${fallbackHead}\``                    |
| [expenditureapproval.tsx](../../client/src/features/expenditure/expenditureapproval.tsx#L2232-L2242) | 2232–2242 | `value: \`legacy-sub::${fallbackHead}::${fallbackSubHead}\`` |
| [expenditureapproval.tsx](../../client/src/features/expenditure/expenditureapproval.tsx#L2323-L2332) | 2323–2332 | `value: \`account::legacy::${row.headOfAccount}\``           |

**Why it exists:** Old expenditure requests may reference budget heads that no longer exist in the current fiscal year's approved proposals. The synthetic options prevent the dropdown from showing blank.

**On fresh deploy:** All expenditure requests reference approved budget proposals from the same fiscal year. The fallback synthetic options would never trigger.

**Cleanup:** Remove the fallback `legacy-head::`, `legacy-sub::`, and `account::legacy::` option construction. Return `null` instead and handle the "no matching option" case in the UI.

---

### 25. Client — `FALLBACK_TAG_OPTIONS` Hardcoded Constants

Two components define identical hardcoded tag option lists used when the API call to fetch dynamic tags fails:

| File                                                                                          | Line    | Constant                                      |
| --------------------------------------------------------------------------------------------- | ------- | --------------------------------------------- |
| [budget.tsx](../../client/src/features/budget/budget.tsx#L81)                                 | 81–95   | `FALLBACK_TAG_OPTIONS` (13 options)           |
| [expenditureapproval.tsx](../../client/src/features/expenditure/expenditureapproval.tsx#L410) | 410–424 | `FALLBACK_TAG_OPTIONS` (identical 13 options) |

**Why it exists:** If the `/budget-catalog/tags` API fails, the UI still needs to show tag options. On a fresh deploy with the catalog seeded, the API should always succeed.

**On fresh deploy:** The API endpoint always returns the tag list from `budget_catalog`. The fallback is never needed.

**Cleanup:** Remove the hardcoded constants. Show an error state or retry UI when the tag API fails instead of silently falling back to stale data.

---

### 26. Client — `FALLBACK_SUBCATEGORY_OPTIONS` Hardcoded Beneficiary Lists

The expenditure approval form has a hardcoded map of beneficiary sub-categories used when the master data API fails:

**File:** [expenditureapproval.tsx](../../client/src/features/expenditure/expenditureapproval.tsx#L383-L409) — Lines 383–409

```ts
const FALLBACK_SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Department: ['Computer Science and Engineering', ...],
  Centre: ['Centre for Research', ...],
  Cell: ['Placement Cell', ...],
  // ... hardcoded institution-specific names
};
```

**Why it exists:** If the master data API (`/master-data/entity-options`) fails, the form still renders with these hardcoded options. This list is institution-specific (KSR-CT specific names).

**On fresh deploy:** The master data tables are seeded and the API always returns current options. The hardcoded list would be wrong for a different institution anyway.

**Cleanup:** Remove `FALLBACK_SUBCATEGORY_OPTIONS`. Show an error state when the API fails. This constant is doubly problematic because it's institution-specific — deploying to a new client with different departments would show incorrect options.

---

### 27. Client — `FALLBACK_BENEFICIARY_OPTIONS` in Workflow Page

**File:** [WorkflowApprovalPage.tsx](../../client/src/shared/pages/workflow/WorkflowApprovalPage.tsx#L37-L47) — Lines 37–47

```ts
const FALLBACK_BENEFICIARY_OPTIONS = [
  'All Beneficiary',
  'Faculty',
  'Staff',
  'Department',
  'Centre',
  'Cell',
  'Club',
  'Professional Body',
  'Institution',
];
```

**Why it exists:** Used as a fallback filter list when the workflow meta API doesn't return beneficiary type options.

**On fresh deploy:** The workflow meta endpoint always returns available beneficiary types from master data.

**Cleanup:** Remove the constant. Source beneficiary options from the API response only.

---

### 28. Client — Legacy Annexure Field Fallback in Finance Approval

**File:** [financeapproval.tsx](../../client/src/features/finance/financeapproval.tsx#L2685-L2700) — Lines 2685–2700

```ts
const fallbackLegacyAnnexure =
  record.annexure_file_path && record.annexure_storage_name
    ? [{ annexure_type: record.annexure_type || '', ... }]
    : [];
const effectiveAnnexures = annexuresFromApi.length
  ? annexuresFromApi
  : fallbackLegacyAnnexure;
```

**Why it exists:** Old finance requests stored annexure info as flat columns (`annexure_file_path`, `annexure_storage_name`, `annexure_file_name`) directly on the request row. Modern requests use the `finance_request_annexures` array.

**On fresh deploy:** All annexures are stored in the `finance_request_annexures` table and returned as an array.

**Cleanup:** Remove the `fallbackLegacyAnnexure` construction. Use `annexuresFromApi` directly.

---

### 29. Client — `user.role` Singular Read in Workflow Page

**File:** [WorkflowApprovalPage.tsx](../../client/src/shared/pages/workflow/WorkflowApprovalPage.tsx#L204-L206) — Lines 204–206

```ts
if (user?.role) {
  roleTokens.push(extractRoleToken(user.role));
}
```

Inside `getNormalizedUserRoles()`, the code reads both `user.roles` (modern array) and `user.role` (legacy singular string) to extract role tokens.

**Why it exists:** Old JWT shapes had a singular `role` field. The server's `toRequestUser()` function (item 6) emits `role` as an alias.

**On fresh deploy:** The server only needs to emit `roles` (array). Once server item 6 is cleaned up, this read is dead.

**Cleanup:** Remove the `user.role` fallback after server-side item 6 is deployed.

---

### 30. ⚠️ KEEP — Client — `stageRoleFallback` in Finance Approval

**File:** [financeapproval.tsx](../../client/src/features/finance/financeapproval.tsx#L2523-L2529) — Lines 2523–2529

```ts
const stageRoleFallback: Record<string, string[]> = {
  dof: ['dof'],
  principal: ['principal'],
  chairman: ['chairman'],
};
const userRoles = normalizeFinanceRoleCodes(user);
return (stageRoleFallback[loadedCurrentStage] || []).some((r) => userRoles.includes(r));
```

**Why it exists:** If the user doesn't have explicit workflow stage permissions, falls back to checking if their role name matches the stage name.

**Verdict:** **KEEP.** This is a valid authorization fallback, not a legacy compat issue. Role-based stage matching is a reasonable approach when permission keys aren't configured.

---

## Recommended Cleanup Order

The items above have dependencies. Clean them up in this order to avoid breaking changes:

```
Phase 1 — Delete dead code (zero risk)
  └─ #8   authModel.js commented-out old version
  └─ #10  documentsController.js "legacy mode" catch blocks
  └─ #14  createExpenditureLegacy() function

Phase 2 — Remove text-matching fallbacks (data layer)
  └─ #11  budgetCatalogResolver.js — document that NULL IDs mean rejection
  └─ #12  budgetModel.js — reject unresolvable heads instead of storing NULL
  └─ #13  financeModel.js — remove text-based budget matching
  └─ #16  expenditureModel.js — remove legacy_totals subquery
  └─ #18  adminBudgetModel.js — simplify COALESCE display logic

Phase 3 — Remove old schema column fallbacks (data layer)
  └─ #15  deriveLegacyAnchorRequestIds() — use refs table only
  └─ #17  resolveCanonicalBeneficiaryOrg() — use beneficiary_org only
  └─ #28  financeapproval.tsx — remove fallbackLegacyAnnexure

Phase 4 — Remove RBAC fallbacks (auth layer, do together)
  └─ #1   Delete LEGACY_ADMIN_PERMISSION_KEYS constant
  └─ #2   Remove legacyIsAdmin / fallbackPermissions logic
  └─ #3   Delete syncLegacyAdminFlag() method + call sites
  └─ #4   Remove is_admin from all SELECT queries
  └─ #7   Remove || Boolean(user.is_admin) from authModel.js

Phase 5 — Standardize API field names (full-stack, do together)
  └─ #5   Simplify normalizeDecodedUser() and normalizeRequestUser()
  └─ #6   Remove backward-compat aliases from toRequestUser()
  └─ #9   Remove snake_case fallbacks from preEventController.js
  └─ #21  Update User type: is_admin → isAdmin, is_super_admin → isSuperAdmin
  └─ #22  Simplify all super admin dual-key checks
  └─ #23  Simplify quad-key admin/updatedByAdmin reads
  └─ #29  Remove user.role singular read

Phase 6 — Remove hardcoded client-side fallbacks
  └─ #24  Remove legacy-head:: / legacy-sub:: synthetic budget options
  └─ #25  Remove FALLBACK_TAG_OPTIONS constants
  └─ #26  Remove FALLBACK_SUBCATEGORY_OPTIONS constant
  └─ #27  Remove FALLBACK_BENEFICIARY_OPTIONS constant

Phase 7 (optional) — Schema cleanup
  └─ Drop users.is_admin column via migration
  └─ Drop expenditure flat columns (head, sub_head, amount, budget_line_id)
  └─ Drop finance_request_id direct FK on expenditure_requests
  └─ Drop flat annexure columns on finance_requests
```

---

## Database Columns to Drop (Phase 7)

After all code references are removed, these columns can be dropped via migration:

```sql
-- Legacy admin boolean (replaced by RBAC roles)
ALTER TABLE users DROP COLUMN is_admin;

-- Legacy flat expenditure columns (replaced by normalized row tables)
-- Only drop if createExpenditureLegacy and legacy_totals are removed first
ALTER TABLE expenditure_requests
  DROP COLUMN IF EXISTS head,
  DROP COLUMN IF EXISTS sub_head,
  DROP COLUMN IF EXISTS amount,
  DROP COLUMN IF EXISTS budget_line_id;

-- Legacy flat annexure columns (replaced by finance_request_annexures table)
ALTER TABLE finance_requests
  DROP COLUMN IF EXISTS annexure_file_path,
  DROP COLUMN IF EXISTS annexure_storage_name,
  DROP COLUMN IF EXISTS annexure_file_name,
  DROP COLUMN IF EXISTS annexure_mime_type,
  DROP COLUMN IF EXISTS annexure_file_size,
  DROP COLUMN IF EXISTS annexure_type;
```

> **⚠️ WARNING:** Do NOT run these column drops until all code in Phases 1–6
> has been cleaned up and deployed. Dropping a column while code still reads it
> will cause runtime errors.

---

## 31. Expenditure — Bulk NEFT → Bulk Transaction rename aliases

**Files:** `expenditureRoutes.js`, `expenditureController.js`, `expenditureModel.js`,
`expenditureapproval.tsx`

"Bulk NEFT" was renamed to "Bulk Transaction" (modes NEFT / RTGS / UPI / DD). The API
field names were renamed with the UI; these aliases keep an older deployed client working:

| Where                 | Legacy alias                              | Replacement                                                                                           |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Upload field (routes) | `bulk_neft_file`                          | `bulk_transaction_file`                                                                               |
| Template route        | `GET /templates/bulk-neft`                | `GET /templates/bulk-transaction`                                                                     |
| Payload keys          | `showbulkneft`, `bulknefttemplateversion` | `showbulktransaction`, `bulktransactiontype`, `bulktransactionbank`, `bulktransactiontemplateversion` |
| Response key          | `bulk_neft_file`                          | `bulk_transaction_file`                                                                               |
| Client load path      | `record.bulk_neft_file` fallback          | `record.bulk_transaction_file`                                                                        |

**When to remove:** once no deployed client posts the old field/payload names or reads the
old response key. Search for `LEGACY: pre-rename` to find every site.

**Not legacy (keep):** the DB table `expenditure_bulk_neft_files` and the column
`expenditure_requests.show_bulk_neft` were deliberately left un-renamed — only the API
and UI were renamed. A future rename would need a migration plus a data move.

**Also removed as part of this change:** the `chk_expenditure_bulk_neft_excel_name` CHECK
constraint, since DD uploads accept any file format (validated per transaction type in
`expenditureController.js` instead).
