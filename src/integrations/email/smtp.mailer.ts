import nodemailer, { Transporter } from 'nodemailer';
import { Mailer, SendMailOptions, SendMailResult } from './Mailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class SmtpMailer implements Mailer {
  private transporter: Transporter;
  private from: string;

  constructor(from: string = env.EMAIL_FROM) {
    this.from = from;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      return { messageId: info.messageId };
    } catch (err: any) {
      logger.error({ error: err.message, to: options.to }, 'SMTP mail delivery error');
      throw err;
    }
  }
}

