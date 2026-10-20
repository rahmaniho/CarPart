import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { compactMoney, dateFa, toFaDigits } from '../lib/format';
import { DataTable, ErrorBox, PageHeader, Spinner, StatCard } from '../components/ui';

/** داشبورد مدیریت — همه اعداد از پایگاه‌داده واقعی (GMV جدا از درآمد پلتفرم) */
export default function DashboardPage(): JSX.Element {
  const dashboard = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api.admin.dashboard(30) });
  const daily = useQuery({ queryKey: ['admin-daily'], queryFn: () => api.admin.dailyReport(14) });

  const data = dashboard.data;

  return (
    <>
      <PageHeader
        title="داشبورد مدیریت"
        subtitle={data ? `آخرین به‌روزرسانی: ${dateFa(data.generatedAt)}` : 'در حال دریافت اطلاعات…'}
        actions={
          <button type="button" className="cp-btn-ghost" onClick={() => { void dashboard.refetch(); void daily.refetch(); }}>
            به‌روزرسانی
          </button>
        }
      />

      {dashboard.isError ? <ErrorBox message="دریافت داشبورد ممکن نشد" onRetry={() => dashboard.refetch()} /> : null}
      {dashboard.isLoading ? <Spinner /> : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="کل کاربران" value={toFaDigits(data.users.total)} hint={`${toFaDigits(data.users.newToday)} کاربر جدید امروز`} />
            <StatCard label="سفارش‌ها" value={toFaDigits(data.orders.total)} hint={`${toFaDigits(data.orders.today)} سفارش امروز`} tone="primary" />
            <StatCard label="GMV (گردش مالی)" value={`${compactMoney(data.money.gmv)} تومان`} hint="مجموع مبلغ سفارش‌های پرداخت‌شده" tone="money" />
            <StatCard label="درآمد پلتفرم" value={`${compactMoney(data.money.platformRevenue)} تومان`} hint={data.money.note} tone="money" />
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="در انتظار تأیید هویت" value={toFaDigits(data.verifications.seller + data.verifications.courier + data.verifications.workshop)} hint="فروشنده + پیک + تعمیرگاه" />
            <StatCard label="مأموریت‌های تحویل‌شده" value={toFaDigits(data.delivery.delivered)} hint={`میانگین زمان: ${data.delivery.avgMinutes ? toFaDigits(Math.round(data.delivery.avgMinutes)) + ' دقیقه' : '—'}`} />
            <StatCard label="پرداخت‌های موفق" value={toFaDigits(data.payments.success)} hint={data.payments.sandboxActive ? 'درگاه آزمایشی (Sandbox) فعال است' : 'درگاه واقعی'} />
            <StatCard label="تیکت‌های باز پشتیبانی" value={toFaDigits(data.support.openTickets)} hint={`${toFaDigits(data.support.openReturns)} درخواست مرجوعی باز`} />
          </section>

          <section className="cp-card">
            <h2 className="mb-3 text-sm font-bold">روند ۱۴ روز اخیر (داده واقعی)</h2>
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="jalali" tick={{ fontSize: 11 }} reversed />
                  <YAxis tick={{ fontSize: 11 }} orientation="right" />
                  <Tooltip formatter={(value) => [compactMoney(Number(value)), 'مقدار']} />
                  <Legend formatter={(value: string) => (value === 'gmv' ? 'گردش مالی (GMV)' : value === 'platformRevenue' ? 'درآمد پلتفرم' : 'تعداد سفارش')} />
                  <Line type="monotone" dataKey="gmv" stroke="#0f766e" strokeWidth={2} dot={false} name="gmv" />
                  <Line type="monotone" dataKey="platformRevenue" stroke="#b45309" strokeWidth={2} dot={false} name="platformRevenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold">فروشندگان برتر</h2>
            <DataTable headers={['فروشگاه', 'تعداد سفارش', 'درآمد فروشنده', 'درآمد پلتفرم']}>
              {data.topSellers.map((seller) => (
                <tr key={seller.id}>
                  <td>{seller.storeName}</td>
                  <td className="tabular-nums">{toFaDigits(seller.orders)}</td>
                  <td className="tabular-nums">{compactMoney(seller.revenue)} تومان</td>
                  <td className="tabular-nums">{compactMoney(seller.platformRevenue)} تومان</td>
                </tr>
              ))}
              {data.topSellers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-xs text-muted">
                    داده‌ای ثبت نشده است
                  </td>
                </tr>
              ) : null}
            </DataTable>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold">آخرین عملیات حساس (گزارش ممیزی)</h2>
            <DataTable headers={['زمان', 'عملیات', 'توضیح', 'انجام‌دهنده']}>
              {data.recentAudit.map((row, index) => (
                <tr key={index}>
                  <td className="text-xs text-muted">{dateFa(row.at)}</td>
                  <td dir="ltr" className="text-xs">
                    {row.action}
                  </td>
                  <td>{row.fa}</td>
                  <td className="text-xs">{row.actor ?? 'سامانه'}</td>
                </tr>
              ))}
              {data.recentAudit.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-xs text-muted">
                    عملیاتی ثبت نشده است
                  </td>
                </tr>
              ) : null}
            </DataTable>
          </section>
        </>
      ) : null}
    </>
  );
}
