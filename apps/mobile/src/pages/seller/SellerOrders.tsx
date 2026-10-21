import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type OrderRow } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa, formatToman } from '../../lib/format';
import { LiveTrackingCard } from '../../components/LiveTrackingCard';
import { ErrorBox, Section, Spinner, StatusChip } from '../../components/ui';
import { SellerShell } from './SellerShell';

const NEXT_ACTIONS: Record<string, Array<{ to: string; label: string }>> = {
  PAID: [{ to: 'SELLER_CONFIRMED', label: 'تأیید سفارش' }],
  SELLER_CONFIRMED: [{ to: 'PREPARING', label: 'شروع آماده‌سازی' }],
  PREPARING: [{ to: 'READY_FOR_PICKUP', label: 'آماده تحویل به پیک' }],
};

/** سفارش‌های فروشگاه با گذار وضعیت */
export default function SellerOrders(): JSX.Element {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orders = useQuery({ queryKey: ['seller-orders'], queryFn: () => api.sellers.orders({ pageSize: 20 }) });
  const detail = useQuery({ queryKey: ['seller-order', selected?.id], queryFn: () => api.sellers.orderDetail(selected!.id), enabled: Boolean(selected) });
  const events = useQuery({ queryKey: ['seller-order-events', selected?.id], queryFn: () => api.sellers.orderEvents(selected!.id), enabled: Boolean(selected) });
  const tracking = useQuery({
    queryKey: ['seller-order-tracking', selected?.id],
    queryFn: () => api.delivery.orderTracking(selected!.id),
    enabled: Boolean(selected),
    refetchInterval: 10_000,
  });

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.sellers.transitionOrder(id, to),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seller-orders'] });
      void qc.invalidateQueries({ queryKey: ['seller-order'] });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'تغییر وضعیت مجاز نیست'),
  });

  return (
    <SellerShell title="سفارش‌های فروشگاه">
      {error ? <ErrorBox message={error} /> : null}
      <div className="space-y-2">
        {(orders.data?.items ?? []).map((order) => (
          <button key={order.id} type="button" className="cp-card w-full text-start" onClick={() => setSelected(order)}>
            <div className="flex items-center justify-between">
              <b className="text-sm" dir="ltr">{order.code}</b>
              <StatusChip status={order.status} />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted">
              <span>{dateFa(order.createdAt, false)}</span>
              <b className="text-ink">{formatToman(order.payableTotal)}</b>
            </div>
          </button>
        ))}
        {orders.data?.items.length === 0 ? <p className="cp-card text-center text-xs text-muted">سفارشی نیست.</p> : null}
      </div>

      {selected ? (
        <Section title={`جزئیات ${selected.code}`}>
          <div className="cp-card space-y-2">
            {detail.isLoading ? <Spinner /> : null}
            {detail.data ? (
              <>
                {tracking.data?.deliveryId ? <LiveTrackingCard tracking={tracking.data} viewer="seller" /> : null}
                <ul className="space-y-1 text-xs">
                  {(detail.data.items ?? []).map((item) => (
                    <li key={item.id} className="flex justify-between rounded-lg bg-slate-50 px-2 py-1.5">
                      <span>{item.partNameFa ?? 'قطعه'} × {item.quantity}</span>
                      <b className="tabular-nums">{formatToman(item.lineTotal)}</b>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {(NEXT_ACTIONS[detail.data.status] ?? []).map((action) => (
                    <button
                      key={action.to}
                      type="button"
                      className="cp-btn-primary !py-1.5 text-xs"
                      disabled={transition.isPending}
                      onClick={() => transition.mutate({ id: detail.data!.id, to: action.to })}
                    >
                      {action.label}
                    </button>
                  ))}
                  <button type="button" className="cp-btn-ghost !py-1.5 text-xs" onClick={() => setSelected(null)}>
                    بستن
                  </button>
                </div>
                <ul className="space-y-1 text-[11px] text-muted">
                  {(events.data ?? []).map((event) => (
                    <li key={String(event.id)}>
                      {String(event.fa ?? event.toStatus)} — {dateFa(String(event.createdAt))}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </Section>
      ) : null}
    </SellerShell>
  );
}
