import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(serverRoot, envFile);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`Environment file not found: ${envPath}`);
} else {
  console.log(`Loaded environment variables from ${envPath}`);
}
