import app from './app';
import { env } from './config/env';
import { db } from './config/db';
import { logger } from './config/logger';

const server = app.listen(env.PORT, () => {
  logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await db.$disconnect();
      logger.info('Database connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during database disconnection.');
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds if graceful close hangs
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, 'Unhandled Rejection detected');
});

process.on('uncaughtException', (error: Error) => {
  logger.error({ error }, 'Uncaught Exception detected');
  process.exit(1);
});

