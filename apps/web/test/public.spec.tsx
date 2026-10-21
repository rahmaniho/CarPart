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
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/دنیای قطعات خودرو.*هوشمندتر از همیشه/s);
    expect(screen.getByLabelText('جست‌وجوی قطعه')).toBeTruthy();
    expect(screen.getAllByText('کارپارت').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'یک سفارش؛ چند مسیر هماهنگ' })).toBeTruthy();
    expect(screen.getByText('۲ بستهٔ فروشنده')).toBeTruthy();
    expect(screen.getByText('نمایش مفهومی')).toBeTruthy();
    expect(screen.getByText('برای مکانیک و خریدار')).toBeTruthy();
    expect(screen.getByText('برای فروشنده و تأمین‌کننده')).toBeTruthy();
    expect(screen.getByText('برای پیک')).toBeTruthy();
    expect(screen.getByText(/خرید قطعه از حدس‌زدن/)).toBeTruthy();
    expect(screen.getByText(/تقاضای واقعی را منظم‌تر ببینید/)).toBeTruthy();
    expect(screen.getByText(/تمرکز بیشتر روی تعمیر خودرو/)).toBeTruthy();
    expect(screen.getByText(/کارپارت عدد یا سود تضمینی اعلام نمی‌کند/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /خریدار در حال بررسی قطعه/ }).getAttribute('src')).toBe('/landing/buyer-real.webp');
    expect(screen.getByRole('img', { name: /تأمین‌کننده در انبار قطعات/ }).getAttribute('src')).toBe('/landing/supplier-real.webp');
    expect(screen.getByRole('img', { name: 'مکانیک در تعمیرگاه هنگام بررسی قطعه تأمین‌شده با کارپارت' }).getAttribute('src')).toBe('/landing/mechanic-real.webp');
    expect(screen.getByRole('img', { name: /دریافت و بارگیری بسته قطعه/ }).getAttribute('src')).toBe('/landing/courier-pickup.webp');
    expect(screen.getByRole('img', { name: /تحویل بسته قطعه به مکانیک/ }).getAttribute('src')).toBe('/landing/courier-delivery.webp');
    expect(screen.getByText('دریافت و بارگیری امن')).toBeTruthy();
    expect(screen.getByText('تحویل به مکانیک یا مشتری')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /جست‌وجوی قطعات/ }).some((link) => link.getAttribute('href') === '/search')).toBe(true);
    expect(screen.getAllByRole('link', { name: /همکاری با CarPart/ }).some((link) => link.getAttribute('href') === '/register')).toBe(true);
    const karensoft = screen.getByRole('link', { name: /طراحی و توسعه توسط کارن سافت/ });
    expect(karensoft.getAttribute('href')).toBe('https://www.karen-soft.ir');
    expect(karensoft.getAttribute('target')).toBe('_blank');
    expect(karensoft.getAttribute('rel')).toBe('noopener noreferrer');
    expect(karensoft.querySelector('img[src="/images/karensoft/mark.png"]')).toBeTruthy();
    expect(karensoft.querySelector('img[src="/images/karensoft/wordmark-fa.png"]')).toBeTruthy();
    expect(karensoft.querySelector('img[src="/images/karensoft/wordmark-en.png"]')).toBeTruthy();
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
