/**
 * Employee Data Import Script
 *
 * This script imports employee data from CSV into the master_employees table.
 *
 * Usage:
 *   cd server
 *   node scripts/import-employees.js /path/to/employees.csv
 *
 * Requirements:
 *   - Run the migration scripts first to create master_departments and master_employees tables
 *   - CSV file with the expected format
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

// Load environment variables FIRST
const envPath = path.join(__dirname, '..', '.env.production');
console.log(`📁 Loading env from: ${envPath}`);
dotenv.config({ path: envPath });

// Create database pool directly here (instead of importing connection.js)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

console.log(`🔌 Connecting to DB: ${process.env.DB_HOST} as ${process.env.DB_USER}`);

// Status mapping from CSV to database ENUM
const STATUS_MAP = {
  Active: 'Active',
  'Long Leave': 'On Leave',
  'Medical Leave': 'On Leave',
  Relieved: 'Relieved',
  Retired: 'Retired',
  Resigned: 'Resigned',
  Terminated: 'Relieved',
  Deputation: 'Deputation',
};

// Department name normalization
const DEPT_NAME_MAP = {
  'Artificial Intelligence & Data Science': 'Artificial Intelligence & Data Science',
  'CSE (Artificial Intelligence and Machine Learning)':
    'CSE (Artificial Intelligence and Machine Learning)',
  Biotechnology: 'Biotechnology',
  'Civil Engineering': 'Civil Engineering',
  'Computer Science and Engineering': 'Computer Science and Engineering',
  'Computer Science and Business Systems': 'Computer Science and Business Systems',
  'Electronics and Communication Engineering': 'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering': 'Electrical and Electronics Engineering',
  'Food Technology': 'Food Technology',
  'Information Technology': 'Information Technology',
  'Mechatronics Engineering': 'Mechatronics Engineering',
  'Mechanical Engineering': 'Mechanical Engineering',
  'Textile Technology': 'Textile Technology',
  'Electronics Engineering (VLSI Design & Technology)':
    'Electronics Engineering (VLSI Design & Technology)',
  'Nano Science and Technology': 'Nano Science and Technology',
  'Master of Business Administration': 'Master of Business Administration',
  'Master of Computer Application': 'Master of Computer Application',
  // Parent departments (Science & Humanities)
  Physics: 'Physics',
  Chemistry: 'Chemistry',
  Mathematics: 'Mathematics',
  English: 'English',
};

/**
 * Parse date from DD.MM.YYYY format
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Get department ID by name
 */
async function getDepartmentId(connection, deptName) {
  if (!deptName || deptName.trim() === '') return null;

  // Try exact match first
  const [rows] = await connection.execute(
    'SELECT id FROM master_departments WHERE name = ? LIMIT 1',
    [deptName.trim()],
  );

  if (rows.length > 0) return rows[0].id;

  // Try partial match
  const [partialRows] = await connection.execute(
    'SELECT id FROM master_departments WHERE name LIKE ? LIMIT 1',
    [`%${deptName.split(' ')[0]}%`],
  );

  if (partialRows.length > 0) return partialRows[0].id;

  console.warn(`  ⚠️ Department not found: ${deptName}`);
  return null;
}

/**
 * Import a single employee record
 */
async function importEmployee(connection, row, deptCache) {
  const deptName = row['Dept.'] || row['Dept'];

  // Get or cache department ID
  if (!deptCache[deptName]) {
    deptCache[deptName] = await getDepartmentId(connection, deptName);
  }
  const departmentId = deptCache[deptName];

  const employee = {
    erp_id: row['ERP ID']?.trim() || null,
    title: row['Title']?.trim() || null,
    first_name: row['First Name']?.trim() || '',
    last_name: row['Last Name']?.trim() || '',
    designation: row['Designation']?.trim() || null,
    mobile: row['Mobile']?.trim() || null,
    gender: row['Gender']?.trim() || null,
    dob: parseDate(row['DoB']),
    doj: parseDate(row['DoJ']),
    dor: parseDate(row['DoR']),
    status: STATUS_MAP[row['Status']?.trim()] || 'Active',
    email: row['Email']?.trim() || null,
    department_id: departmentId,
    orcid_id: row['ORCID_ID']?.trim() || null,
    wos_researcher_id: row['WoS Researcher_ID']?.trim() || null,
    scopus_id: row['Scopus_ID']?.trim() || null,
    google_scholar_id: row['Google_Scholar_ID']?.trim() || null,
  };

  // Skip if no ERP ID or Email
  if (!employee.erp_id && !employee.email) {
    console.warn(
      `  ⚠️ Skipping row - no ERP ID or Email: ${employee.first_name} ${employee.last_name}`,
    );
    return null;
  }

  const sql = `
    INSERT INTO master_employees (
      erp_id, title, first_name, last_name, designation, mobile, gender,
      dob, doj, dor, status, email, department_id,
      orcid_id, wos_researcher_id, scopus_id, google_scholar_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      first_name = VALUES(first_name),
      last_name = VALUES(last_name),
      designation = VALUES(designation),
      mobile = VALUES(mobile),
      department_id = VALUES(department_id),
      orcid_id = VALUES(orcid_id),
      wos_researcher_id = VALUES(wos_researcher_id),
      scopus_id = VALUES(scopus_id),
      google_scholar_id = VALUES(google_scholar_id),
      updated_at = CURRENT_TIMESTAMP
  `;

  const values = [
    employee.erp_id,
    employee.title,
    employee.first_name,
    employee.last_name,
    employee.designation,
    employee.mobile,
    employee.gender,
    employee.dob,
    employee.doj,
    employee.dor,
    employee.status,
    employee.email,
    employee.department_id,
    employee.orcid_id,
    employee.wos_researcher_id,
    employee.scopus_id,
    employee.google_scholar_id,
  ];

  await connection.execute(sql, values);
  return employee;
}

/**
 * Main import function
 */
async function importEmployees(csvPath) {
  console.log('🚀 Starting Employee Import...\n');

  // Read CSV file
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

  // Get database connection
  const connection = await pool.getConnection();

  try {
    const deptCache = {};
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const [index, row] of records.entries()) {
      try {
        const result = await importEmployee(connection, row, deptCache);
        if (result) {
          imported++;
          if (imported % 50 === 0) {
            console.log(`  ✅ Imported ${imported} employees...`);
          }
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        console.error(`  ❌ Error on row ${index + 2}: ${error.message}`);
        console.error(`     Data: ${row['ERP ID']} - ${row['First Name']} ${row['Last Name']}`);
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️ Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📁 Total: ${records.length}`);

    // Verify import
    const [countResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM master_employees',
    );
    console.log(`\n🔍 Total employees in database: ${countResult[0].count}`);
  } finally {
    connection.release();
    await pool.end();
  }

  console.log('\n✅ Import completed!');
}

// Run the import
const csvPath =
  process.argv[2] ||
  '/Users/mahesh/Downloads/Chrome/KSRCT Research Profile IDs (1).xlsx - Database.csv';
importEmployees(csvPath).catch(console.error);
