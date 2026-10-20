import type { LatLng } from '@carpart/contract';
import type { MapProvider, MapProviderHealth, RouteEstimate } from '../map-provider.interface';
import { MockMapProvider } from './mock-map.provider';

/**
 * آداپتر سرویس نقشه و مسیر نشان (مناسب ایران).
 * بدون کلید API فعال نیست و در آن حالت به لایه تخمینی بازمی‌گردد.
 * برای فعال‌سازی: MAP_PROVIDER=neshan و MAP_API_KEY=<کلید شما>
 */
export class NeshanMapProvider implements MapProvider {
  readonly name = 'neshan';
  readonly isLive = true;
  private lastError: string | null = null;
  private lastCheckedAt: string | null = null;

  constructor(
    private readonly apiKey: () => string,
    private readonly fallback: MockMapProvider,
    private readonly timeoutMs = 5000,
  ) {}

  private get configured(): boolean {
    return Boolean(this.apiKey());
  }

  async route(from: LatLng, to: LatLng): Promise<RouteEstimate> {
    this.lastCheckedAt = new Date().toISOString();
    if (!this.configured) {
      const estimate = await this.fallback.route(from, to);
      return { ...estimate, degraded: true, note: 'کلید سرویس نقشه تنظیم نشده؛ از تخمین استفاده شد.' };
    }
    const url = `https://api.neshan.org/v4/direction?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&type=car`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Api-Key': this.apiKey(), accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`پاسخ ${response.status} از سرویس نقشه`);
      const data = (await response.json()) as {
        status?: string;
        routes?: Array<{ distance?: number; duration?: number; summary?: { distance?: number; duration?: number } }>;
      };
      const route = data.routes?.[0];
      const distanceMeters = route?.distance ?? route?.summary?.distance;
      const durationSeconds = route?.duration ?? route?.summary?.duration;
      if (!distanceMeters || !durationSeconds) throw new Error('پاسخ سرویس نقشه کامل نبود');
      this.lastError = null;
      return {
        distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
        durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
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
        note: `سرویس نقشه در دسترس نبود؛ مقدار تخمینی بازگردانده شد.`,
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
