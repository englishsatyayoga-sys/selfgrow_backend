import PgBoss from 'pg-boss';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface EnqueueOptions {
  key?: string;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
}

export interface Job<T = any> {
  id: string;
  data: T;
}

export type JobHandler<T = any> = (job: Job<T>) => Promise<any>;

export interface JobQueue {
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueue(queueName: string, data: any, options?: EnqueueOptions): Promise<string | null>;
  process(queueName: string, handler: JobHandler): Promise<void>;
}

export class InMemoryJobQueue implements JobQueue {
  private handlers = new Map<string, JobHandler>();
  private processedKeys = new Set<string>();

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async enqueue(queueName: string, data: any, options?: EnqueueOptions): Promise<string | null> {
    const key = options?.key;
    if (key && this.processedKeys.has(`${queueName}_${key}`)) {
      return null;
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const handler = this.handlers.get(queueName);

    if (handler) {
      // Execute asynchronously
      setImmediate(async () => {
        try {
          await handler({ id: jobId, data });
          if (key) {
            this.processedKeys.add(`${queueName}_${key}`);
          }
        } catch (err) {
          logger.error({ err, queueName, jobId }, 'InMemoryQueue handler error');
        }
      });
    }

    return jobId;
  }

  async process(queueName: string, handler: JobHandler): Promise<void> {
    this.handlers.set(queueName, handler);
  }

  clear(): void {
    this.processedKeys.clear();
  }
}

export class PgBossJobQueue implements JobQueue {
  private boss: PgBoss;
  private isStarted = false;

  constructor(connectionString: string = env.DATABASE_URL) {
    this.boss = new PgBoss({
      connectionString,
      schema: 'pgboss',
      max: 10,
    });

    this.boss.on('error', (error) => {
      logger.error({ error }, 'pg-boss queue encountered an error');
    });
  }

  async start(): Promise<void> {
    if (!this.isStarted) {
      await this.boss.start();
      this.isStarted = true;
      logger.info('pg-boss queue engine started');
    }
  }

  async stop(): Promise<void> {
    if (this.isStarted) {
      await this.boss.stop();
      this.isStarted = false;
      logger.info('pg-boss queue engine stopped');
    }
  }

  async enqueue(queueName: string, data: any, options?: EnqueueOptions): Promise<string | null> {
    await this.start();

    const sendOptions: any = {};
    if (options?.key) {
      sendOptions.singletonKey = options.key;
    }
    if (options?.retryLimit !== undefined) {
      sendOptions.retryLimit = options.retryLimit;
    }
    if (options?.retryDelay !== undefined) {
      sendOptions.retryDelay = options.retryDelay;
    }
    if (options?.retryBackoff !== undefined) {
      sendOptions.retryBackoff = options.retryBackoff;
    }

    return this.boss.send(queueName, data, sendOptions);
  }

  async process(queueName: string, handler: JobHandler): Promise<void> {
    await this.start();

    await this.boss.work(queueName, async (jobs) => {
      const jobList = Array.isArray(jobs) ? jobs : [jobs];
      for (const job of jobList) {
        await handler({
          id: job.id,
          data: job.data,
        });
      }
    });
  }
}

export const defaultJobQueue: JobQueue =
  env.NODE_ENV === 'test' ? new InMemoryJobQueue() : new PgBossJobQueue();
