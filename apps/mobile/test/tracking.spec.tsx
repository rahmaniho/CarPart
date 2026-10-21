import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DeliveryTracking } from '@carpart/api-client';

vi.mock('../src/lib/native', () => ({ openInMaps: vi.fn() }));

import { LiveTrackingCard } from '../src/components/LiveTrackingCard';

function tracking(overrides: Partial<DeliveryTracking> = {}): DeliveryTracking {
  return {
    deliveryId: 'd1',
    code: 'DLV-1',
    status: 'ACCEPTED',
    statusFa: 'پذیرفته‌شده',
    pickupPoint: { title: 'فروشگاه', lat: 35.7, lng: 51.4 },
    dropoffPoint: { title: 'تعمیرگاه', lat: 35.8, lng: 51.5 },
    courier: { name: 'علی', phoneMasked: '0912***001', ratingAvg: 4.8, vehicleType: 'motorcycle' },
    distanceKm: 8,
    estimatedMinutes: 25,
    estimatedArrival: null,
    events: [],
    location: {
      lat: 35.71,
      lng: 51.41,
      accuracyM: 12,
      speedKmh: 20,
      heading: 90,
      recordedAt: new Date().toISOString(),
      ageSeconds: 5,
      isFresh: true,
      distanceToPickupM: 240,
      distanceToDropoffM: 6800,
    },
    sellerArrival: { detected: false, at: null },
    refreshAfterSeconds: 15,
    notice: 'زمان تقریبی است.',
    ...overrides,
  };
}

describe('ردیابی زنده مأموریت', () => {
  it('برای خریدار، تازگی GPS و فاصله تا نقطه بعدی را نشان می‌دهد', () => {
    render(<LiveTrackingCard tracking={tracking()} viewer="customer" />);
    expect(screen.getByText('● GPS آنلاین')).toBeTruthy();
    expect(screen.getByText('۲۴۰ متر')).toBeTruthy();
    expect(screen.getByText('پیک در مسیر دریافت بسته است')).toBeTruthy();
  });

  it('برای فروشنده بعد از Geofence پیام آماده‌سازی بسته نشان می‌دهد', () => {
    render(<LiveTrackingCard tracking={tracking({ sellerArrival: { detected: true, at: new Date().toISOString() } })} viewer="seller" />);
    expect(screen.getByText('پیک به محدوده فروشگاه رسیده است')).toBeTruthy();
    expect(screen.getByText(/بسته را برای تحویل آماده کنید/)).toBeTruthy();
  });
});
