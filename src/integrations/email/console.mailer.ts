import { Mailer, SendMailOptions, SendMailResult } from './Mailer';
import { logger } from '../../config/logger';

export class ConsoleMailer implements Mailer {
  public sentMails: SendMailOptions[] = [];
  public shouldFail: boolean = false;

  async send(options: SendMailOptions): Promise<SendMailResult> {
    if (this.shouldFail) {
      throw new Error('Simulated mail delivery failure');
    }

    this.sentMails.push(options);
    const messageId = `console-${Date.now()}-${this.sentMails.length}`;

    logger.info(
      {
        to: options.to,
        subject: options.subject,
        messageId,
      },
      '[ConsoleMailer] Email simulated delivery'
    );

    return { messageId };
  }

  clear(): void {
    this.sentMails = [];
    this.shouldFail = false;
  }
}

