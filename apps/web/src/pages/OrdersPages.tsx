import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OrderRow } from '@carpart/api-client';
import { api } from '../lib/api';
import { dateFa, formatToman, toFaDigits } from '../lib/format';
import { DataTable, ErrorBox, PageHeader, Spinner, StatusChip } from '../components/ui';

export default function OrdersAdminPage(): JSX.Element {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const orders = useQuery({ queryKey: ['admin-orders', status], queryFn: () => api.admin.orders({ status: status || undefined, pageSize: 50 }) });
  const detail = useQuery({
    queryKey: ['admin-order', selected?.id],
    queryFn: () => api.orders.detail(selected!.id as string),
    enabled: Boolean(selected),
  });

  return (
    <>
      <PageHeader title="سفارش‌ها" subtitle="مشاهده همه سفارش‌ها با جزئیات مالی و تاریخچه وضعیت" />
      <div className="flex gap-2">
        <select className="cp-field max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          <option value="WAITING_FOR_PAYMENT">در انتظار پرداخت</option>
          <option value="PAID">پرداخت‌شده</option>
          <option value="PREPARING">در حال آماده‌سازی</option>
          <option value="IN_TRANSIT">در حال ارسال</option>
          <option value="DELIVERED">تحویل شد</option>
          <option value="COMPLETED">تکمیل شد</option>
          <option value="CANCELLED">لغو شد</option>
        </select>
      </div>
      {orders.isError ? <ErrorBox message="دریافت سفارش‌ها ممکن نشد" onRetry={() => orders.refetch()} /> : null}
      {orders.isLoading ? <Spinner /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataTable headers={['کد سفارش', 'وضعیت', 'مبلغ قابل پرداخت', 'تاریخ ثبت']}>
          {(orders.data?.items ?? []).map((order) => (
            <tr key={order.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(order)}>
              <td dir="ltr" className="text-xs font-semibold">
                {order.code}
              </td>
              <td>
                <StatusChip status={order.status} />
              </td>
              <td className="tabular-nums">{formatToman(order.payableTotal)}</td>
              <td className="text-xs text-muted">{dateFa(order.createdAt, false)}</td>
            </tr>
          ))}
          {orders.data?.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center text-xs text-muted">
                سفارشی یافت نشد
              </td>
            </tr>
          ) : null}
        </DataTable>

        <div className="cp-card">
          {!selected ? <p className="text-sm text-muted">برای مشاهده جزئیات، یک سفارش را انتخاب کنید.</p> : null}
          {selected && detail.isLoading ? <Spinner /> : null}
          {selected && detail.data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <b dir="ltr">{detail.data.code}</b>
                <StatusChip status={detail.data.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-2">
                  مبلغ اقلام:
                  <b className="mr-1 tabular-nums">{formatToman(detail.data.itemsSubtotal)}</b>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  هزینه ارسال:
                  <b className="mr-1 tabular-nums">{formatToman(detail.data.deliveryFee)}</b>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  تخفیف:
                  <b className="mr-1 tabular-nums">{formatToman(detail.data.discountTotal)}</b>
                </div>
                <div className="rounded-xl bg-primary-soft p-2">
                  قابل پرداخت:
                  <b className="mr-1 tabular-nums">{formatToman(detail.data.payableTotal)}</b>
                </div>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-bold text-muted">اقلام ({toFaDigits(detail.data.items.length)})</h3>
                <ul className="space-y-1 text-xs">
                  {detail.data.items.map((item) => (
                    <li key={item.id} className="flex justify-between rounded-lg bg-slate-50 px-2 py-1.5">
                      <span>
                        {item.partNameFa ?? 'قطعه'} × {toFaDigits(item.quantity)}
                      </span>
                      <b className="tabular-nums">{formatToman(item.lineTotal)}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-bold text-muted">تاریخچه</h3>
                <OrderEvents orderId={detail.data.id} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function OrderEvents({ orderId }: { orderId: string }): JSX.Element {
  const events = useQuery({ queryKey: ['order-events', orderId], queryFn: () => api.orders.events(orderId) });
  if (events.isLoading) return <Spinner />;
  return (
    <ul className="space-y-1.5 text-xs">
      {(events.data ?? []).map((event) => (
        <li key={String(event.id)} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          <span>{String(event.fa ?? event.toStatus)}</span>
          <span className="text-muted">— {dateFa(String(event.createdAt))}</span>
        </li>
      ))}
    </ul>
  );
}

export function DeliveriesAdminPage(): JSX.Element {
  const deliveries = useQuery({ queryKey: ['admin-deliveries'], queryFn: () => api.admin.deliveries({ pageSize: 30 }) });
  const stats = useQuery({ queryKey: ['admin-delivery-stats'], queryFn: () => api.admin.deliveryStatistics() });

  return (
    <>
      <PageHeader title="مأموریت‌های ارسال" subtitle="نظارت بر تخصیص پیک و وضعیت مأموریت‌ها" />
      {stats.data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="cp-card">
            <p className="text-xs text-muted">کل مأموریت‌ها</p>
            <b className="text-xl">{toFaDigits(String(stats.data.total ?? 0))}</b>
          </div>
          <div className="cp-card">
            <p className="text-xs text-muted">تحویل‌شده</p>
            <b className="text-xl text-emerald-700">{toFaDigits(String(stats.data.delivered ?? 0))}</b>
          </div>
          <div className="cp-card">
            <p className="text-xs text-muted">ناموفق/لغوشده</p>
            <b className="text-xl text-red-700">{toFaDigits(String(stats.data.failed ?? 0))}</b>
          </div>
          <div className="cp-card">
            <p className="text-xs text-muted">در انتظار پیک</p>
            <b className="text-xl text-amber-700">{toFaDigits(String(stats.data.waitingForCourier ?? 0))}</b>
          </div>
        </div>
      ) : null}
      {deliveries.isLoading ? <Spinner /> : null}
      <DataTable headers={['کد مأموریت', 'وضعیت', 'شهر', 'مسافت', 'کرایه پیک', 'ثبت']}>
        {(deliveries.data?.items ?? []).map((row) => (
          <tr key={String(row.id)}>
            <td dir="ltr" className="text-xs font-semibold">
              {String(row.code)}
            </td>
            <td>
              <StatusChip status={String(row.status)} kind="delivery" />
            </td>
            <td>{String(row.city ?? '—')}</td>
            <td className="text-xs">{row.distanceKm ? `${toFaDigits(Number(row.distanceKm).toFixed(1))} کیلومتر` : '—'}</td>
            <td className="tabular-nums">{formatToman(Number(row.courierShare ?? 0))}</td>
            <td className="text-xs text-muted">{dateFa(String(row.createdAt), false)}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
