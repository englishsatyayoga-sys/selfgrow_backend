import { PrismaClient } from '@prisma/client';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const db = global.prisma || new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (env.NODE_ENV !== 'production') {
  global.prisma = db;
}

let dbOnline = false;
export const isDbOnline = () => dbOnline;

// Non-blocking connectivity probe
(async () => {
  try {
    const probe = db.$queryRaw`SELECT 1`;
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)
    );
    await Promise.race([probe, timeout]);
    dbOnline = true;
  } catch {
    dbOnline = false;
  }
})();
