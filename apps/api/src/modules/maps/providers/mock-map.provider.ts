import { haversineKm, type LatLng } from '@carpart/contract';
import type { MapProvider, MapProviderHealth, RouteEstimate } from '../map-provider.interface';

export interface MockMapOptions {
  detourFactor: number;
  avgSpeedKmh: number;
  pickupOverheadMinutes: number;
}

/**
 * لایه تخمینی نقشه (پیش‌فرض وقتی سرویس واقعی پیکربندی نشده است).
 *
 * صادق بودن خروجی مهم است: مسافت = فاصله مستقیم × ضریب شهری و زمان = مسافت/سرعت + سربار.
 * این مقدار «زمان تضمینی تحویل» نیست و در رابط کاربری به‌صورت «تخمین» نمایش داده می‌شود.
 */
export class MockMapProvider implements MapProvider {
  readonly name = 'mock';
  readonly isLive = false;

  constructor(private readonly options: () => MockMapOptions) {}

  async route(from: LatLng, to: LatLng): Promise<RouteEstimate> {
    const opts = this.options();
    const straight = haversineKm(from, to) ?? 0;
    const distanceKm = Math.round(straight * Math.max(1, opts.detourFactor) * 100) / 100;
    const speed = Math.max(5, opts.avgSpeedKmh);
    const drivingMinutes = (distanceKm / speed) * 60;
    const durationMinutes = Math.max(5, Math.round(drivingMinutes + opts.pickupOverheadMinutes));
    return {
      distanceKm,
      durationMinutes,
      source: 'estimation',
      provider: this.name,
      note: 'تخمین مبتنی بر فاصله مستقیم و ضریب شهری — جایگزین مسیر واقعی نیست.',
      fetchedAt: new Date().toISOString(),
    };
  }

  health(): MapProviderHealth {
    return {
      name: this.name,
      configured: true,
      live: false,
      lastError: null,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}
