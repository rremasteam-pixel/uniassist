import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Moon, Sun } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n, pick } from '../lib/i18n';
import { useTheme, useToast } from '../lib/ui';
import { api, ApiError } from '../lib/api';

function Shell({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { dark, toggle } = useTheme();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brass-500 text-ink-950"><GraduationCap /></div>
          <span className="font-display text-2xl">UniAssist</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-brass-300">Shkolla e Mesme Profesionale</p>
          <h1 className="mt-3 font-display text-5xl leading-tight">“Beqir Çela”</h1>
          <p className="mt-4 max-w-md text-ink-200">{t('appTagline')}. {t('chatIntro')}</p>
        </div>
        <p className="text-xs text-ink-400">Lagjia 14, Rruga "Bajram Tusha", Shkozet, Durrës · 052 26 45 28</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full border-[40px] border-white/5" />
      </div>
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex justify-end gap-1">
          <button className="btn-ghost px-2 text-xs font-semibold" onClick={() => setLang(lang === 'sq' ? 'en' : 'sq')}>{lang === 'sq' ? 'EN' : 'SQ'}</button>
          <button className="btn-ghost p-2" onClick={toggle} aria-label="theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await login(email, password); } catch (err) { toast('error', (err as Error).message); } finally { setBusy(false); }
  };
  const demo = [['nxenes@uniassist.demo', 'Nxenes2026!', t('student')], ['mesues.tik@uniassist.demo', 'Mesues2026!', t('teacher')], ['admin@uniassist.demo', 'Admin2026!', t('admin')]];
  return (
    <Shell>
      <h2 className="text-3xl font-semibold">{t('login')}</h2>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div><label className="label" htmlFor="email">{t('email')}</label><input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="pw">{t('password')}</label><input id="pw" type="password" required autoComplete="current-password" className="input" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('loading') : t('login')}</button>
      </form>
      <p className="mt-4 text-sm text-ink-500">{t('noAccount')} <Link className="font-medium text-ink-800 underline dark:text-brass-300" to="/register">{t('register')}</Link></p>
      <div className="mt-8 rounded-xl border border-dashed border-ink-200 p-4 dark:border-ink-700">
        <p className="label">{t('demoAccounts')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {demo.map(([e, p, r]) => <button key={e} type="button" className="btn-ghost border border-ink-200 py-1 text-xs dark:border-ink-700" onClick={() => { setEmail(e); setPassword(p); }}>{r}</button>)}
        </div>
      </div>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const [opts, setOpts] = useState<{ classGroups: any[]; departments: any[] }>({ classGroups: [], departments: [] });
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'student', classGroupId: '', departmentId: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/auth/options').then(setOpts).catch(() => {}); }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrors({});
    try {
      await register({
        ...f, locale: lang,
        classGroupId: f.role === 'student' && f.classGroupId ? Number(f.classGroupId) : undefined,
        departmentId: f.role === 'teacher' && f.departmentId ? Number(f.departmentId) : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError && err.details?.fieldErrors) setErrors(err.details.fieldErrors);
      toast('error', (err as Error).message);
    } finally { setBusy(false); }
  };
  const Err = ({ k }: { k: string }) => errors[k] ? <p className="mt-1 text-xs text-red-600">{errors[k].join(', ')}</p> : null;

  return (
    <Shell>
      <h2 className="text-3xl font-semibold">{t('register')}</h2>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t('firstName')}</label><input required className="input" value={f.firstName} onChange={set('firstName')} /><Err k="firstName" /></div>
          <div><label className="label">{t('lastName')}</label><input required className="input" value={f.lastName} onChange={set('lastName')} /><Err k="lastName" /></div>
        </div>
        <div><label className="label">{t('email')}</label><input required type="email" className="input" value={f.email} onChange={set('email')} /><Err k="email" /></div>
        <div><label className="label">{t('password')}</label><input required type="password" autoComplete="new-password" minLength={8} className="input" value={f.password} onChange={set('password')} />
          <p className="mt-1 text-xs text-ink-500">{t('pwHint')}</p><Err k="password" /></div>
        <div><label className="label">{t('role')}</label>
          <select className="input" value={f.role} onChange={set('role')}><option value="student">{t('student')}</option><option value="teacher">{t('teacher')}</option></select></div>
        {f.role === 'student'
          ? <div><label className="label">{t('classGroup')}</label><select className="input" value={f.classGroupId} onChange={set('classGroupId')}><option value="">—</option>{opts.classGroups.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          : <div><label className="label">{t('department')}</label><select className="input" value={f.departmentId} onChange={set('departmentId')}><option value="">—</option>{opts.departments.map(d => <option key={d.id} value={d.id}>{pick(d, 'name', lang)}</option>)}</select></div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('loading') : t('register')}</button>
      </form>
      <p className="mt-4 text-sm text-ink-500">{t('haveAccount')} <Link className="font-medium text-ink-800 underline dark:text-brass-300" to="/login">{t('login')}</Link></p>
    </Shell>
  );
}
