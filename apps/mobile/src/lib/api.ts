import { Capacitor } from '@capacitor/core';
import { createApiClient, LocalStorageTokenStore, type ApiClient, type AuthSession } from '@carpart/api-client';
import { useSessionStore } from './session';

/** کلید نشانی API قابل‌تنظیم در نسخه اندروید */
export const API_BASE_KEY = 'carpart_api_base_url';

function normalizedApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

function resolveBaseUrl(): string {
  const buildTime = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (buildTime) return normalizedApiBase(buildTime);
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(API_BASE_KEY);
    if (saved) return normalizedApiBase(saved);
  }
  // وب با پراکسی Vite/Nginx؛ اندروید بدون تنظیم اولیه این URL قابل دسترس نیست
  return '/api/v1';
}

/** آیا نسخه نیتیو هنوز نشانی سرور نگرفته است؟ */
export function needsApiConfiguration(): boolean {
  const buildTime = Boolean((import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim());
  const saved = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(API_BASE_KEY));
  return Capacitor.isNativePlatform() && !buildTime && !saved;
}

/** ذخیره نشانی سرور و reload؛ ApiClient پس از reload با base URL جدید ساخته می‌شود. */
export function configureApiBaseUrl(url: string): void {
  const normalized = normalizedApiBase(url);
  const parsed = new URL(normalized);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('نشانی سرور باید با https:// یا http:// شروع شود.');
  localStorage.setItem(API_BASE_KEY, normalized);
  window.location.reload();
}

export function currentApiBaseUrl(): string {
  return resolveBaseUrl();
}

export const apiTokens = new LocalStorageTokenStore();

const platform = Capacitor.getPlatform();
export const api: ApiClient = createApiClient({
  baseUrl: resolveBaseUrl(),
  tokens: apiTokens,
  clientPlatform: platform === 'android' || platform === 'ios' ? platform : 'web',
  onSessionExpired: () => {
    apiTokens.setAccess(null);
    apiTokens.setRefresh?.(null);
    useSessionStore.getState().clear();
  },
});

/** ذخیره هر دو توکن برای نشست نیتیو؛ وب فقط accessToken را ذخیره می‌کند. */
export function persistAuthSession(session: AuthSession): void {
  apiTokens.setAccess(session.accessToken);
  if (session.refreshToken) apiTokens.setRefresh?.(session.refreshToken);
  useSessionStore.getState().set(session.user);
}

export function clearAuthSession(): void {
  apiTokens.setAccess(null);
  apiTokens.setRefresh?.(null);
  useSessionStore.getState().clear();
}
