/* ============================================================
   20260911_create_kpi_module.sql

   PURPOSE
     The KPI faculty-credit-points module: which institutional roles
     exist, what each is worth at the four institute/department levels,
     the responsibilities that justify the weighting, and which faculty
     member holds which role in which academic year.

   ------------------------------------------------------------
   THE NUMERIC MODEL, AND WHY IT IS SHAPED THIS WAY
   ------------------------------------------------------------
   The admin form (AssociatedRoles.tsx, AssociatedLevelCreditPoints)
   renders seven fields per level. Three are editable star controls —
   Priority, Frequency, Work Load. The other four — Level, Max, Score,
   Credit Point — are all readOnly.

   That is the whole specification. Because Max / Score / Credit Point
   are readOnly, none of them can be a per-role value an admin types.
   They are derived:

     Max          The credit ceiling for the LEVEL, not the role.
                  Institute-L1 is worth more than Department-L2
                  regardless of which role is being described, so it is
                  institution policy and lives once per level_type in
                  kpi_level_policies.

     Score        priority + frequency + work_load, so 0..15.
                  A stored generated column — there is no code path that
                  can change a rating and forget to recompute it.

     Credit Point ROUND(max_credit_point * score / 15).
                  The level's ceiling, scaled by how the role rated
                  against it. Computed in the views rather than stored,
                  because it draws on kpi_level_policies and a MySQL
                  generated column may only reference its own row. Not
                  storing it means it cannot drift at all.

   So the only inputs are the three ratings and the per-level policy
   ceiling. Everything else in the form is a projection of those.

   ------------------------------------------------------------
   THE SIX TABLES
   ------------------------------------------------------------
     kpi_level_policies          The four level tags: display label,
                                 credit ceiling, display order. Seeded
                                 below. Single source of the labels the
                                 client currently hardcodes.
     kpi_roles                   Prime roles (parent_role_id IS NULL) and
                                 their associated roles, one
                                 self-referencing catalog.
     kpi_role_credit_levels      One row per (role, level tag) holding
                                 that level's three ratings.
     kpi_level_responsibilities  The responsibility list under each
                                 credit-level block.
     kpi_role_assignments        Faculty member holds role at level for
                                 an academic year, with the credit point
                                 frozen at award time.
     kpi_change_audit            Append-only before/after log for the
                                 catalog and the ratings.

   ------------------------------------------------------------
   DECISIONS WORTH KNOWING
   ------------------------------------------------------------
   A prime role carries its OWN ratings, not a roll-up of its associated
   roles. Both admin pages render the identical credit-point card — the
   Primary Role page for the prime role, the Associated-Add page for the
   associated role — so both own credit levels. The Associated Roles
   table on the Primary Role page lists the children separately, which is
   where a roll-up would otherwise have been shown.

   One self-referencing catalog, not two tables. A prime role and an
   associated role carry identical columns and own the same children; the
   two listing queries differ only by `parent_role_id IS NULL` versus
   `= :id`.

   Ratings are 0-5, not 1-5. The star control clears back to zero when
   the current value is clicked, so 0 is a value the UI produces and must
   be storable. It means "not yet rated".

   Assignments snapshot their credit point. If a rating is retuned next
   year, last year's award must not silently change value. The award
   therefore stores awarded_credit_point together with the two numbers it
   was derived from, so any historical score can be explained without
   consulting the current catalog. This is what makes in-place editing of
   the catalog safe, and is why the catalog itself needs no effective
   dating.

   Roles are retired, not deleted. Hard-deleting a prime role would
   cascade away its associated roles, their credit levels and every
   responsibility with no trace, which §20 rule 5 forbids. The self-FK is
   ON DELETE RESTRICT and removal is `is_active = 0`, matching
   master_departments. The two genuinely-owned child tables keep CASCADE:
   a credit level has no meaning apart from its role.

   No relationship to the existing `roles` table. That one is RBAC
   (role_code / is_admin_role, joined through user_roles and
   role_permissions). A kpi_role is an institutional duty carrying a
   credit weighting. The `kpi_` prefix is the namespace; do not join them.

   ------------------------------------------------------------
   INVARIANTS THE SCHEMA CANNOT EXPRESS
   ------------------------------------------------------------
   A role's credit levels must agree with its is_institutional_level /
   is_department_level flags: a role with is_institutional_level = 0 must
   own no institute_l1/institute_l2 row. That spans two tables, so a
   MySQL CHECK cannot state it. The service must delete the orphaned
   credit levels when a flag is cleared — which is what the form's
   checkbox handler already does client-side.

   Depth is capped at two (prime -> associated). The self-FK permits
   deeper chains, and MySQL forbids AUTO_INCREMENT columns inside a
   CHECK, so neither the depth cap nor `parent_role_id <> id` can be a
   constraint. Both are enforced on insert.

   kpi_change_audit is written by the service, inside the same
   transaction as the change. Nothing in the schema can force that, so it
   is a code-review checkpoint rather than a guarantee.

   ------------------------------------------------------------
   SAFETY
   ------------------------------------------------------------
   Every table and view here is new. Nothing existing is altered or
   dropped, so there is no financial or historical data to reconcile.
   Idempotent and safe to re-run: tables are CREATE TABLE IF NOT EXISTS,
   views are CREATE OR REPLACE, and the policy seed is INSERT IGNORE so a
   re-run never overwrites a ceiling an admin has since tuned.
   ============================================================ */

/* ============================================================
   1. LEVEL POLICY
   ============================================================ */

/* Keyed by level_type rather than an id, because there are exactly four
   and every other table refers to them by name. `display_label` is the
   single source of the strings the client currently holds in a hardcoded
   array (associatedLevelOptions) — serve these instead, or the two
   drift the first time someone renames a level. */
CREATE TABLE IF NOT EXISTS kpi_level_policies (
  level_type ENUM('institute_l1','institute_l2','department_l1','department_l2') NOT NULL,
  display_label VARCHAR(60) NOT NULL COMMENT 'Label shown in the UI, e.g. "Institute - Level 1"',
  scope ENUM('institute','department') NOT NULL
    COMMENT 'Which of the two Level checkboxes unlocks this tag',
  max_credit_point INT NOT NULL
    COMMENT 'The readOnly "Max" field: credit ceiling for this level, institution policy',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (level_type),
  UNIQUE KEY uq_kpi_level_policies_label (display_label),
  CONSTRAINT fk_kpi_level_policies_updated_by
    FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_kpi_level_policies_max CHECK (max_credit_point > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* INSERT IGNORE, not ON DUPLICATE KEY UPDATE: re-running this migration
   must not reset a ceiling the institution has tuned since. The starting
   ceilings descend institute -> department and L1 -> L2; 50 for
   Institute-L1 matches the value the form was mocked with. */
INSERT IGNORE INTO kpi_level_policies
  (level_type, display_label, scope, max_credit_point, sort_order) VALUES
  ('institute_l1',  'Institute - Level 1',  'institute',  50, 1),
  ('institute_l2',  'Institute - Level 2',  'institute',  40, 2),
  ('department_l1', 'Department - Level 1', 'department', 30, 3),
  ('department_l2', 'Department - Level 2', 'department', 20, 4);

/* ============================================================
   2. THE ROLE CATALOG
   ============================================================ */

/* `parent_key` exists only so uq_kpi_roles_name can protect prime roles.
   MySQL treats NULLs in a unique index as distinct, so a plain
   UNIQUE (parent_role_id, role_name) would constrain associated roles and
   silently allow (NULL,'HOD') any number of times — i.e. it would leave
   the Faculty Credit Points list free to fill with duplicates. The stored
   generated column collapses NULL to 0 so one index covers both cases. */
CREATE TABLE IF NOT EXISTS kpi_roles (
  id INT NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(150) NOT NULL COMMENT 'The form "Role" field, e.g. "Head of Department"',
  parent_role_id INT DEFAULT NULL
    COMMENT 'NULL = prime role; otherwise the prime role this is associated with',
  parent_key INT GENERATED ALWAYS AS (COALESCE(parent_role_id, 0)) STORED NOT NULL
    COMMENT 'NULL-safe parent for uq_kpi_roles_name; see the note above this table',
  category ENUM('academic','non_academic') DEFAULT NULL
    COMMENT 'The Academic / Non-Academic toggle. Prime roles only — chk_kpi_roles_category_scope',
  is_institutional_level TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Institutional Level checkbox; unlocks the institute_* tags',
  is_department_level TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Department Level checkbox; unlocks the department_* tags',
  sort_order INT NOT NULL DEFAULT 0
    COMMENT 'Drives the S.No. column; ties are possible, so always ORDER BY sort_order, id',
  is_active TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Soft delete — weights are cited in appraisals, so rows are retired, not removed',
  created_by INT DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kpi_roles_name (parent_key, role_name),
  KEY idx_kpi_roles_parent (parent_role_id),
  KEY idx_kpi_roles_listing (is_active, parent_role_id, sort_order),
  CONSTRAINT fk_kpi_roles_parent
    FOREIGN KEY (parent_role_id) REFERENCES kpi_roles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_kpi_roles_created_by
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_kpi_roles_updated_by
    FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_kpi_roles_category_scope CHECK (
    (parent_role_id IS NULL     AND category IS NOT NULL) OR
    (parent_role_id IS NOT NULL AND category IS NULL)
  ),
  CONSTRAINT chk_kpi_roles_has_level CHECK (
    is_institutional_level = 1 OR is_department_level = 1
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   3. THE PER-LEVEL RATINGS
   ============================================================ */

/* Only the three ratings are stored. `score` is generated so it cannot
   drift from them; Max and Credit Point are not here at all — they come
   from kpi_level_policies and the views. See THE NUMERIC MODEL above. */
CREATE TABLE IF NOT EXISTS kpi_role_credit_levels (
  id INT NOT NULL AUTO_INCREMENT,
  role_id INT NOT NULL,
  level_type ENUM('institute_l1','institute_l2','department_l1','department_l2') NOT NULL,
  priority TINYINT NOT NULL DEFAULT 0
    COMMENT 'Importance relative to the other levels, 0-5 (0 = unrated)',
  frequency TINYINT NOT NULL DEFAULT 0
    COMMENT 'How often the responsibilities recur, 0-5 (0 = unrated)',
  work_load TINYINT NOT NULL DEFAULT 0
    COMMENT 'Expected effort and time, 0-5 (0 = unrated)',
  score TINYINT GENERATED ALWAYS AS (priority + frequency + work_load) STORED
    COMMENT 'The readOnly "Score" field: rating total 0-15. Generated, so it cannot drift',
  created_by INT DEFAULT NULL,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kpi_credit_levels_role_level (role_id, level_type),
  KEY idx_kpi_credit_levels_level (level_type),
  CONSTRAINT fk_kpi_credit_levels_role
    FOREIGN KEY (role_id) REFERENCES kpi_roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_kpi_credit_levels_policy
    FOREIGN KEY (level_type) REFERENCES kpi_level_policies (level_type) ON DELETE RESTRICT,
  CONSTRAINT fk_kpi_credit_levels_created_by
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_kpi_credit_levels_updated_by
    FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_kpi_credit_levels_ratings CHECK (
    priority  BETWEEN 0 AND 5 AND
    frequency BETWEEN 0 AND 5 AND
    work_load BETWEEN 0 AND 5
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   4. RESPONSIBILITIES
   ============================================================ */

/* Hangs off the credit level, not the role: the same duty carries
   different expectations at institute and department level, and the form
   renders one list per level block. VARCHAR(500) rather than TEXT so the
   bound exists at the storage layer as well as in the API. */
CREATE TABLE IF NOT EXISTS kpi_level_responsibilities (
  id INT NOT NULL AUTO_INCREMENT,
  role_credit_level_id INT NOT NULL,
  responsibility_text VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
    COMMENT 'Display order; ties are possible, so always ORDER BY sort_order, id',
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kpi_responsibilities_level (role_credit_level_id, sort_order),
  CONSTRAINT fk_kpi_responsibilities_credit_level
    FOREIGN KEY (role_credit_level_id) REFERENCES kpi_role_credit_levels (id) ON DELETE CASCADE,
  CONSTRAINT fk_kpi_responsibilities_created_by
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   5. FACULTY ASSIGNMENTS
   ============================================================ */

/* What makes the module answer "what are Dr. X's credit points for
   2026-2027". The three awarded_* columns are a snapshot taken at award
   time, not a cache: retuning a rating next year must not silently
   restate last year's award, and an appraisal figure has to be
   explainable years later without the current catalog.

   awarded_credit_point is therefore authoritative for anything
   historical. The views below are for configuring the catalog; they are
   not the source for a past award.

   FKs are RESTRICT in both directions — neither a role nor a user may be
   hard-deleted out from under an award. */
CREATE TABLE IF NOT EXISTS kpi_role_assignments (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'The faculty member holding the role',
  kpi_role_id INT NOT NULL,
  level_type ENUM('institute_l1','institute_l2','department_l1','department_l2') NOT NULL,
  academic_year VARCHAR(9) NOT NULL COMMENT 'YYYY-YYYY, e.g. 2026-2027',
  awarded_credit_point INT NOT NULL
    COMMENT 'Frozen at award time. Authoritative for historical scores',
  awarded_score TINYINT NOT NULL
    COMMENT 'The rating total the award was computed from, for explainability',
  awarded_max_credit_point INT NOT NULL
    COMMENT 'The level ceiling the award was computed from, for explainability',
  awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  awarded_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kpi_assignments_award (user_id, kpi_role_id, level_type, academic_year),
  KEY idx_kpi_assignments_user_year (user_id, academic_year),
  KEY idx_kpi_assignments_role (kpi_role_id, academic_year),
  CONSTRAINT fk_kpi_assignments_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_kpi_assignments_role
    FOREIGN KEY (kpi_role_id) REFERENCES kpi_roles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_kpi_assignments_policy
    FOREIGN KEY (level_type) REFERENCES kpi_level_policies (level_type) ON DELETE RESTRICT,
  CONSTRAINT fk_kpi_assignments_awarded_by
    FOREIGN KEY (awarded_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_kpi_assignments_year CHECK (
    REGEXP_LIKE(academic_year, '^[0-9]{4}-[0-9]{4}$')
  ),
  CONSTRAINT chk_kpi_assignments_award_range CHECK (
    awarded_credit_point >= 0 AND
    awarded_max_credit_point > 0 AND
    awarded_credit_point <= awarded_max_credit_point AND
    awarded_score BETWEEN 0 AND 15
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   6. THE AUDIT LOG
   ============================================================ */

/* Append-only. before_row is NULL on an insert, after_row is NULL on a
   delete. One table for both entity types, keyed by entity_type +
   entity_id, with no FK back to the audited row — the trail has to
   outlive what it describes. */
CREATE TABLE IF NOT EXISTS kpi_change_audit (
  id BIGINT NOT NULL AUTO_INCREMENT,
  entity_type ENUM('role','credit_level','level_policy') NOT NULL,
  entity_id INT NOT NULL COMMENT 'Not an FK: the trail outlives the row it describes',
  role_id INT DEFAULT NULL COMMENT 'Denormalised so a role history reads without joins',
  action ENUM('insert','update','delete') NOT NULL,
  before_row JSON DEFAULT NULL COMMENT 'Previous column values; NULL on insert',
  after_row JSON DEFAULT NULL COMMENT 'New column values; NULL on delete',
  changed_by INT DEFAULT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kpi_audit_entity (entity_type, entity_id, changed_at),
  KEY idx_kpi_audit_role (role_id, changed_at),
  CONSTRAINT fk_kpi_audit_changed_by
    FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   7. THE FORM VIEW
   ============================================================ */

/* One row per credit-point card in the admin form, with all seven fields
   the card renders. `credit_point` is computed here rather than stored,
   so it can never disagree with the ratings or the policy ceiling.

   The 15 is the rating ceiling: three dimensions capped at 5 by
   chk_kpi_credit_levels_ratings. A migration that adds a fourth
   dimension must update this divisor and the CHECK together. */
CREATE OR REPLACE VIEW v_kpi_role_credit_levels AS
SELECT
  c.id                AS credit_level_id,
  c.role_id,
  r.role_name,
  r.parent_role_id,
  c.level_type,
  p.display_label     AS level_label,
  c.priority,
  c.frequency,
  c.work_load,
  c.score,
  p.max_credit_point  AS max_credit_point,
  ROUND(p.max_credit_point * c.score / 15) AS credit_point
FROM kpi_role_credit_levels c
JOIN kpi_roles r          ON r.id = c.role_id
JOIN kpi_level_policies p ON p.level_type = c.level_type;

/* ============================================================
   8. THE LISTING PIVOT
   ============================================================ */

/* Both listing tables read this; they differ only in the predicate.

     Faculty Credit Points page  ->  WHERE parent_role_id IS NULL
     Associated Roles table      ->  WHERE parent_role_id = :prime_role_id

   Each row shows that role's own four credit points — see DECISIONS
   above on why a prime role is not a roll-up of its children.

   MAX(CASE ...) is lossless only because uq_kpi_credit_levels_role_level
   guarantees at most one row per (role, level_type). If that unique key
   is ever dropped, this view starts silently hiding rows.

   is_active is filtered here so retired roles leave both listings without
   every caller having to remember the predicate. */
CREATE OR REPLACE VIEW v_kpi_role_credit_summary AS
SELECT
  r.id AS role_id,
  r.role_name,
  r.parent_role_id,
  r.category,
  r.sort_order,
  MAX(CASE WHEN v.level_type = 'institute_l1'  THEN v.credit_point END) AS i_l1,
  MAX(CASE WHEN v.level_type = 'institute_l2'  THEN v.credit_point END) AS i_l2,
  MAX(CASE WHEN v.level_type = 'department_l1' THEN v.credit_point END) AS d_l1,
  MAX(CASE WHEN v.level_type = 'department_l2' THEN v.credit_point END) AS d_l2
FROM kpi_roles r
LEFT JOIN v_kpi_role_credit_levels v ON v.role_id = r.id
WHERE r.is_active = 1
GROUP BY r.id, r.role_name, r.parent_role_id, r.category, r.sort_order;

/* ============================================================
   ROLLBACK (keep commented — use only if this migration must be undone)
   ============================================================
   DROP VIEW  IF EXISTS v_kpi_role_credit_summary;
   DROP VIEW  IF EXISTS v_kpi_role_credit_levels;
   DROP TABLE IF EXISTS kpi_change_audit;
   DROP TABLE IF EXISTS kpi_role_assignments;
   DROP TABLE IF EXISTS kpi_level_responsibilities;
   DROP TABLE IF EXISTS kpi_role_credit_levels;
   DROP TABLE IF EXISTS kpi_roles;
   DROP TABLE IF EXISTS kpi_level_policies;
   ============================================================ */
