import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PublicLayout } from '../../components/PublicLayout';

const roles = [
  {
    id: 'mechanic',
    title: 'برای مکانیک و خریدار',
    eyebrow: 'پیدا کردن قطعهٔ درست',
    description: 'جست‌وجوی نام، کد فنی یا OEM؛ مقایسهٔ شفاف پیشنهادها و ثبت استعلام هم‌زمان از چند فروشنده.',
    image: '/branding/mechanic.webp',
    color: 'from-cyan-500/15 to-blue-600/5',
    action: 'جست‌وجوی قطعه',
    to: '/search',
  },
  {
    id: 'seller',
    title: 'برای فروشنده و تأمین‌کننده',
    eyebrow: 'فروش حرفه‌ای و یکپارچه',
    description: 'مدیریت کالا، قیمت و موجودی، پاسخ به استعلام‌ها، پردازش سفارش و مشاهدهٔ وضعیت تسویه در یک پنل.',
    image: '/branding/seller.webp',
    color: 'from-amber-500/15 to-orange-600/5',
    action: 'شروع همکاری فروش',
    to: '/register',
  },
  {
    id: 'courier',
    title: 'برای پیک',
    eyebrow: 'مأموریت روشن، درآمد شفاف',
    description: 'مشاهدهٔ مسیر و سهم مأموریت پیش از پذیرش، رهگیری مرحله‌ای و تحویل امن با کد یکبارمصرف.',
    image: '/branding/courier.webp',
    color: 'from-blue-500/15 to-violet-600/5',
    action: 'ثبت‌نام پیک',
    to: '/register',
  },
] as const;

const capabilities = [
  { icon: '⌕', title: 'جست‌وجوی هوشمند', text: 'نام فارسی، کد فنی و سازگاری خودرو را در یک تجربهٔ جست‌وجوی سریع کنار هم ببینید.' },
  { icon: '↗', title: 'رتبه‌بندی شفاف', text: 'قیمت، موجودی، فاصله و امتیاز فروشنده معیارند؛ میزان کمیسیون در رتبه‌بندی دخالت ندارد.' },
  { icon: '◎', title: 'استعلام چندفروشنده‌ای', text: 'یک درخواست ثبت کنید، پیشنهادهای واقعی را مقایسه کنید و گزینهٔ مناسب را بپذیرید.' },
  { icon: '▦', title: 'کنترل موجودی و سفارش', text: 'فروشنده از ثبت کالا تا آماده‌سازی، تحویل به پیک و تسویه را در یک جریان مشخص مدیریت می‌کند.' },
  { icon: '⌖', title: 'رهگیری ارسال', text: 'وضعیت مأموریت مرحله‌به‌مرحله ثبت می‌شود و تحویل با OTP قابل تأیید است.' },
  { icon: '◇', title: 'امنیت نقش‌محور', text: 'مجوزها در سرور کنترل می‌شوند و عملیات حساس در گزارش ممیزی ثبت می‌گردند.' },
] as const;

const faqs = [
  ['کارپارت برای چه کسانی ساخته شده است؟', 'برای مکانیک‌ها و خریداران قطعه، فروشندگان و تأمین‌کنندگان، پیک‌ها و تیم مدیریت بازار. هر نقش، وب‌اپ و تجربهٔ متناسب خود را دارد.'],
  ['ترتیب نمایش فروشندگان چگونه تعیین می‌شود؟', 'رتبه‌بندی بر اساس معیارهای شفاف مانند قیمت، موجودی، امتیاز و فاصله انجام می‌شود. کمیسیون فروشنده در جایگاه پیشنهاد اثر ندارد.'],
  ['آیا زمان تحویل تضمینی است؟', 'خیر. زمان‌ها بر اساس اطلاعات مسیر و آماده‌سازی تخمین زده می‌شوند و به‌صورت شفاف تخمینی نمایش داده می‌شوند.'],
  ['نسخه Android هم وجود دارد؟', 'بله؛ نسخه‌های مستقل مکانیک، فروشنده، پیک و مدیریت از صفحهٔ انتشار رسمی قابل دریافت‌اند.'],
] as const;

export default function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.catalog.categories() });
  const announcements = useQuery({ queryKey: ['announcements'], queryFn: () => api.settings.announcements() });

  function search(event: FormEvent): void {
    event.preventDefault();
    const term = q.trim();
    navigate(`/search${term ? `?q=${encodeURIComponent(term)}` : ''}`);
  }

  return (
    <PublicLayout wide>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-grid" aria-hidden="true" />
        <div className="landing-orb landing-orb--one" aria-hidden="true" />
        <div className="landing-orb landing-orb--two" aria-hidden="true" />
        <div className="relative z-10 grid items-center gap-10 px-5 py-12 sm:px-9 lg:grid-cols-[1.08fr_.92fr] lg:px-14 lg:py-20">
          <div>
            <div className="landing-pill"><span className="landing-pill__dot" /> بازار هوشمند قطعات خودرو</div>
            <h1 id="landing-title" className="mt-5 max-w-3xl text-4xl font-black leading-[1.35] tracking-tight text-white sm:text-5xl lg:text-[3.55rem]">
              قطعه‌ای که لازم دارید،<br /><span className="landing-gradient-text">شفاف‌تر و سریع‌تر</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">
              کارپارت، مکانیک و خریدار را به فروشندگان معتبر و پیک‌های آماده متصل می‌کند؛ از جست‌وجو و استعلام قیمت تا پرداخت، ارسال و پیگیری—همه در یک جریان روشن.
            </p>

            <form className="landing-search mt-7" onSubmit={search}>
              <span className="text-xl text-slate-400" aria-hidden="true">⌕</span>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                aria-label="جست‌وجوی قطعه"
                placeholder="نام قطعه، کد فنی یا OEM را وارد کنید…"
              />
              <button type="submit">پیدا کن <span aria-hidden="true">←</span></button>
            </form>

            <div className="mt-4 flex min-h-7 flex-wrap gap-2">
              {(categories.data ?? []).slice(0, 5).map((category) => {
                const name = String(category.nameFa ?? category.name ?? '');
                return <button key={String(category.id)} type="button" className="landing-category" onClick={() => navigate(`/search?q=${encodeURIComponent(name)}`)}>{name}</button>;
              })}
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-300">
              <span>✓ رتبه‌بندی مستقل از کمیسیون</span>
              <span>✓ قیمت‌ها به تومان</span>
              <span>✓ وب‌اپ و Android</span>
            </div>
          </div>

          <div className="landing-showcase" aria-label="نسخه‌های کارپارت">
            <div className="landing-showcase__glow" aria-hidden="true" />
            <img className="landing-logo landing-logo--main" src="/branding/mechanic.webp" width="360" height="360" alt="نشان اپ مکانیک کارپارت" loading="eager" />
            <div className="landing-float-card landing-float-card--seller">
              <img src="/branding/seller.webp" width="74" height="74" alt="" />
              <div><b>پنل فروشنده</b><span>کالا، سفارش و مالی</span></div>
            </div>
            <div className="landing-float-card landing-float-card--courier">
              <img src="/branding/courier.webp" width="74" height="74" alt="" />
              <div><b>اپ پیک</b><span>مأموریت و رهگیری</span></div>
            </div>
            <div className="landing-live"><span /> دادهٔ واقعی، بدون ویترین ساختگی</div>
          </div>
        </div>
      </section>

      <section className="landing-trust" aria-label="ویژگی‌های کلیدی">
        {[
          ['رتبه‌بندی شفاف', 'انتخاب بر اساس معیارهای روشن'],
          ['استعلام رقابتی', 'دریافت پیشنهاد از چند فروشنده'],
          ['پیگیری یکپارچه', 'از ثبت سفارش تا تحویل'],
          ['امنیت عملیاتی', 'مجوز سمت سرور و گزارش ممیزی'],
        ].map(([title, text], index) => (
          <div key={title} className="landing-trust__item"><span>۰{index + 1}</span><div><b>{title}</b><small>{text}</small></div></div>
        ))}
      </section>

      <section id="roles" className="landing-section">
        <div className="landing-section-heading">
          <div><p>یک بازار، سه تجربهٔ تخصصی</p><h2>برای هر نقش، ابزار درست</h2></div>
          <p>رابط هر نسخه بر اساس کار واقعی همان نقش طراحی شده؛ نه یک پنل عمومی و شلوغ برای همه.</p>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {roles.map((role) => (
            <article key={role.id} className={`landing-role-card bg-gradient-to-b ${role.color}`}>
              <div className="landing-role-card__image"><img src={role.image} width="420" height="420" loading="lazy" alt={`لوگوی ${role.title} کارپارت`} /></div>
              <div className="p-6 pt-4">
                <p className="text-[11px] font-black tracking-wide text-primary">{role.eyebrow}</p>
                <h3 className="mt-2 text-xl font-black">{role.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{role.description}</p>
                <Link to={role.to} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-primary">{role.action} <span aria-hidden="true">←</span></Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="landing-section rounded-[2rem] bg-slate-950 px-5 py-10 text-white sm:px-10 sm:py-14">
        <div className="landing-section-heading landing-section-heading--dark">
          <div><p>زیرساختی برای عملیات واقعی</p><h2>از جست‌وجو تا تسویه، یکپارچه</h2></div>
          <p>قابلیت‌ها به API واقعی متصل‌اند و حالت سرویس‌های بیرونیِ تنظیم‌نشده، صریحاً مشخص می‌شود.</p>
        </div>
        <div className="mt-9 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item) => (
            <article key={item.title} className="landing-feature-card">
              <span className="landing-feature-card__icon" aria-hidden="true">{item.icon}</span>
              <h3>{item.title}</h3><p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="landing-section grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="landing-eyebrow">چطور کار می‌کند؟</p>
          <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">مسیر کوتاه‌تر برای تأمین قطعه</h2>
          <p className="mt-4 text-sm leading-8 text-muted">به‌جای تماس‌های پراکنده و قیمت‌های نامشخص، درخواست و پیشنهادها در یک مسیر قابل پیگیری ثبت می‌شوند.</p>
          <Link to="/register" className="cp-btn-primary mt-6 !px-6 !py-3">ساخت حساب رایگان</Link>
        </div>
        <ol className="landing-steps">
          {[
            ['۰۱', 'جست‌وجو یا ثبت استعلام', 'قطعه را مستقیم پیدا کنید یا نیاز خود را برای چند فروشنده ارسال کنید.'],
            ['۰۲', 'مقایسه و انتخاب آگاهانه', 'قیمت، موجودی، کیفیت، فاصله و سابقه فروشنده را کنار هم ببینید.'],
            ['۰۳', 'خرید و پیگیری مرحله‌ای', 'سفارش را ثبت کنید و وضعیت آماده‌سازی، ارسال و تحویل را دنبال کنید.'],
          ].map(([number, title, text]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}
        </ol>
      </section>

      <section id="download" className="landing-download">
        <div className="relative z-10 max-w-2xl">
          <p className="landing-eyebrow !text-cyan-300">همیشه همراه شما</p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-white sm:text-4xl">نسخهٔ Android هر نقش آماده است</h2>
          <p className="mt-4 text-sm leading-8 text-slate-300">اپ مستقل مکانیک، فروشنده و پیک را از صفحهٔ رسمی انتشار دریافت کنید. برای ورود عملیاتی، نشانی HTTPS سرور کارپارت لازم است.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="cp-btn bg-white !px-6 !py-3 font-black text-slate-950" href="https://github.com/rahmaniho/CarPart/releases/latest" target="_blank" rel="noreferrer">دریافت نسخه Android ↗</a>
            <Link className="cp-btn border border-white/15 bg-white/5 !px-6 !py-3 text-white hover:bg-white/10" to="/register">استفاده از نسخه وب</Link>
          </div>
        </div>
        <div className="landing-download__art" aria-hidden="true">
          {roles.map((role) => <img key={role.id} src={role.image} alt="" />)}
        </div>
      </section>

      {announcements.data?.length ? (
        <section className="landing-section">
          <div className="landing-section-heading"><div><p>تازه‌های کارپارت</p><h2>اطلاعیه‌ها</h2></div></div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {announcements.data.slice(0, 4).map((item, index) => (
              <article key={index} className="cp-card border-sky-100 bg-sky-50/60 text-xs leading-7"><b className="block text-sm text-ink">{String((item as { titleFa?: string }).titleFa ?? 'اطلاعیه')}</b>{String((item as { bodyFa?: string }).bodyFa ?? '')}</article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="landing-section grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
        <div><p className="landing-eyebrow">پرسش‌های متداول</p><h2 className="mt-2 text-3xl font-black">قبل از شروع بدانید</h2><p className="mt-3 text-sm leading-7 text-muted">پاسخ شفاف به پرسش‌های مهم دربارهٔ بازار کارپارت.</p></div>
        <div className="space-y-3">{faqs.map(([question, answer]) => <details key={question} className="landing-faq"><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="landing-final-cta">
        <div><p>آماده‌اید زنجیرهٔ تأمین قطعه را ساده‌تر کنید؟</p><h2>همین امروز وارد کارپارت شوید.</h2></div>
        <div className="flex flex-wrap gap-3"><Link to="/register" className="cp-btn bg-white !px-6 !py-3 text-primary">ثبت‌نام و شروع همکاری</Link><Link to="/search" className="cp-btn border border-white/20 !px-6 !py-3 text-white">مشاهدهٔ قطعات</Link></div>
      </section>
    </PublicLayout>
  );
}
