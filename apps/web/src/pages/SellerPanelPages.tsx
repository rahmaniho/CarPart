import {
  ORDER_STATUS_META,
  PAYOUT_STATUS_META,
  QUALITY_GRADES,
  QUALITY_META,
  QUOTE_STATUS_META,
  REQUEST_STATUS_META,
  RETURN_STATUS_META,
  URGENCY_META,
  VERIFICATION_STATUS_META,
  formatJalali,
  formatToman,
  toPersianDigits,
  type OrderStatus,
  type Page,
  type QualityGrade,
} from '@carpart/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  FileSpreadsheet,
  KeyRound,
  LayoutDashboard,
  MessageSquareQuote,
  ShoppingBag,
  Store,
  Wallet,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PanelShell } from '../components/layout/AppLayout';
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
  Modal,
  StatCard,
  StatusFromMap,
} from '../components/ui/Primitives';
import { api } from '../lib/api-client';
import type {
  CategoryNode,
  OrderDetailDto,
  PartRequestDto,
  PayoutItemDto,
  ReturnRequestDto,
  TrackingDto,
} from '../lib/types';
import { useToastStore } from '../store/toast-store';

export function SellerPanelLayout() {
  return (
    <PanelShell
      roleBadge="پنل فروشنده قطعه"
      title="مدیریت فروشگاه و تأمین"
      subtitle="موجودی، پیشنهاد قیمت، آماده‌سازی سفارش و مالی"
      items={[
        { to: '/seller', label: 'داشبورد فروش', icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
        { to: '/seller/products', label: 'محصولات و انبار', icon: <Boxes className="h-4 w-4" /> },
        { to: '/seller/requests', label: 'استعلام‌ها و پیشنهاد قیمت', icon: <MessageSquareQuote className="h-4 w-4" /> },
        { to: '/seller/orders', label: 'سفارش‌ها و کد تحویل پیک', icon: <ShoppingBag className="h-4 w-4" /> },
        { to: '/seller/finance', label: 'کارمزد و تسویه‌ها', icon: <Wallet className="h-4 w-4" /> },
        { to: '/seller/profile', label: 'اطلاعات فروشگاه و شعبه‌ها', icon: <Store className="h-4 w-4" /> },
      ]}
    />
  );
}

/* ============================= ۱) داشبورد فروشنده ============================= */
interface SellerDashboardDto {
  seller: { id: string; storeName: string; verificationStatus: string; ratingAvg: number; ratingCount: number };
  products: { total: number; active: number; outOfStock: number; lowStock: number; stalePrice: number };
  branches: { total: number; openNow: number };
  quotes: { openRequests: number; submitted: number; accepted: number };
  orders: { waitingConfirmation: number; preparing: number; readyForPickup: number; completedToday: number; total: number };
  finance: { netRevenueTotal: number; platformCommissionTotal: number; pendingPayout: number };
}

export function SellerDashboardPage() {
  const dashQuery = useQuery({
    queryKey: ['seller-dashboard'],
    queryFn: () => api.get<SellerDashboardDto>('sellers/me/dashboard'),
  });

  if (dashQuery.isLoading) return <LoadingState />;
  if (dashQuery.error || !dashQuery.data) {
    return <ErrorAlert error={dashQuery.error} onRetry={() => dashQuery.refetch()} />;
  }

  const d = dashQuery.data;

  return (
    <div className="space-y-6">
      <div className="cp-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-slate-900">{d.seller.storeName}</h1>
            <StatusFromMap value={d.seller.verificationStatus} map={VERIFICATION_STATUS_META} size="xs" />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            امتیاز فروشگاه: {toPersianDigits(d.seller.ratingAvg.toFixed(1))} از ۵ • شعبه‌های فعال:{' '}
            {toPersianDigits(d.branches.openNow)} از {toPersianDigits(d.branches.total)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="در انتظار تأیید فروشنده"
          value={d.orders.waitingConfirmation}
          sub="سفارش‌های پرداخت‌شده جدید"
          tone="amber"
        />
        <StatCard
          label="در حال آماده‌سازی"
          value={d.orders.preparing}
          sub={`کل سفارش‌ها: ${toPersianDigits(d.orders.total)}`}
          tone="brand"
        />
        <StatCard
          label="کالاهای فعال فروشگاه"
          value={d.products.active}
          sub={`کم‌موجود: ${toPersianDigits(d.products.lowStock)} • ناموجود: ${toPersianDigits(d.products.outOfStock)}`}
        />
        <StatCard
          label="سهم خالص ثبت‌شده فروشنده"
          value={formatToman(d.finance.netRevenueTotal)}
          sub={`کارمزد کسرشده پلتفرم: ${formatToman(d.finance.platformCommissionTotal)}`}
          tone="emerald"
        />
      </div>
    </div>
  );
}

/* ============================= ۲) محصولات و موجودی انبار ============================= */
interface SellerProductItem {
  id: string;
  sku: string | null;
  price: number;
  listPrice: number | null;
  stock: number;
  reservedStock: number;
  quality: QualityGrade;
  preparationMinutes: number;
  isActive: boolean;
  part?: { id: string; nameFa: string; technicalCode?: string | null };
}

export function SellerProductsPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newNameFa, setNewNameFa] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newPrice, setNewPrice] = useState(550_000);
  const [newStock, setNewStock] = useState(10);
  const [newQuality, setNewQuality] = useState<QualityGrade>('oem');
  const [error, setError] = useState<unknown>(null);

  const [editItem, setEditItem] = useState<{ id: string; name: string; price: number; stock: number } | null>(null);

  const productsQuery = useQuery({
    queryKey: ['seller-products', search],
    queryFn: () => api.get<Page<SellerProductItem>>('sellers/me/products', { search: search || undefined, pageSize: 40 }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => api.get<CategoryNode[]>('catalog/categories'),
  });

  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const catId = newCategoryId || categoriesQuery.data?.[0]?.id;
    if (!catId) return;
    try {
      await api.post('sellers/me/products', {
        newPart: {
          nameFa: newNameFa,
          categoryId: catId,
        },
        price: newPrice,
        stock: newStock,
        quality: newQuality,
        preparationMinutes: 35,
      });
      setAddOpen(false);
      setNewNameFa('');
      await queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      pushToast({ tone: 'success', title: 'محصول جدید در انبار فروشگاه ثبت شد' });
    } catch (err) {
      setError(err);
    }
  };

  const handleQuickSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setError(null);
    try {
      await api.post(`sellers/me/products/${editItem.id}/price`, { price: editItem.price });
      await api.post(`sellers/me/products/${editItem.id}/stock`, {
        absoluteStock: editItem.stock,
        reason: 'restock',
        note: 'اصلاح از پنل فروشنده',
      });
      setEditItem(null);
      await queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      pushToast({ tone: 'success', title: 'قیمت و موجودی اتمیک به‌روزرسانی شد' });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="cp-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو در انبار فروشگاه..."
            className="cp-input text-xs w-60"
          />
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="cp-btn-primary text-xs">
          + افزودن قطعه و موجودی جدید
        </button>
      </div>

      <ErrorAlert error={error} />

      {productsQuery.isLoading ? (
        <LoadingState />
      ) : !productsQuery.data?.items.length ? (
        <EmptyState title="محصولی در فروشگاه یافت نشد" />
      ) : (
        <div className="space-y-2.5">
          {productsQuery.data.items.map((item) => (
            <div key={item.id} className="cp-card flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{item.part?.nameFa ?? 'قطعه'}</span>
                  <StatusFromMap value={item.quality} map={QUALITY_META} size="xs" />
                </div>
                <p className="text-slate-500">
                  قیمت واحد: <strong className="text-slate-900">{formatToman(item.price)}</strong> • موجودی کل:{' '}
                  <strong>{toPersianDigits(item.stock)}</strong> (رزروشده: {toPersianDigits(item.reservedStock)})
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEditItem({
                    id: item.id,
                    name: item.part?.nameFa ?? 'قطعه',
                    price: item.price,
                    stock: item.stock,
                  })
                }
                className="cp-btn-secondary text-xs"
              >
                اصلاح سریع قیمت / موجودی
              </button>
            </div>
          ))}
        </div>
      )}

      {/* پنجره افزودن محصول */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="افزودن محصول جدید به فروشگاه">
        <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
          <div>
            <label className="cp-label">نام فارسی قطعه</label>
            <input
              value={newNameFa}
              onChange={(e) => setNewNameFa(e.target.value)}
              className="cp-input"
              required
              minLength={2}
              placeholder="مثلاً: دیسک و صفحه پراید والئو"
            />
          </div>
          <div>
            <label className="cp-label">دسته‌بندی کاتالوگ</label>
            <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} className="cp-input">
              {categoriesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameFa}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="cp-label">قیمت (تومان صحیح)</label>
              <input
                type="number"
                min={1000}
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="cp-input"
                required
              />
            </div>
            <div>
              <label className="cp-label">موجودی اولیه</label>
              <input
                type="number"
                min={0}
                value={newStock}
                onChange={(e) => setNewStock(Number(e.target.value))}
                className="cp-input"
                required
              />
            </div>
            <div>
              <label className="cp-label">کیفیت</label>
              <select
                value={newQuality}
                onChange={(e) => setNewQuality(e.target.value as QualityGrade)}
                className="cp-input"
              >
                {QUALITY_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {QUALITY_META[g].fa}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="cp-btn-primary w-full">
            ثبت محصول در فروشگاه
          </button>
        </form>
      </Modal>

      {/* پنجره ویرایش سریع قیمت و موجودی */}
      <Modal
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        title={`به‌روزرسانی قیمت و موجودی — ${editItem?.name ?? ''}`}
      >
        {editItem && (
          <form onSubmit={handleQuickSave} className="space-y-3 text-xs">
            <div>
              <label className="cp-label">قیمت جدید (تومان صحیح)</label>
              <input
                type="number"
                min={0}
                value={editItem.price}
                onChange={(e) => setEditItem({ ...editItem, price: Number(e.target.value) })}
                className="cp-input"
                required
              />
            </div>
            <div>
              <label className="cp-label">موجودی جدید انبار (ثبت در دفتر حرکت موجودی)</label>
              <input
                type="number"
                min={0}
                value={editItem.stock}
                onChange={(e) => setEditItem({ ...editItem, stock: Number(e.target.value) })}
                className="cp-input"
                required
              />
            </div>
            <button type="submit" className="cp-btn-primary w-full">
              ذخیره تغییرات
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ============================= ۳) استعلام‌های باز و ارسال پیشنهاد قیمت ============================= */
interface SellerQuoteRow {
  id: string;
  status: string;
  total: number;
  preparationMinutes: number;
  requestTitle?: string | null;
  createdAt: string;
}

export function SellerRequestsPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);

  const [quoteModalReq, setQuoteModalReq] = useState<PartRequestDto | null>(null);
  const [unitPrice, setUnitPrice] = useState(750_000);
  const [prepMinutes, setPrepMinutes] = useState(35);
  const [quoteNote, setQuoteNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  const openReqsQuery = useQuery({
    queryKey: ['seller-open-requests'],
    queryFn: () => api.get<Page<PartRequestDto>>('seller/requests', { status: 'open' }),
  });

  const myQuotesQuery = useQuery({
    queryKey: ['seller-my-quotes'],
    queryFn: () => api.get<Page<SellerQuoteRow>>('seller/quotes'),
  });

  const handleSubmitQuote = async (e: FormEvent) => {
    e.preventDefault();
    if (!quoteModalReq) return;
    setError(null);
    try {
      await api.post(`seller/requests/${quoteModalReq.id}/quotes`, {
        items: [
          {
            nameFa: quoteModalReq.partNameFa,
            quantity: quoteModalReq.quantity,
            unitPrice,
            quality: quoteModalReq.qualityPreference ?? 'oem',
            isSubstitute: false,
          },
        ],
        preparationMinutes: prepMinutes,
        note: quoteNote.trim() || undefined,
      });
      setQuoteModalReq(null);
      setQuoteNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['seller-open-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['seller-my-quotes'] }),
      ]);
      pushToast({ tone: 'success', title: 'پیشنهاد قیمت شما برای تعمیرگاه ارسال شد' });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="space-y-6">
      <ErrorAlert error={error} />

      <div className="space-y-3">
        <h2 className="text-base font-extrabold text-slate-900">استعلام‌های باز تعمیرگاه‌ها در محدوده شما</h2>
        {openReqsQuery.isLoading ? (
          <LoadingState />
        ) : !openReqsQuery.data?.items.length ? (
          <EmptyState title="درخواست باز جدیدی در صف پاسخ‌دهی نیست" />
        ) : (
          <div className="space-y-3">
            {openReqsQuery.data.items.map((req) => (
              <div key={req.id} className="cp-card flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 ltr-num">{req.code}</span>
                    <span className="text-sm font-bold text-slate-900">{req.titleFa}</span>
                    <StatusFromMap value={req.status} map={REQUEST_STATUS_META} size="xs" />
                    <StatusFromMap value={req.urgency} map={URGENCY_META} size="xs" />
                  </div>
                  <p className="text-slate-500">
                    تعداد درخواستی: {toPersianDigits(req.quantity)} عدد {req.description ? `• ${req.description}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setQuoteModalReq(req)} className="cp-btn-primary text-xs">
                  ارسال پیشنهاد قیمت
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* پیشنهادهای ثبت‌شده قبلی */}
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900">پیشنهادهای ارسال‌شده فروشگاه من</h3>
        <div className="space-y-2">
          {myQuotesQuery.data?.items.map((q) => (
            <div key={q.id} className="cp-card flex flex-wrap items-center justify-between gap-2 p-3.5 text-xs">
              <div>
                <span className="font-bold text-slate-900">{q.requestTitle ?? 'درخواست تأمین'}</span>
                <p className="text-slate-500">
                  مبلغ کل پیشنهادی: {formatToman(q.total)} • آماده‌سازی: {toPersianDigits(q.preparationMinutes)} دقیقه
                </p>
              </div>
              <StatusFromMap value={q.status} map={QUOTE_STATUS_META} size="xs" />
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={Boolean(quoteModalReq)}
        onClose={() => setQuoteModalReq(null)}
        title={`ثبت پیشنهاد قیمت برای «${quoteModalReq?.titleFa ?? ''}»`}
      >
        <form onSubmit={handleSubmitQuote} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cp-label">قیمت هر واحد (تومان صحیح)</label>
              <input
                type="number"
                min={1000}
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="cp-input"
                required
              />
            </div>
            <div>
              <label className="cp-label">زمان آماده‌سازی تحویل (دقیقه)</label>
              <input
                type="number"
                min={5}
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(Number(e.target.value))}
                className="cp-input"
                required
              />
            </div>
          </div>
          <div>
            <label className="cp-label">توضیحات فنی / برند و گارانتی قطعه</label>
            <textarea
              rows={2}
              value={quoteNote}
              onChange={(e) => setQuoteNote(e.target.value)}
              placeholder="مثلاً: قطعه اصلی شرکتی موجود در انبار مرکزی با ضمانت سلامت..."
              className="cp-input"
            />
          </div>
          <button type="submit" className="cp-btn-primary w-full">
            ثبت و ارسال پیشنهاد به مکانیک
          </button>
        </form>
      </Modal>
    </div>
  );
}

/* ============================= ۴) سفارش‌های فروشنده + کد تحویل به پیک + مرجوعی ============================= */
export function SellerOrdersPage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const [pickupInfo, setPickupInfo] = useState<TrackingDto | null>(null);
  const [error, setError] = useState<unknown>(null);

  const ordersQuery = useQuery({
    queryKey: ['seller-orders'],
    queryFn: () => api.get<Page<OrderDetailDto>>('seller/orders', { pageSize: 30 }),
    refetchInterval: 10_000,
  });

  const returnsQuery = useQuery({
    queryKey: ['seller-returns'],
    queryFn: () => api.get<Page<ReturnRequestDto>>('seller/returns'),
  });

  const handleSellerTransition = async (orderId: string, to: OrderStatus) => {
    setError(null);
    try {
      await api.post(`seller/orders/${orderId}/transition`, { to });
      await queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['seller-dashboard'] });
      pushToast({ tone: 'success', title: 'وضعیت آماده‌سازی سفارش به‌روزرسانی شد' });
    } catch (err) {
      setError(err);
    }
  };

  const handleShowPickupCode = async (orderId: string) => {
    setError(null);
    try {
      const info = await api.get<TrackingDto>(`seller/deliveries/${orderId}`);
      setPickupInfo(info);
    } catch (err) {
      setError(err);
    }
  };

  const handleReturnDecision = async (returnId: string, decision: 'APPROVED' | 'REJECTED') => {
    await api.post(`seller/returns/${returnId}/respond`, {
      decision,
      note: decision === 'APPROVED' ? 'مورد تأیید فروشگاه جهت تعویض/مرجوعی است' : 'طبق شرایط گارانتی رد شد',
    });
    await queryClient.invalidateQueries({ queryKey: ['seller-returns'] });
    pushToast({ tone: 'info', title: 'پاسخ فروشگاه به درخواست مرجوعی ثبت شد' });
  };

  return (
    <div className="space-y-6">
      <ErrorAlert error={error} />

      <div className="space-y-3">
        <h2 className="text-base font-extrabold text-slate-900">سفارش‌های ورودی فروشگاه</h2>
        {ordersQuery.isLoading ? (
          <LoadingState />
        ) : !ordersQuery.data?.items.length ? (
          <EmptyState title="سفارشی برای فروشگاه شما ثبت نشده است" />
        ) : (
          <div className="space-y-3">
            {ordersQuery.data.items.map((ord) => (
              <div key={ord.id} className="cp-card flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-slate-900 ltr-num">{ord.code}</span>
                    <StatusFromMap value={ord.status} map={ORDER_STATUS_META} size="xs" />
                  </div>
                  <p className="text-slate-500">
                    جمع اقلام: <strong>{formatToman(ord.itemsSubtotal)}</strong> • {formatJalali(ord.createdAt, { withTime: true })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {ord.status === 'PAID' && (
                    <button
                      type="button"
                      onClick={() => handleSellerTransition(ord.id, 'SELLER_CONFIRMED')}
                      className="cp-btn-primary text-xs"
                    >
                      تأیید سفارش
                    </button>
                  )}
                  {ord.status === 'SELLER_CONFIRMED' && (
                    <button
                      type="button"
                      onClick={() => handleSellerTransition(ord.id, 'PREPARING')}
                      className="cp-btn-primary text-xs"
                    >
                      شروع بسته‌بندی
                    </button>
                  )}
                  {ord.status === 'PREPARING' && (
                    <button
                      type="button"
                      onClick={() => handleSellerTransition(ord.id, 'READY_FOR_PICKUP')}
                      className="cp-btn-accent text-xs"
                    >
                      آماده تحویل به پیک
                    </button>
                  )}
                  {['WAITING_FOR_COURIER', 'COURIER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(ord.status) && (
                    <button
                      type="button"
                      onClick={() => handleShowPickupCode(ord.id)}
                      className="cp-btn-secondary text-xs"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-brand-700" />
                      مشاهده کد تحویل به پیک
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* درخواست‌های مرجوعی خریداران */}
      {returnsQuery.data && returnsQuery.data.items.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">پرونده‌های مرجوعی خریداران</h3>
          {returnsQuery.data.items.map((ret) => (
            <div key={ret.id} className="cp-card flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">علت: {ret.reason}</span>
                  <StatusFromMap value={ret.status} map={RETURN_STATUS_META} size="xs" />
                </div>
                {ret.description && <p className="mt-1 text-slate-600">{ret.description}</p>}
              </div>
              {ret.status === 'REQUESTED' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleReturnDecision(ret.id, 'APPROVED')}
                    className="cp-btn-primary text-xs py-1.5"
                  >
                    پذیرش مرجوعی
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReturnDecision(ret.id, 'REJECTED')}
                    className="cp-btn-danger text-xs py-1.5"
                  >
                    رد با توضیح
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* پنجره نمایش کد تحویل مرسوله به پیک */}
      <Modal
        open={Boolean(pickupInfo)}
        onClose={() => setPickupInfo(null)}
        title="کد تحویل مرسوله به پیک (Pickup Code)"
      >
        {pickupInfo && (
          <div className="space-y-4 text-xs">
            {pickupInfo.pickupCode ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center space-y-2">
                <p className="text-slate-600">هنگام تحویل بسته به پیک، این کد را برای ثبت در برنامه پیک اعلام کنید:</p>
                <p className="font-mono text-2xl font-extrabold tracking-widest text-brand-900 ltr-num">
                  {pickupInfo.pickupCode}
                </p>
              </div>
            ) : (
              <p className="text-slate-600">مأموریت ارسال در حال تخصیص به نزدیک‌ترین پیک آنلاین است.</p>
            )}
            <p className="text-slate-500">
              وضعیت پیک: {pickupInfo.courier ? `${pickupInfo.courier.name}` : 'در انتظار پذیرش پیک'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================= ۵) مالی و تسویه فروشنده ============================= */
export function SellerFinancePage() {
  const pushToast = useToastStore((s) => s.push);
  const [bankName, setBankName] = useState('ملت');
  const [ownerName, setOwnerName] = useState('');
  const [iban, setIban] = useState('IR062960000000100324200001');
  const [error, setError] = useState<unknown>(null);

  const rateQuery = useQuery({
    queryKey: ['seller-commission-rate'],
    queryFn: () =>
      api.get<{ effectiveRatePercent: number; isCustomRate: boolean; note: string }>('seller/finance/commission-rate'),
  });

  const payoutsQuery = useQuery({
    queryKey: ['seller-payouts'],
    queryFn: () => api.get<Page<PayoutItemDto>>('seller/finance/payouts'),
  });

  const handleSavePayout = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.put('sellers/me/payout-info', { bankName, ownerName, iban });
      pushToast({ tone: 'success', title: 'اطلاعات شبا به‌صورت رمزنگاری‌شده در سرور ذخیره شد' });
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="space-y-6">
      {rateQuery.data && (
        <div className="cp-card p-5 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-brand-700" />
            <h2 className="text-sm font-extrabold text-slate-900">
              نرخ کارمزد مؤثر فروشگاه شما: {toPersianDigits(rateQuery.data.effectiveRatePercent)}٪
            </h2>
          </div>
          <p className="text-slate-600">{rateQuery.data.note}</p>
        </div>
      )}

      <ErrorAlert error={error} />

      <form onSubmit={handleSavePayout} className="cp-card p-5 space-y-3 text-xs">
        <h3 className="text-sm font-extrabold text-slate-900">حساب شبا جهت تسویه دوره‌ای (نگهداری رمزنگاری‌شده AES-GCM)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="cp-label">نام بانک</label>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="cp-input" required />
          </div>
          <div>
            <label className="cp-label">نام صاحب حساب</label>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="نام قانونی صاحب حساب"
              className="cp-input"
              required
            />
          </div>
          <div>
            <label className="cp-label">شماره شبا (IR + ۲۴ رقم)</label>
            <input value={iban} onChange={(e) => setIban(e.target.value)} className="cp-input ltr-num" required />
          </div>
        </div>
        <button type="submit" className="cp-btn-primary">
          ذخیره امن اطلاعات تسویه
        </button>
      </form>

      <div className="cp-card p-5 space-y-3 text-xs">
        <h3 className="text-sm font-extrabold text-slate-900">تاریخچه تسویه‌حساب‌ها</h3>
        {!payoutsQuery.data?.items.length ? (
          <p className="text-slate-500">هنوز تسویه ثبت‌شده‌ای وجود ندارد.</p>
        ) : (
          payoutsQuery.data.items.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-slate-100 py-2.5">
              <span>مبلغ خالص واریزی: {formatToman(p.netAmount)}</span>
              <StatusFromMap value={p.status} map={PAYOUT_STATUS_META} size="xs" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================= ۶) پروفایل و شعبه‌های فروشگاه ============================= */
interface SellerBranchItem {
  id: string;
  name: string;
  city: string | null;
  addressText: string | null;
  prepTimeMinutes: number;
  serviceRadiusKm: number;
  isOpenNow: boolean;
}

export function SellerProfilePage() {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');

  const meQuery = useQuery({
    queryKey: ['seller-me'],
    queryFn: () =>
      api.get<{ storeName: string; city: string | null; verificationStatus: string; description: string | null }>(
        'sellers/me',
      ),
  });

  const branchesQuery = useQuery({
    queryKey: ['seller-branches'],
    queryFn: () => api.get<SellerBranchItem[]>('sellers/me/branches'),
  });

  const handleAddBranch = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('sellers/me/branches', {
      name: branchName,
      city: meQuery.data?.city ?? 'تهران',
      addressText: branchAddress,
      lat: 35.72,
      lng: 51.42,
      prepTimeMinutes: 35,
      serviceRadiusKm: 18,
    });
    setBranchName('');
    setBranchAddress('');
    await queryClient.invalidateQueries({ queryKey: ['seller-branches'] });
    pushToast({ tone: 'success', title: 'شعبه جدید ثبت شد' });
  };

  return (
    <div className="space-y-6">
      {meQuery.data && (
        <div className="cp-card p-5 flex items-center justify-between text-xs">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{meQuery.data.storeName}</h2>
            <p className="mt-1 text-slate-500">{meQuery.data.description}</p>
          </div>
          <StatusFromMap value={meQuery.data.verificationStatus} map={VERIFICATION_STATUS_META} />
        </div>
      )}

      <div className="cp-card p-5 space-y-4 text-xs">
        <h3 className="text-sm font-extrabold text-slate-900">شعبه‌ها و نقاط بارگیری پیک</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {branchesQuery.data?.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 p-3.5 space-y-1">
              <p className="font-bold text-slate-900">{b.name}</p>
              <p className="text-slate-500">{b.addressText}</p>
              <p className="text-slate-400">
                آماده‌سازی پایه: {toPersianDigits(b.prepTimeMinutes)} دقیقه • شعاع پوشش:{' '}
                {toPersianDigits(b.serviceRadiusKm)} کیلومتر
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddBranch} className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="نام شعبه جدید"
            className="cp-input"
            required
            minLength={3}
          />
          <input
            value={branchAddress}
            onChange={(e) => setBranchAddress(e.target.value)}
            placeholder="نشانی دقیق شعبه"
            className="cp-input"
            required
          />
          <button type="submit" className="cp-btn-primary">
            + ثبت شعبه
          </button>
        </form>
      </div>
    </div>
  );
}
