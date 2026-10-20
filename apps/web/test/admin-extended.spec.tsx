import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RefundsPage, PayoutsPage } from '../src/pages/admin/RefundsPayouts';
import { CouponsPage, AnnouncementsPage } from '../src/pages/admin/CouponsAnnouncements';
import SupportPage from '../src/pages/admin/SupportPage';

const page = { items: [], meta: { page: 1, pageSize: 30, total: 0, totalPages: 0, hasNext: false, hasPrevious: false } };
vi.mock('../src/lib/api', () => ({
  api: {
    admin: {
      refunds: vi.fn(async () => page),
      adminPayoutsList: vi.fn(async () => page),
      coupons: vi.fn(async () => page),
      supportTickets: vi.fn(async () => page),
      returns: vi.fn(async () => page),
      createCoupon: vi.fn(), approveRefund: vi.fn(), rejectRefund: vi.fn(), executeRefund: vi.fn(),
      payoutAction: vi.fn(), replyTicket: vi.fn(), resolveReturn: vi.fn(), createAnnouncement: vi.fn(),
    },
    settings: { adminList: vi.fn(async () => []), announcements: vi.fn(async () => []) },
  },
}));

function renderPage(node: JSX.Element): void {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);
}

describe('داشبورد مدیریت تکمیلی', () => {
  it('صفحات بازپرداخت و تسویه بدون داده حالت خالی دارند', async () => {
    renderPage(<RefundsPage />);
    expect(await screen.findByText('بازپرداخت‌ها')).toBeTruthy();
    expect(await screen.findByText('بازپرداختی ثبت نشده است')).toBeTruthy();
    renderPage(<PayoutsPage />);
    expect(await screen.findByText('تسویه‌ها')).toBeTruthy();
    expect(await screen.findByText('تسویه‌ای ثبت نشده است')).toBeTruthy();
  });

  it('صفحات کوپن، اطلاعیه و پشتیبانی رندر می‌شوند', async () => {
    renderPage(<CouponsPage />);
    expect(await screen.findByText('کوپن‌های تخفیف')).toBeTruthy();
    renderPage(<AnnouncementsPage />);
    expect(await screen.findByText('اطلاعیه‌ها')).toBeTruthy();
    renderPage(<SupportPage />);
    expect(await screen.findByText('پشتیبانی')).toBeTruthy();
  });
});
