import pino from 'pino';
import { env } from './env';

// Safely detect if pino-pretty is resolvable
let isPrettyAvailable = false;
try {
  require.resolve('pino-pretty');
  isPrettyAvailable = true;
} catch {
  isPrettyAvailable = false;
}

// Disable pino-pretty in cloud/container environments (Render, production) to avoid transport errors
const isCloudOrProduction =
  env.NODE_ENV === 'production' ||
  process.env.NODE_ENV === 'production' ||
  process.env.RENDER === 'true' ||
  process.env.CONTAINER === 'true';

const usePrettyTransport = !isCloudOrProduction && isPrettyAvailable && env.NODE_ENV === 'development';

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
  transport: usePrettyTransport
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

