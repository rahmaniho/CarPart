/**
 * نگهداری توکن دسترسی.
 * رفرش توکن در کوکی httpOnly سمت سرور است و کلاینت به آن دسترسی ندارد؛
 * بنابراین اینجا فقط توکن دسترسی ذخیره می‌شود (برای هر درخواست Authorization).
 */
export interface TokenStore {
  getAccess(): string | null;
  setAccess(token: string | null): void;
  /** فقط کلاینت نیتیو: وب از کوکی httpOnly استفاده می‌کند */
  getRefresh?(): string | null;
  setRefresh?(token: string | null): void;
}

export class MemoryTokenStore implements TokenStore {
  private access: string | null = null;
  private refresh: string | null = null;

  getAccess(): string | null {
    return this.access;
  }

  setAccess(token: string | null): void {
    this.access = token;
  }

  getRefresh(): string | null {
    return this.refresh;
  }

  setRefresh(token: string | null): void {
    this.refresh = token;
  }
}

/** ذخیره در localStorage برای حفظ نشست بین بازشدن‌های اپ (مرورگر/WebView) */
export class LocalStorageTokenStore implements TokenStore {
  constructor(private readonly key = 'carpart_access_token', private readonly refreshKey = 'carpart_native_refresh_token') {}

  getAccess(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.key);
  }

  setAccess(token: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(this.key, token);
    else localStorage.removeItem(this.key);
  }

  getRefresh(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.refreshKey);
  }

  setRefresh(token: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(this.refreshKey, token);
    else localStorage.removeItem(this.refreshKey);
  }
}
