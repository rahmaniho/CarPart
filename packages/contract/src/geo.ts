/** ابزارهای جغرافیایی — محاسبه فاصله و جعبه محدوده. لایه نقشه/مسیر جدا و قابل جایگزینی است. */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** فاصله دایره‌بزرگ بر حسب کیلومتر (Haversine). */
export function haversineKm(a: LatLng | null | undefined, b: LatLng | null | undefined): number | null {
  if (!a || !b) return null;
  if (!isValidLatLng(a) || !isValidLatLng(b)) return null;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidLatLng(point?: LatLng | null): point is LatLng {
  if (!point) return false;
  return (
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export function metersBetween(a: LatLng, b: LatLng): number {
  const km = haversineKm(a, b);
  return km === null ? Number.POSITIVE_INFINITY : km * 1000;
}

/** جعبه محدوده برای فیلتر اولیه در پایگاه‌داده (شعاع بر حسب کیلومتر). */
export function boundingBox(center: LatLng, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.max(0.01, Math.cos(toRadians(center.lat))));
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/** تبدیل مختصات به کد ژئوهش ساده (۷ رقم) برای گروه‌بندی/ایندکس. */
export function geoKey(point: LatLng, precision = 3): string {
  return `${point.lat.toFixed(precision)},${point.lng.toFixed(precision)}`;
}
