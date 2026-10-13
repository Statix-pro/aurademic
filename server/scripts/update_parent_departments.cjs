const fs = require('fs');
const path = require('path');

const { parse } = require('csv-parse/sync');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const DEFAULT_CSV_PATH = path.join(
  __dirname,
  '..',
  'schema',
  'migrations',
  'Employee Database 2026-02-21 162053 Sheet1 (1).csv',
);

function normalize(value) {
  return (value || '').toString().trim();
}

function normalizeCode(value) {
  return normalize(value).toUpperCase();
}

function normalizeName(value) {
  return normalize(value).toLowerCase();
}

function getFirstValue(row, keys) {
  for (const key of keys) {
    const value = normalize(row[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

function resolveDepartmentId(rawValue, deptByCode, deptByName, aliases) {
  if (!rawValue) {
    return null;
  }

  const code = normalizeCode(rawValue);
  const name = normalizeName(rawValue);
  const aliasCode = aliases[code];

  return (
    deptByCode.get(code) ||
    (aliasCode ? deptByCode.get(aliasCode) : null) ||
    deptByName.get(name) ||
    null
  );
}

async function main() {
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CSV_PATH;
  const isDryRun = process.argv.includes('--dry-run');

  dotenv.config({ path: path.join(__dirname, '..', '.env.development') });

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const csvRaw = fs.readFileSync(csvPath, 'utf8');
  const records = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dev',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'research',
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    const [deptRows] = await connection.query('SELECT id, code, name FROM master_departments');
    const deptByCode = new Map();
    const deptByName = new Map();

    for (const row of deptRows) {
      if (row.code) {
        deptByCode.set(normalizeCode(row.code), row.id);
      }
      if (row.name) {
        deptByName.set(normalizeName(row.name), row.id);
      }
    }

    const aliases = {
      MATHS: 'MAT',
      MATHEMATICS: 'MAT',
    };

    const stats = {
      totalRows: records.length,
      updated: 0,
      unchanged: 0,
      missingEmployee: 0,
      missingParentDepartment: 0,
      unresolvedParentDepartment: 0,
      missingIdentifier: 0,
    };

    const unresolvedValues = new Map();

    for (const row of records) {
      const erpId = getFirstValue(row, ['Prime ERP Code', 'ERP ID']);
      const email = getFirstValue(row, ['Official EMail ID', 'Email']).toLowerCase();
      const parentDepartmentRaw = getFirstValue(row, [
        'Parent Department',
        'Parent Dept.',
        'Parent Dept',
      ]);

      if (!erpId && !email) {
        stats.missingIdentifier += 1;
        continue;
      }

      if (!parentDepartmentRaw) {
        stats.missingParentDepartment += 1;
        continue;
      }

      const parentDepartmentId = resolveDepartmentId(
        parentDepartmentRaw,
        deptByCode,
        deptByName,
        aliases,
      );

      if (!parentDepartmentId) {
        stats.unresolvedParentDepartment += 1;
        unresolvedValues.set(
          parentDepartmentRaw,
          (unresolvedValues.get(parentDepartmentRaw) || 0) + 1,
        );
        continue;
      }

      const whereClause = erpId ? 'erp_id = ?' : 'LOWER(email) = ?';
      const whereValue = erpId || email;

      const [employeeRows] = await connection.query(
        `SELECT id, parent_department_id FROM master_employees WHERE ${whereClause} LIMIT 1`,
        [whereValue],
      );

      if (!employeeRows.length) {
        stats.missingEmployee += 1;
        continue;
      }

      const employee = employeeRows[0];
      if (employee.parent_department_id === parentDepartmentId) {
        stats.unchanged += 1;
        continue;
      }

      if (!isDryRun) {
        await connection.query(
          'UPDATE master_employees SET parent_department_id = ? WHERE id = ?',
          [parentDepartmentId, employee.id],
        );
      }

      stats.updated += 1;
    }

    const unresolvedSummary = Array.from(unresolvedValues.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    console.log(`CSV: ${csvPath}`);
    console.log(`Mode: ${isDryRun ? 'dry-run' : 'apply'}`);
    console.log(JSON.stringify({ ...stats, unresolvedValues: unresolvedSummary }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
