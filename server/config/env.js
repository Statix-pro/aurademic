import path from 'path';

import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

console.log(`Loaded environment variables from ${envFile}`);

// Fail fast on a missing or weak JWT secret. A short/guessable secret lets an
// attacker forge tokens (including isSuperAdmin claims), so require adequate length.
const MIN_JWT_SECRET_LENGTH = 32;
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
  throw new Error(
    `JWT_SECRET is missing or too short. Set a strong secret of at least ${MIN_JWT_SECRET_LENGTH} characters.`,
  );
}
