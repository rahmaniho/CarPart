import { beforeEach, describe, expect, it, vi } from 'vitest';

// شبیه‌سازی محیط وب (بدون Capacitor نیتیو) — توابع باید بی‌خطا fallback بدهند
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));
vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn(), exitApp: vi.fn() },
}));
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: { setBackgroundColor: vi.fn(), setStyle: vi.fn() },
  Style: { Light: 'LIGHT' },
}));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    addListener: vi.fn(),
  },
}));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: { getCurrentPosition: vi.fn() } }));

import { applyNativeChrome, getCurrentPosition, isNative, onBackButton, platformName, registerPushToken, unregisterPushToken } from '../src/lib/native';

describe('لایه نیتیو — fallback وب', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('در وب، خود را نیتیو گزارش نمی‌کند و پلتفرم web است', () => {
    expect(isNative()).toBe(false);
    expect(platformName()).toBe('web');
  });

  it('ثبت Push در وب بی‌صدا null برمی‌گرداند (بدون خطا)', async () => {
    await expect(registerPushToken()).resolves.toBeNull();
    await expect(unregisterPushToken()).resolves.toBeUndefined();
    await expect(applyNativeChrome()).resolves.toBeUndefined();
  });

  it('دکمه بازگشت در وب ثبت نمی‌شود (بدون خطا)', () => {
    expect(() => onBackButton(() => true)).not.toThrow();
  });

  it('موقعیت از geolocation مرورگر خوانده می‌شود', async () => {
    const getCurrentPositionMock = vi.fn((success: (pos: unknown) => void) => {
      success({ coords: { latitude: 35.735, longitude: 51.41, accuracy: 12, speed: 5, heading: 90 }, timestamp: 1_700_000_000_000 });
    });
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
    });

    const position = await getCurrentPosition();
    expect(position.lat).toBeCloseTo(35.735);
    expect(position.lng).toBeCloseTo(51.41);
    expect(position.accuracy).toBe(12);
    expect(position.speedKmh).toBe(18);
    expect(position.heading).toBe(90);
    expect(position.capturedAt).toBe('2023-11-14T22:13:20.000Z');
  });

  it('موقعیت مرورگر: خطای دسترسی با پیام فارسی', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { getCurrentPosition: (_s: unknown, error: (err: unknown) => void) => error(new Error('denied')) },
      configurable: true,
    });
    await expect(getCurrentPosition()).rejects.toThrow('دریافت موقعیت ممکن نشد');
  });
});
