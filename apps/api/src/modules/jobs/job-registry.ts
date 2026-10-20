export interface JobContext {
  jobId: string;
  attempt: number;
  enqueuedAt: string;
}

export interface JobHandler {
  readonly type: string;
  handle(payload: Record<string, unknown>, context: JobContext): Promise<void>;
}

/**
 * ثبت‌کننده پردازش‌گرهای کار.
 * ماژول‌های کسب‌وکاری در onModuleInit پردازش‌گر خود را اینجا ثبت می‌کنند
 * تا وابستگی حلقوی بین ماژول‌ها ایجاد نشود.
 */
export class JobRegistry {
  private handlers = new Map<string, JobHandler>();

  register(handler: JobHandler): void {
    this.handlers.set(handler.type, handler);
  }

  get(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }

  types(): string[] {
    return [...this.handlers.keys()];
  }
}
