import { API_PREFIX, type ApiErrorBody, type CurrentUserDto } from '@carpart/contract';

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly faMessage: string;
  readonly errors: Array<{ field: string; message: string }>;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(payload: Partial<ApiErrorBody> & { statusCode: number }) {
    const faMessage =
      payload.faMessage ||
      payload.message ||
      (payload.statusCode === 401
        ? 'نشست شما منقضی شده یا وارد حساب کاربری نشده‌اید.'
        : payload.statusCode === 403
          ? 'دسترسی به این بخش برای نقش کاربری شما مجاز نیست.'
          : 'خطایی در ارتباط با سرور رخ داد.');
    super(faMessage);
    this.name = 'ApiClientError';
    this.statusCode = payload.statusCode;
    this.code = payload.code ?? 'HTTP_ERROR';
    this.faMessage = faMessage;
    this.errors = payload.errors ?? [];
    this.requestId = payload.requestId;
    this.retryable = Boolean(payload.retryable);
  }
}

let inMemoryAccessToken: string | null = null;
let sessionListener: ((session: { user: CurrentUserDto; accessToken: string } | null) => void) | null = null;
let inflightRefresh: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function onSessionChange(
  listener: ((session: { user: CurrentUserDto; accessToken: string } | null) => void) | null,
): void {
  sessionListener = listener;
}

export function makeIdempotencyKey(prefix = 'web'): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

export async function refreshAccessSession(): Promise<{ user: CurrentUserDto; accessToken: string } | null> {
  try {
    const res = await fetch(`${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      inMemoryAccessToken = null;
      sessionListener?.(null);
      return null;
    }
    const data = (await res.json()) as { user: CurrentUserDto; accessToken: string };
    inMemoryAccessToken = data.accessToken;
    sessionListener?.(data);
    return data;
  } catch {
    return null;
  }
}

async function singleFlightRefresh(): Promise<string | null> {
  if (!inflightRefresh) {
    inflightRefresh = refreshAccessSession()
      .then((res) => res?.accessToken ?? null)
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  formData?: FormData;
  idempotencyKey?: string;
  skipAuthRefresh?: boolean;
  rawUrl?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query'], rawUrl = false): string {
  const normalized = rawUrl
    ? path
    : path.startsWith('/api/')
      ? path
      : `${API_PREFIX}/${path.replace(/^\/+/, '')}`;
  if (!query) return normalized;
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(query)) {
    if (val === undefined || val === null || val === '') continue;
    params.set(key, String(val));
  }
  const qs = params.toString();
  return qs ? `${normalized}?${qs}` : normalized;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, formData, idempotencyKey, skipAuthRefresh = false, rawUrl = false } = options;
  const url = buildUrl(path, query, rawUrl);

  const execute = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (!formData && body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await execute(inMemoryAccessToken);

  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    !path.includes('auth/login') &&
    !path.includes('auth/otp') &&
    !path.includes('auth/refresh') &&
    !path.includes('auth/register')
  ) {
    const refreshedToken = await singleFlightRefresh();
    if (refreshedToken) {
      response = await execute(refreshedToken);
    }
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!response.ok) {
    const errPayload = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Partial<ApiErrorBody>;
    throw new ApiClientError({
      ...errPayload,
      statusCode: response.status,
    });
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], rawUrl = false) =>
    apiRequest<T>(path, { method: 'GET', query, rawUrl }),
  post: <T>(path: string, body?: unknown, opts?: Pick<RequestOptions, 'idempotencyKey' | 'skipAuthRefresh'>) =>
    apiRequest<T>(path, { method: 'POST', body: body ?? {}, ...opts }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body: body ?? {} }),
  del: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => apiRequest<T>(path, { method: 'POST', formData }),
};
