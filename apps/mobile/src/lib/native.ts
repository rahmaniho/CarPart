import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';

/**
 * لایه یکپارچه‌سازی نیتیو اندروید.
 * در وب همه توابع بی‌خطا fallback دارند (مثلاً geolocation مرورگر)؛
 * در WebView اندروید از افزونه‌های Capacitor استفاده می‌شود.
 */

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function platformName(): 'android' | 'ios' | 'web' {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' ? platform : 'web';
}

/** نوار وضعیت برند (سبز فیروزه‌ای) + مخفی کردن اسپلش پس از آماده شدن UI */
export async function applyNativeChrome(): Promise<void> {
  if (!isNative()) return;
  try {
    await StatusBar.setBackgroundColor({ color: '#0f766e' });
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* نادیده گرفتن خطا در پلتفرم‌های بدون پشتیبانی */
  }
  try {
    await SplashScreen.hide();
  } catch {
    /* اسپلش قبلاً مخفی شده */
  }
}

/** دکمه بازگشت سیستم‌عامل: در صفحات داخلی → عقب؛ در صفحه ریشه → خروج */
export function onBackButton(handler: () => boolean): void {
  if (!isNative()) return;
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    const handled = handler();
    if (!handled) {
      if (canGoBack) window.history.back();
      else void CapApp.exitApp();
    }
  });
}

export interface DevicePushToken {
  token: string;
  platform: 'android' | 'ios' | 'web';
}

/**
 * ثبت اعلان فشاری (FCM).
 * در وب یا بدون پیکربندی FCM، `null` برمی‌گرداند (بدون خطا) — سمت سرور نیز
 * اعلان push فقط برای دستگاه‌های ثبت‌شده ساخته می‌شود.
 */
export async function registerPushToken(): Promise<DevicePushToken | null> {
  if (!isNative()) return null;
  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return null;
    await PushNotifications.register();
    const result = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000);
      PushNotifications.addListener('registration', (token) => {
        clearTimeout(timeout);
        resolve(token.value);
      }).catch(() => resolve(null));
      PushNotifications.addListener('registrationError', () => {
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

/** خاموش کردن اعلان‌های یک دستگاه (هنگام خروج حساب) */
export async function unregisterPushToken(): Promise<void> {
  if (!isNative()) return;
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
  if (isNative()) {
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 });
    return { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy ?? null };
  }
  return new Promise<PositionResult>((resolve, reject) => {
    if (!navigator.geolocation) {
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
