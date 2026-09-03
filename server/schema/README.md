# Database Schema Guide

This guide explains how to manage database schemas for the Aurademic Research Portal.

## 📁 Directory Structure

```
schema/
├── README.md              # This file
├── structure.sql          # Schema only, no rows (use this for setup)
├── developer_seed.sql     # Minimal rows to log in and click around
├── dump/                  # Untracked. A real dump, if someone hands you one
├── migrations/            # Incremental schema changes
│   └── YYYYMMDD_description.sql
└── legacy/                # Old individual schema files (reference only)
```

---

## 🚀 Quick Setup (For New Developers)

```bash
# 1. Create the database
mysql -u root -p -e "CREATE DATABASE research;"

# 2. Load the schema
mysql -u root -p research < schema/structure.sql

# 3. Apply every migration dated after structure.sql was regenerated, in date order
mysql -u root -p research < schema/migrations/YYYYMMDD_description.sql

# 4. Seed enough data to log in
mysql -u root -p research < schema/developer_seed.sql
```

✅ Done! You have the schema and enough rows to work with.

`structure.sql` is `mysqldump --no-data`, so it carries no rows. That is
deliberate: the full dump it replaced held 555 real staff email addresses and
the institution's financial history, in a public repository. **Never commit a
dump with rows in it.** If you need production-like data, ask for a dump
directly and restore it locally — `schema/dump/` is gitignored for that.

---

## 🔔 Notification retention

The notification tables (`notification_events`, `notifications`,
`notification_deliveries`) grow with every approval in the system and nothing
prunes them automatically.

```bash
npm run purge:notifications -- --dry-run    # report only
npm run purge:notifications                 # 90 / 180 day defaults
npm run purge:notifications -- --read-days=30 --event-days=90
```

Read notifications past the window are **archived, not deleted** — they leave the
bell but stay readable for audit. Unread notifications are never touched however
old they are. Finished outbox events past the longer window are deleted, and
their notification rows go with them by `ON DELETE CASCADE`.

Schedule this (Task Scheduler on the IIS box, or cron) rather than running it by
hand.

---

## 🔄 Making Schema Changes

### Adding a Column / Modifying Tables

1. **Create a migration file:**

   ```bash
   touch schema/migrations/20251219_add_status_to_journals.sql
   ```

2. **Write the migration:**

   ```sql
   -- schema/migrations/20251219_add_status_to_journals.sql
   -- Author: Your Name
   -- Date: 2025-12-19
   -- Description: Add review_status column to journals table

   ALTER TABLE `journals`
   ADD COLUMN `review_status` VARCHAR(50) DEFAULT 'pending' AFTER `status`;
   ```

3. **Test locally:**

   ```bash
   mysql -u root -p research < schema/migrations/20251219_add_status_to_journals.sql
   ```

4. **Commit & push:**

   ```bash
   git add schema/migrations/20251219_add_status_to_journals.sql
   git commit -m "Add review_status column to journals"
   git push
   ```

5. **Run on production** (after code review)

---

### Creating New Tables

Same process - create a migration file:

```sql
-- schema/migrations/20251220_create_notifications.sql
-- Author: Your Name
-- Date: 2025-12-20

CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `message` TEXT NOT NULL,
    `is_read` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
```

---

## 💾 Updating the Dump

After making schema changes, **update the dump** so future developers get the latest version:

```bash
# Schema only — no rows, safe to commit
mysqldump -u root -p --no-data --skip-comments research > schema/structure.sql

git add schema/structure.sql
git commit -m "Regenerate schema structure"
```

Check the diff before committing. If `git diff` shows an `INSERT INTO`, the
`--no-data` flag was missed and real rows are about to be published.

---

## 📝 Migration Naming Convention

```
YYYYMMDD_short_description.sql
```

**Examples:**

- `20251219_add_status_to_journals.sql`
- `20251220_create_notifications_table.sql`
- `20251221_add_index_on_user_email.sql`

---

## ⚠️ Important Rules

1. **Never run ALTER TABLE directly on production** - Always create a migration file first
2. **Test locally** before pushing
3. **Keep migrations small** - One change per file is easier to debug
4. **Update the dump** after significant changes

---

## 📂 Legacy Folder

The `legacy/` folder contains the original individual schema files for reference:

- `01_auth.sql` - Users & authentication tables
- `02_journals.sql` - Journal tables
- `03_projects.sql` - Project tables
- `04_events.sql` - Event tables

These are kept for documentation purposes. **Use the dump for actual setup.**

---

## 🔧 Useful Commands

```bash
# Connect to MySQL
mysql -u root -p research

# Show all tables
SHOW TABLES;

# Describe a table
DESCRIBE table_name;

# Show table creation SQL
SHOW CREATE TABLE table_name;
```
