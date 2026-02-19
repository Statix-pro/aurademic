import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${stack || message}`;
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    return log;
});

// Base formats applied to all transports
const baseFormats = combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
);

// Console transport (always active)
const consoleTransport = new winston.transports.Console({
    format: combine(colorize(), baseFormats),
});

// File transports (production only)
const logsDir = path.join(process.cwd(), 'logs');

const fileTransports = [
    new DailyRotateFile({
        filename: path.join(logsDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: baseFormats,
    }),
    new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        format: baseFormats,
    }),
];

// Create the logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'http' : 'debug',
    transports: [
        consoleTransport,
        ...(process.env.NODE_ENV === 'production' ? fileTransports : []),
    ],
    // Catch uncaught exceptions and unhandled rejections
    exceptionHandlers: process.env.NODE_ENV === 'production'
        ? [new DailyRotateFile({
            filename: path.join(logsDir, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            format: baseFormats,
        })]
        : [],
    rejectionHandlers: process.env.NODE_ENV === 'production'
        ? [new DailyRotateFile({
            filename: path.join(logsDir, 'rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            format: baseFormats,
        })]
        : [],
});

// Morgan stream for HTTP request logging
export const morganStream = {
    write: (message) => logger.http(message.trim()),
};

export default logger;
