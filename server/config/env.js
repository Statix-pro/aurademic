import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(serverRoot, envFile);
const result = dotenv.config({ path: envPath });

if (result.error) {
  if (result.error.code === 'ENOENT') {
    console.warn(`Environment file not found: ${envPath}`);
  } else {
    console.error(`Failed to load environment variables from ${envPath}`, result.error);
  }
} else {
  console.log(`Loaded environment variables from ${envPath}`);
}
