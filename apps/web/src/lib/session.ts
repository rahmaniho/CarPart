import { create } from 'zustand';
import type { SessionUser } from '@carpart/api-client';

const USER_KEY = 'carpart_admin_user';

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

/** پنل مدیریت فقط برای نقش‌های admin و operator */
export function canUsePanel(user: SessionUser | null): boolean {
  return Boolean(user?.roles?.some((role) => role === 'admin' || role === 'operator'));
}

export function isAdmin(user: SessionUser | null): boolean {
  return Boolean(user?.roles?.includes('admin'));
}
