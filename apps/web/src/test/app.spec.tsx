import { PANEL_ROLES, formatToman, normalizeFa, normalizeIranMobile } from '@carpart/contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { RequirePanelAccess } from '../components/layout/AppLayout';
import { OrderProgressBar, RankBreakdownModal } from '../components/ui/Primitives';
import { useAuthStore } from '../store/auth-store';
import { useCartStore } from '../store/cart-store';

function renderWithProviders(ui: ReactNode, initialEntry = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('پایندی فرانت‌اند به قرارداد مشترک @carpart/contract', () => {
  beforeEach(() => {
    useCartStore.getState().clear();
    useAuthStore.setState({ user: null, bootstrapped: true });
  });

  it('مبالغ صحیح تومان، ارقام فارسی و نرمال‌سازی موبایل را دقیق پردازش می‌کند', () => {
    expect(formatToman(690_000)).toContain('تومان');
    expect(normalizeIranMobile('۰۹۱۲۱۱۱۰۰۰۱')).toBe('09121110001');
    expect(normalizeFa(' فيلتر   روغن  ۲۰۶ ')).toBe('فیلتر روغن 206');
  });

  it('قانون تک‌فروشنده‌ای سبد خرید را پیش از ارسال به سرور اعمال می‌کند', () => {
    const first = useCartStore.getState().addItem({
      sellerProductId: 'sp-1',
      partId: 'part-1',
      partNameFa: 'لنت ترمز جلو پراید',
      sellerId: 'seller-A',
      sellerName: 'یدک‌رسان مرکزی',
      branchName: 'شعبه چراغ‌برق',
      unitPrice: 690_000,
      quantity: 1,
      quality: 'oem',
      maxStock: 5,
      estimatedDeliveryFee: 45_000,
    });
    expect(first.ok).toBe(true);

    const conflict = useCartStore.getState().addItem({
      sellerProductId: 'sp-2',
      partId: 'part-2',
      partNameFa: 'فیلتر روغن پژو',
      sellerId: 'seller-B',
      sellerName: 'پارس قطعه',
      branchName: 'شعبه غرب',
      unitPrice: 120_000,
      quantity: 1,
      quality: 'oem',
      maxStock: 10,
      estimatedDeliveryFee: 40_000,
    });
    expect(conflict).toEqual({ ok: false, conflictSellerName: 'یدک‌رسان مرکزی' });
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it('محافظ نقش (RequirePanelAccess) دسترسی فروشنده به پنل مدیریت را مسدود می‌کند', () => {
    useAuthStore.setState({
      bootstrapped: true,
      user: {
        id: 'u-seller',
        mobile: '09122220001',
        fullName: 'حسین رحیمی',
        email: null,
        city: 'تهران',
        isActive: true,
        roles: ['seller'],
        permissions: [],
        profileId: 's-1',
        profileKind: 'seller',
      },
    });

    renderWithProviders(
      <Routes>
        <Route element={<RequirePanelAccess allowed={PANEL_ROLES.admin} />}>
          <Route path="/admin" element={<div>محتوای محرمانه مدیر</div>} />
        </Route>
      </Routes>,
      '/admin',
    );

    expect(screen.queryByText('محتوای محرمانه مدیر')).not.toBeInTheDocument();
    expect(screen.getByText('عدم دسترسی به این پنل')).toBeInTheDocument();
  });

  it('نوار پیشرفت وضعیت سفارش و پنجره توضیح رتبه شفاف را نمایش می‌دهد', () => {
    renderWithProviders(
      <>
        <OrderProgressBar status="PREPARING" />
        <RankBreakdownModal
          open={true}
          onClose={() => {}}
          sellerName="یدک‌رسان مرکزی"
          rank={{
            total: 88,
            compatibility: 'exact',
            transparent: true,
            factors: [
              {
                key: 'compatibility',
                fa: 'تطابق فنی با خودرو',
                score: 1,
                weight: 30,
                contribution: 30,
                note: 'تطابق دقیق با تیپ خودرو',
              },
            ],
          }}
          warnings={[]}
        />
      </>,
    );

    expect(screen.getByText('آماده‌سازی')).toBeInTheDocument();
    expect(screen.getByText(/جزئیات رتبه‌بندی شفاف — یدک‌رسان مرکزی/)).toBeInTheDocument();
    expect(screen.getByText(/تطابق فنی با خودرو/)).toBeInTheDocument();
  });
});
