import { API_PREFIX, type ApiErrorBody } from '@carpart/contract';

export const DEFAULT_ANDROID_EMULATOR_ORIGIN = ['http:', '', '10.0.2.2:4000'].join('/');
export const DEFAULT_CLOUD_SERVER_ORIGIN = 'https://4000-iraqxshap4bfywbrxmlk7.e2b.app';

let currentOrigin = DEFAULT_CLOUD_SERVER_ORIGIN;
let accessToken: string | null = null;

export function getMobileApiOrigin(): string {
  return currentOrigin;
}

export function setMobileApiOrigin(nextOrigin: string): void {
  currentOrigin = nextOrigin.trim().replace(/\/+$/, '') || DEFAULT_CLOUD_SERVER_ORIGIN;
}

export function setMobileAccessToken(token: string | null): void {
  accessToken = token;
}

export function makeMobileIdempotencyKey(prefix = 'rn'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function mobileRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  opts: {
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    idempotencyKey?: string;
    rawUrl?: boolean;
  } = {},
): Promise<T> {
  const relPath = opts.rawUrl ? path : `${API_PREFIX}/${path.replace(/^\/+/, '')}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  const url = `${currentOrigin}${relPath}${qs ? `?${qs}` : ''}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const errBody = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Partial<ApiErrorBody>;
    throw new Error(errBody.faMessage || errBody.message || `خطای ارتباط با سرور (${res.status})`);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>, rawUrl = false) =>
    mobileRequest<T>('GET', path, { query, rawUrl }),
  post: <T>(path: string, body?: unknown, opts?: { idempotencyKey?: string }) =>
    mobileRequest<T>('POST', path, { body: body ?? {}, idempotencyKey: opts?.idempotencyKey }),
  put: <T>(path: string, body?: unknown) => mobileRequest<T>('PUT', path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => mobileRequest<T>('PATCH', path, { body: body ?? {} }),
  del: <T>(path: string) => mobileRequest<T>('DELETE', path),
};
