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

const palette = {
  mechanic: { accent: '#22d3ee', soft: '#0e7490' },
  seller: { accent: '#fbbf24', soft: '#d97706' },
  courier: { accent: '#a78bfa', soft: '#7c3aed' },
  admin: { accent: '#60a5fa', soft: '#2563eb' },
};

/** گرافیک برداری سبک؛ بدون درخواست شبکه و مناسب نمایشگرهای با تراکم بالا. */
function RoleArtwork({ variant }: { variant: RoleHeroProps['variant'] }): JSX.Element {
  const color = palette[variant];
  const glyph = variant === 'mechanic' ? 'M12 7h28M18 15h16M10 23h30M17 31h17' : variant === 'seller' ? 'M12 17h28l-3-8H15l-3 8Zm4 0v18h20V17M22 35V24h8v11' : variant === 'courier' ? 'M10 29h8l4-15h13l5 15h4M21 29h15M16 34a3 3 0 1 0 0 .1M39 34a3 3 0 1 0 0 .1' : 'M11 12h34v25H11zM17 31l6-7 6 4 8-10 3 3M18 42h20';

  return (
    <svg className="role-art" viewBox="0 0 56 56" aria-hidden="true">
      <defs>
        <linearGradient id={`role-gradient-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={color.accent} />
          <stop offset="1" stopColor={color.soft} />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="25" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.16)" />
      <path d={glyph} fill="none" stroke={`url(#role-gradient-${variant})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="role-art-dot" cx="45" cy="10" r="3" fill={color.accent} />
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
