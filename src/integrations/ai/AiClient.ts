import { z } from 'zod';

export interface GenerateStructuredParams<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName?: string;
  model?: string;
}

export interface StructuredOutputResult<T> {
  data: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export class AiClientError extends Error {
  public readonly isRetryable: boolean;
  public readonly status?: number;

  constructor(message: string, isRetryable: boolean = true, status?: number) {
    super(message);
    this.name = 'AiClientError';
    this.isRetryable = isRetryable;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface AiClient {
  generateStructured<T>(params: GenerateStructuredParams<T>): Promise<StructuredOutputResult<T>>;
}

