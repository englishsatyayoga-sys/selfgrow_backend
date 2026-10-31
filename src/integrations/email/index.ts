import { Mailer } from './Mailer';
import { ConsoleMailer } from './console.mailer';
import { ResendMailer } from './resend.mailer';
import { SmtpMailer } from './smtp.mailer';
import { env } from '../../config/env';

export * from './Mailer';
export * from './console.mailer';
export * from './resend.mailer';
export * from './smtp.mailer';

export const defaultConsoleMailer = new ConsoleMailer();

export const defaultMailer: Mailer = (() => {
  if (env.NODE_ENV === 'test' || env.EMAIL_PROVIDER === 'console') {
    return defaultConsoleMailer;
  }
  if (env.EMAIL_PROVIDER === 'resend') {
    return new ResendMailer();
  }
  if (env.EMAIL_PROVIDER === 'smtp') {
    return new SmtpMailer();
  }
  return defaultConsoleMailer;
})();

