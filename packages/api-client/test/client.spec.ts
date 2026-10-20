import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, MemoryTokenStore, createApiClient } from '../src';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('کلاینت API — هسته HTTP', () => {
  it('پاسخ موفق را برمی‌گرداند و هدر Authorization را از TokenStore می‌گیرد', async () => {
    const tokens = new MemoryTokenStore();
    tokens.setAccess('abc-123');
    const fetchImpl = vi.fn(async () => jsonResponse(200, { items: [], meta: { page: 1 } }));
    const api = createApiClient({ baseUrl: 'http://api.test/api/v1', tokens, fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await api.catalog.search({ q: 'لنت' });
    expect(result.items).toEqual([]);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc-123');
    expect(init.credentials).toBe('include');
  });

  it('خطای API را به ApiClientError با پیام فارسی تبدیل می‌کند', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'invalid',
        faMessage: 'مقادیر ارسالی معتبر نیست.',
        errors: [{ field: 'mobile', message: 'شماره موبایل معتبر نیست.' }],
        requestId: 'req-1',
      }),
    );
    const api = createApiClient({ baseUrl: 'http://api.test/api/v1', tokens: new MemoryTokenStore(), fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(api.auth.login('bad', 'x')).rejects.toSatisfy((error: unknown) => {
      expect(ApiClientError.is(error)).toBe(true);
      const err = error as ApiClientError;
      expect(err.status).toBe(400);
      expect(err.code).toBe('VALIDATION_FAILED');
      expect(err.userMessage).toBe('شماره موبایل معتبر نیست.');
      expect(err.requestId).toBe('req-1');
      return true;
    });
  });

  it('خطای شبکه را با کد NETWORK_ERROR و قابلیت تلاش مجدد نشان می‌دهد', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const api = createApiClient({ baseUrl: 'http://api.test/api/v1', tokens: new MemoryTokenStore(), fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(api.settings.public()).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
  });

  it('در پاسخ ۴۰۱ یک‌بار نشست را تمدید و درخواست را تکرار می‌کند', async () => {
    const tokens = new MemoryTokenStore();
    tokens.setAccess('expired');
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      calls += 1;
      if (url.includes('/auth/refresh')) return jsonResponse(200, { user: {}, accessToken: 'fresh' });
      if (calls === 1) return jsonResponse(401, { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'expired', faMessage: 'منقضی', timestamp: '' });
      return jsonResponse(200, { items: [], meta: { page: 1 } });
    });
    const api = createApiClient({ baseUrl: 'http://api.test/api/v1', tokens, fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await api.orders.list();
    expect(result.items).toEqual([]);
    expect(tokens.getAccess()).toBe('fresh');
  });

  it('چند درخواست ۴۰۱ هم‌زمان فقط یک بار تمدید نشست می‌کنند (single-flight)', async () => {
    const tokens = new MemoryTokenStore();
    tokens.setAccess('expired');
    let refreshCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse(200, { user: {}, accessToken: 'fresh' });
      }
      if (tokens.getAccess() !== 'fresh') {
        return jsonResponse(401, { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'expired', faMessage: 'منقضی', timestamp: '' });
      }
      return jsonResponse(200, { items: [], meta: { page: 1 } });
    });
    const api = createApiClient({ baseUrl: 'http://api.test/api/v1', tokens, fetchImpl: fetchImpl as unknown as typeof fetch });

    await Promise.all([api.orders.list(), api.notifications.list(), api.delivery.list()]);
    expect(refreshCalls).toBe(1);
  });

  it('پس از شکست تمدید، onSessionExpired اجرا می‌شود', async () => {
    const onSessionExpired = vi.fn();
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/auth/refresh')) return jsonResponse(401, { statusCode: 401, code: 'TOKEN_INVALID', message: 'x', faMessage: 'x', timestamp: '' });
      return jsonResponse(401, { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'x', faMessage: 'x', timestamp: '' });
    });
    const api = createApiClient({
      baseUrl: 'http://api.test/api/v1',
      tokens: new MemoryTokenStore(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onSessionExpired,
    });

    await expect(api.orders.list()).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('درخواست ناشناس هدر Authorization نمی‌فرستد', async () => {
    const tokens = new MemoryTokenStore();
    tokens.setAccess('should-not-be-sent');
    const fetchImpl = vi.fn(async () => jsonResponse(200, { sent: true, expiresIn: 120, simulated: true }));
    const api = createApiClient({ baseUrl: 'http://api.test/api/v1', tokens, fetchImpl: fetchImpl as unknown as typeof fetch });

    await api.auth.requestOtp('09121110001');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('کلید Idempotency در هدر درخواست‌های حساس ارسال می‌شود', async () => {
    const tokens = new MemoryTokenStore();
    tokens.setAccess('t');
    const fetchImpl = vi.fn(async () => jsonResponse(201, { id: 'order-1', code: 'ORD-1', items: [], allowedActions: [], breakdown: [] }));
    const api = createApiClient({ baseUrl: 'http://api.test/api/v1', tokens, fetchImpl: fetchImpl as unknown as typeof fetch });

    await api.orders.create({ items: [{ sellerProductId: 'p1', quantity: 2 }] }, 'idem-9');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('idem-9');
  });
});
