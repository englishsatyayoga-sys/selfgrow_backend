export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  messageId?: string;
}

export interface Mailer {
  send(options: SendMailOptions): Promise<SendMailResult>;
}

