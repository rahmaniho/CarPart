import type { ReactNode } from 'react';
import { AppShell, type TabDef } from '../../components/AppShell';

export const ADMIN_TABS: TabDef[] = [
  { to: '/admin', label: 'نبض سامانه', icon: '◉' },
  { to: '/admin/users', label: 'کاربران', icon: '♟' },
  { to: '/admin/reviews', label: 'تأییدها', icon: '✓' },
  { to: '/admin/operations', label: 'عملیات', icon: '⌁' },
];

export function AdminShell({ title, children, headerExtra }: { title: string; children: ReactNode; headerExtra?: ReactNode }): JSX.Element {
  return <AppShell title={title} tabs={ADMIN_TABS} headerExtra={headerExtra}>{children}</AppShell>;
}
