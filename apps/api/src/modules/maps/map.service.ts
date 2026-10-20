import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LatLng } from '@carpart/contract';
import { haversineKm, isValidLatLng } from '@carpart/contract';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { SystemSettingsService } from '../settings/system-settings.service';
import { MockMapProvider } from './providers/mock-map.provider';
import { NeshanMapProvider } from './providers/neshan-map.provider';
import { OsrmMapProvider } from './providers/osrm-map.provider';
import type { MapProvider, MapProviderHealth, RouteEstimate } from './map-provider.interface';

/**
 * سرویس نقشه — نقطه ورود یکتای همه بخش‌ها به محاسبه مسیر و مسافت.
 * انتخاب فراهم‌کننده از تنظیمات (env + SystemSetting) انجام می‌شود.
 */
@Injectable()
export class MapService {
  private readonly logger = new Logger(MapService.name);
  private readonly providers: Map<string, MapProvider>;
  private readonly mock: MockMapProvider;

  constructor(
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
    private readonly settings: SystemSettingsService,
  ) {
    this.mock = new MockMapProvider(() => ({
      detourFactor: this.config.map.detourFactor,
      avgSpeedKmh: this.config.map.avgSpeedKmh,
      pickupOverheadMinutes: 12,
    }));
    this.providers = new Map<string, MapProvider>([
      ['mock', this.mock],
      ['osrm', new OsrmMapProvider(() => this.config.map.routeUrl, this.mock)],
      ['neshan', new NeshanMapProvider(() => this.config.map.apiKey, this.mock)],
    ]);
  }

  get activeProviderName(): string {
    return this.config.map.provider;
  }

  private active(): MapProvider {
    return this.providers.get(this.config.map.provider) ?? this.mock;
  }

  /** تخمین مسیر بین دو نقطه — در صورت نبود سرویس واقعی، تخمین شفاف بازمی‌گردد. */
  async route(from: LatLng | null | undefined, to: LatLng | null | undefined): Promise<RouteEstimate | null> {
    if (!isValidLatLng(from) || !isValidLatLng(to)) return null;
    const overhead = await this.settings.getNumber('map.pickup_overhead_minutes', 12);
    const estimate = await this.active().route(from, to);
    if (estimate.provider === 'mock' || estimate.degraded) {
      const detour = await this.settings.getNumber('map.detour_factor', this.config.map.detourFactor);
      const speed = await this.settings.getNumber('map.avg_speed_kmh', this.config.map.avgSpeedKmh);
      const straight = haversineKm(from, to) ?? 0;
      const distanceKm = Math.round(straight * Math.max(1, detour) * 100) / 100;
      const durationMinutes = Math.max(5, Math.round((distanceKm / Math.max(5, speed)) * 60 + overhead));
      return {
        distanceKm,
        durationMinutes,
        source: 'estimation',
        provider: `${estimate.provider}(fallback)`,
        degraded: true,
        note: estimate.note ?? 'تخمین داخلی سامانه — سرویس مسیر واقعی متصل نیست.',
        fetchedAt: new Date().toISOString(),
      };
    }
    return estimate;
  }

  async distanceKm(from: LatLng | null | undefined, to: LatLng | null | undefined): Promise<number | null> {
    const route = await this.route(from, to);
    if (route) return route.distanceKm;
    return isValidLatLng(from) && isValidLatLng(to) ? haversineKm(from, to) : null;
  }

  /** وضعیت فراهم‌کننده‌ها — برای صفحه سلامت و پنل مدیریت (شفافیت درباره حالت آزمایشی). */
  health(): { active: string; live: boolean; providers: MapProviderHealth[] } {
    const active = this.active();
    return {
      active: active.name,
      live: active.isLive && active.health().live,
      providers: [...this.providers.values()].map((p) => p.health()),
    };
  }
}
