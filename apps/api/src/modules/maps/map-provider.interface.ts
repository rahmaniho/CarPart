import type { LatLng } from '@carpart/contract';

export interface RouteEstimate {
  distanceKm: number;
  durationMinutes: number;
  /** منبع داده: live = سرویس مسیر واقعی، estimation = تخمین داخلی */
  source: 'live' | 'estimation';
  provider: string;
  /** اگر سرویس واقعی در دسترس نبود و از تخمین استفاده شد */
  degraded?: boolean;
  note?: string;
  fetchedAt: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  source: 'live' | 'manual';
}

export interface MapProviderHealth {
  name: string;
  configured: boolean;
  live: boolean;
  lastError: string | null;
  lastCheckedAt: string | null;
}

/**
 * رابط لایه نقشه/مسیر — کاملاً قابل جایگزینی از طریق تنظیمات.
 * هیچ بخش کسب‌وکاری مستقیماً به یک سرویس نقشه خاص وابسته نیست.
 */
export interface MapProvider {
  readonly name: string;
  readonly isLive: boolean;
  route(from: LatLng, to: LatLng): Promise<RouteEstimate>;
  geocode?(query: string): Promise<GeocodeResult | null>;
  health(): MapProviderHealth;
}
