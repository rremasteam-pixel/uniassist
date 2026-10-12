import { Link } from 'react-router-dom';
import { BookOpen, Building2, CalendarDays, ExternalLink, MapPin, MessageSquareText, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n, fmtDate, pick } from '../lib/i18n';
import { Badge, PageHeader, State, useLoad } from '../lib/ui';
import type { Course } from '../lib/types';

export function Courses() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api<Course[]>('/academics/courses'));
  const kind = { general: t('generalEd'), theory: t('theory'), practice: t('practice') };
  return (
    <>
      <PageHeader title={t('courses')} actions={<Badge tone="amber">{t('demoData')}</Badge>} />
      <State loading={loading} error={error} empty={!data?.length} onRetry={reload}>
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map(c => (
            <div key={c.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-xs font-mono text-ink-500">{c.code}</div><h3 className="mt-1 text-lg font-semibold">{pick(c, 'name', lang)}</h3></div>
                <Badge tone={c.kind === 'practice' ? 'brass' : 'ink'}>{kind[c.kind]}</Badge>
              </div>
              <p className="mt-2 flex-1 text-sm text-ink-600 dark:text-ink-300">{pick(c, 'description', lang)}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                <span>{c.weekly_hours} {t('hoursWeek')}</span>
                {pick(c, 'program', lang) && <span>{pick(c, 'program', lang)}</span>}
                {c.teachers.length > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.teachers.map(x => x.name).join(', ')}</span>}
              </div>
              <Link to={`/chat?course=${c.id}`} className="btn-ghost mt-3 self-start px-2 text-xs"><MessageSquareText className="h-3.5 w-3.5" />{t('askAboutCourse')}</Link>
            </div>
          ))}
        </div>
      </State>
    </>
  );
}

export function Schedule() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<any[]>('/academics/schedule'));
  const days = t('weekdays').split(',');
  const today = new Date().getDay();
  return (
    <>
      <PageHeader title={t('schedule')} subtitle={user?.class_group} actions={<Badge tone="amber">{t('demoData')}</Badge>} />
      <State loading={loading} error={error} empty={!data?.length} onRetry={reload}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {days.map((d, i) => {
            const rows = (data ?? []).filter(s => s.weekday === i + 1);
            return (
              <div key={d} className={`card p-4 ${today === i + 1 ? 'ring-2 ring-brass-400' : ''}`}>
                <h3 className="mb-3 text-sm font-semibold">{d}</h3>
                {rows.length === 0 && <p className="text-xs text-ink-400">—</p>}
                <div className="space-y-2">
                  {rows.map(s => (
                    <div key={s.id} className={`rounded-xl border-l-4 bg-ink-50 p-2.5 text-xs dark:bg-ink-800/60 ${s.kind === 'practice' ? 'border-brass-500' : 'border-ink-500'}`}>
                      <div className="font-mono text-ink-500">{s.start}–{s.end}</div>
                      <div className="mt-0.5 font-medium text-ink-800 dark:text-ink-100">{pick(s, 'name', lang)}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-ink-500"><MapPin className="h-3 w-3" />{s.room}{user?.role === 'teacher' ? ` · ${s.class_group}` : s.teacher ? ` · ${s.teacher}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </State>
    </>
  );
}

export function Exams() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api<any[]>('/academics/exams'));
  const kinds: Record<string, string> = { matura: 'Matura', level: lang === 'sq' ? 'Provim niveli' : 'Level exam', term: lang === 'sq' ? 'Test periudhe' : 'Term test', practicum: lang === 'sq' ? 'Provim praktik' : 'Practical exam' };
  return (
    <>
      <PageHeader title={t('exams')} subtitle={lang === 'sq' ? 'Datat zyrtare publikohen nga shkolla te rubrika “Njoftime”.' : 'Official dates are published by the school under “Njoftime”.'} />
      <State loading={loading} error={error} empty={!data?.length} onRetry={reload}>
        <div className="space-y-3">
          {data?.map(e => {
            const d = new Date(e.starts_at); const past = d < new Date();
            return (
              <div key={e.id} className={`card flex items-center gap-4 p-4 ${past ? 'opacity-60' : ''}`}>
                <div className="w-16 shrink-0 rounded-xl bg-ink-800 py-2 text-center text-white dark:bg-ink-700">
                  <div className="text-xl font-semibold leading-none">{d.getDate()}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-brass-300">{d.toLocaleString(lang === 'sq' ? 'sq-AL' : 'en-GB', { month: 'short' })}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-500">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(e.starts_at, lang, true)}</span>
                    {e.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.room}</span>}
                    {e.class_group && <span>{e.class_group}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1"><Badge>{kinds[e.kind]}</Badge>{e.is_demo && <Badge tone="amber">{t('demoData')}</Badge>}</div>
              </div>
            );
          })}
        </div>
      </State>
    </>
  );
}

export function Directory() {
  const { t, lang } = useI18n();
  const deps = useLoad(() => api<any[]>('/academics/departments'));
  const staff = useLoad(() => api<any[]>('/academics/teachers'));
  return (
    <>
      <PageHeader title={t('directory')} subtitle={lang === 'sq' ? 'Sipas faqes zyrtare beqircela.edu.al — stafi mësimor 2024–2025' : 'From the official site beqircela.edu.al — teaching staff 2024–2025'} />
      <State loading={deps.loading} error={deps.error} onRetry={deps.reload}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deps.data?.map(d => (
            <div key={d.id} className="card p-5">
              <div className="flex items-center gap-2 text-ink-500"><Building2 className="h-4 w-4" /><span className="text-xs">{d.kind === 'department' ? t('department') : lang === 'sq' ? 'Ekip lëndor' : 'Subject team'}</span></div>
              <h3 className="mt-2 font-semibold">{pick(d, 'name', lang)}</h3>
              {d.programs.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{d.programs.map((p: any) => <Badge key={p.id} tone="brass"><BookOpen className="h-3 w-3" />{pick(p, 'name', lang)}</Badge>)}</div>}
              {d.source_url && <a href={d.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-ink-500 hover:underline">{t('officialSource')}<ExternalLink className="h-3 w-3" /></a>}
            </div>
          ))}
        </div>
      </State>
      <h2 className="mb-3 mt-8 text-lg font-semibold">{t('teachers')} <span className="text-sm font-normal text-ink-500">({staff.data?.length ?? '…'})</span></h2>
      <State loading={staff.loading} error={staff.error} onRetry={staff.reload}>
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {staff.data?.map(s => (
            <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <span className="min-w-[180px] flex-1 font-medium">{s.first_name} {s.last_name}</span>
              <span className="text-ink-500">{s.position}</span>
              {pick(s, 'department', lang) && <span className="text-xs text-ink-400">{pick(s, 'department', lang)}</span>}
            </div>
          ))}
        </div>
      </State>
    </>
  );
}
