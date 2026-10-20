import type { CapacitorConfig } from '@capacitor/cli';

/**
 * پیکربندی Capacitor برای بسته‌بندی اندروید.
 *
 * نکته مهم استقرار: تمدید نشست با کوکی httpOnly انجام می‌شود؛ بنابراین در نسخه
 * اندروید، `server.url` باید به همان میزبانی اشاره کند که وب‌اپ را سرو می‌کند
 * (هم‌منبع با API یا پشت یک دامنه مشترک) تا کوکی SameSite=Strict ارسال شود.
 * برای توسعه، WebView به dev server ویناصل (`localhost:5174`) وصل است.
 */
const config: CapacitorConfig = {
  appId: 'ir.carpart.app',
  appName: 'کارپارت',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: { backgroundColor: '#0f766e' },
  },
};

export default config;
