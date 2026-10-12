import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, ArrowUp, BookMarked, FileText, MessageSquarePlus, PanelLeft, Sparkles, Trash2 } from 'lucide-react';
import { api, openDocument } from '../lib/api';
import { useI18n, pick } from '../lib/i18n';
import { useToast, Spinner } from '../lib/ui';
import { useAuth } from '../lib/auth';
import type { Conversation, Course, Message } from '../lib/types';

const SUGGEST = {
  sq: ['Ku ndodhet shkolla dhe cili është orari i sekretarisë?', 'Cilat drejtime ofron shkolla?', 'Kush është drejtori i shkollës?', 'Kush punon në shërbimin psikosocial?'],
  en: ['Where is the school and what are the office hours?', 'Which programs does the school offer?', 'Who is the school director?', 'Who works in the psychosocial service?'],
};

export default function Chat() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | null>(params.get('course') ? Number(params.get('course')) : null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const createdHere = useRef<string | null>(null);   // conversation just created by send(): don't reload it

  const loadConvs = () => api<Conversation[]>('/chat/conversations').then(setConvs).catch(() => {});
  useEffect(() => { loadConvs(); if (user?.role !== 'admin') api<Course[]>('/academics/courses').then(setCourses).catch(() => {}); }, []);

  useEffect(() => {
    if (!id) { setMessages([]); return; }
    if (createdHere.current === id) return;
    setLoadingConv(true);
    api<Conversation>(`/chat/conversations/${id}`)
      .then(c => { setMessages(c.messages ?? []); setCourseId(c.course_id); })
      .catch(e => { toast('error', e.message); nav('/chat'); })
      .finally(() => setLoadingConv(false));
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput(''); setBusy(true);
    let convId = id;
    const optimistic: Message = { id: -Date.now(), role: 'user', content, sources: [], answered: null, created_at: new Date().toISOString(), pending: true };
    setMessages(m => [...m, optimistic]);
    try {
      if (!convId) {
        const c = await api<Conversation>('/chat/conversations', { method: 'POST', json: courseId ? { courseId } : {} });
        convId = c.id;
        createdHere.current = c.id;
        nav(`/chat/${c.id}`, { replace: true });
      }
      const reply = await api<Message>(`/chat/conversations/${convId}/messages`, { method: 'POST', json: { content, lang } });
      setMessages(m => [...m.map(x => (x.id === optimistic.id ? { ...x, pending: false } : x)), reply]);
      loadConvs();
    } catch (e) {
      setMessages(m => m.filter(x => x.id !== optimistic.id));
      setInput(content);
      toast('error', (e as Error).message);
    } finally { setBusy(false); taRef.current?.focus(); }
  };

  const remove = async (cid: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await api(`/chat/conversations/${cid}`, { method: 'DELETE' });
    if (cid === id) nav('/chat');
    loadConvs();
  };

  const history = (
    <div className="flex h-full flex-col">
      <button className="btn-primary m-3" onClick={() => { nav('/chat'); setShowHistory(false); }}><MessageSquarePlus className="h-4 w-4" />{t('newChat')}</button>
      <p className="label px-4">{t('history')}</p>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {convs.length === 0 && <p className="px-3 py-2 text-xs text-ink-400">{t('empty')}</p>}
        {convs.map(c => (
          <div key={c.id} className={`group flex items-center rounded-lg ${c.id === id ? 'bg-ink-100 dark:bg-ink-800' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50'}`}>
            <button className="flex-1 truncate px-3 py-2 text-left text-sm" onClick={() => { nav(`/chat/${c.id}`); setShowHistory(false); }} title={c.title}>{c.title}</button>
            <button className="p-2 opacity-0 transition group-hover:opacity-100" onClick={() => remove(c.id)} aria-label={t('deleteChat')}><Trash2 className="h-3.5 w-3.5 text-ink-400" /></button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-61px)] md:-mx-8 md:-my-8">
      <aside className="hidden w-64 shrink-0 border-r border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900 lg:block">{history}</aside>
      {showHistory && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-ink-950/50" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-ink-900" onClick={e => e.stopPropagation()}>{history}</aside>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2 dark:border-ink-800">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setShowHistory(true)} aria-label={t('history')}><PanelLeft className="h-4 w-4" /></button>
          <BookMarked className="h-4 w-4 text-ink-400" />
          <label className="sr-only" htmlFor="ctx">{t('courseContext')}</label>
          <select id="ctx" className="input w-auto max-w-[60vw] border-none bg-transparent py-1 shadow-none" value={courseId ?? ''} disabled={!!id}
            onChange={e => setCourseId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('general')}</option>
            {courses.map(c => <option key={c.id} value={c.id}>{pick(c, 'name', lang)}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {loadingConv && <div className="flex justify-center"><Spinner /></div>}
            {!id && messages.length === 0 && !loadingConv && (
              <div className="pt-6 text-center md:pt-14">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-800 text-brass-400 dark:bg-ink-800"><Sparkles /></div>
                <h1 className="mt-4 text-3xl font-semibold">{t('assistant')}</h1>
                <p className="mx-auto mt-2 max-w-lg text-sm text-ink-500 dark:text-ink-400">{t('chatIntro')}</p>
                <p className="label mt-8">{t('suggestions')}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SUGGEST[lang].map(s => (
                    <button key={s} className="card px-4 py-3 text-left text-sm transition hover:border-ink-300 hover:shadow dark:hover:border-ink-600" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(m => <Bubble key={m.id} m={m} />)}
            {busy && (
              <div className="flex items-center gap-3 text-sm text-ink-500">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink-800 text-brass-400"><Sparkles className="h-4 w-4" /></div>
                <span className="flex items-center gap-2"><Spinner className="h-4 w-4" />{t('thinking')}</span>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-ink-100 bg-ink-50/80 px-4 py-3 dark:border-ink-800 dark:bg-ink-950/80">
          <form className="mx-auto flex max-w-3xl items-end gap-2" onSubmit={e => { e.preventDefault(); send(); }}>
            <textarea ref={taRef} rows={1} className="input max-h-40 min-h-[44px] flex-1 resize-none py-3" placeholder={t('askPlaceholder')} value={input} maxLength={2000}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label={t('askPlaceholder')} />
            <button className="btn-primary h-11 w-11 p-0" disabled={busy || !input.trim()} aria-label={t('send')}><ArrowUp className="h-5 w-5" /></button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const { t } = useI18n();
  const toast = useToast();
  if (m.role === 'user') return (
    <div className="flex justify-end">
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink-800 px-4 py-2.5 text-sm text-white dark:bg-ink-700 ${m.pending ? 'opacity-70' : ''}`}>{m.content}</div>
    </div>
  );
  return (
    <div className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-brass-400"><Sparkles className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        {m.answered === false && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" />{t('notFoundBadge')}
          </div>
        )}
        <div className="prose-chat text-sm leading-relaxed"><ReactMarkdown>{m.content}</ReactMarkdown></div>
        {m.sources?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {m.sources.map(s => (
              <button key={s.n} onClick={() => openDocument(s.documentId, s.page).catch(e => toast('error', e.message))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-700 transition hover:border-brass-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
                <FileText className="h-3.5 w-3.5 text-brass-500" />
                <span className="font-semibold">[{s.n}]</span> {t('source')}: {s.title}{s.page ? `, ${t('page')} ${s.page}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
