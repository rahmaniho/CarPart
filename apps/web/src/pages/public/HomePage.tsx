import { useEffect, useState, type FormEvent, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PublicLayout } from '../../components/PublicLayout';
import { MarketplaceNetwork } from '../../components/MarketplaceNetwork';
import { api, isStaticLanding } from '../../lib/api';

const asset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

const roles = [
  { title: 'برای مکانیک و خریدار', label: 'مکانیک و تعمیرگاه', text: 'قطعه را با نام، کد فنی یا OEM پیدا کنید و پیشنهادهای فروشنده‌ها را کنار هم ببینید.', icon: '⚙', to: '/search' },
  { title: 'برای مشتری', label: 'خریدار قطعه', text: 'جست‌وجو، انتخاب و وضعیت سفارش را در یک مسیر روشن و قابل پیگیری مدیریت کنید.', icon: '⌕', to: '/search' },
  { title: 'برای فروشنده و تأمین‌کننده', label: 'فروشنده و تأمین‌کننده', text: 'کالا، قیمت، موجودی و سفارش‌های فروشگاه خودتان را با ابزارهای موجود مدیریت کنید.', icon: '▦', to: '/register' },
  { title: 'برای پیک', label: 'پیک تحویل', text: 'مأموریت‌های واگذارشده را ببینید و وضعیت دریافت، حرکت و تحویل را ثبت کنید.', icon: '↗', to: '/register' },
] as const;

const journey = [
  ['۰۱', 'جست‌وجو', 'نام یا کد قطعه'],
  ['۰۲', 'انتخاب', 'مقایسه پیشنهادها'],
  ['۰۳', 'پرداخت', 'ثبت سفارش'],
  ['۰۴', 'آماده‌سازی', 'تأیید فروشنده'],
  ['۰۵', 'ارسال', 'گردش کار پیک'],
  ['۰۶', 'تحویل', 'تأیید مقصد'],
] as const;

const benefits = [
  {
    id: 'buyer-benefits',
    eyebrow: 'برای خریدار قطعه',
    title: 'خرید قطعه از حدس‌زدن به یک انتخاب آگاهانه تبدیل می‌شود',
    text: 'اطلاعات قطعه، پیشنهاد فروشنده‌ها و وضعیت سفارش در یک مسیر قرار می‌گیرند؛ قیمت، موجودی و سازگاری ادعاشده از هم تفکیک می‌شوند.',
    image: 'landing/buyer-real.webp',
    alt: 'خریدار در حال بررسی قطعه و پیشنهادهای کارپارت کنار خودرو',
    points: ['جست‌وجو با نام، کد فنی یا OEM', 'رتبه‌بندی شفاف پیشنهادها', 'مشاهدهٔ مرحله‌ای سفارش'],
  },
  {
    id: 'seller-benefits',
    eyebrow: 'برای تأمین‌کننده و لوازم یدکی',
    title: 'تقاضای واقعی را منظم‌تر ببینید و فروش را حرفه‌ای‌تر مدیریت کنید',
    text: 'فروشگاه می‌تواند کالا، قیمت و موجودی را مدیریت کند، به استعلام مرتبط پاسخ بدهد و سفارش را تا وضعیت تسویه دنبال کند.',
    image: 'landing/supplier-real.webp',
    alt: 'تأمین‌کننده در انبار قطعات خودرو هنگام مدیریت موجودی و سفارش',
    points: ['مدیریت محصول و موجودی', 'پاسخ به درخواست مرتبط', 'پیگیری سفارش و امور مالی'],
  },
  {
    id: 'mechanic-benefits',
    eyebrow: 'برای مکانیک',
    title: 'زمان کمتری صرف پیدا کردن قطعه؛ تمرکز بیشتر روی تعمیر خودرو',
    text: 'نیاز قطعه یک‌بار ثبت می‌شود و پیشنهادها در یک جریان مشخص قابل بررسی‌اند؛ بدون رفت‌وآمد میان تماس‌ها و پیام‌های پراکنده.',
    image: 'landing/mechanic-real.webp',
    alt: 'مکانیک در تعمیرگاه هنگام بررسی قطعه تأمین‌شده با کارپارت',
    points: ['یک استعلام برای چند فروشنده', 'مقایسه پیش از انتخاب', 'پیگیری تأمین و ارسال'],
  },
] as const;

const faqs = [
  ['چطور قطعه را جست‌وجو کنم؟', 'در جست‌وجوی عمومی می‌توانید نام فارسی، کد فنی یا OEM را وارد کنید. نتیجه‌ها پیشنهادهای فعال فروشندگان را با اطلاعات تفکیک‌شده نمایش می‌دهند.'],
  ['آیا یک سفارش می‌تواند از چند فروشنده باشد؟', 'بله. سفارش والد می‌تواند به بسته‌های مستقل فروشنده‌ها تقسیم شود و هر بسته جریان آماده‌سازی و ارسال خودش را داشته باشد.'],
  ['چطور وضعیت سفارش را دنبال کنم؟', 'پس از ورود، سفارش‌ها و وضعیت‌های تجمیع‌شدهٔ پرداخت، تأیید فروشنده، آماده‌سازی، ارسال و تحویل در حساب قابل مشاهده‌اند.'],
  ['فروشنده چطور به CarPart می‌پیوندد؟', 'از مسیر ثبت‌نام، نقش مناسب را انتخاب کنید. دسترسی پنل فروشنده پس از کنترل‌های نقش و وضعیت حساب ارائه می‌شود.'],
  ['اگر مشکلی برای سفارش پیش بیاید چه کنم؟', 'از مسیرهای پشتیبانی و وضعیت سفارش استفاده کنید. شرایط بازپرداخت یا تضمین خارج از سیاست‌های منتشرشده نمایش داده نمی‌شود.'],
] as const;

export default function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.catalog.categories(), enabled: !isStaticLanding });

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')), { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    const nodes = document.querySelectorAll('.reveal');
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  function search(event: FormEvent): void {
    event.preventDefault();
    const term = q.trim();
    navigate(`/search${term ? `?q=${encodeURIComponent(term)}` : ''}`);
  }

  function moveHero(event: PointerEvent<HTMLDivElement>): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--hero-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 10}px`);
    event.currentTarget.style.setProperty('--hero-y', `${((event.clientY - bounds.top) / bounds.height - 0.5) * 8}px`);
  }

  return (
    <PublicLayout wide>
      <section className="auto-hero" aria-labelledby="landing-title" onPointerMove={moveHero}>
        <div className="auto-hero__grid" aria-hidden="true" />
        <div className="auto-hero__scan" aria-hidden="true" />
        <div className="auto-hero__media" aria-hidden="true">
          <img src={asset('landing/cinematic-brake-assembly.webp')} width="1536" height="864" alt="" loading="eager" />
          <div className="auto-hero__orbit auto-hero__orbit--one" /><div className="auto-hero__orbit auto-hero__orbit--two" />
        </div>
        <div className="auto-hero__content">
          <p className="auto-eyebrow"><span /> EVERY PART. ONE SMART NETWORK.</p>
          <h1 id="landing-title">دنیای قطعات خودرو،<br /><em>هوشمندتر از همیشه</em></h1>
          <p className="auto-hero__lead">جست‌وجو، خرید و مدیریت سفارش قطعات خودرو؛ در یک شبکهٔ متصل از خریداران، فروشندگان و متخصصان.</p>

          {isStaticLanding ? (
            <div className="hero-static-note" role="status"><span>نسخهٔ معرفی</span> جست‌وجوی عملیاتی با اتصال API فعال می‌شود.</div>
          ) : (
            <form className="hero-search" onSubmit={search} role="search">
              <span aria-hidden="true">⌕</span>
              <input value={q} onChange={(event) => setQ(event.target.value)} aria-label="جست‌وجوی قطعه" placeholder="نام قطعه، کد فنی یا OEM…" />
              <button type="submit">جست‌وجوی قطعات <span aria-hidden="true">←</span></button>
            </form>
          )}

          <div className="auto-hero__actions">
            <Link className="auto-btn auto-btn--primary" to="/search">جست‌وجوی قطعات <span aria-hidden="true">←</span></Link>
            <Link className="auto-btn auto-btn--ghost" to="/register">همکاری با CarPart</Link>
          </div>
          <p className="auto-hero__trust">قطعه موردنیازت، در یک شبکه هوشمند.</p>
        </div>
        <div className="auto-hero__spec" aria-label="مشخصات تجربه">
          <span>NETWORK / 01</span><b>PRECISION COMMERCE</b><small>MARKETPLACE · ORDERS · DELIVERY</small>
        </div>
        <a className="auto-hero__scroll" href="#precision"><span /> ادامهٔ مسیر</a>
      </section>

      <section id="precision" className="precision-strip reveal" aria-label="اصول کارپارت">
        {[
          ['۰۱', 'جست‌وجوی دقیق', 'نام، کد فنی و OEM'],
          ['۰۲', 'انتخاب شفاف', 'قیمت و معیارهای رتبه‌بندی'],
          ['۰۳', 'سفارش چندفروشنده‌ای', 'بسته‌های مستقل زیر یک سفارش'],
          ['۰۴', 'گردش تحویل', 'وضعیت‌های ثبت‌شدهٔ پیک'],
        ].map(([number, title, text]) => <article key={number}><span>{number}</span><div><b>{title}</b><small>{text}</small></div></article>)}
      </section>

      <section id="catalog" className="catalog-story reveal" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div><p className="section-kicker">پیدا کردن قطعهٔ درست</p><h2 id="catalog-title">از مشخصات فنی تا پیشنهاد واقعی فروشنده</h2></div>
          <p>جست‌وجوی عمومی به API کاتالوگ متصل است؛ سازگاری، پیشنهاد فروش، موجودی و قیمت به‌عنوان داده‌های متفاوت نمایش داده می‌شوند.</p>
        </div>
        <div className="catalog-console">
          <div className="catalog-console__visual" aria-hidden="true"><div className="catalog-gear"><span /><span /><span /></div><small>PART / IDENTIFICATION</small></div>
          <div className="catalog-console__body">
            <div className="catalog-console__top"><span>کاتالوگ عملیاتی</span><small>REAL API ROUTE · /CATALOG/SEARCH</small></div>
            <form className="catalog-search" onSubmit={search}><label htmlFor="catalog-query">نام یا کد قطعه</label><div><input id="catalog-query" value={q} onChange={(event) => setQ(event.target.value)} placeholder="مثلاً لنت ترمز یا کد OEM" /><button>نمایش نتایج <span aria-hidden="true">←</span></button></div></form>
            <div className="catalog-categories" aria-label="دسته‌بندی‌های کاتالوگ">
              {categories.isLoading ? <span className="catalog-status">در حال دریافت دسته‌بندی‌ها…</span> : null}
              {categories.isError ? <span className="catalog-status">دسته‌بندی‌ها در دسترس نیستند؛ جست‌وجوی مستقیم همچنان ممکن است.</span> : null}
              {(categories.data ?? []).slice(0, 6).map((category) => {
                const name = String(category.nameFa ?? category.name ?? 'دسته قطعه');
                return <button key={String(category.id)} type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(name)}`)}>{name}<span>↗</span></button>;
              })}
              {isStaticLanding ? <span className="catalog-status">دسته‌های فعال پس از اتصال API نمایش داده می‌شوند.</span> : null}
            </div>
          </div>
        </div>
      </section>

      <MarketplaceNetwork />

      <section id="journey" className="journey-section reveal" aria-labelledby="journey-title">
        <div className="section-heading">
          <div><p className="section-kicker">گردش واقعی سفارش</p><h2 id="journey-title">از انتخاب تا تحویل، مرحله‌به‌مرحله</h2></div>
          <p>این مسیر بازنمایی ساده‌شدهٔ وضعیت‌های واقعی سیستم است. وضعیت عملیاتی هر سفارش فقط از دادهٔ سرور خوانده می‌شود.</p>
        </div>
        <ol className="journey-line">
          {journey.map(([number, title, detail], index) => <li key={number} className={index < 3 ? 'is-complete' : index === 3 ? 'is-active' : ''}><span>{number}</span><div><b>{title}</b><small>{detail}</small></div></li>)}
        </ol>
        <p className="concept-label">نمونهٔ توضیحی فرایند — نه وضعیت زندهٔ سفارش</p>
      </section>

      <section id="roles" className="roles-section reveal" aria-labelledby="roles-title">
        <div className="section-heading section-heading--dark"><div><p className="section-kicker">یک شبکه، ابزار متناسب هر نقش</p><h2 id="roles-title">برای هر نقش، یک مسیر روشن</h2></div><p>ورود و دسترسی هر بخش با احراز هویت و کنترل مجوز سمت سرور انجام می‌شود.</p></div>
        <div className="role-grid">{roles.map((role) => <article key={role.label}><span className="role-icon" aria-hidden="true">{role.icon}</span><small>{role.title}</small><h3>{role.label}</h3><p>{role.text}</p><Link to={role.to}>{role.to === '/search' ? 'شروع جست‌وجو' : 'شروع همکاری'} <span aria-hidden="true">←</span></Link></article>)}</div>
      </section>

      <section id="benefits" className="benefit-section reveal" aria-labelledby="benefits-title">
        <div className="section-heading"><div><p className="section-kicker">ارزش در عملیات روزمره</p><h2 id="benefits-title">سود واقعی برای هر حلقهٔ بازار قطعه</h2></div><p>کارپارت عدد یا سود تضمینی اعلام نمی‌کند؛ نتیجه به موجودی، قیمت، شهر و کیفیت پاسخ‌گویی هر کسب‌وکار وابسته است.</p></div>
        <div className="benefit-list">{benefits.map((item, index) => <article id={item.id} key={item.id} className={index % 2 ? 'is-reversed' : ''}><div className="benefit-image"><img src={asset(item.image)} width="800" height="800" loading="lazy" alt={item.alt} /></div><div className="benefit-copy"><p className="section-kicker">{item.eyebrow}</p><h3>{item.title}</h3><p>{item.text}</p><ul>{item.points.map((point) => <li key={point}><span>✓</span>{point}</li>)}</ul><Link to={index === 1 ? '/register' : '/search'}>{index === 1 ? 'شروع همکاری با کارپارت' : 'جست‌وجوی قطعه'} <span>←</span></Link></div></article>)}</div>
      </section>

      <section id="courier-journey" className="courier-story reveal" aria-labelledby="courier-title">
        <div className="section-heading section-heading--dark"><div><p className="section-kicker">گردش کار پیک</p><h2 id="courier-title">از فروشگاه قطعه تا مقصد</h2></div><p>پیک مأموریت واگذارشده را دریافت می‌کند و وضعیت دریافت، حرکت و تحویل را ثبت می‌کند. زمان تحویل تضمینی نمایش داده نمی‌شود.</p></div>
        <div className="courier-grid"><figure><img src={asset('landing/courier-pickup.webp')} width="1200" height="900" loading="lazy" alt="پیک کارپارت هنگام دریافت و بارگیری بسته قطعه از فروشگاه لوازم یدکی" /><figcaption><span>01 / PICKUP</span><b>دریافت و بارگیری امن</b></figcaption></figure><div className="courier-route" aria-hidden="true"><span>→</span><small>ثبت وضعیت مسیر</small></div><figure><img src={asset('landing/courier-delivery.webp')} width="1200" height="900" loading="lazy" alt="پیک کارپارت هنگام تحویل بسته قطعه به مکانیک در تعمیرگاه" /><figcaption><span>02 / DELIVERY</span><b>تحویل به مکانیک یا مشتری</b></figcaption></figure></div>
      </section>

      <section id="seller" className="seller-cta reveal">
        <div><p className="section-kicker">SELLER NETWORK</p><h2>فروش قطعاتت را به یک شبکهٔ هوشمند متصل کن</h2><p>محصولات، موجودی و سفارش‌های خودت را از طریق ابزارهای موجود CarPart مدیریت کن.</p><Link className="auto-btn auto-btn--orange" to="/register">شروع همکاری <span>←</span></Link></div><div className="seller-flow" aria-hidden="true"><span>قطعه</span><i>→</i><span>فروشنده</span><i>→</i><span>سفارش</span></div>
      </section>

      <section id="faq" className="faq-section reveal" aria-labelledby="faq-title"><div><p className="section-kicker">پرسش‌های متداول</p><h2 id="faq-title">پیش از شروع بدانید</h2><p>پاسخ‌ها بر اساس قابلیت‌ها و سیاست‌های فعلی محصول نوشته شده‌اند.</p></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="final-cta reveal"><p>EVERY PART. ONE SMART NETWORK.</p><h2>قطعه موردنیازت، در یک شبکه هوشمند.</h2><div><Link className="auto-btn auto-btn--primary" to="/search">جست‌وجوی قطعات</Link><Link className="auto-btn auto-btn--ghost" to="/register">پیوستن به شبکه</Link></div></section>
    </PublicLayout>
  );
}
