import { create } from 'zustand';
import type { SessionUser } from '@carpart/api-client';

const USER_KEY = 'carpart_user';

function loadUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

interface SessionState {
  user: SessionUser | null;
  set(user: SessionUser | null): void;
  clear(): void;
}

/** نشست کاربر (کاربر جاری + پاک‌سازی هنگام خروج یا انقضای توکن) */
export const useSessionStore = create<SessionState>((set) => ({
  user: loadUser(),
  set: (user) => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
    set({ user });
  },
  clear: () => {
    localStorage.removeItem(USER_KEY);
    set({ user: null });
  },
}));

export function hasRole(user: SessionUser | null, role: string): boolean {
  return Boolean(user?.roles?.includes(role as never));
}
