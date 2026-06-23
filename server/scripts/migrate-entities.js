/**
 * Academic Entity Migration Script
 *
 * Consolidates data for Cells, Centres, Clubs, and Professional Bodies
 * from CSV into master_entities and master_entity_contacts tables.
 *
 * Usage:
 *   cd server
 *   node scripts/migrate-entities.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// Setup paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================================

// Load environment variables (fallback to .env.production if it exists)
const envFile = fs.existsSync(path.join(__dirname, '..', '.env.production'))
  ? '.env.production'
  : '.env.development';
const envPath = path.join(__dirname, '..', envFile);
console.log(`📁 Loading env from: ${envPath}`);
dotenv.config({ path: envPath });

// Define production DB config overrides if needed
const PROD_DB_CONFIG = {};

// Create database pool (Prioritizes PROD_DB_CONFIG if values are provided)
const pool = mysql.createPool({
  host: PROD_DB_CONFIG.host || process.env.DB_HOST,
  user: PROD_DB_CONFIG.user || process.env.DB_USER,
  password: PROD_DB_CONFIG.password || process.env.DB_PASSWORD,
  database: PROD_DB_CONFIG.database || process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function migrateEntities() {
  console.log('🚀 Starting Academic Entity Migration...\n');
  console.log(`🔌 Target DB: ${PROD_DB_CONFIG.host || process.env.DB_HOST || 'localhost'}`);

  const csvPath = path.join(__dirname, '..', 'schema', 'scripts', 'data', 'merged_entities.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📄 Found ${records.length} records in CSV\n`);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get Entity Types
    const [types] = await connection.execute('SELECT id, code FROM master_entity_types');
    const typeMap = types.reduce((acc, t) => {
      acc[t.code] = t.id;
      return acc;
    }, {});

    console.log(`📋 Found ${types.length} entity types in DB`);

    let updated = 0;
    let created = 0;
    let contactsCreated = 0;

    for (const record of records) {
      const { Type, Name, Acronym, Email } = record;
      const typeId = typeMap[Type];

      if (!typeId) {
        console.warn(`  ⚠️ Unknown entity type: ${Type} for ${Name}`);
        continue;
      }

      // 2. Upsert master_entities (using Name as match key)
      const [existing] = await connection.execute(
        'SELECT id FROM master_entities WHERE name = ? AND entity_type_id = ?',
        [Name, typeId],
      );

      let entityId;
      if (existing.length > 0) {
        entityId = existing[0].id;
        await connection.execute(
          'UPDATE master_entities SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [Acronym || null, entityId],
        );
        updated++;
      } else {
        const [result] = await connection.execute(
          'INSERT INTO master_entities (entity_type_id, name, code) VALUES (?, ?, ?)',
          [typeId, Name, Acronym || null],
        );
        entityId = result.insertId;
        created++;
      }

      // 3. Update master_entity_contacts
      if (Email && Email.trim() !== '') {
        await connection.execute('DELETE FROM master_entity_contacts WHERE entity_id = ?', [
          entityId,
        ]);

        const emails = Email.split(',')
          .map((e) => e.trim())
          .filter((e) => e !== '');
        for (const [index, email] of emails.entries()) {
          await connection.execute(
            'INSERT INTO master_entity_contacts (entity_id, role, email, is_primary) VALUES (?, ?, ?, ?)',
            [entityId, 'office', email, index === 0 ? 1 : 0],
          );
          contactsCreated++;
        }
      }
    }

    await connection.commit();

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Entities Created: ${created}`);
    console.log(`   ✅ Entities Updated: ${updated}`);
    console.log(`   📧 Contacts Created: ${contactsCreated}`);
    console.log(`   📁 Total Processed: ${records.length}`);
  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Migration Failed!');
    console.error(error);
  } finally {
    connection.release();
    await pool.end();
  }

  console.log('\n✅ Migration completed!');
}

migrateEntities().catch(console.error);
