import pino from 'pino';

const base = { level: process.env.LOG_LEVEL || 'info' } as pino.LoggerOptions;

export const logger = pino(
  process.env.LOG_PRETTY === 'true'
    ? {
        ...base,
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
            translateTime: 'HH:MM:ss',
          },
        },
      }
    : base
);
