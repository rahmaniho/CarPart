import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type OrderRow } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, formatToman, toFaDigits } from '../../lib/format';
import { SellerLayout } from '../../components/SellerLayout';
import { DataTable, ErrorBox, PageHeader, Spinner, StatusChip } from '../../components/ui';

const NEXT_ACTIONS: Record<string, Array<{ to: string; label: string }>> = {
  PAID: [{ to: 'SELLER_CONFIRMED', label: 'تأیید سفارش' }],
  SELLER_CONFIRMED: [{ to: 'PREPARING', label: 'شروع آماده‌سازی' }],
  PREPARING: [{ to: 'READY_FOR_PICKUP', label: 'آماده تحویل به پیک' }],
};

/** سفارش‌های فروشگاه: پذیرش، آماده‌سازی و تحویل به پیک */
export default function SellerOrders(): JSX.Element {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orders = useQuery({ queryKey: ['seller-orders', status], queryFn: () => api.sellers.orders({ status: status || undefined, pageSize: 30 }) });
  const detail = useQuery({ queryKey: ['seller-order', selected?.id], queryFn: () => api.sellers.orderDetail(selected!.id), enabled: Boolean(selected) });
  const events = useQuery({ queryKey: ['seller-order-events', selected?.id], queryFn: () => api.sellers.orderEvents(selected!.id), enabled: Boolean(selected) });

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.sellers.transitionOrder(id, to),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['seller-order'] });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'تغییر وضعیت مجاز نیست'),
  });

  return (
    <SellerLayout>
      <PageHeader title="سفارش‌های فروشگاه" />
      <select className="cp-field max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">همه وضعیت‌ها</option>
        <option value="PAID">پرداخت‌شده</option>
        <option value="PREPARING">در حال آماده‌سازی</option>
        <option value="READY_FOR_PICKUP">آماده تحویل به پیک</option>
        <option value="COMPLETED">تکمیل‌شده</option>
      </select>
      {error ? <ErrorBox message={error} /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataTable headers={['کد', 'وضعیت', 'مبلغ', 'ثبت']}>
          {(orders.data?.items ?? []).map((order) => (
            <tr key={order.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(order)}>
              <td dir="ltr" className="text-xs font-semibold">{order.code}</td>
              <td><StatusChip status={order.status} /></td>
              <td className="tabular-nums">{formatToman(order.payableTotal)}</td>
              <td className="text-xs text-muted">{dateFa(order.createdAt, false)}</td>
            </tr>
          ))}
          {orders.data?.items.length === 0 ? (
            <tr><td colSpan={4} className="text-center text-xs text-muted">سفارشی نیست</td></tr>
          ) : null}
        </DataTable>

        <div className="cp-card">
          {!selected ? <p className="text-sm text-muted">برای مشاهده جزئیات، سفارشی را انتخاب کنید.</p> : null}
          {detail.isLoading ? <Spinner /> : null}
          {detail.data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <b dir="ltr">{detail.data.code}</b>
                <StatusChip status={detail.data.status} />
              </div>
              <ul className="space-y-1 text-xs">
                {(detail.data.items ?? []).map((item) => (
                  <li key={item.id} className="flex justify-between rounded-lg bg-slate-50 px-2 py-1.5">
                    <span>{item.partNameFa ?? 'قطعه'} × {toFaDigits(item.quantity)}</span>
                    <b className="tabular-nums">{formatToman(item.lineTotal)}</b>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {(NEXT_ACTIONS[detail.data.status] ?? []).map((action) => (
                  <button key={action.to} type="button" className="cp-btn-primary !py-1.5 text-xs" disabled={transition.isPending} onClick={() => transition.mutate({ id: detail.data!.id, to: action.to })}>
                    {action.label}
                  </button>
                ))}
              </div>
              <div>
                <h3 className="mb-1 text-xs font-bold text-muted">تاریخچه</h3>
                <ul className="space-y-1 text-xs">
                  {(events.data ?? []).map((event) => (
                    <li key={String(event.id)} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                      <span>{String(event.fa ?? event.toStatus)}</span>
                      <span className="text-muted">— {dateFa(String(event.createdAt))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </SellerLayout>
  );
}
