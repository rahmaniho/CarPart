import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../src/pages/LoginPage';
import { useSessionStore } from '../src/lib/session';

const requestOtp = vi.fn();
const verifyOtp = vi.fn();
const login = vi.fn();

vi.mock('../src/lib/api', () => ({
  api: {
    auth: {
      requestOtp: (...args: unknown[]) => requestOtp(...args),
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      login: (...args: unknown[]) => login(...args),
    },
  },
  apiTokens: { getAccess: () => null, setAccess: vi.fn() },
}));

function renderLogin(): void {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mechanic" element={<p>صفحه مکانیک</p>} />
        <Route path="/courier" element={<p>صفحه پیک</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('جریان ورود', () => {
  beforeEach(() => {
    useSessionStore.getState().clear();
    requestOtp.mockReset();
    verifyOtp.mockReset();
    login.mockReset();
  });

  it('درخواست کد، کد آزمایشی و مرحله OTP را نشان می‌دهد', async () => {
    requestOtp.mockResolvedValue({ sent: true, expiresIn: 120, devCode: '123456', simulated: true, notice: 'شبیه‌سازی' });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('09xxxxxxxxx'), { target: { value: '09121110001' } });
    fireEvent.click(screen.getByText('دریافت کد تأیید'));

    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    expect(requestOtp).toHaveBeenCalledWith('09121110001', 'login');
    expect(screen.getByText('تأیید و ورود')).toBeTruthy();
  });

  it('تأیید کد، نشست را ذخیره و به پنل مکانیک می‌برد', async () => {
    requestOtp.mockResolvedValue({ sent: true, expiresIn: 120, devCode: '123456', simulated: true });
    verifyOtp.mockResolvedValue({
      user: { id: 'u1', mobile: '09121110001', fullName: 'رضا محمدی', roles: ['mechanic'], permissions: [], isActive: true, city: 'تهران', email: null },
      accessToken: 'tok',
      accessExpiresIn: 900,
      requiresMobileVerification: false,
    });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('09xxxxxxxxx'), { target: { value: '09121110001' } });
    fireEvent.click(screen.getByText('دریافت کد تأیید'));
    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('کد تأیید'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('تأیید و ورود'));

    await waitFor(() => expect(screen.getByText('صفحه مکانیک')).toBeTruthy());
    expect(useSessionStore.getState().user?.roles).toContain('mechanic');
  });

  it('خطای API را با پیام فارسی نشان می‌دهد', async () => {
    const { ApiClientError } = await import('@carpart/api-client');
    requestOtp.mockRejectedValue(
      new ApiClientError(404, { statusCode: 404, code: 'NOT_FOUND', message: 'x', faMessage: 'حسابی با این شماره ثبت نشده است.', timestamp: '' }),
    );
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('09xxxxxxxxx'), { target: { value: '09120000099' } });
    fireEvent.click(screen.getByText('دریافت کد تأیید'));

    await waitFor(() => expect(screen.getByText('حسابی با این شماره ثبت نشده است.')).toBeTruthy());
  });

  it('پیک بدون نقش مکانیک به پنل پیک هدایت می‌شود', async () => {
    requestOtp.mockResolvedValue({ sent: true, expiresIn: 120, simulated: true });
    verifyOtp.mockResolvedValue({
      user: { id: 'u2', mobile: '09123330001', fullName: 'پیک نمونه', roles: ['courier'], permissions: [], isActive: true, city: 'تهران', email: null },
      accessToken: 'tok',
      accessExpiresIn: 900,
      requiresMobileVerification: false,
    });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('09xxxxxxxxx'), { target: { value: '09123330001' } });
    fireEvent.click(screen.getByText('دریافت کد تأیید'));
    await waitFor(() => expect(screen.getByText('تأیید و ورود')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('کد تأیید'), { target: { value: '999999' } });
    fireEvent.click(screen.getByText('تأیید و ورود'));

    await waitFor(() => expect(screen.getByText('صفحه پیک')).toBeTruthy());
  });
});
