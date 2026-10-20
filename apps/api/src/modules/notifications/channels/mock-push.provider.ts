import { Logger } from '@nestjs/common';
import type { PushProvider, PushSendInput, PushSendResult } from './push-provider.interface';

/**
 * فراهم‌کننده آزمایشی اعلان فشاری.
 * اعلانی واقعاً ارسال نمی‌شود؛ فقط ثبت می‌شود (simulated=true) تا هرگز با Push واقعی اشتباه نشود.
 */
export class MockPushProvider implements PushProvider {
  readonly name = 'mock';
  readonly isLive = false;
  private readonly logger = new Logger('PUSH(mock)');

  async send(input: PushSendInput): Promise<PushSendResult> {
    this.logger.warn(`[آزمایشی] اعلان فشاری به ${input.tokens.length} دستگاه: ${input.title} — ${input.body.slice(0, 120)}`);
    return {
      provider: this.name,
      deliveredTokens: [],
      status: 'simulated',
      simulated: true,
      error: null,
    };
  }
}
