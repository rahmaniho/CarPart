import { Logger } from '@nestjs/common';
import type { PushProvider, PushSendInput, PushSendResult } from './push-provider.interface';

/**
 * فراهم‌کننده FCM (Firebase Cloud Messaging) — legacy HTTP API.
 *
 * صادقانه: بدون `FCM_SERVER_KEY` هیچ ادعایی برای ارسال واقعی ندارد و نتیجه
 * «simulated» برمی‌گرداند (مثل فراهم‌کننده پیامک آزمایشی). برای انتشار نسخه
 * واقعی، کلید سرور FCM را از Firebase Console در متغیر محیطی قرار دهید
 * (یا پیاده‌سازی را به HTTP v1 با service account ارتقا دهید).
 */
export class FcmPushProvider implements PushProvider {
  readonly name = 'fcm';
  private readonly logger = new Logger('PUSH(fcm)');
  private lastError: string | null = null;

  constructor(private readonly serverKey: () => string) {}

  get isLive(): boolean {
    return Boolean(this.serverKey());
  }

  async send(input: PushSendInput): Promise<PushSendResult> {
    const key = this.serverKey();
    if (!key) {
      this.logger.warn('FCM پیکربندی نشده (FCM_SERVER_KEY خالی است)؛ اعلان به‌صورت آزمایشی ثبت می‌شود.');
      return { provider: this.name, deliveredTokens: [], status: 'simulated', simulated: true, error: null };
    }

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registration_ids: input.tokens,
        notification: { title: input.title, body: input.body, click_action: input.link ?? undefined },
        data: input.data ?? undefined,
      }),
    });

    if (!response.ok) {
      this.lastError = `FCM HTTP ${response.status}`;
      return { provider: this.name, deliveredTokens: [], status: 'failed', simulated: false, error: this.lastError };
    }
    const body = (await response.json()) as { success?: number; failure?: number; results?: Array<{ error?: string }> };
    const delivered = input.tokens.filter((_token, index) => !body.results?.[index]?.error);
    return {
      provider: this.name,
      deliveredTokens: delivered,
      status: delivered.length ? 'sent' : 'failed',
      simulated: false,
      error: delivered.length ? null : (body.results?.find((r) => r.error)?.error ?? 'ارسال FCM ناموفق بود.'),
    };
  }
}
