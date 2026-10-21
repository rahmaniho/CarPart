import { createApiClient, LocalStorageTokenStore, type ApiClient } from '@carpart/api-client';
import { useSessionStore } from './session';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const baseUrl = configuredBaseUrl || '/api/v1';

/** در GitHub Pages بدون API عمومی، لندینگ صادقانه در حالت معرفی اجرا می‌شود. */
export const isStaticLanding = import.meta.env.VITE_STATIC_LANDING === 'true' && !configuredBaseUrl;

export const apiTokens = new LocalStorageTokenStore();

export const api: ApiClient = createApiClient({
  baseUrl,
  tokens: apiTokens,
  onSessionExpired: () => useSessionStore.getState().clear(),
});
