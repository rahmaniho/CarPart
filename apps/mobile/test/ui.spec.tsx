import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatusChip, OtpInput, EmptyState, ErrorBox } from '../src/components/ui';

describe('اجزای رابط کاربری', () => {
  it('وضعیت سفارش را با برچسب فارسی نشان می‌دهد', () => {
    render(<StatusChip status="WAITING_FOR_PAYMENT" />);
    expect(screen.getByText('در انتظار پرداخت')).toBeTruthy();
    render(<StatusChip status="DELIVERED" kind="delivery" />);
    expect(screen.getByText('تحویل شد')).toBeTruthy();
  });

  it('ورودی OTP فقط رقم می‌پذیرد و حداکثر ۶ رقم است', () => {
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);
    const input = screen.getByLabelText('کد تأیید');
    fireEvent.change(input, { target: { value: '12ab3456789' } });
    expect(onChange).toHaveBeenCalledWith('123456');
  });

  it('حالت خالی و خطا پیام فارسی و دکمه تلاش مجدد دارند', () => {
    render(
      <MemoryRouter>
        <EmptyState title="سفارشی نیست" hint="شروع کنید" />
        <ErrorBox message="خطا رخ داد" onRetry={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText('سفارشی نیست')).toBeTruthy();
    expect(screen.getByText('خطا رخ داد')).toBeTruthy();
    expect(screen.getByText('تلاش دوباره')).toBeTruthy();
  });
});
