# Database Schema Guide

This guide explains how to manage database schemas for the Aurademic Research Portal.

## 📁 Directory Structure

```
schema/
├── README.md              # This file
├── dump/                  # Full database backups (use this for setup)
│   └── dump-research-YYYYMMDD.sql
├── migrations/            # Incremental schema changes
│   └── YYYYMMDD_description.sql
└── legacy/                # Old individual schema files (reference only)
```

---

## 🚀 Quick Setup (For New Developers)

```bash
# 1. Create the database
mysql -u root -p -e "CREATE DATABASE research;"

# 2. Load the latest dump
mysql -u root -p research < schema/dump/dump-research-YYYYMMDD.sql

# 3. Run any newer migrations (check dates after the dump)
# For each migration file newer than the dump:
mysql -u root -p research < schema/migrations/YYYYMMDD_description.sql
```

✅ Done! You have a complete copy of the database.

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
# Create new dump with today's date
mysqldump -u root -p research > schema/dump/dump-research-$(date +%Y%m%d).sql

# Commit it
git add schema/dump/dump-research-*.sql
git commit -m "Updated database dump"
git push
```

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
