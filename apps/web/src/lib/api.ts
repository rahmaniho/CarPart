import { createApiClient, LocalStorageTokenStore, type ApiClient } from '@carpart/api-client';
import { useSessionStore } from './session';

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

export const apiTokens = new LocalStorageTokenStore();

export const api: ApiClient = createApiClient({
  baseUrl,
  tokens: apiTokens,
  onSessionExpired: () => useSessionStore.getState().clear(),
});
