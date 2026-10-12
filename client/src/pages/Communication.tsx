import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Megaphone, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n, fmtDate, pick } from '../lib/i18n';
import { Badge, Modal, PageHeader, State, useLoad, useToast } from '../lib/ui';
import type { Course } from '../lib/types';

export function Announcements() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const list = useLoad(() => api<any[]>('/announcements'));
  const [open, setOpen] = useState(false);
  const canPost = user?.role === 'teacher' || user?.role === 'admin';
  const del = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    try { await api(`/announcements/${id}`, { method: 'DELETE' }); list.reload(); } catch (e) { toast('error', (e as Error).message); }
  };
  return (
    <>
      <PageHeader title={t('announcements')} actions={canPost && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('newAnnouncement')}</button>} />
      <State loading={list.loading} error={list.error} empty={!list.data?.length} onRetry={list.reload}>
        <div className="space-y-3">
          {list.data?.map(a => (
            <article key={a.id} className="card p-5">
              <div className="flex items-start gap-3">
                <Megaphone className="mt-1 h-4 w-4 text-brass-500" />
                <div className="flex-1">
                  <h3 className="font-semibold">{a.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <span>{a.author}</span><span>·</span><span>{fmtDate(a.created_at, lang, true)}</span>
                    <Badge tone={a.course_id ? 'brass' : 'ink'}>{a.course_id ? pick(a, 'course', lang) : t('schoolWide')}</Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700 dark:text-ink-200">{a.body}</p>
                </div>
                {(user?.role === 'admin' || a.author_id === user?.id) && <button className="btn-ghost p-2" onClick={() => del(a.id)} aria-label={t('delete')}><Trash2 className="h-4 w-4" /></button>}
              </div>
            </article>
          ))}
        </div>
      </State>
      {open && <NewAnnouncement onClose={() => setOpen(false)} onDone={() => { setOpen(false); list.reload(); }} />}
    </>
  );
}

function NewAnnouncement({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const courses = useLoad(() => api<Course[]>(`/academics/courses?mine=${user?.role === 'teacher'}`));
  const [f, setF] = useState({ title: '', body: '', courseId: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await api('/announcements', { method: 'POST', json: { title: f.title, body: f.body, courseId: f.courseId ? Number(f.courseId) : null } });
      toast('success', t('saved')); onDone();
    } catch (err) { toast('error', (err as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('newAnnouncement')}>
      <form className="space-y-4" onSubmit={submit}>
        <div><label className="label">{t('course')}</label>
          <select className="input" value={f.courseId} required={user?.role === 'teacher'} onChange={e => setF({ ...f, courseId: e.target.value })}>
            {user?.role === 'admin' ? <option value="">{t('schoolWide')}</option> : <option value="">—</option>}
            {courses.data?.map(c => <option key={c.id} value={c.id}>{pick(c, 'name', lang)}</option>)}
          </select></div>
        <div><label className="label">{t('title')}</label><input required minLength={3} maxLength={150} className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
        <div><label className="label">{t('body')}</label><textarea required minLength={3} rows={5} className="input" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{t('cancel')}</button><button className="btn-primary" disabled={busy}>{t('create')}</button></div>
      </form>
    </Modal>
  );
}

export function Notifications() {
  const { t, lang } = useI18n();
  const list = useLoad(() => api<any[]>('/notifications'));
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); list.reload(); };
  const read = (id: number) => api(`/notifications/${id}/read`, { method: 'POST' }).then(list.reload);
  return (
    <>
      <PageHeader title={t('notifications')} actions={<button className="btn-ghost" onClick={readAll}><CheckCheck className="h-4 w-4" />{t('markAllRead')}</button>} />
      <State loading={list.loading} error={list.error} empty={!list.data?.length} onRetry={list.reload}>
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {list.data?.map(n => (
            <Link key={n.id} to={n.link ?? '#'} onClick={() => !n.read_at && read(n.id)} className={`flex gap-3 p-4 transition hover:bg-ink-50 dark:hover:bg-ink-800/50 ${n.read_at ? '' : 'bg-brass-300/10'}`}>
              <Bell className={`mt-0.5 h-4 w-4 ${n.read_at ? 'text-ink-300' : 'text-brass-500'}`} />
              <div className="flex-1"><div className={`text-sm ${n.read_at ? '' : 'font-semibold'}`}>{n.title}</div>{n.body && <div className="mt-0.5 text-sm text-ink-500">{n.body}</div>}</div>
              <span className="text-xs text-ink-400">{fmtDate(n.created_at, lang)}</span>
            </Link>
          ))}
        </div>
      </State>
    </>
  );
}

export function Questions() {
  const { t, lang } = useI18n();
  const courses = useLoad(() => api<Course[]>('/academics/courses'));
  const [courseId, setCourseId] = useState('');
  const list = useLoad(() => api<any[]>(`/academics/questions${courseId ? `?courseId=${courseId}` : ''}`), [courseId]);
  return (
    <>
      <PageHeader title={t('questions')} subtitle={lang === 'sq' ? 'Pyetjet që nxënësit i bëjnë asistentit në kontekstin e lëndëve tuaja. Pyetjet pa përgjigje tregojnë materiale që mungojnë.' : 'Questions students ask the assistant in the context of your courses. Unanswered ones point to missing materials.'}
        actions={<select className="input w-auto" value={courseId} onChange={e => setCourseId(e.target.value)}><option value="">{t('all')}</option>{courses.data?.map(c => <option key={c.id} value={c.id}>{pick(c, 'name', lang)}</option>)}</select>} />
      <State loading={list.loading} error={list.error} empty={!list.data?.length} onRetry={list.reload}>
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {list.data?.map(q => (
            <div key={q.id} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="text-sm">{q.question}</p><p className="mt-1 text-xs text-ink-500">{q.student} · {pick(q, 'course', lang)} · {fmtDate(q.created_at, lang, true)}</p></div>
              <Badge tone={q.answered ? 'green' : 'amber'}>{q.answered ? t('answered') : t('notAnswered')}</Badge>
            </div>
          ))}
        </div>
      </State>
    </>
  );
}
