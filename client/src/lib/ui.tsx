import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Inbox, Loader2, X } from 'lucide-react';
import { useI18n } from './i18n';

/* ── theme ── */
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark; setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
  return { dark, toggle };
}

/* ── toasts ── */
type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems(x => [...x, { id, kind, text }]);
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 4500);
  }, []);
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {items.map(t => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg
              ${t.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
              : t.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100'}`}>
              <I className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{t.text}</span>
              <button onClick={() => setItems(x => x.filter(i => i.id !== t.id))} aria-label="close"><X className="h-4 w-4 opacity-60" /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── data loading hook with loading/error/reload ── */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true); setError(null);
    fn().then(setData).catch(e => setError(e.message ?? 'Error')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

/* ── small components ── */
export const Spinner = ({ className = '' }: { className?: string }) => <Loader2 className={`h-5 w-5 animate-spin text-ink-400 ${className}`} />;

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-white md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function State({ loading, error, empty, onRetry, children }: { loading: boolean; error: string | null; empty?: boolean; onRetry?: () => void; children: ReactNode }) {
  const { t } = useI18n();
  if (loading) return <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-2xl bg-ink-100 dark:bg-ink-800" />)}</div>;
  if (error) return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <p className="text-sm">{t('error')} <span className="text-ink-500">({error})</span></p>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>{t('retry')}</button>}
    </div>
  );
  if (empty) return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center text-ink-500">
      <Inbox className="h-8 w-8" /><p className="text-sm">{t('empty')}</p>
    </div>
  );
  return <>{children}</>;
}

export const Badge = ({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'brass' | 'green' | 'red' | 'amber' }) => {
  const c = {
    ink: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
    brass: 'bg-brass-300/30 text-brass-600 dark:bg-brass-500/20 dark:text-brass-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
};

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="card max-h-[90vh] w-full overflow-y-auto rounded-b-none p-6 sm:max-w-lg sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({ icon: I, label, value }: { icon: any; label: string; value: ReactNode }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="rounded-xl bg-ink-100 p-3 text-ink-700 dark:bg-ink-800 dark:text-brass-300"><I className="h-5 w-5" /></div>
      <div><div className="text-2xl font-semibold tabular-nums">{value}</div><div className="text-xs text-ink-500 dark:text-ink-400">{label}</div></div>
    </div>
  );
}
