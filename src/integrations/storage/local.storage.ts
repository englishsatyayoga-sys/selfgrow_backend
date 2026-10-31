import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { StorageService } from './Storage';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class LocalStorageDriver implements StorageService {
  private baseDir: string;
  private secret: string;

  constructor(baseDir?: string, secret: string = env.JWT_ACCESS_SECRET) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'uploads');
    this.secret = secret;
  }

  private resolveKeyPath(key: string): string {
    // Prevent directory traversal attacks
    const safeKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.baseDir, safeKey);
  }

  async put(key: string, body: Buffer, _contentType?: string): Promise<void> {
    const fullPath = this.resolveKeyPath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body);
    logger.debug({ key, path: fullPath, size: body.length }, 'Saved file to local storage');
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = `${key}:${expires}`;
    const signature = crypto.createHmac('sha256', this.secret).update(payload).digest('hex');

    const baseUrl = env.APP_PUBLIC_URL.replace(/\/$/, '');
    return `${baseUrl}/api/v1/storage/download?key=${encodeURIComponent(key)}&expires=${expires}&signature=${signature}`;
  }

  verifySignature(key: string, expiresStr: string, signature: string): boolean {
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || Math.floor(Date.now() / 1000) > expires) {
      return false;
    }

    const payload = `${key}:${expires}`;
    const expected = crypto.createHmac('sha256', this.secret).update(payload).digest('hex');

    if (expected.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveKeyPath(key);
    try {
      await fs.unlink(fullPath);
      logger.debug({ key }, 'Deleted file from local storage');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    const fullPath = this.resolveKeyPath(key);
    return fs.readFile(fullPath);
  }
}

