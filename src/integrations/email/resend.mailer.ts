import { Resend } from 'resend';
import { Mailer, SendMailOptions, SendMailResult } from './Mailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class ResendMailer implements Mailer {
  private resend: Resend;
  private from: string;

  constructor(apiKey: string = env.EMAIL_API_KEY || '', from: string = env.EMAIL_FROM) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    const result = await this.resend.emails.send({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (result.error) {
      logger.error({ error: result.error, to: options.to }, 'Resend email send error');
      throw new Error(`Resend mail failed: ${result.error.message}`);
    }

    return { messageId: result.data?.id };
  }
}

