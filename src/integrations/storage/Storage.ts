export interface StorageService {
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  getBuffer(key: string): Promise<Buffer>;
}

