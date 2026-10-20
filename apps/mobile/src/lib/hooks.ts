import { useEffect, useState } from 'react';

/** شمارش معکوس زنده تا یک زمان مشخص (برای مهلت پذیرش مأموریت و پیشنهاد) */
export function useCountdown(targetIso: string | null | undefined): number {
  const target = targetIso ? new Date(targetIso).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(target)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  return Number.isNaN(target) ? 0 : Math.max(0, Math.floor((target - now) / 1000));
}

/** تولید کلید Idempotency برای عملیات حساس (پرداخت/سفارش) */
export function idempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
