import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobRegistry } from '../jobs/job-registry';
import { QuotesService } from './quotes.service';
import { RequestsService } from './requests.service';

/** پردازش‌گرهای صف کار برای مهلت درخواست‌ها و پیشنهادها. */
@Injectable()
export class RequestJobHandlers implements OnModuleInit {
  constructor(
    private readonly requests: RequestsService,
    private readonly quotes: QuotesService,
    private readonly registry: JobRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      type: 'request.expire',
      handle: async () => {
        await this.requests.expireDue();
      },
    });
    this.registry.register({
      type: 'quote.expire',
      handle: async () => {
        await this.quotes.expireQuotes();
      },
    });
  }
}
