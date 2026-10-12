import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Building2, FileText, GraduationCap, User as UserIcon } from 'lucide-react';
import { api, openDocument } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n, fmtDate, pick } from '../lib/i18n';
import { Badge, PageHeader, State, useLoad, useToast } from '../lib/ui';

export function Profile() {
  const { user, setUser } = useAuth();
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({ firstName: user!.first_name, lastName: user!.last_name, phone: user!.phone ?? '', office: user!.office ?? '' });
  const [pw, setPw] = useState({ current: '', next: '' });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const u = await api('/profile', { method: 'PATCH', json: { ...f, phone: f.phone || null, office: user!.role === 'teacher' ? f.office || null : undefined, locale: lang } });
      setUser(u); toast('success', t('saved'));
    } catch (err) { toast('error', (err as Error).message); }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/profile/password', { method: 'POST', json: pw }); setPw({ current: '', next: '' }); toast('success', t('saved')); }
    catch (err) { toast('error', (err as Error).message); }
  };
  const info: [string, string | undefined][] = user!.role === 'student'
    ? [['Nr.', user!.student_number], [t('classGroup'), user!.class_group], [lang === 'sq' ? 'Drejtimi' : 'Program', pick(user, 'program', lang)]]
    : user!.role === 'teacher' ? [[lang === 'sq' ? 'Pozicioni' : 'Position', user!.position], [t('department'), pick(user, 'department', lang)]] : [];
  return (
    <>
      <PageHeader title={t('profile')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ink-800 text-2xl font-semibold text-brass-300">{user!.first_name[0]}{user!.last_name[0]}</div>
          <h2 className="mt-3 text-lg font-semibold">{user!.first_name} {user!.last_name}</h2>
          <p className="text-sm text-ink-500">{user!.email}</p>
          <div className="mt-2"><Badge tone="brass">{t(user!.role)}</Badge></div>
          <dl className="mt-5 space-y-2 text-left text-sm">
            {info.map(([k, v]) => v ? <div key={k} className="flex justify-between gap-3"><dt className="text-ink-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div> : null)}
          </dl>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <form className="card space-y-4 p-6" onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">{t('firstName')}</label><input className="input" required value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></div>
              <div><label className="label">{t('lastName')}</label><input className="input" required value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></div>
              <div><label className="label">{t('phone')}</label><input className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
              {user!.role === 'teacher' && <div><label className="label">{t('office')}</label><input className="input" value={f.office} onChange={e => setF({ ...f, office: e.target.value })} /></div>}
              <div><label className="label">{t('language')}</label>
                <select className="input" value={lang} onChange={e => setLang(e.target.value as 'sq' | 'en')}><option value="sq">Shqip</option><option value="en">English</option></select></div>
            </div>
            <div className="flex justify-end"><button className="btn-primary">{t('save')}</button></div>
          </form>
          <form className="card space-y-4 p-6" onSubmit={changePw}>
            <h3 className="font-semibold">{t('changePassword')}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">{t('currentPassword')}</label><input type="password" autoComplete="current-password" required className="input" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></div>
              <div><label className="label">{t('newPassword')}</label><input type="password" autoComplete="new-password" minLength={8} required className="input" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
                <p className="mt-1 text-xs text-ink-500">{t('pwHint')}</p></div>
            </div>
            <div className="flex justify-end"><button className="btn-primary">{t('save')}</button></div>
          </form>
        </div>
      </div>
    </>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { t, lang } = useI18n();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api(`/search?q=${encodeURIComponent(q)}`), [q]);
  const total = data ? Object.values(data).reduce((n: number, a: any) => n + a.length, 0) : 0;
  const Section = ({ title, icon: I, children, n }: any) => n ? (
    <section className="card p-5"><h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><I className="h-4 w-4 text-brass-500" />{title}<span className="text-xs font-normal text-ink-400">({n})</span></h2><div className="space-y-2 text-sm">{children}</div></section>
  ) : null;
  return (
    <>
      <PageHeader title={`${t('results')}: “${q}”`} />
      <State loading={loading} error={error} empty={!total} onRetry={reload}>
        {data && <div className="grid gap-4 lg:grid-cols-2">
          <Section title={t('documents')} icon={FileText} n={data.documents.length}>
            {data.documents.map((d: any) => (
              <button key={d.id} onClick={() => openDocument(d.id).catch(e => toast('error', e.message))} className="block w-full rounded-lg p-2 text-left hover:bg-ink-50 dark:hover:bg-ink-800">
                <div className="font-medium">{d.title} <span className="text-xs font-normal text-ink-400">· {pick(d, 'category', lang)}</span></div>
                {d.snippet && <div className="mt-0.5 line-clamp-2 text-xs text-ink-500">…{d.snippet}…</div>}
              </button>
            ))}
          </Section>
          <Section title={t('teachers')} icon={UserIcon} n={data.teachers.length}>
            {data.teachers.map((x: any) => <div key={x.id} className="flex justify-between p-2"><span>{x.first_name} {x.last_name}</span><span className="text-ink-500">{x.position}</span></div>)}
          </Section>
          <Section title={t('coursesCount')} icon={BookOpen} n={data.courses.length}>
            {data.courses.map((c: any) => <Link key={c.id} to={`/chat?course=${c.id}`} className="block p-2 hover:underline">{pick(c, 'name', lang)} <span className="text-xs text-ink-400">{c.code}</span></Link>)}
          </Section>
          <Section title={t('directory')} icon={Building2} n={data.departments.length}>
            {data.departments.map((d: any) => <Link key={d.id} to="/directory" className="block p-2 hover:underline">{pick(d, 'name', lang)}</Link>)}
          </Section>
          <Section title={t('programs')} icon={GraduationCap} n={data.programs.length}>
            {data.programs.map((p: any) => <Link key={p.id} to="/directory" className="block p-2 hover:underline">{pick(p, 'name', lang)}</Link>)}
          </Section>
        </div>}
      </State>
    </>
  );
}

export function Users() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user: me } = useAuth();
  const [filter, setFilter] = useState('');
  const list = useLoad(() => api<any[]>('/users'));
  const toggle = async (u: any) => {
    try { await api(`/users/${u.id}`, { method: 'PATCH', json: { isActive: !u.is_active } }); list.reload(); } catch (e) { toast('error', (e as Error).message); }
  };
  const rows = (list.data ?? []).filter(u => !u.email.endsWith('.invalid')).filter(u => !filter || u.role === filter);
  return (
    <>
      <PageHeader title={t('users')} subtitle={lang === 'sq' ? 'Llogaritë me qasje në platformë (stafi i drejtorisë shfaqet te “Departamente & stafi”).' : 'Accounts with platform access (staff directory entries are under “Departments & staff”).'}
        actions={<select className="input w-auto" value={filter} onChange={e => setFilter(e.target.value)}><option value="">{t('all')}</option><option value="student">{t('student')}</option><option value="teacher">{t('teacher')}</option><option value="admin">{t('admin')}</option></select>} />
      <State loading={list.loading} error={list.error} empty={!rows.length} onRetry={list.reload}>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800"><tr><th className="p-3">{t('firstName')}</th><th className="p-3">{t('email')}</th><th className="p-3">{t('role')}</th><th className="p-3">{t('uploaded')}</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {rows.map(u => (
                <tr key={u.id}>
                  <td className="p-3 font-medium">{u.first_name} {u.last_name}</td><td className="p-3 text-ink-500">{u.email}</td>
                  <td className="p-3"><Badge>{t(u.role)}</Badge></td><td className="p-3 text-ink-500">{fmtDate(u.created_at, lang)}</td>
                  <td className="p-3 text-right">{u.id !== me?.id && <button className={u.is_active ? 'btn-ghost text-red-600' : 'btn-ghost'} onClick={() => toggle(u)}>{u.is_active ? t('deactivate') : t('activate')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
    </>
  );
}
