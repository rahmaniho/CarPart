/** تنظیمات مشترک تست‌ها */
process.env.NODE_ENV = 'test';
// جلوگیری از نویز لاگ در خروجی تست
if (!process.env.TEST_LOGS) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).__SUPPRESS_LOGS__ = true;
}
