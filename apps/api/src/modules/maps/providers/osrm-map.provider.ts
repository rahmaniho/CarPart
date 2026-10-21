import type { LatLng } from '@carpart/contract';
import type { MapProvider, MapProviderHealth, RouteEstimate } from '../map-provider.interface';
import { MockMapProvider } from './mock-map.provider';

/**
 * آداپتر سرویس مسیر سازگار با OSRM (مانند OSRM عمومی یا نمونه خودمیزبان).
 * در صورت در دسترس نبودن سرویس، به‌صورت شفاف به لایه تخمینی بازمی‌گردد (degraded=true).
 */
export class OsrmMapProvider implements MapProvider {
  readonly name = 'osrm';
  readonly isLive = true;
  private lastError: string | null = null;
  private lastCheckedAt: string | null = null;

  constructor(
    private readonly baseUrl: () => string,
    private readonly fallback: MockMapProvider,
    private readonly timeoutMs = 5000,
  ) {}

  private get configured(): boolean {
    return Boolean(this.baseUrl());
  }

  async route(from: LatLng, to: LatLng): Promise<RouteEstimate> {
    this.lastCheckedAt = new Date().toISOString();
    if (!this.configured) {
      const estimate = await this.fallback.route(from, to);
      return { ...estimate, degraded: true, note: 'سرویس مسیر پیکربندی نشده؛ از تخمین استفاده شد.' };
    }
    const url = `${this.baseUrl().replace(/\/$/, '')}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false&steps=false`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`پاسخ ${response.status} از سرویس مسیر`);
      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{ distance: number; duration: number }>;
      };
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route) throw new Error('پاسخ سرویس مسیر معتبر نبود');
      this.lastError = null;
      return {
        distanceKm: Math.round((route.distance / 1000) * 100) / 100,
        durationMinutes: Math.max(1, Math.round(route.duration / 60)),
        source: 'live',
        provider: this.name,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.lastError = (error as Error).message;
      const estimate = await this.fallback.route(from, to);
      return {
        ...estimate,
        degraded: true,
        provider: this.name,
        note: `سرویس مسیر در دسترس نبود (${this.lastError})؛ مقدار تخمینی بازگردانده شد.`,
      };
    }
  }

  health(): MapProviderHealth {
    return {
      name: this.name,
      configured: this.configured,
      live: this.configured && !this.lastError,
      lastError: this.lastError,
      lastCheckedAt: this.lastCheckedAt,
    };
  }
}
