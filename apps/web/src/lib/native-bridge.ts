import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { StatusBar, Style } from '@capacitor/status-bar';

const API_ORIGIN_STORAGE_KEY = 'carpart_native_api_origin_v1';
const NATIVE_SESSION_STORAGE_KEY = 'carpart_native_session_v1';

/** پیش‌فرض سرور ابری زنده برای اجرای بی‌نیاز از تنظیم اولیه روی گوشی اندروید */
export const DEFAULT_NATIVE_SERVER_ORIGIN = 'https://4000-iraqxshap4bfywbrxmlk7.e2b.app';

/** شبیه‌ساز رسمی اندروید استودیو (AVD) برای اتصال به پورت ۴۰۰۰ سیستم میزبان */
export const ANDROID_EMULATOR_ORIGIN = ['http:', '', '10.0.2.2:4000'].join('/');

export function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatformName(): 'android' | 'ios' | 'web' {
  const p = Capacitor.getPlatform();
  if (p === 'android' || p === 'ios') return p;
  return 'web';
}

export function getConfiguredApiOrigin(): string {
  try {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(API_ORIGIN_STORAGE_KEY)?.trim();
      if (saved) return saved.replace(/\/+$/, '');
    }
  } catch {
    // نادیده‌گرفتن خطای ذخیره‌سازی محلی
  }
  return isNativeMobile() ? DEFAULT_NATIVE_SERVER_ORIGIN : '';
}

export function setConfiguredApiOrigin(origin: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    const cleaned = (origin ?? '').trim().replace(/\/+$/, '');
    if (!cleaned) {
      window.localStorage.removeItem(API_ORIGIN_STORAGE_KEY);
    } else {
      window.localStorage.setItem(API_ORIGIN_STORAGE_KEY, cleaned);
    }
  } catch {
    // نادیده‌گرفتن خطای ذخیره‌سازی محلی
  }
}

export function saveNativeSessionSnapshot<T>(payload: { user: T; accessToken: string } | null): void {
  if (!isNativeMobile()) return;
  try {
    if (!payload) {
      window.localStorage.removeItem(NATIVE_SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(NATIVE_SESSION_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // نادیده‌گرفتن خطا
  }
}

export function loadNativeSessionSnapshot<T>(): { user: T; accessToken: string } | null {
  if (!isNativeMobile()) return null;
  try {
    const raw = window.localStorage.getItem(NATIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { user: T; accessToken: string };
  } catch {
    return null;
  }
}

/** راه‌اندازی یکپارچگی‌های بومی اندروید: نوار وضعیت، دکمه بازگشت سخت‌افزاری و پایش شبکه */
export async function initNativeShell(onNetworkChange?: (connected: boolean) => void): Promise<() => void> {
  const cleanups: Array<() => void> = [];

  if (!isNativeMobile()) {
    if (typeof window !== 'undefined' && onNetworkChange) {
      const goOnline = () => onNetworkChange(true);
      const goOffline = () => onNetworkChange(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      cleanups.push(() => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      });
    }
    return () => cleanups.forEach((fn) => fn());
  }

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#115e59' });
  } catch {
    // در برخی نسخه‌های اندروید نادیده گرفته می‌شود
  }

  try {
    const backHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        void CapacitorApp.exitApp();
      }
    });
    cleanups.push(() => void backHandle.remove());
  } catch {
    // نادیده گرفتن
  }

  if (onNetworkChange) {
    try {
      const status = await Network.getStatus();
      onNetworkChange(status.connected);
      const netHandle = await Network.addListener('networkStatusChange', (s) => {
        onNetworkChange(s.connected);
      });
      cleanups.push(() => void netHandle.remove());
    } catch {
      // نادیده گرفتن
    }
  }

  return () => cleanups.forEach((fn) => fn());
}

/** دریافت مختصات GPS واقعی گوشی اندروید (با بازگشت امن به مختصات نمونه در صورت عدم دسترسی) */
export async function getDeviceCoordinates(): Promise<{
  lat: number;
  lng: number;
  source: 'gps' | 'fallback';
}> {
  if (isNativeMobile()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        await Geolocation.requestPermissions();
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
      });
      return {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        source: 'gps',
      };
    } catch {
      return { lat: 35.732, lng: 51.398, source: 'fallback' };
    }
  }

  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      return {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        source: 'gps',
      };
    } catch {
      return { lat: 35.732, lng: 51.398, source: 'fallback' };
    }
  }

  return { lat: 35.732, lng: 51.398, source: 'fallback' };
}
