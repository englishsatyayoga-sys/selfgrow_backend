import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { env } from '../../config/env';
import {
  AiClient,
  GenerateStructuredParams,
  StructuredOutputResult,
  AiClientError,
} from './AiClient';
import { logger } from '../../config/logger';

export class OpenAiClient implements AiClient {
  private client: OpenAI;

  constructor(apiKey: string = env.OPENAI_API_KEY) {
    this.client = new OpenAI({
      apiKey,
      timeout: env.AI_TIMEOUT_MS,
    });
  }

  async generateStructured<T>(params: GenerateStructuredParams<T>): Promise<StructuredOutputResult<T>> {
    const model = params.model || env.OPENAI_MODEL;
    const schemaName = params.schemaName || 'StructuredReportOutput';

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        response_format: zodResponseFormat(params.schema as any, schemaName),
        temperature: 0.3,
      });

      const message = response.choices[0]?.message;
      if (!message || message.refusal) {
        throw new AiClientError(
          message?.refusal || 'Model refused to generate response',
          false
        );
      }

      if (!message.content) {
        throw new AiClientError('Model returned empty response content', true);
      }

      let parsedData: T;
      try {
        const rawJson = JSON.parse(message.content);
        parsedData = params.schema.parse(rawJson);
      } catch (parseErr: any) {
        throw new AiClientError(`Structured output parsing failed: ${parseErr.message}`, true);
      }

      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;

      return {
        data: parsedData,
        usage: {
          promptTokens,
          completionTokens,
        },
      };
    } catch (error: any) {
      if (error instanceof AiClientError) {
        throw error;
      }

      const status = error.status || error.statusCode;
      // 400 (bad schema/prompt) and 401 (invalid key) are non-retryable
      // 429 (rate limit), 500/502/503/504 (server error), timeout, network errors are retryable
      const isRetryable =
        status === 429 ||
        status >= 500 ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.name === 'APIConnectionTimeoutError' ||
        error.name === 'APIConnectionError';

      logger.error(
        { error: error.message, status, isRetryable, model },
        'OpenAI generation error encountered'
      );

      throw new AiClientError(
        error.message || 'OpenAI generation failed',
        isRetryable,
        status
      );
    }
  }
}

export const defaultAiClient: AiClient = new OpenAiClient();
