import { StorageService } from './Storage';
import { LocalStorageDriver } from './local.storage';
import { S3StorageDriver } from './s3.storage';
import { env } from '../../config/env';

export * from './Storage';
export * from './local.storage';
export * from './s3.storage';

export const defaultStorageService: StorageService =
  env.STORAGE_DRIVER === 's3' ? new S3StorageDriver() : new LocalStorageDriver();

