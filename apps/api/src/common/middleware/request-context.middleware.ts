import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestStorage } from '../context/request-context';

/**
 * میان‌افزار زمینه درخواست.
 *
 * شناسه درخواست پیش از گاردها ساخته می‌شود (نه در رهگیر)، چون خطاهای احراز هویت و
 * مجوز توسط گاردها پیش از اجرای رهگیرها پرتاب می‌شوند؛ با این ترتیب هر پاسخ خطا
 * — از جمله ۴۰۱/۴۰۳ — دارای requestId برای رهگیری و پشتیبانی است.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.headers['x-request-id'];
  const requestId = typeof headerId === 'string' && headerId.length >= 8 && headerId.length <= 128 ? headerId : randomUUID();
  res.setHeader('X-Request-Id', requestId);
  requestStorage.run({ requestId, method: req.method, path: req.originalUrl, startedAt: Date.now() }, () => next());
}
