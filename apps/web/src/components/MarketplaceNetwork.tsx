import { Link } from 'react-router-dom';

const participants = [
  { key: 'buyer', label: 'خریدار', detail: 'جست‌وجو و انتخاب', icon: '⌕' },
  { key: 'mechanic', label: 'مکانیک', detail: 'ثبت نیاز قطعه', icon: '⚙' },
  { key: 'seller', label: 'فروشنده', detail: 'بستهٔ فروشنده ۱', icon: '▦' },
  { key: 'supplier', label: 'تأمین‌کننده', detail: 'بستهٔ فروشنده ۲', icon: '◇' },
  { key: 'courier', label: 'پیک', detail: 'دریافت و تحویل', icon: '↗' },
] as const;

/** نمایش توضیحی معماری واقعی سفارش والد و بسته‌های فروشنده؛ داده‌ها نمایشی‌اند. */
export function MarketplaceNetwork(): JSX.Element {
  return (
    <section id="network" className="network-section reveal" aria-labelledby="network-title">
      <div className="section-heading section-heading--dark">
        <div>
          <p className="section-kicker">شبکهٔ هوشمند تأمین</p>
          <h2 id="network-title">یک سفارش؛ چند مسیر هماهنگ</h2>
        </div>
        <p>کارپارت سفارش اصلی را به بسته‌های مستقل هر فروشنده تفکیک می‌کند؛ هر بسته وضعیت آماده‌سازی و ارسال خودش را دارد و زیر سفارش والد قابل پیگیری است.</p>
      </div>

      <div className="network-canvas" aria-describedby="network-note">
        <div className="network-grid" aria-hidden="true" />
        <svg className="network-lines" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="networkBlue" x1="0" x2="1"><stop stopColor="#3185ff" /><stop offset="1" stopColor="#49d8ff" /></linearGradient>
            <filter id="networkGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <path className="network-path network-path--one" d="M500 250 C390 245 340 120 210 105" />
          <path className="network-path network-path--two" d="M500 250 C610 245 660 120 790 105" />
          <path className="network-path network-path--three" d="M500 250 C385 260 325 390 185 400" />
          <path className="network-path network-path--four" d="M500 250 C615 260 675 390 815 400" />
          <path className="network-path network-path--five" d="M500 250 L500 455" />
          <circle className="network-packet packet-one" cx="0" cy="0" r="5"><animateMotion dur="4.5s" repeatCount="indefinite" path="M500 250 C390 245 340 120 210 105" /></circle>
          <circle className="network-packet packet-two" cx="0" cy="0" r="5"><animateMotion dur="5s" begin="1s" repeatCount="indefinite" path="M500 250 C615 260 675 390 815 400" /></circle>
        </svg>

        <div className="network-core">
          <span className="network-core__pulse" aria-hidden="true" />
          <small>سفارش والد</small><strong>یک خرید</strong><span>۲ بستهٔ فروشنده</span>
        </div>

        {participants.map((participant, index) => (
          <article key={participant.key} className={`network-node network-node--${index + 1}`} tabIndex={0}>
            <span className="network-node__icon" aria-hidden="true">{participant.icon}</span>
            <div><strong>{participant.label}</strong><small>{participant.detail}</small></div>
          </article>
        ))}

        <div className="network-package network-package--one"><span>بسته ۰۱</span><b>آماده‌سازی</b></div>
        <div className="network-package network-package--two"><span>بسته ۰۲</span><b>تأیید فروشنده</b></div>
      </div>

      <div className="network-mobile" aria-label="نمای ساده شبکه سفارش">
        <div className="network-mobile__core"><small>سفارش والد</small><b>یک خرید</b></div>
        <span aria-hidden="true">↓</span>
        <div className="network-mobile__packages"><div><small>فروشنده ۱</small><b>بسته ۰۱</b></div><div><small>فروشنده ۲</small><b>بسته ۰۲</b></div></div>
        <span aria-hidden="true">↓</span>
        <div className="network-mobile__courier"><small>گردش ارسال</small><b>تحویل بسته‌ها به مقصد</b></div>
      </div>

      <div className="network-footer">
        <p id="network-note"><span>نمایش مفهومی</span> این نمودار معماری محصول را توضیح می‌دهد و وضعیت زندهٔ سفارش نیست.</p>
        <Link to="/search">ورود به جست‌وجوی واقعی <span aria-hidden="true">←</span></Link>
      </div>
    </section>
  );
}
