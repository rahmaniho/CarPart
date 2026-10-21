import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '../src/pages/public/AuthPages';
import { canUsePanel, canUseSeller, isAdmin, useSessionStore } from '../src/lib/session';
import { compactMoney, toFaDigits } from '../src/lib/format';
import { StatusChip, StatCard } from '../src/components/ui';
import type { SessionUser } from '@carpart/api-client';

const login = vi.fn();
vi.mock('../src/lib/api', () => ({
  isStaticLanding: false,
  api: { auth: { login: (...args: unknown[]) => login(...args), logout: vi.fn() } },
  apiTokens: { getAccess: () => null, setAccess: vi.fn(), clear: vi.fn() },
}));

describe('پنل‌ها — سطح دسترسی', () => {
  it('admin و operator به پنل مدیریت؛ seller به پنل فروشنده', () => {
    const base: SessionUser = { id: '1', roles: ['admin'], mobile: '09120000000', fullName: 'مدیر', permissions: [], isActive: true, city: null, email: null };
    expect(canUsePanel({ ...base, roles: ['admin'] })).toBe(true);
    expect(canUsePanel({ ...base, roles: ['operator'] })).toBe(true);
    expect(canUsePanel({ ...base, roles: ['mechanic'] })).toBe(false);
    expect(canUseSeller({ ...base, roles: ['seller'] })).toBe(true);
    expect(canUseSeller({ ...base, roles: ['mechanic'] })).toBe(false);
    expect(isAdmin({ ...base, roles: ['admin'] })).toBe(true);
    expect(isAdmin({ ...base, roles: ['operator'] })).toBe(false);
  });
});

describe('ورود عمومی — هدایت بر اساس نقش', () => {
  beforeEach(() => {
    useSessionStore.getState().clear();
    login.mockReset();
  });

  it('اپراتور به پنل مدیریت هدایت می‌شود', async () => {
    login.mockResolvedValue({
      user: { id: 'u1', mobile: '09120000001', fullName: 'اپراتور', roles: ['operator'], permissions: [], isActive: true, city: null, email: null },
      accessToken: 'tok',
      accessExpiresIn: 900,
      requiresMobileVerification: false,
    });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<p>داشبورد مدیریت</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09120000001' } });
    fireEvent.change(screen.getByLabelText('رمز عبور'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));
    await waitFor(() => expect(screen.getByText('داشبورد مدیریت')).toBeTruthy());
  });

  it('فروشنده به پنل فروشنده هدایت می‌شود', async () => {
    login.mockResolvedValue({
      user: { id: 'u2', mobile: '09122220001', fullName: 'فروشنده', roles: ['seller'], permissions: [], isActive: true, city: 'تهران', email: null },
      accessToken: 'tok',
      accessExpiresIn: 900,
      requiresMobileVerification: false,
    });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/seller" element={<p>پنل فروشنده</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09122220001' } });
    fireEvent.change(screen.getByLabelText('رمز عبور'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));
    await waitFor(() => expect(screen.getByText('پنل فروشنده')).toBeTruthy());
  });

  it('مکانیک به صفحه عمومی هدایت می‌شود', async () => {
    login.mockResolvedValue({
      user: { id: 'u3', mobile: '09121110001', fullName: 'مکانیک', roles: ['mechanic'], permissions: [], isActive: true, city: 'تهران', email: null },
      accessToken: 'tok',
      accessExpiresIn: 900,
      requiresMobileVerification: false,
    });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>صفحه خانگی</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09121110001' } });
    fireEvent.change(screen.getByLabelText('رمز عبور'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));
    await waitFor(() => expect(screen.getByText('صفحه خانگی')).toBeTruthy());
  });
});

describe('اجزای مشترک', () => {
  it('وضعیت‌ها برچسب فارسی و کارت آمار مقدار درست نشان می‌دهند', () => {
    render(
      <>
        <StatusChip status="PAID" />
        <StatusChip status="OFFERED" kind="delivery" />
        <StatCard label="کل کاربران" value={toFaDigits(12)} />
      </>,
    );
    expect(screen.getByText('پرداخت شده')).toBeTruthy();
    expect(screen.getByText('به پیک پیشنهاد شد')).toBeTruthy();
    expect(screen.getByText('۱۲')).toBeTruthy();
  });

  it('پول فشرده فارسی است', () => {
    expect(compactMoney(7_100_000)).toContain('میلیون');
    expect(compactMoney(250_000)).toContain('هزار');
  });
});
