import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';

/**
 * Environment files are tried in order and the first one that exists wins.
 *
 * A plain `.env` is checked first, and that order is deliberate. The production
 * box keeps everything in one `.env` with `NODE_ENV=production` set *inside*
 * it, so NODE_ENV is still undefined while this runs and the environment-
 * specific branch below evaluates to `.env.development`. Were that consulted
 * first, deploying a copy of this tree that happened to carry a developer's
 * `.env.development` would silently point production at a localhost database.
 * Checking `.env` first means the box's own single-file config always wins.
 */
const candidates = [
  '.env',
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
];

const envFile = candidates.find((file) => fs.existsSync(path.resolve(process.cwd(), file)));

if (envFile) {
  dotenv.config({ path: path.resolve(process.cwd(), envFile) });
  console.log(`Loaded environment variables from ${envFile}`);
} else {
  console.warn(
    `No environment file found (looked for ${candidates.join(', ')} in ${process.cwd()}). ` +
      'Relying on variables already present in the process environment.',
  );
}
