import fs from 'fs';
import path from 'path';

import pino from 'pino';

import { getRequestContext } from './requestContext.js';

const LOG_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const isProduction = process.env.NODE_ENV === 'production';

// pino-roll handles daily file rotation and automatic cleanup of old log files.
// This works cross-platform (Windows IIS included) — no logrotate/cron needed.
const rollOptions = (filename, level) => ({
  target: 'pino-roll',
  level,
  options: {
    file: path.join(LOG_DIR, filename),
    // Rotate daily. pino-roll appends a date suffix (e.g. app.log.2026-07-04).
    frequency: 'daily',
    // Keep 7 days of rotated logs then auto-delete.
    limit: { count: 7 },
    mkdir: true,
  },
});

const targets = [rollOptions('app.log', 'info'), rollOptions('error.log', 'error')];

if (!isProduction) {
  targets.push({
    target: 'pino-pretty',
    level: 'debug',
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
  });
} else {
  // Keep stdout logging in production too (useful under IIS/pm2 log capture).
  targets.push({ target: 'pino/file', level: 'info', options: { destination: 1 } });
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    // Attach the current request id/user to every log line automatically.
    mixin() {
      const ctx = getRequestContext();
      if (!ctx) return {};
      return {
        requestId: ctx.requestId,
        userId: ctx.req?.user?.id || undefined,
      };
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
    redact: {
      paths: ['req.headers.authorization', '*.password', '*.token'],
      censor: '[redacted]',
    },
  },
  pino.transport({ targets }),
);

export default logger;
