import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
const eventDb = mysql.createPool({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: 'event_management',
});
export default eventDb;
