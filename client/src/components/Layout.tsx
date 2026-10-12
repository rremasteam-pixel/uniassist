import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, Building2, CalendarClock, CalendarDays, FileText, GraduationCap, LayoutDashboard, LogOut,
  Megaphone, Menu, MessageSquareText, Moon, Search, Sun, User, Users, X, HelpCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n, type Key } from '../lib/i18n';
import { useTheme } from '../lib/ui';
import { api } from '../lib/api';
import type { Role } from '../lib/types';

type Item = { to: string; key: Key; icon: any; roles: Role[] };
const NAV: Item[] = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, roles: ['student', 'teacher', 'admin'] },
  { to: '/chat', key: 'assistant', icon: MessageSquareText, roles: ['student', 'teacher', 'admin'] },
  { to: '/courses', key: 'courses', icon: BookOpen, roles: ['student', 'teacher'] },
  { to: '/schedule', key: 'schedule', icon: CalendarClock, roles: ['student', 'teacher'] },
  { to: '/exams', key: 'exams', icon: CalendarDays, roles: ['student', 'teacher', 'admin'] },
  { to: '/documents', key: 'documents', icon: FileText, roles: ['student', 'teacher', 'admin'] },
  { to: '/questions', key: 'questions', icon: HelpCircle, roles: ['teacher'] },
  { to: '/announcements', key: 'announcements', icon: Megaphone, roles: ['student', 'teacher', 'admin'] },
  { to: '/directory', key: 'directory', icon: Building2, roles: ['student', 'teacher', 'admin'] },
  { to: '/users', key: 'users', icon: Users, roles: ['admin'] },
  { to: '/notifications', key: 'notifications', icon: Bell, roles: ['student', 'teacher', 'admin'] },
  { to: '/profile', key: 'profile', icon: User, roles: ['student', 'teacher', 'admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    const load = () => api('/dashboard/summary').then(s => setUnread(s.unread)).catch(() => {});
    load(); const i = setInterval(load, 60_000); return () => clearInterval(i);
  }, []);

  const items = NAV.filter(i => user && i.roles.includes(user.role));
  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); if (q.trim().length >= 2) { nav(`/search?q=${encodeURIComponent(q.trim())}`); setOpen(false); } };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brass-500 text-ink-950"><GraduationCap className="h-5 w-5" /></div>
        <div>
          <div className="font-display text-lg font-semibold leading-none text-white">UniAssist</div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-ink-300">Beqir Çela · Durrës</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map(({ to, key, icon: I }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition
              ${isActive ? 'bg-white/10 font-medium text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white'}`}>
            <I className="h-4 w-4" /><span className="flex-1">{t(key)}</span>
            {key === 'notifications' && unread > 0 && <span className="rounded-full bg-brass-500 px-1.5 text-[11px] font-semibold text-ink-950">{unread}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 text-sm text-white">{user?.first_name} {user?.last_name}</div>
        <div className="mb-3 text-xs text-ink-300">{user && t(user.role)}</div>
        <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-200 hover:bg-white/5" onClick={logout}>
          <LogOut className="h-4 w-4" />{t('logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink-900 md:block dark:bg-ink-950 dark:border-r dark:border-ink-800">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink-900">{sidebar}
            <button className="absolute right-3 top-5 text-ink-200" onClick={() => setOpen(false)} aria-label="close menu"><X /></button>
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-100 bg-ink-50/85 px-4 py-3 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85 md:px-8">
        <button className="btn-ghost p-2 md:hidden" onClick={() => setOpen(true)} aria-label="open menu"><Menu className="h-5 w-5" /></button>
        <form onSubmit={submitSearch} className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <input className="input pl-9" placeholder={t('searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} aria-label={t('search')} />
        </form>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-ghost px-2 text-xs font-semibold" onClick={() => setLang(lang === 'sq' ? 'en' : 'sq')} aria-label={t('language')}>
            {lang === 'sq' ? 'EN' : 'SQ'}
          </button>
          <button className="btn-ghost p-2" onClick={toggle} aria-label="theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <NavLink to="/notifications" className="btn-ghost relative p-2" aria-label={t('notifications')}>
            <Bell className="h-4 w-4" />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brass-500" />}
          </NavLink>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8"><Outlet /></main>
    </div>
  );
}
