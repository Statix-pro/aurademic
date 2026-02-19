import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Use console.log here intentionally — logger depends on env being loaded first
console.log(`[env] Loaded environment variables from ${envFile}`);
