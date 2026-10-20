import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../src/pages/LoginPage';
import { canUsePanel, isAdmin, useSessionStore } from '../src/lib/session';
import { compactMoney, toFaDigits } from '../src/lib/format';
import { StatusChip, StatCard } from '../src/components/ui';
import type { SessionUser } from '@carpart/api-client';

const login = vi.fn();
vi.mock('../src/lib/api', () => ({
  api: { auth: { login: (...args: unknown[]) => login(...args), logout: vi.fn() } },
  apiTokens: { getAccess: () => null, setAccess: vi.fn(), clear: vi.fn() },
}));

describe('پنل مدیریت — سطح دسترسی', () => {
  it('operator و admin اجازه ورود دارند؛ مکانیک نه', () => {
    const admin: SessionUser = { id: '1', roles: ['admin'], mobile: '09120000000', fullName: 'مدیر', permissions: [], isActive: true, city: null, email: null };
    const operator: SessionUser = { ...admin, id: '2', roles: ['operator'] };
    const mechanic: SessionUser = { ...admin, id: '3', roles: ['mechanic'] };
    expect(canUsePanel(admin)).toBe(true);
    expect(canUsePanel(operator)).toBe(true);
    expect(canUsePanel(mechanic)).toBe(false);
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(operator)).toBe(false);
  });
});

describe('پنل مدیریت — ورود', () => {
  beforeEach(() => {
    useSessionStore.getState().clear();
    login.mockReset();
  });

  it('ورود اپراتور موفق، به داشبورد می‌برد', async () => {
    login.mockResolvedValue({
      user: { id: 'u1', mobile: '09120000001', fullName: 'اپراتور پشتیبانی', roles: ['operator'], permissions: [], isActive: true, city: null, email: null },
      accessToken: 'tok',
      accessExpiresIn: 900,
      requiresMobileVerification: false,
    });
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>داشبورد</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const [mobileInput, passwordInput] = Array.from(container.querySelectorAll('input'));
    fireEvent.change(mobileInput, { target: { value: '09120000001' } });
    fireEvent.change(passwordInput, { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('ورود'));
    await waitFor(() => expect(screen.getByText('داشبورد')).toBeTruthy());
  });

  it('کاربر بدون نقش مدیریتی اجازه ورود ندارد و پیام فارسی می‌بیند', async () => {
    login.mockResolvedValue({
      user: { id: 'u2', mobile: '09121110001', fullName: 'مکانیک', roles: ['mechanic'], permissions: [], isActive: true, city: null, email: null },
      accessToken: 'tok',
      accessExpiresIn: 900,
      requiresMobileVerification: false,
    });
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>داشبورد</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const [mobileInput, passwordInput] = Array.from(container.querySelectorAll('input'));
    fireEvent.change(mobileInput, { target: { value: '09121110001' } });
    fireEvent.change(passwordInput, { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('ورود'));
    await waitFor(() => expect(screen.getByText(/دسترسی به پنل مدیریت ندارید/)).toBeTruthy());
  });
});

describe('اجزای پنل', () => {
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
