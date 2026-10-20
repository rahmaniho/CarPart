import { createApiClient, LocalStorageTokenStore, type ApiClient } from '@carpart/api-client';
import { useSessionStore } from './session';

/**
 * نمونهٔ سراسری کلاینت API.
 * نشانی پایه از متغیر محیطی می‌آید؛ در توسعه با پراکسی وایت (`/api`) هم کار می‌کند.
 */
const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

export const apiTokens = new LocalStorageTokenStore();

export const api: ApiClient = createApiClient({
  baseUrl,
  tokens: apiTokens,
  onSessionExpired: () => {
    // خروج نرم: پاک‌سازی کاربر ذخیره‌شده؛ مسیریاب کاربر را به صفحه ورود می‌برد
    useSessionStore.getState().clear();
  },
});
