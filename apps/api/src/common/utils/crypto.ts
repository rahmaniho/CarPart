import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as unknown as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

const SCRYPT_OPTIONS: ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
};

/**
 * hashing رمز عبور با scrypt (KDF حافظه‌سنگین).
 * دلیل انتخاب: در محیط فعلی امکان ساخت ماژول بومی bcrypt/argon2 وجود ندارد؛
 * scrypt در هسته Node پیاده‌سازی شده و طبق توصیه OWASP برای ذخیره رمز عبور قابل قبول است.
 * قالب ذخیره: scrypt$N$r$p$saltBase64$hashBase64
 */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 64 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_PARAMS.keyLen, SCRYPT_OPTIONS);
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, nStr, rStr, pStr, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      ...SCRYPT_OPTIONS,
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** HMAC-SHA256 — برای امضای لینک‌های بازگشت پرداخت و توکن‌های یکبارمصرف. */
export function hmac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** هش یکطرفه برای نگهداری توکن‌های حساس (refresh token، کد تأیید). */
export function hashToken(token: string): string {
  return createHmac('sha256', 'carpart-token-hash').update(token).digest('hex');
}

function normalizeKey(key: string): Buffer {
  const hex = key.replace(/[^0-9a-fA-F]/g, '');
  if (hex.length === 64) return Buffer.from(hex, 'hex');
  return createHmac('sha256', 'carpart-key-derivation').update(key).digest();
}

/** رمزنگاری متقارن AES-256-GCM برای داده‌های حساسِ کم‌حجم (مانند شناسه پذیرنده). */
export function encryptSecret(plaintext: string, key: string): string {
  if (!plaintext) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', normalizeKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptSecret(payload: string, key: string): string {
  if (!payload) return '';
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const decipher = createDecipheriv('aes-256-gcm', normalizeKey(key), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
