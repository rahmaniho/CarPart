import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextValue {
  requestId: string;
  userId?: string;
  userMobile?: string;
  method?: string;
  path?: string;
  startedAt: number;
}

export const requestStorage = new AsyncLocalStorage<RequestContextValue>();

export function getRequestContext(): RequestContextValue | undefined {
  return requestStorage.getStore();
}

export function getRequestId(): string | undefined {
  return requestStorage.getStore()?.requestId;
}

export function getUserId(): string | undefined {
  return requestStorage.getStore()?.userId;
}
