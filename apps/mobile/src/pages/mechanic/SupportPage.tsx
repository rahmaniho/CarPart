import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@carpart/api-client';
import { api } from '../../lib/api';
import { dateFa } from '../../lib/format';
import { AppShell } from '../../components/AppShell';
import { EmptyState, ErrorBox, Field, Spinner } from '../../components/ui';
import { MECHANIC_TABS } from './MechanicHome';

const TICKET_FA: Record<string, string> = {
  OPEN: 'باز', IN_PROGRESS: 'در حال بررسی', WAITING_FOR_USER: 'در انتظار شما', RESOLVED: 'حل‌شده', CLOSED: 'بسته',
};

/** پشتیبانی مکانیک: ثبت تیکت + پیگیری */
export default function SupportPage(): JSX.Element {
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const tickets = useQuery({ queryKey: ['my-tickets'], queryFn: () => api.support.myTickets({ pageSize: 20 }) });

  const create = useMutation({
    mutationFn: () => api.support.openTicket({ subject, body }),
    onSuccess: () => {
      setSubject('');
      setBody('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['my-tickets'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ثبت تیکت ناموفق بود'),
  });

  const reply = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.support.replyTicket(id, text),
    onSuccess: () => {
      setReplyFor(null);
      setReplyBody('');
      void qc.invalidateQueries({ queryKey: ['my-tickets'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.userMessage : 'ارسال پاسخ ناموفق بود'),
  });

  return (
    <AppShell title="پشتیبانی" tabs={MECHANIC_TABS}>
      <div className="cp-card space-y-2">
        <Field label="موضوع">
          <input className="cp-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="شرح مشکل">
          <textarea className="cp-field min-h-24" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <button type="button" className="cp-btn-primary w-full" disabled={create.isPending || !subject || !body} onClick={() => create.mutate()}>
          ثبت تیکت
        </button>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {tickets.isLoading ? <Spinner /> : null}
      {tickets.data && tickets.data.items.length === 0 ? <EmptyState title="تیکتی ندارید" hint="مشکلی دارید؟ ثبت کنید تا پیگیری شود." /> : null}

      <div className="space-y-2">
        {(tickets.data?.items ?? []).map((ticket) => (
          <article key={String(ticket.id)} className="cp-card space-y-2">
            <div className="flex items-center justify-between">
              <b className="text-sm">{String(ticket.subject ?? '—')}</b>
              <span className="cp-chip bg-slate-100 text-slate-700">{TICKET_FA[String(ticket.status)] ?? String(ticket.status)}</span>
            </div>
            <p className="text-xs leading-6 text-muted">{String(ticket.lastMessage ?? ticket.body ?? '')}</p>
            <p className="text-[11px] text-muted">{dateFa(String(ticket.updatedAt ?? ticket.createdAt))}</p>
            {replyFor === String(ticket.id) ? (
              <div className="space-y-2 rounded-xl bg-slate-50 p-2">
                <input className="cp-field !py-1.5 text-xs" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="پاسخ شما…" />
                <button type="button" className="cp-btn-primary w-full !py-1.5 text-xs" disabled={reply.isPending || !replyBody} onClick={() => reply.mutate({ id: String(ticket.id), text: replyBody })}>
                  ارسال پاسخ
                </button>
              </div>
            ) : (
              <button type="button" className="cp-btn-ghost w-full !py-1.5 text-xs" onClick={() => setReplyFor(String(ticket.id))}>
                افزودن پاسخ
              </button>
            )}
          </article>
        ))}
      </div>
    </AppShell>
  );
}
