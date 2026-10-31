import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './Storage';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class S3StorageDriver implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      credentials:
        env.S3_ACCESS_KEY && env.S3_SECRET_KEY
          ? {
              accessKeyId: env.S3_ACCESS_KEY,
              secretAccessKey: env.S3_SECRET_KEY,
            }
          : undefined,
      forcePathStyle: !!env.S3_ENDPOINT, // Required for MinIO or local S3 emulators
    });
  }

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/pdf',
    });

    await this.client.send(command);
    logger.debug({ key, bucket: this.bucket }, 'Uploaded object to S3');
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
    logger.debug({ key, bucket: this.bucket }, 'Deleted object from S3');
  }

  async getBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`S3 object ${key} has empty body`);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }
}

