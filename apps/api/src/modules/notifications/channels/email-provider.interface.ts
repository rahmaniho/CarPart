import type { ProviderHealth } from './sms-provider.interface';

export interface EmailSendInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  provider: string;
  messageId: string | null;
  status: 'sent' | 'simulated' | 'failed';
  simulated: boolean;
  error?: string | null;
}

export interface EmailProvider {
  readonly name: string;
  readonly isLive: boolean;
  send(input: EmailSendInput): Promise<EmailSendResult>;
  health(): ProviderHealth;
}
