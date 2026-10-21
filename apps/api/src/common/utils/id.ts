import { randomInt, randomUUID } from 'node:crypto';

/** شناسه یکتا (UUIDv4) — برای کلیدهای اصلی و شناسه ارجاع تراکنش‌ها. */
export function newId(): string {
  return randomUUID();
}

/** شناسه کوتاه انسان‌خوانا برای شماره سفارش/مأموریت: CP-4K7Q2M */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function shortCode(length = 6, prefix = ''): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return prefix ? `${prefix}-${out}` : out;
}

/** کد یکبارمصرف عددی برای تأیید تحویل یا پیامک. */
export function numericOtp(digits = 5): string {
  let out = '';
  for (let i = 0; i < digits; i += 1) out += String(randomInt(10));
  return out;
}

export function randomToken(bytes = 32): string {
  return require('node:crypto').randomBytes(bytes).toString('base64url');
}
