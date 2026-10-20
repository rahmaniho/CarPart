import {
  NOTIFICATION_CHANNEL_META,
  RETURN_STATUS_META,
  ROLE_LABELS_FA,
  TICKET_STATUS_META,
  formatJalali,
  toPersianDigits,
  type Page,
} from '@carpart/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, HeadphonesIcon, KeyRound, Laptop, Send, Shield } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { EmptyState, ErrorAlert, LoadingState, Modal, StatusBadge, StatusFromMap } from '../components/ui/Primitives';
import { api } from '../lib/api-client';
import type { NotificationDto, ReturnRequestDto, TicketDto } from '../lib/types';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';

/* =============================== مرکز اعلان‌ها =============================== */
export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const listQuery = useQuery({
    queryKey: ['my-notifications', unreadOnly],
    queryFn: () => api.get<Page<NotificationDto>>('notifications', { unreadOnly: unreadOnly ? 'true' : undefined }),
  });

  const handleMarkRead = async (id: string) => {
    await api.post(`notifications/${id}/read`);
    await queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const handleMarkAllRead = async () => {
    await api.post('notifications/read-all');
    await queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="cp-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2.5">
          <Bell className="h-5 w-5 text-brand-700" />
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">صندوق اعلان‌های من</h1>
            <p className="text-xs text-slate-500">
              اعلان‌های درون‌برنامه‌ای واقعی و پیامک‌های شبیه‌سازی‌شده (با برچسب شفاف آزمایشی)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            فقط خوانده‌نشده
          </label>
          <button type="button" onClick={handleMarkAllRead} className="cp-btn-secondary text-xs">
            <CheckCheck className="h-4 w-4" />
            خواندن همه
          </button>
        </div>
      </div>

      {listQuery.isLoading ? (
        <LoadingState />
      ) : listQuery.error ? (
        <ErrorAlert error={listQuery.error} onRetry={() => listQuery.refetch()} />
      ) : !listQuery.data?.items.length ? (
        <EmptyState title="اعلانی در این نما وجود ندارد" />
      ) : (
        <div className="space-y-2.5">
          {listQuery.data.items.map((item) => (
            <div
              key={item.id}
              className={`cp-card p-4 transition ${!item.readAt ? 'border-brand-300 bg-brand-50/20' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusFromMap value={item.channel} map={NOTIFICATION_CHANNEL_META} size="xs" />
                    {item.isSimulated && <StatusBadge tone="warning" label="ارسال آزمایشی (Mock)" size="xs" />}
                    {!item.readAt && <StatusBadge tone="info" label="جدید" size="xs" />}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{item.titleFa}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.bodyFa}</p>
                </div>

                <div className="flex flex-col items-end gap-2 text-xs">
                  <span className="text-[11px] text-slate-400">{formatJalali(item.createdAt, { withTime: true })}</span>
                  {!item.readAt && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(item.id)}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      علامت خوانده‌شده
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================== مرکز پشتیبانی و مرجوعی =========================== */
export function SupportCenterPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const [tab, setTab] = useState<'tickets' | 'returns'>('tickets');
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('order');
  const [priority, setPriority] = useState('normal');
  const [body, setBody] = useState('');
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState<unknown>(null);

  const ticketsQuery = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api.get<Page<TicketDto>>('tickets'),
  });

  const ticketDetailQuery = useQuery({
    queryKey: ['ticket-detail', activeTicketId],
    queryFn: () => api.get<TicketDto>(`tickets/${activeTicketId}`),
    enabled: Boolean(activeTicketId),
  });

  const returnsQuery = useQuery({
    queryKey: ['my-returns'],
    queryFn: () => api.get<Page<ReturnRequestDto>>('returns'),
  });

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('tickets', { subject, category, priority, body });
      setSubject('');
      setBody('');
      setNewTicketOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      pushToast({ tone: 'success', title: 'تیکت پشتیبانی با موفقیت ثبت شد' });
    } catch (err) {
      setError(err);
    }
  };

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeTicketId || !replyText.trim()) return;
    try {
      await api.post(`tickets/${activeTicketId}/replies`, { body: replyText.trim() });
      setReplyText('');
      await queryClient.invalidateQueries({ queryKey: ['ticket-detail', activeTicketId] });
      await queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="cp-card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2.5">
          <HeadphonesIcon className="h-5 w-5 text-brand-700" />
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">پشتیبانی و پیگیری مرجوعی</h1>
            <p className="text-xs text-slate-500">ثبت تیکت مستقیم برای اپراتورها و پیگیری پرونده‌های مغایرت قطعه</p>
          </div>
        </div>

        <button type="button" onClick={() => setNewTicketOpen(true)} className="cp-btn-primary text-xs">
          + ثبت تیکت پشتیبانی جدید
        </button>
      </div>

      <ErrorAlert error={error} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('tickets')}
          className={tab === 'tickets' ? 'cp-btn-primary text-xs' : 'cp-btn-secondary text-xs'}
        >
          تیکت‌های پشتیبانی ({toPersianDigits(ticketsQuery.data?.meta.total ?? 0)})
        </button>
        <button
          type="button"
          onClick={() => setTab('returns')}
          className={tab === 'returns' ? 'cp-btn-primary text-xs' : 'cp-btn-secondary text-xs'}
        >
          درخواست‌های مرجوعی ({toPersianDigits(returnsQuery.data?.meta.total ?? 0)})
        </button>
      </div>

      {tab === 'tickets' ? (
        !ticketsQuery.data?.items.length ? (
          <EmptyState title="هنوز تیکت پشتیبانی ثبت نکرده‌اید" />
        ) : (
          <div className="space-y-2.5">
            {ticketsQuery.data.items.map((t) => (
              <div key={t.id} className="cp-card flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-500 ltr-num">{t.code}</span>
                    <StatusFromMap value={t.status} map={TICKET_STATUS_META} size="xs" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{t.subject}</p>
                  <p className="text-slate-400">{formatJalali(t.createdAt, { withTime: true })}</p>
                </div>
                <button type="button" onClick={() => setActiveTicketId(t.id)} className="cp-btn-secondary text-xs">
                  مشاهده گفت‌وگو و پاسخ
                </button>
              </div>
            ))}
          </div>
        )
      ) : !returnsQuery.data?.items.length ? (
        <EmptyState
          title="درخواست مرجوعی ثبت‌شده‌ای ندارید"
          description="از صفحه جزئیات سفارش‌های تحویل‌شده می‌توانید مغایرت قطعه یا درخواست مرجوعی ثبت کنید."
        />
      ) : (
        <div className="space-y-2.5">
          {returnsQuery.data.items.map((ret) => (
            <div key={ret.id} className="cp-card p-4 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  علت: {ret.reason} — تعداد: {toPersianDigits(ret.quantity)}
                </span>
                <StatusFromMap value={ret.status} map={RETURN_STATUS_META} size="xs" />
              </div>
              {ret.description && <p className="text-slate-600">{ret.description}</p>}
              {ret.sellerNote && <p className="text-brand-800">پاسخ فروشنده: {ret.sellerNote}</p>}
              {ret.resolutionNote && <p className="text-emerald-800">نتیجه داوری پشتیبانی: {ret.resolutionNote}</p>}
            </div>
          ))}
        </div>
      )}

      {/* پنجره ثبت تیکت */}
      <Modal open={newTicketOpen} onClose={() => setNewTicketOpen(false)} title="ثبت تیکت پشتیبانی جدید">
        <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
          <div>
            <label className="cp-label">موضوع تیکت (حداقل ۵ نویسه)</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="cp-input"
              required
              minLength={5}
              placeholder="مثلاً: پیگیری تأخیر ارسال سفارش"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cp-label">دسته‌بندی موضوع</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="cp-input">
                <option value="order">سفارش</option>
                <option value="delivery">ارسال و پیک</option>
                <option value="part_mismatch">مغایرت فنی قطعه</option>
                <option value="payment">پرداخت و تسویه</option>
                <option value="technical">فنی سامانه</option>
                <option value="general">عمومی</option>
              </select>
            </div>
            <div>
              <label className="cp-label">اولویت</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="cp-input">
                <option value="normal">عادی</option>
                <option value="high">فوری</option>
                <option value="critical">بحرانی</option>
              </select>
            </div>
          </div>
          <div>
            <label className="cp-label">شرح کامل درخواست (حداقل ۱۰ نویسه)</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="cp-input"
              required
              minLength={10}
            />
          </div>
          <button type="submit" className="cp-btn-primary w-full">
            ارسال تیکت به پشتیبانی
          </button>
        </form>
      </Modal>

      {/* پنجره مشاهده گفت‌وگوی تیکت */}
      <Modal
        open={Boolean(activeTicketId)}
        onClose={() => setActiveTicketId(null)}
        title={ticketDetailQuery.data ? `گفت‌وگوی تیکت — ${ticketDetailQuery.data.subject}` : 'جزئیات تیکت'}
        maxWidth="max-w-xl"
      >
        {ticketDetailQuery.isLoading ? (
          <LoadingState />
        ) : ticketDetailQuery.data ? (
          <div className="space-y-4 text-xs">
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {ticketDetailQuery.data.messages?.map((msg) => (
                <div key={msg.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span className="font-bold text-slate-700">نقش فرستنده: {msg.senderRole}</span>
                    <span>{formatJalali(msg.createdAt, { withTime: true })}</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed">{msg.body}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendReply} className="flex gap-2 border-t border-slate-100 pt-3">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="پاسخ جدید خود را بنویسید..."
                className="cp-input"
                required
              />
              <button type="submit" className="cp-btn-primary shrink-0">
                <Send className="h-4 w-4" />
                ارسال
              </button>
            </form>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* =========================== حساب کاربری و نشست‌های فعال =========================== */
interface SessionItem {
  id: string;
  ip: string | null;
  deviceInfo: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export function AccountSecurityPage() {
  const { user, reloadMe } = useAuthStore();
  const pushToast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<unknown>(null);

  const sessionsQuery = useQuery({
    queryKey: ['my-sessions'],
    queryFn: () => api.get<SessionItem[]>('users/me/sessions'),
  });

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.patch('users/me', { fullName, city: city || undefined });
      await reloadMe();
      pushToast({ tone: 'success', title: 'اطلاعات نمایه کاربری ذخیره شد' });
    } catch (err) {
      setError(err);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('users/me/password', {
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      pushToast({ tone: 'success', title: 'رمز عبور با موفقیت به‌روزرسانی شد' });
    } catch (err) {
      setError(err);
    }
  };

  const handleRevokeSession = async (id: string) => {
    await api.del(`users/me/sessions/${id}`);
    await queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    pushToast({ tone: 'info', title: 'نشست انتخاب‌شده باطل شد' });
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="cp-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-brand-700" />
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">{user.fullName}</h1>
            <p className="text-xs text-slate-500">
              موبایل: <span className="ltr-num font-mono">{user.mobile}</span> • نقش‌ها:{' '}
              {user.roles.map((r) => ROLE_LABELS_FA[r]).join('، ')}
            </p>
          </div>
        </div>
      </div>

      <ErrorAlert error={error} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <form onSubmit={handleSaveProfile} className="cp-card p-5 space-y-3 text-xs">
          <h2 className="text-sm font-extrabold text-slate-900">ویرایش مشخصات پایه</h2>
          <div>
            <label className="cp-label">نام و نام خانوادگی</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="cp-input" required />
          </div>
          <div>
            <label className="cp-label">شهر</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="cp-input" />
          </div>
          <button type="submit" className="cp-btn-primary">
            ذخیره تغییرات
          </button>
        </form>

        <form onSubmit={handleChangePassword} className="cp-card p-5 space-y-3 text-xs">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
            <KeyRound className="h-4 w-4 text-brand-700" />
            تغییر یا تعیین رمز عبور
          </h2>
          <div>
            <label className="cp-label">رمز عبور فعلی (در صورت داشتن رمز قبلی)</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="cp-input ltr-num"
            />
          </div>
          <div>
            <label className="cp-label">رمز عبور جدید (حداقل ۸ نویسه شامل حرف و رقم)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="cp-input ltr-num"
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="cp-btn-primary">
            به‌روزرسانی رمز عبور
          </button>
        </form>
      </div>

      <div className="cp-card p-5 space-y-3 text-xs">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
          <Laptop className="h-4 w-4 text-brand-700" />
          نشست‌های فعال امنیتی
        </h2>
        <div className="divide-y divide-slate-100">
          {sessionsQuery.data?.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="font-semibold text-slate-800">{s.deviceInfo || 'مرورگر وب'}</p>
                <p className="text-[11px] text-slate-400">
                  ایجاد: {formatJalali(s.createdAt, { withTime: true })} {s.ip ? `• IP: ${s.ip}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRevokeSession(s.id)}
                className="cp-btn-danger text-xs py-1 px-2.5"
              >
                ابطال نشست
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
