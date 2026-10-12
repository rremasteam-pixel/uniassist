import { Link } from 'react-router-dom';
import { ArrowRight, Bell, BookOpen, CalendarDays, FileText, GraduationCap, MessageSquareText, Sparkles, Users, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n, fmtDate, pick } from '../lib/i18n';
import { Badge, PageHeader, State, StatCard, useLoad } from '../lib/ui';

export default function Dashboard() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminDashboard /> : <MemberDashboard />;
}

function QuickAsk() {
  const { t } = useI18n();
  return (
    <div className="card relative overflow-hidden bg-ink-900 p-6 text-white dark:bg-ink-900">
      <div className="flex items-center gap-2 text-brass-300"><Sparkles className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-widest">{t('assistant')}</span></div>
      <h2 className="mt-2 text-xl font-semibold">{t('quickAsk')}</h2>
      <p className="mt-1 max-w-xl text-sm text-ink-300">{t('chatIntro')}</p>
      <Link to="/chat" className="btn mt-4 bg-brass-500 text-ink-950 hover:bg-brass-400"><MessageSquareText className="h-4 w-4" />{t('newChat')}<ArrowRight className="h-4 w-4" /></Link>
      <GraduationCap className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 text-white/5" />
    </div>
  );
}

function MemberDashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const summary = useLoad(() => api('/dashboard/summary'));
  const courses = useLoad(() => api<any[]>('/academics/courses'));
  const schedule = useLoad(() => api<any[]>('/academics/schedule'));
  const today = new Date().getDay();
  const todays = (schedule.data ?? []).filter(s => s.weekday === today);
  const isTeacher = user?.role === 'teacher';

  return (
    <>
      <PageHeader title={`${t('hello')}, ${user?.first_name}`}
        subtitle={isTeacher ? [user?.position, pick(user, 'department', lang)].filter(Boolean).join(' · ') : [user?.class_group, pick(user, 'program', lang)].filter(Boolean).join(' · ')} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><QuickAsk /></div>
        <div className="grid gap-4">
          <StatCard icon={Bell} label={t('unread')} value={summary.data?.unread ?? '–'} />
          <div className="card p-5">
            <div className="flex items-center gap-2 text-xs text-ink-500"><CalendarDays className="h-4 w-4" />{t('nextExam')}</div>
            {summary.data?.nextExam
              ? <><div className="mt-2 font-medium">{summary.data.nextExam.title}</div><div className="text-sm text-ink-500">{fmtDate(summary.data.nextExam.starts_at, lang, true)}</div></>
              : <div className="mt-2 text-sm text-ink-400">—</div>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{t('courses')}</h2><Link to="/courses" className="text-sm text-ink-500 hover:underline">→</Link></div>
          <State loading={courses.loading} error={courses.error} empty={!courses.data?.length} onRetry={courses.reload}>
            <div className="grid gap-2">
              {courses.data?.slice(0, 6).map(c => (
                <div key={c.id} className="card flex items-center gap-3 p-3">
                  <BookOpen className="h-4 w-4 text-brass-500" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{pick(c, 'name', lang)}</div><div className="text-xs text-ink-500">{c.code} · {c.weekly_hours} {t('hoursWeek')}</div></div>
                  <Link to={`/chat?course=${c.id}`} className="btn-ghost px-2 py-1 text-xs">{t('askAboutCourse')}</Link>
                </div>
              ))}
            </div>
          </State>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('schedule')} — {t('weekdays').split(',')[today - 1] ?? '—'}</h2>
            <Badge tone="amber">{t('demoData')}</Badge>
          </div>
          <State loading={schedule.loading} error={schedule.error} empty={!todays.length} onRetry={schedule.reload}>
            <div className="card divide-y divide-ink-100 dark:divide-ink-800">
              {todays.map(s => (
                <div key={s.id} className="flex items-center gap-4 p-3 text-sm">
                  <span className="w-24 font-mono text-xs text-ink-500">{s.start}–{s.end}</span>
                  <span className="flex-1 font-medium">{pick(s, 'name', lang)}</span>
                  <span className="text-xs text-ink-500">{isTeacher ? s.class_group : s.room}</span>
                </div>
              ))}
            </div>
          </State>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">{t('announcements')}</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {(summary.data?.announcements ?? []).map((a: any) => (
            <Link to="/announcements" key={a.id} className="card p-4 transition hover:shadow"><div className="text-sm font-medium">{a.title}</div><div className="mt-1 text-xs text-ink-500">{fmtDate(a.created_at, lang)}</div></Link>
          ))}
        </div>
      </section>
    </>
  );
}

function AdminDashboard() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api('/dashboard/admin'));
  const max = Math.max(1, ...(data?.activity ?? []).map((a: any) => a.questions));
  return (
    <>
      <PageHeader title={t('dashboard')} subtitle="Shkolla e Mesme Profesionale “Beqir Çela”" actions={<Link to="/documents" className="btn-primary"><FileText className="h-4 w-4" />{t('upload')}</Link>} />
      <State loading={loading} error={error} onRetry={reload}>
        {data && <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard icon={GraduationCap} label={t('students')} value={data.counts.students} />
            <StatCard icon={Users} label={t('teachers')} value={data.counts.teachers} />
            <StatCard icon={BookOpen} label={t('coursesCount')} value={data.counts.courses} />
            <StatCard icon={FileText} label={t('docsCount')} value={data.counts.documents} />
            <StatCard icon={MessageSquareText} label={t('conversations')} value={data.counts.conversations} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="text-base font-semibold">{t('activity')}</h2>
              <div className="mt-4 flex h-36 items-end gap-1.5" role="img" aria-label={t('activity')}>
                {data.activity.map((a: any) => (
                  <div key={a.day} className="group relative flex-1">
                    <div className="rounded-t bg-ink-700 transition group-hover:bg-brass-500 dark:bg-ink-500" style={{ height: `${Math.max(3, (a.questions / max) * 128)}px` }} />
                    <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{a.day.slice(5)}: {a.questions}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h2 className="text-base font-semibold">{t('faq')}</h2>
              <ol className="mt-3 space-y-2 text-sm">
                {data.faq.length === 0 && <li className="text-ink-400">{t('empty')}</li>}
                {data.faq.map((f: any, i: number) => (
                  <li key={i} className="flex gap-3"><span className="w-5 text-ink-400">{i + 1}.</span><span className="flex-1">{f.question}</span><Badge>{f.count}</Badge></li>
                ))}
              </ol>
            </div>
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold"><AlertCircle className="h-4 w-4 text-amber-500" />{t('unanswered')}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.unanswered.length === 0 && <li className="text-ink-400">{t('empty')}</li>}
                {data.unanswered.map((u: any, i: number) => <li key={i} className="flex justify-between gap-3"><span>{u.question}</span><span className="shrink-0 text-xs text-ink-400">{fmtDate(u.created_at, lang)}</span></li>)}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="text-base font-semibold">{t('recentDocs')}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.recentDocuments.map((d: any) => (
                  <li key={d.id} className="flex items-center gap-3"><FileText className="h-4 w-4 text-ink-400" /><span className="flex-1 truncate">{d.title}</span>
                    <Badge tone={d.status === 'ready' ? 'green' : d.status === 'failed' ? 'red' : 'amber'}>{t(d.status)}</Badge></li>
                ))}
              </ul>
            </div>
            <div className="card p-5 lg:col-span-2">
              <h2 className="text-base font-semibold">{t('recentUsers')}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {data.recentUsers.map((u: any) => (
                      <tr key={u.id}><td className="py-2">{u.first_name} {u.last_name}</td><td className="text-ink-500">{u.email.endsWith('.invalid') ? '—' : u.email}</td>
                        <td><Badge>{t(u.role)}</Badge></td><td className="text-right text-xs text-ink-400">{fmtDate(u.created_at, lang)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>}
      </State>
    </>
  );
}
