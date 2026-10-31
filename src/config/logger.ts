import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      '*.password',
      '*.passwordHash',
      'token',
      'tokenHash',
      'refreshToken',
      'accessToken',
      '*.refreshToken',
      '*.accessToken',
      'cookie',
      'cookies',
      'headers.cookie',
      'headers.authorization',
      'req.headers.cookie',
      'req.headers.authorization',
      'cardNumber',
      'cvv',
      'pan',
      'aadhaar',
      'secret',
      '*.secret',
      'key',
      '*.key',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

