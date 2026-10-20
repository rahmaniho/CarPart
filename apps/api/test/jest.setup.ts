/**
 * تنظیمات مشترک تست‌ها.
 *
 * همه مقادیر لازم برای اجرای سرویس در محیط تست اینجا با مقدار آزمایشی تنظیم می‌شوند؛
 * هیچ مقدار محرمانه واقعی در مخزن وجود ندارد.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-0123456789abcdef';
process.env.DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY ?? 'a'.repeat(64);
process.env.PAYMENT_SANDBOX_SECRET = process.env.PAYMENT_SANDBOX_SECRET ?? 'test-sandbox-payment-secret';
process.env.AUTH_EXPOSE_DEV_OTP = 'true';
process.env.DB_TYPE = 'sqljs';
process.env.DB_SQLJS_FILE = ':memory:';
process.env.DB_SYNC = 'true';
process.env.PAYMENT_PROVIDER = 'sandbox';
process.env.MAP_PROVIDER = 'mock';
process.env.SMS_PROVIDER = 'mock';
process.env.EMAIL_PROVIDER = 'mock';
process.env.STORAGE_LOCAL_DIR = './data/test-uploads';
process.env.SEED_ADMIN_MOBILE = '09120000000';
process.env.SEED_ADMIN_PASSWORD = 'TestAdmin!12345';
process.env.SEED_DEMO_DATA = 'true';
// محدودسازی نرخ در تست‌ها غیرفعال می‌شود تا سناریوها قابل تکرار باشند
process.env.THROTTLE_DISABLED = 'true';
process.env.THROTTLE_TTL_SECONDS = '60';
process.env.THROTTLE_LIMIT = '100000';
process.env.THROTTLE_AUTH_TTL_SECONDS = '60';
process.env.THROTTLE_AUTH_LIMIT = '100000';
// صف کارها در تست سریع‌تر پردازش می‌شود تا جریان‌های ناهمگام قابل آزمون باشند
process.env.JOB_POLL_INTERVAL_MS = '250';

if (!process.env.TEST_LOGS) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).__SUPPRESS_LOGS__ = true;
}
