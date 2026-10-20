import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';

/**
 * لایه یکپارچه‌سازی نیتیو اندروید.
 *
 * قواعد پایداری (درس‌گرفته از کرش نسخه اول):
 * 1. هیچ فراخوانی نیتیو بدون try/catch نیست.
 * 2. افزونه Push فقط وقتی استفاده می‌شود که واقعاً در دسترس باشد و کاربر وارد شده باشد.
 * 3. دکمه بازگشت فقط یک بار ثبت می‌شود و هنگام خروج از کامپوننت پاک می‌شود
 *    (تجمع listenerها باعث می‌شد اپ ناگهان بسته شود).
 * 4. در وب همه‌چیز fallback بی‌خطا دارد.
 */

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function hasPlugin(name: string): boolean {
  if (!isNative()) return false;
  try {
    return Capacitor.isPluginAvailable(name);
  } catch {
    return false;
  }
}

export function platformName(): 'android' | 'ios' | 'web' {
  try {
    const platform = Capacitor.getPlatform();
    return platform === 'android' || platform === 'ios' ? platform : 'web';
  } catch {
    return 'web';
  }
}

/** نوار وضعیت برند + مخفی کردن اسپلش پس از آماده شدن UI */
export async function applyNativeChrome(): Promise<void> {
  if (!isNative()) return;
  try {
    if (hasPlugin('StatusBar')) {
      await StatusBar.setBackgroundColor({ color: '#0f766e' });
      await StatusBar.setStyle({ style: Style.Light });
    }
  } catch {
    /* پلتفرم‌های بدون پشتیبانی */
  }
  try {
    if (hasPlugin('SplashScreen')) await SplashScreen.hide();
  } catch {
    /* اسپلش قبلاً مخفی شده */
  }
}

let backListener: PluginListenerHandle | null = null;

/**
 * ثبت دکمه بازگشت سیستم‌عامل — دقیقاً یک listener.
 * handler باید `true` برگرداند اگر خودش مسیر را مدیریت کرد؛
 * `false` یعنی رفتار پیش‌فرض سیستم (بستن اپ در صفحه اصلی).
 */
export async function onBackButton(handler: () => boolean): Promise<() => void> {
  const cleanup = (): void => {
    if (backListener) {
      try {
        void backListener.remove();
      } catch {
        /* نادیده */
      }
      backListener = null;
    }
  };
  if (!hasPlugin('App')) return cleanup;
  cleanup(); // جایگزینی listener قبلی
  try {
    backListener = await CapApp.addListener('backButton', ({ canGoBack }) => {
      let handled = false;
      try {
        handled = handler();
      } catch {
        handled = false;
      }
      if (!handled && canGoBack) {
        window.history.back();
      }
      // اگر handled نشد و تاریخچه‌ای نیست، رفتار پیش‌فرض سیستم (خروج) انجام می‌شود
    });
  } catch {
    backListener = null;
  }
  return cleanup;
}

export interface DevicePushToken {
  token: string;
  platform: 'android' | 'ios' | 'web';
}

/**
 * ثبت اعلان فشاری (FCM).
 * فقط بعد از ورود کاربر فراخوانی شود؛ در وب یا بدون پیکربندی FCM بی‌صدا
 * `null` برمی‌گرداند. هیچ‌وقت استثنا پرتاب نمی‌کند.
 */
export async function registerPushToken(): Promise<DevicePushToken | null> {
  if (!hasPlugin('PushNotifications')) return null;
  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return null;
    await PushNotifications.register();
    const result = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 4000);
      void PushNotifications.addListener('registration', (token) => {
        clearTimeout(timeout);
        resolve(token.value);
      }).catch(() => resolve(null));
      void PushNotifications.addListener('registrationError', () => {
        clearTimeout(timeout);
        resolve(null);
      }).catch(() => resolve(null));
    });
    if (!result) return null;
    return { token: result, platform: platformName() };
  } catch {
    // بدون google-services.json یا سرویس Google Play، ثبت ناموفق است — بی‌صدا رد می‌شویم
    return null;
  }
}

/** خاموش کردن اعلان‌های یک دستگاه — فقط هنگام خروج حساب (هرگز هنگام بالا آمدن) */
export async function unregisterPushToken(): Promise<void> {
  if (!hasPlugin('PushNotifications')) return;
  try {
    await PushNotifications.unregister();
  } catch {
    /* نادیده */
  }
}

export interface PositionResult {
  lat: number;
  lng: number;
  accuracy: number | null;
}

/** دریافت موقعیت فعلی — افزونه نیتیو با fallback مرورگر */
export async function getCurrentPosition(): Promise<PositionResult> {
  if (hasPlugin('Geolocation')) {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 });
      return { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy ?? null };
    } catch {
      /* سقوط به fallback مرورگر */
    }
  }
  return new Promise<PositionResult>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('دسترسی موقعیت در این دستگاه در دسترس نیست'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy ?? null }),
      () => reject(new Error('دریافت موقعیت ممکن نشد؛ دسترسی مکان را بررسی کنید')),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

/**
 * مشاهده موقعیت تا زمانی که callback توقف فراخوانی شود.
 * فقط در حالی فعال است که اپ باز/فعال باشد؛ برای ردیابی پس‌زمینه واقعی باید
 * افزونه Foreground Service جداگانه اضافه شود (به‌خاطر محدودیت باتری/حریم خصوصی).
 */
export async function watchPosition(
  onPosition: (position: PositionResult) => void,
  onError?: (message: string) => void,
): Promise<() => void> {
  if (hasPlugin('Geolocation')) {
    try {
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15_000, minimumUpdateInterval: 15_000 },
        (position, error) => {
          if (error) {
            onError?.('دریافت موقعیت زنده ممکن نشد.');
            return;
          }
          if (!position) return;
          onPosition({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy ?? null });
        },
      );
      return () => {
        void Geolocation.clearWatch({ id }).catch(() => undefined);
      };
    } catch {
      onError?.('دسترسی موقعیت زنده فعال نشد.');
      return () => undefined;
    }
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => undefined;
  const id = navigator.geolocation.watchPosition(
    (position) => onPosition({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy ?? null }),
    () => onError?.('دریافت موقعیت زنده ممکن نشد.'),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** باز کردن مسیر در برنامه نقشه دستگاه */
export function openInMaps(lat: number | null | undefined, lng: number | null | undefined, label = 'مقصد'): void {
  if (lat == null || lng == null) return;
  const encoded = encodeURIComponent(label);
  try {
    if (platformName() === 'android') window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${encoded})`;
    else window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`, '_blank', 'noopener');
  } catch {
    /* نادیده */
  }
}
