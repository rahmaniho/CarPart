import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { dateFa } from '../../lib/format';
import { AppShell } from '../../components/AppShell';
import { EmptyState, ErrorBox, Spinner } from '../../components/ui';
import { MECHANIC_TABS } from './MechanicHome';

export default function NotificationsPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['notifications'], queryFn: () => api.notifications.list({ pageSize: 30 }) });

  return (
    <AppShell
      title="اعلان‌ها"
      tabs={MECHANIC_TABS}
      headerExtra={
        <button
          type="button"
          className="cp-btn-ghost !bg-white/15 !text-white"
          onClick={async () => {
            await api.notifications.markAllRead();
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }}
        >
          خواندن همه
        </button>
      }
    >
      {list.isLoading ? <Spinner /> : null}
      {list.isError ? <ErrorBox message="دریافت اعلان‌ها ممکن نشد" onRetry={() => list.refetch()} /> : null}
      {list.data && list.data.items.length === 0 ? <EmptyState title="اعلانی ندارید" /> : null}
      <div className="space-y-2">
        {(list.data?.items ?? []).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`cp-card w-full text-start ${item.isRead ? 'opacity-70' : ''}`}
            onClick={async () => {
              if (!item.isRead) await api.notifications.markRead(item.id);
              if (item.link) navigate(item.link);
              void queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <b className="text-sm">{item.titleFa}</b>
              {!item.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="خوانده‌نشده" /> : null}
            </div>
            <p className="mt-1 text-xs leading-6 text-muted">{item.bodyFa}</p>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
              <span>{dateFa(item.createdAt)}</span>
              {item.isSimulated ? <span className="cp-chip bg-slate-100 text-slate-600">پیامک شبیه‌سازی‌شده</span> : null}
            </div>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
