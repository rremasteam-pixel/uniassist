import { useEffect, useState } from 'react';
import { ExternalLink, FileText, RefreshCw, Replace, Search, Trash2, Upload } from 'lucide-react';
import { api, openDocument } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n, fmtDate, pick } from '../lib/i18n';
import { Badge, Modal, PageHeader, State, useLoad, useToast } from '../lib/ui';
import type { Course, Doc } from '../lib/types';

const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export default function Documents() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';
  const canUpload = isAdmin || user?.role === 'teacher';
  const [search, setSearch] = useState(''); const [cat, setCat] = useState(''); const [inactive, setInactive] = useState(false);
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const h = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(h); }, [search]);
  const cats = useLoad(() => api<any[]>('/documents/categories'));
  const docs = useLoad(() => {
    const p = new URLSearchParams(); if (debounced) p.set('search', debounced); if (cat) p.set('categoryId', cat); if (inactive) p.set('includeInactive', 'true');
    return api<Doc[]>(`/documents?${p}`);
  }, [debounced, cat, inactive]);
  const [modal, setModal] = useState<{ mode: 'upload' | 'replace'; doc?: Doc } | null>(null);

  const del = async (d: Doc) => {
    if (!confirm(`${t('confirmDelete')}\n${d.title}`)) return;
    try { await api(`/documents/${d.id}`, { method: 'DELETE' }); toast('success', t('saved')); docs.reload(); } catch (e) { toast('error', (e as Error).message); }
  };
  const reprocess = async (d: Doc) => {
    try { await api(`/documents/${d.id}/reprocess`, { method: 'POST' }); toast('success', t('ready')); docs.reload(); } catch (e) { toast('error', (e as Error).message); }
  };

  return (
    <>
      <PageHeader title={t('documents')} subtitle={t('chatIntro')}
        actions={canUpload && <button className="btn-primary" onClick={() => setModal({ mode: 'upload' })}><Upload className="h-4 w-4" />{t('upload')}</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <input className="input pl-9" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={cat} onChange={e => setCat(e.target.value)} aria-label={t('category')}>
          <option value="">{t('all')}</option>{cats.data?.map(c => <option key={c.id} value={c.id}>{pick(c, 'name', lang)}</option>)}
        </select>
        {isAdmin && <label className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300"><input type="checkbox" checked={inactive} onChange={e => setInactive(e.target.checked)} />{t('showInactive')}</label>}
      </div>
      <State loading={docs.loading} error={docs.error} empty={!docs.data?.length} onRetry={docs.reload}>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800">
              <tr><th className="p-3">{t('title')}</th><th className="p-3">{t('category')}</th><th className="p-3">{t('uploaded')}</th><th className="p-3">{t('status')}</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {docs.data?.map(d => (
                <tr key={d.id} className={!d.is_active ? 'opacity-60' : ''}>
                  <td className="p-3">
                    <button className="flex items-start gap-2 text-left font-medium hover:underline" onClick={() => openDocument(d.id).catch(e => toast('error', e.message))}>
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brass-500" />{d.title}
                    </button>
                    <div className="ml-6 mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <span>{d.original_name} · {kb(d.size_bytes)}{d.page_count ? ` · ${d.page_count} ${t('page')}` : ''}</span>
                      {d.visibility !== 'public' && <Badge tone="brass">{d.visibility === 'course' ? pick(d, 'course', lang) : t('staff')}</Badge>}
                      {!d.is_active && <Badge>{t('inactive')}</Badge>}
                      {d.source_url && <a href={d.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:underline">{t('officialSource')}<ExternalLink className="h-3 w-3" /></a>}
                    </div>
                    {d.error && <div className="ml-6 mt-1 text-xs text-red-600">{d.error}</div>}
                  </td>
                  <td className="p-3 text-ink-600 dark:text-ink-300">{pick(d, 'category', lang)}</td>
                  <td className="whitespace-nowrap p-3 text-ink-500">{fmtDate(d.created_at, lang)}</td>
                  <td className="p-3"><Badge tone={d.status === 'ready' ? 'green' : d.status === 'failed' ? 'red' : 'amber'}>{t(d.status)}</Badge></td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {isAdmin && d.is_active && <button className="btn-ghost p-2" title={t('replace')} onClick={() => setModal({ mode: 'replace', doc: d })}><Replace className="h-4 w-4" /></button>}
                    {isAdmin && d.status === 'failed' && <button className="btn-ghost p-2" title={t('reprocess')} onClick={() => reprocess(d)}><RefreshCw className="h-4 w-4" /></button>}
                    {(isAdmin || (canUpload && d.uploaded_by_id === user?.id)) &&
                      <button className="btn-ghost p-2 text-red-600" title={t('delete')} onClick={() => del(d)}><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
      {modal && <UploadModal mode={modal.mode} doc={modal.doc} categories={cats.data ?? []} onClose={() => setModal(null)} onDone={() => { setModal(null); docs.reload(); }} />}
    </>
  );
}

function UploadModal({ mode, doc, categories, onClose, onDone }: { mode: 'upload' | 'replace'; doc?: Doc; categories: any[]; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const isTeacher = user?.role === 'teacher';
  const [courses, setCourses] = useState<Course[]>([]);
  const [f, setF] = useState({
    title: doc?.title ?? '', categoryId: String(doc?.category_id ?? (isTeacher ? categories.find(c => c.slug === 'course')?.id ?? '' : '')),
    visibility: doc?.visibility ?? (isTeacher ? 'course' : 'public'), courseId: String(doc?.course_id ?? ''), sourceUrl: doc?.source_url ?? '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<Course[]>(`/academics/courses?mine=${isTeacher}`).then(setCourses).catch(() => {}); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(f).forEach(([k, v]) => v && fd.append(k, v));
    try {
      const r = await api<Doc>(mode === 'replace' ? `/documents/${doc!.id}/replace` : '/documents', { method: 'POST', body: fd });
      toast('success', `${r.title} — ${t('ready')}`); onDone();
    } catch (err) { toast('error', (err as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={mode === 'replace' ? `${t('replace')}: ${doc?.title}` : t('upload')}>
      <form className="space-y-4" onSubmit={submit}>
        <div><label className="label">{t('file')} (PDF, TXT, MD)</label>
          <input required type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-1 dark:file:bg-ink-800"
            onChange={e => { const x = e.target.files?.[0] ?? null; setFile(x); if (x && !f.title) setF(s => ({ ...s, title: x.name.replace(/\.[^.]+$/, '') })); }} /></div>
        <div><label className="label">{t('title')}</label><input required minLength={2} className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t('category')}</label>
            <select required className="input" value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}>
              <option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{pick(c, 'name', lang)}</option>)}
            </select></div>
          <div><label className="label">{t('visibility')}</label>
            <select className="input" value={f.visibility} disabled={isTeacher} onChange={e => setF({ ...f, visibility: e.target.value as Doc['visibility'] })}>
              <option value="public">{t('public')}</option><option value="staff">{t('staff')}</option><option value="course">{t('course')}</option>
            </select></div>
        </div>
        {f.visibility === 'course' && (
          <div><label className="label">{t('course')}</label>
            <select required className="input" value={f.courseId} onChange={e => setF({ ...f, courseId: e.target.value })}>
              <option value="">—</option>{courses.map(c => <option key={c.id} value={c.id}>{pick(c, 'name', lang)}</option>)}
            </select></div>
        )}
        {!isTeacher && <div><label className="label">{t('officialSource')} (URL)</label><input type="url" className="input" value={f.sourceUrl} onChange={e => setF({ ...f, sourceUrl: e.target.value })} /></div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" disabled={busy || !file}>{busy ? t('processing') + '…' : mode === 'replace' ? t('replace') : t('upload')}</button>
        </div>
      </form>
    </Modal>
  );
}
