const fs = require('fs');
const readline = require('readline');
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'dev',
    password: 'M@heshwaran325',
    database: 'research',
    port: 3306
  });

  console.log('Connected to MySQL.');

  // Fetch all departments to map name to id
  const [rows] = await connection.query('SELECT id, name FROM master_departments');
  const deptMap = {};
  for (const row of rows) {
    deptMap[row.name.trim()] = row.id;
  }

  const fileStream = fs.createReadStream('/Users/mahesh/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/72E5B349-58FF-4559-A0C4-F161B40CC58E/KSRCT Research Profile IDs.csv');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isFirstLine = true;
  let updatedCount = 0;
  let notFoundDeptCount = 0;

  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }

    if (!line.trim()) continue;

    const parts = line.split(',');

    // Sometimes there are embedded commas if quotes are used, but checking the sample, there are no quotes.
    const erpIdStr = parts[10];
    const parentDeptStr = parts[13];

    if (!erpIdStr || !parentDeptStr) continue;

    const erpId = erpIdStr.trim();
    const parentDeptName = parentDeptStr.trim();

    if (!erpId || !parentDeptName) continue;

    const parentDeptId = deptMap[parentDeptName];

    if (parentDeptId) {
      // Update employee
      const [result] = await connection.query('UPDATE master_employees SET parent_department_id = ? WHERE erp_id = ?', [parentDeptId, erpId]);
      if (result.affectedRows > 0) {
        updatedCount++;
      } else {
        console.log(`Failed to update, ERP ID maybe not found in DB: ${erpId}`);
      }
    } else {
      console.log(`Department not found for parent_dept: "${parentDeptName}" on ERP ID: ${erpId}`);
      notFoundDeptCount++;
    }
  }

  console.log(`Updated ${updatedCount} employees.`);
  if (notFoundDeptCount > 0) {
    console.log(`Failed to find department for ${notFoundDeptCount} employees.`);
  }

  await connection.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
