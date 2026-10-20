import { can, type CurrentUserDto, type Permission, type Role } from '@carpart/contract';
import { create } from 'zustand';
import { api, onSessionChange, refreshAccessSession, setAccessToken } from '../lib/api-client';

export function defaultHomeForRoles(roles: readonly Role[]): string {
  if (roles.includes('admin') || roles.includes('operator')) return '/admin';
  if (roles.includes('seller')) return '/seller';
  if (roles.includes('courier')) return '/courier';
  if (roles.includes('mechanic')) return '/mechanic';
  return '/';
}

interface AuthState {
  user: CurrentUserDto | null;
  bootstrapped: boolean;
  bootstrap: () => Promise<void>;
  setSession: (user: CurrentUserDto, accessToken: string) => void;
  reloadMe: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasAnyRole: (roles: readonly Role[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => {
  onSessionChange((session) => {
    set({ user: session ? session.user : null });
  });

  return {
    user: null,
    bootstrapped: false,

    bootstrap: async () => {
      if (get().bootstrapped) return;
      const session = await refreshAccessSession();
      set({ user: session?.user ?? null, bootstrapped: true });
    },

    setSession: (user, accessToken) => {
      setAccessToken(accessToken);
      set({ user, bootstrapped: true });
    },

    reloadMe: async () => {
      try {
        const me = await api.get<CurrentUserDto>('auth/me');
        set({ user: me });
      } catch {
        // نادیده‌گرفتن خطا در بارگذاری پس‌زمینه
      }
    },

    logout: async () => {
      try {
        await api.post('auth/logout', {}, { skipAuthRefresh: true });
      } catch {
        // حتی اگر نشست سمت سرور پیش‌تر باطل شده باشد، وضعیت محلی پاک می‌شود
      } finally {
        setAccessToken(null);
        set({ user: null });
      }
    },

    hasPermission: (permission) => {
      const u = get().user;
      if (!u) return false;
      return can(u.roles, permission);
    },

    hasAnyRole: (roles) => {
      const u = get().user;
      if (!u) return false;
      return roles.some((r) => u.roles.includes(r));
    },
  };
});
