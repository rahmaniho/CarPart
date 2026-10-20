import { ApiClientError } from './errors';
import type { TokenStore } from './tokens';

export interface HttpOptions {
  /** نشانی پایه API، مثل `http://localhost:4000/api/v1` */
  baseUrl: string;
  tokens: TokenStore;
  fetchImpl?: typeof fetch;
  /** وقتی رفرش نشست شکست خورد (کاربر باید دوباره وارد شود) */
  onSessionExpired?: () => void;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  /** بدون هدر Authorization (مثل ورود/ثبت‌نام) */
  anonymous?: boolean;
  signal?: AbortSignal;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * هسته HTTP کلاینت.
 *
 * - همه پاسخ‌های خطای API به `ApiClientError` با پیام فارسی تبدیل می‌شوند.
 * - در پاسخ ۴۰۱، یک‌بار تلاش برای تمدید نشست (کوکی httpOnly) انجام می‌شود و درخواست تکرار می‌شود؛
 *   چند درخواست هم‌زمان پشت یک «تمدید تک‌مرحله‌ای» (single-flight) صف می‌شوند.
 * - همه درخواست‌ها `credentials: 'include'` هستند تا کوکی نشست بین هاست‌های هم‌سایت ارسال شود.
 */
export class Http {
  readonly baseUrl: string;
  private readonly tokens: TokenStore;
  private readonly fetchImpl: typeof fetch;
  private readonly onSessionExpired?: () => void;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(options: HttpOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.tokens = options.tokens;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.onSessionExpired = options.onSessionExpired;
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  async request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
    const first = await this.send<T>(method, path, options);
    if (first.status !== 401 || options.anonymous) {
      return this.unwrap<T>(first);
    }
    // نشست منقضی شده؛ یک‌بار تمدید و درخواست را تکرار می‌کنیم
    const refreshed = await this.refreshSession();
    if (!refreshed) {
      this.onSessionExpired?.();
      return this.unwrap<T>(first);
    }
    const retry = await this.send<T>(method, path, options);
    return this.unwrap<T>(retry);
  }

  /** تمدید نشست از طریق کوکی httpOnly — چند فراخوانی هم‌زمان یک تمدید مشترک می‌گیرند. */
  refreshSession(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          const res = await this.send<AuthSessionLike>('POST', '/auth/refresh', { anonymous: true, body: {} });
          if (res.status !== 200) return false;
          const body = res.body as AuthSessionLike;
          if (body?.accessToken) this.tokens.setAccess(body.accessToken);
          return true;
        } catch {
          return false;
        } finally {
          // آزادسازی بعد از اتمام همه مصرف‌کننده‌ها
          queueMicrotask(() => {
            this.refreshPromise = null;
          });
        }
      })();
    }
    return this.refreshPromise;
  }

  private async send<T>(method: Method, path: string, options: RequestOptions): Promise<RawResponse> {
    const url = new URL(this.baseUrl + path, typeof location === 'undefined' ? 'http://local' : location.href);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    const access = this.tokens.getAccess();
    if (access && !options.anonymous) headers.Authorization = `Bearer ${access}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers,
        credentials: 'include',
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal ?? null,
      });
    } catch (cause) {
      throw ApiClientError.network(cause);
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { message: text.slice(0, 300) };
      }
    }
    return { status: response.status, body: parsed };
  }

  private unwrap<T>(res: RawResponse): T {
    if (res.status >= 200 && res.status < 300) return res.body as T;
    throw new ApiClientError(res.status, (res.body ?? {}) as Record<string, never>);
  }
}

interface RawResponse {
  status: number;
  body: unknown;
}

interface AuthSessionLike {
  accessToken?: string;
}
