import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PublicLayout } from '../../components/PublicLayout';

/** صفحه خانگی عمومی: جست‌وجو، مراحل کار، دسته‌ها و اطلاعیه‌ها */
export default function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.catalog.categories() });
  const announcements = useQuery({ queryKey: ['announcements'], queryFn: () => api.settings.announcements() });

  return (
    <PublicLayout>
      <section className="rounded-3xl bg-gradient-to-l from-primary to-primary-dark px-6 py-12 text-white">
        <h1 className="text-2xl font-extrabold leading-10">قطعه‌ای که لازم دارید، سریع و مطمئن</h1>
        <p className="mt-2 max-w-xl text-sm leading-7 text-emerald-50">
          از میان پیشنهادهای فروشندگان معتبر با <b>رتبه‌بندی شفاف</b> انتخاب کنید؛ یا درخواست قیمت ثبت کنید تا فروشندگان برایتان پیشنهاد بفرستند.
        </p>
        <form
          className="mt-6 flex max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/search?q=${encodeURIComponent(q)}`);
          }}
        >
          <input
            className="cp-field flex-1 !border-0 !py-3"
            placeholder="نام قطعه، کد فنی یا کد OEM…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            aria-label="جست‌وجوی قطعه"
          />
          <button type="submit" className="cp-btn bg-white !py-3 text-primary hover:bg-emerald-50">
            جست‌وجو
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {(categories.data ?? []).slice(0, 6).map((category) => (
            <button
              key={String(category.id)}
              type="button"
              className="rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25"
              onClick={() => navigate(`/search?q=${encodeURIComponent(String(category.nameFa ?? category.name ?? ''))}`)}
            >
              {String(category.nameFa ?? category.name ?? '')}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { icon: '🔍', title: '۱. جست‌وجو یا درخواست قیمت', text: 'قطعه را پیدا کنید یا از چند فروشنده به‌صورت هم‌زمان استعلام بگیرید.' },
          { icon: '⚖️', title: '۲. مقایسه شفاف', text: 'پیشنهادها با معیارهای مشخص (قیمت، موجودی، فاصله، امتیاز فروشنده) رتبه‌بندی می‌شوند؛ کمیسیون هرگز معیار نیست.' },
          { icon: '🛵', title: '۳. ارسال سریع', text: 'پیک نزدیک مأموریت را می‌پذیرد و با کد OTP تحویل می‌دهد. زمان‌ها تخمینی‌اند و تضمین نمی‌شوند.' },
        ].map((step) => (
          <div key={step.title} className="cp-card">
            <div className="text-2xl">{step.icon}</div>
            <h2 className="mt-2 text-sm font-bold">{step.title}</h2>
            <p className="mt-1 text-xs leading-6 text-muted">{step.text}</p>
          </div>
        ))}
      </section>

      {announcements.data?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-bold">اطلاعیه‌ها</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {announcements.data.slice(0, 4).map((item, index) => (
              <div key={index} className="cp-card border-sky-200 bg-sky-50 text-xs leading-6">
                <b className="block text-sm">{String((item as { titleFa?: string }).titleFa ?? 'اطلاعیه')}</b>
                {String((item as { bodyFa?: string }).bodyFa ?? '')}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="cp-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">فروشنده یا پیک هستید؟</h2>
          <p className="mt-1 text-xs text-muted">با ثبت‌نام، فروشگاه خود را وارد بازار کارپارت کنید یا به‌عنوان پیک فعالیت کنید.</p>
        </div>
        <Link to="/register" className="cp-btn-primary">
          ثبت‌نام فروشنده / پیک
        </Link>
      </section>
    </PublicLayout>
  );
}
