import type { ReactNode } from 'react';
import clsx from 'clsx';

interface RoleHeroProps {
  variant: 'mechanic' | 'seller' | 'courier' | 'admin';
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  metric?: ReactNode;
}

const BRAND_ART: Partial<Record<RoleHeroProps['variant'], string>> = {
  mechanic: '/branding/mechanic.webp',
  seller: '/branding/seller.webp',
  courier: '/branding/courier.webp',
};

/** لوگوی نقش با نسخهٔ بهینهٔ WebP؛ مدیریت فعلاً نشان برداری داخلی دارد. */
function RoleArtwork({ variant }: { variant: RoleHeroProps['variant'] }): JSX.Element {
  const source = BRAND_ART[variant];
  if (source) {
    return <img className="role-art role-art--brand" src={source} width="160" height="160" alt="" aria-hidden="true" decoding="async" />;
  }
  return (
    <svg className="role-art" viewBox="0 0 56 56" aria-hidden="true">
      <defs><linearGradient id="role-gradient-admin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#60a5fa" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
      <circle cx="28" cy="28" r="25" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.16)" />
      <path d="M11 12h34v25H11zM17 31l6-7 6 4 8-10 3 3M18 42h20" fill="none" stroke="url(#role-gradient-admin)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="role-art-dot" cx="45" cy="10" r="3" fill="#60a5fa" />
    </svg>
  );
}

export function RoleHero({ variant, eyebrow, title, description, action, metric }: RoleHeroProps): JSX.Element {
  return (
    <section className={clsx('role-hero', `role-hero--${variant}`)}>
      <div className="relative z-10 min-w-0 flex-1">
        <p className="role-hero__eyebrow"><span className="role-hero__pulse" />{eyebrow}</p>
        <h2 className="mt-2 text-xl font-black leading-8 text-white">{title}</h2>
        <p className="mt-1 max-w-[17rem] text-xs leading-6 text-white/70">{description}</p>
        {metric ? <div className="mt-3 text-sm font-bold text-white">{metric}</div> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
      <RoleArtwork variant={variant} />
    </section>
  );
}
