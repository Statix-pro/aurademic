#!/usr/bin/env node

/* ============================================================
   Cross-Tenant Migration Runner
   ============================================================
   Executes SQL migration files from server/schema/migrations/
   across all tenant databases, tracking which migrations have
   been applied via a `_migrations` table in each database.

   USAGE:
     node server/scripts/run-migrations.js

   CONFIGURATION:
     Set TENANT_DATABASES in your .env file as a comma-separated
     list of database names:
       TENANT_DATABASES=aurademic_ksrct,aurademic_othercolg

     If TENANT_DATABASES is not set, the script runs migrations
     only on the default DB_NAME database.

   HOW IT WORKS:
     1. Reads all .sql files in server/schema/migrations/ (sorted).
     2. For each tenant database:
        a. Creates a _migrations tracking table if it doesn't exist.
        b. Checks which migrations have already been applied.
        c. Executes any pending migrations in order.
        d. Records each successful migration in _migrations.
   ============================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'schema', 'migrations');

/**
 * Parse the list of tenant databases from the environment.
 * Falls back to the single DB_NAME if TENANT_DATABASES is not set.
 */
function getTenantDatabases() {
  const raw = process.env.TENANT_DATABASES;
  if (raw) {
    return raw
      .split(',')
      .map((db) => db.trim())
      .filter(Boolean);
  }
  return [process.env.DB_NAME || 'research'];
}

/**
 * Get all .sql migration files sorted alphabetically (by timestamp prefix).
 * Excludes template files (starting with _).
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn(`[migrations] Migrations directory not found: ${MIGRATIONS_DIR}`);
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
    .sort();
}

/**
 * Ensure the _migrations tracking table exists in the given database.
 */
async function ensureMigrationsTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT NOT NULL AUTO_INCREMENT,
      filename VARCHAR(500) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * Get the set of migration filenames already applied in this database.
 */
async function getAppliedMigrations(conn) {
  const [rows] = await conn.execute('SELECT filename FROM _migrations ORDER BY filename');
  return new Set(rows.map((r) => r.filename));
}

/**
 * Run a single migration file against the connection.
 * Splits the file on semicolons and executes each statement.
 */
async function runMigrationFile(conn, filePath, filename) {
  const sql = fs.readFileSync(filePath, 'utf-8').trim();
  if (!sql) {
    console.log(`  [skip] ${filename} (empty file)`);
    return;
  }

  // Split on semicolons, filter empty statements
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await conn.execute(statement);
  }

  // Record the migration as applied
  await conn.execute('INSERT INTO _migrations (filename) VALUES (?)', [filename]);
}

/**
 * Run all pending migrations for a single tenant database.
 */
async function migrateDatabase(dbName) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    multipleStatements: true,
  });

  try {
    console.log(`\n📦 Database: ${dbName}`);

    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    const allFiles = getMigrationFiles();

    const pending = allFiles.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('  ✅ All migrations already applied.');
      return;
    }

    console.log(`  ⏳ ${pending.length} pending migration(s)...`);

    for (const filename of pending) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      try {
        await runMigrationFile(conn, filePath, filename);
        console.log(`  ✅ ${filename}`);
      } catch (err) {
        console.error(`  ❌ ${filename} — FAILED:`, err.message);
        console.error('  Stopping migrations for this database.');
        return; // Stop on first failure for this tenant
      }
    }

    console.log(`  🎉 All migrations applied successfully.`);
  } finally {
    await conn.end();
  }
}

/**
 * Main entry point. Runs migrations across all tenant databases.
 */
async function main() {
  const databases = getTenantDatabases();

  console.log('═══════════════════════════════════════════');
  console.log('  Cross-Tenant Migration Runner');
  console.log('═══════════════════════════════════════════');
  console.log(`Environment: ${envFile}`);
  console.log(`Tenant databases: ${databases.join(', ')}`);
  console.log(`Migrations directory: ${MIGRATIONS_DIR}`);

  const allFiles = getMigrationFiles();
  console.log(`Total migration files found: ${allFiles.length}`);

  for (const dbName of databases) {
    await migrateDatabase(dbName);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Migration run complete.');
  console.log('═══════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
