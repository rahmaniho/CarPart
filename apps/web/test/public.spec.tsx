import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../src/pages/public/HomePage';
import { OfferCard } from '../src/components/OfferCard';
import type { SearchOffer } from '@carpart/api-client';

function offerFixture(): SearchOffer {
  return {
    id: 'o1',
    sellerProductId: 'sp1',
    part: { id: 'p1', nameFa: 'لنت ترمز جلو پراید' },
    seller: { id: 's1', name: 'یدک مرکزی', branchName: 'شعبه ۱', rating: 5, city: 'تهران' },
    price: 685000,
    stock: 24,
    quality: 'aftermarket_high',
    preparationMinutes: 40,
    deliveryFee: 25000,
    estimatedDeliveryMinutes: null,
    distanceKm: null,
    compatibility: { level: 'unknown', note: 'سازگاری بررسی نشده' },
    rank: {
      total: 66,
      transparent: true,
      factors: [
        { key: 'price', fa: 'قیمت قطعه', weight: 22, score: 0.95, contribution: 20.9 },
        { key: 'sellerRating', fa: 'امتیاز فروشنده', weight: 12, score: 0.78, contribution: 9.3 },
      ],
    },
    warnings: ['سازگاری این قطعه با خودروی شما تأیید نشده است.'],
    updatedAt: new Date().toISOString(),
  };
}

describe('صفحات عمومی', () => {
  it('صفحه خانگی عنوان و جست‌وجو دارد', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/قطعه‌ای که لازم دارید/)).toBeTruthy();
    expect(screen.getByLabelText('جست‌وجوی قطعه')).toBeTruthy();
    expect(screen.getAllByText('کارپارت').length).toBeGreaterThan(0);
  });

  it('کارت پیشنهاد قیمت، هشدار و رتبه‌بندی شفاف را نشان می‌دهد', () => {
    render(
      <MemoryRouter>
        <OfferCard offer={offerFixture()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('لنت ترمز جلو پراید')).toBeTruthy();
    expect(screen.getByText(/سازگاری این قطعه با خودروی شما/)).toBeTruthy();
    fireEvent.click(screen.getByText('چرا این رتبه؟ (رتبه‌بندی شفاف)'));
    expect(screen.getByText('قیمت قطعه')).toBeTruthy();
    expect(screen.getByText('امتیاز فروشنده')).toBeTruthy();
    expect(screen.getByText(/کمیسیون فروشنده هرگز در رتبه‌بندی اثر ندارد/)).toBeTruthy();
  });
});
