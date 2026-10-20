#!/usr/bin/env node
/**
 * بررسی خودکار هم‌ترازی قرارداد مشترک (Contract Alignment Check)
 * ۱. اعتبارسنجی خروجی‌های بسته @carpart/contract
 * ۲. تطبیق مسیرهای فراخوانی‌شده در apps/web با کنترلرهای واقعی NestJS در apps/api
 * ۳. اطمینان از عدم وجود آدرس سخت‌کد localhost در کد مرورگر (apps/web/src)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, predicate) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function normalizeRouteShape(route) {
  return route
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/:[A-Za-z0-9_]+/g, ':param');
}

function routeMatches(callShape, backendRoutes) {
  if (backendRoutes.has(callShape)) return true;
  const [verb, callPath] = callShape.split(' ');
  const callSegs = callPath.split('/');
  for (const candidate of backendRoutes) {
    const [candVerb, candPath] = candidate.split(' ');
    if (candVerb !== verb) continue;
    const candSegs = candPath.split('/');
    if (candSegs.length !== callSegs.length) continue;
    if (candSegs.every((seg, idx) => seg === callSegs[idx] || seg === ':param' || callSegs[idx] === ':param')) {
      return true;
    }
  }
  return false;
}

const contract = await import('../packages/contract/dist/index.js');
const requiredExports = [
  'API_PREFIX',
  'ROLES',
  'ORDER_STATUSES',
  'DELIVERY_STATUSES',
  'ORDER_TRANSITIONS',
  'DELIVERY_TRANSITIONS',
  'formatToman',
  'formatJalali',
  'normalizeIranMobile',
  'normalizeFa',
  'can',
];

for (const key of requiredExports) {
  if (!(key in contract)) {
    console.error(`❌ خروجی الزامی '${key}' در @carpart/contract یافت نشد.`);
    process.exit(1);
  }
}

// ۱. استخراج تمام مسیرهای تعریف‌شده در کنترلرهای NestJS
const controllerFiles = walk(path.join(rootDir, 'apps/api/src'), (f) => f.endsWith('.controller.ts'));
const backendRoutes = new Set();

for (const file of controllerFiles) {
  const src = fs.readFileSync(file, 'utf8');
  // یک کنترلر ممکن است بیش از یک کلاس @Controller داشته باشد
  const classChunks = src.split(/(?=@Controller\()/g).filter((chunk) => chunk.startsWith('@Controller('));
  for (const chunk of classChunks) {
    const ctrlMatch = chunk.match(/^@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/);
    const prefix = ctrlMatch?.[1] ?? '';
    const methodRegex = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
    let match;
    while ((match = methodRegex.exec(chunk)) !== null) {
      const verb = match[1].toUpperCase();
      const sub = match[2] ?? '';
      const combined = normalizeRouteShape([prefix, sub].filter(Boolean).join('/'));
      backendRoutes.add(`${verb} ${combined}`);
    }
  }
}

// ۲. بررسی تمام فراخوانی‌های api.* در apps/web/src
const webFiles = walk(
  path.join(rootDir, 'apps/web/src'),
  (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('/test/'),
);

const verbMap = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  del: 'DELETE',
  upload: 'POST',
};

const mismatches = [];
const localhostViolations = [];
let checkedCalls = 0;

for (const file of webFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(rootDir, file);

  if (/https?:\/\/(localhost|127\.0\.0\.1)/i.test(src)) {
    localhostViolations.push(rel);
  }

  const callRegex = /\bapi\.(get|post|put|patch|del|upload)\s*(?:<[\s\S]*?>)?\s*\(\s*(['"`])([^'"`]+)\2/g;
  let m;
  while ((m = callRegex.exec(src)) !== null) {
    const httpVerb = verbMap[m[1]];
    const shape = `${httpVerb} ${normalizeRouteShape(m[3].split('?')[0])}`;
    checkedCalls += 1;
    if (!routeMatches(shape, backendRoutes)) {
      mismatches.push(`${rel} -> ${shape}`);
    }
  }
}

if (localhostViolations.length > 0) {
  console.error('❌ آدرس سخت‌کد localhost در کد کلاینت یافت شد:', localhostViolations);
  process.exit(1);
}

if (mismatches.length > 0) {
  console.error('❌ عدم تطابق مسیر فرانت‌اند با بک‌اند:', mismatches);
  process.exit(1);
}

console.log(
  `✅ هم‌ترازی قرارداد تأیید شد: ${backendRoutes.size} مسیر کنترلر بک‌اند و ${checkedCalls} فراخوانی کلاینت ۱۰۰٪ منطبق هستند.`,
);
