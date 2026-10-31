import { defaultJobQueue } from './queue/jobQueue';
import './modules/reports/reports.service';
import { db } from './config/db';
import { logger } from './config/logger';

async function startWorker() {
  logger.info('Starting standalone AI Report Worker process...');

  // Ensure queue processor is initialized
  await defaultJobQueue.start();
  logger.info('Worker listening for report.generate jobs');

  const shutdown = async (signal: string) => {
    logger.info(`Worker received ${signal}. Gracefully stopping...`);
    try {
      await defaultJobQueue.stop();
      await db.$disconnect();
      logger.info('Worker stopped cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during worker shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorker().catch((err) => {
  logger.error({ err }, 'Worker fatal startup error');
  process.exit(1);
});
