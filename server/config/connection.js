import mysql from 'mysql2/promise';

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // MySQL DATE columns represent calendar dates, not instants. Returning them
  // as Date objects makes UTC conversion shift the displayed day by timezone.
  dateStrings: ['DATE'],
  waitForConnections: true,
  connectionLimit: 10,
});

export default db;
