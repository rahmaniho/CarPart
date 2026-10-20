import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// پاک‌سازی DOM بعد از هر تست (بدون این، اجزای تست قبلی باقی می‌مانند)
afterEach(() => {
  cleanup();
});
