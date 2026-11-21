/**
 * App-wide state, the same shape as bondhu-fund's AppContext: the active screen (no router — one tab at a time),
 * language and t(), day / night, toasts, and the signed-in staff member.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Copy, Info, X } from 'lucide-react';
import type { PublicSession, StaffRole } from '@shared/types';
import { ROLE_RANK } from '@shared/types';
import { call, parseError } from '../services/api';
import { translate, toBanglaDigits, fill, type AppLanguage } from '../utils/i18n';

export type NavTab = 'dashboard' | 'medicines' | 'editor' | 'brands' | 'requests' | 'promotions' | 'contact' | 'appsettings' | 'backups' | 'team' | 'settings';
export interface NavParams { id?: string; [k: string]: string | undefined }

interface ToastInfo { id: number; message: string; type: 'success' | 'error' | 'info' }

interface AppContextType {
  activeTab: NavTab;
  params: NavParams;
  go: (tab: NavTab, params?: NavParams) => void;
  t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string;
  language: AppLanguage;
  toggleLanguage: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  /** toast for a failed call, with the app's own wording for known error codes */
  showError: (e: unknown) => void;
  errText: (e: unknown) => string;
  num: (n: number | null | undefined) => string;
  fmtDate: (iso: string | null | undefined, withTime?: boolean) => string;
  relTime: (iso: string | null | undefined) => string;
  session: PublicSession | null;
  sessionChecked: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (role: StaffRole) => boolean;
  refreshKey: number;
  triggerRefresh: () => void;
  waitingCount: number;
  setWaitingCount: (n: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const ERR: Record<string, [string, string]> = {
  E_AUTH: ['err.auth', 'Wrong email or password.'],
  E_NOT_STAFF: ['err.not_staff', 'This account is not on the Homio Essentials team. Ask an owner to add you.'],
  E_OFFLINE: ['err.offline', 'Could not reach the server. Check the internet connection.'],
  E_SESSION: ['err.session', 'Your session has ended. Please sign in again.'],
  E_FORBIDDEN: ['err.forbidden', 'Your role does not allow this change.'],
  E_DUPLICATE: ['err.duplicate', 'Something with the same name or address already exists.'],
  E_IN_USE: ['err.in_use', 'This is still used elsewhere, so it cannot be removed.'],
  E_UNCONFIRMED: ['err.unconfirmed', 'This email address is not confirmed yet. Open the confirmation email first.'],
  E_SIGNUP_OFF: ['err.signup_off', 'New accounts are switched off for this project. Turn on email sign-ups in Supabase, or invite the person from the Supabase dashboard.'],
  E_EXISTS: ['err.exists', 'An account with this email already exists.'],
  E_RATE: ['err.rate', 'Too many attempts. Wait a minute and try again.'],
  E_DESKTOP: ['err.desktop', 'This works in the desktop app only.'],
  E_CONFIG: ['err.config', 'This build has no server address. Add config/supabase.json and build again.'],
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [params, setParams] = useState<NavParams>({});
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [copiedToastId, setCopiedToastId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem('homio_dark_mode') === 'true'; } catch { return false; }
  });
  const [language, setLanguage] = useState<AppLanguage>(() => {
    try { return (localStorage.getItem('homio_language') as AppLanguage) || 'en'; } catch { return 'en'; }
  });

  const toggleLanguage = useCallback(() => setLanguage(l => {
    const next = l === 'en' ? 'bn' : 'en';
    try { localStorage.setItem('homio_language', next); } catch { /* ignore */ }
    return next;
  }), []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const t = useCallback((key: string, fallback?: string, vars?: Record<string, string | number>) => {
    const s = translate(language, key, fallback);
    if (!vars) return s;
    const v = language === 'bn' ? Object.fromEntries(Object.entries(vars).map(([k, x]) => [k, typeof x === 'number' ? toBanglaDigits(x.toLocaleString('en-IN')) : x])) : vars;
    return fill(s, v as Record<string, string>);
  }, [language]);

  const num = useCallback((n: number | null | undefined) => {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    const s = Number(n).toLocaleString('en-IN');
    return language === 'bn' ? toBanglaDigits(s) : s;
  }, [language]);

  const fmtDate = useCallback((iso: string | null | undefined, withTime = false) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const s = d.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-GB', withTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
    return s;
  }, [language]);

  const relTime = useCallback((iso: string | null | undefined) => {
    if (!iso) return '—';
    const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    const n = (x: number) => (language === 'bn' ? toBanglaDigits(x) : String(x));
    if (sec < 60) return translate(language, 'time.now', 'just now');
    if (sec < 3600) return fill(translate(language, 'time.min', '{n} min ago'), { n: n(Math.floor(sec / 60)) });
    if (sec < 86400) return fill(translate(language, 'time.hour', '{n} h ago'), { n: n(Math.floor(sec / 3600)) });
    if (sec < 86400 * 30) return fill(translate(language, 'time.day', '{n} d ago'), { n: n(Math.floor(sec / 86400)) });
    return fmtDate(iso);
  }, [language, fmtDate]);

  const firstMode = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    if (!firstMode.current) { root.classList.add('theme-fade'); window.setTimeout(() => root.classList.remove('theme-fade'), 520); }   // day <-> night glides
    firstMode.current = false;
    root.classList.toggle('dark', isDarkMode);
    try { localStorage.setItem('homio_dark_mode', String(isDarkMode)); } catch { /* ignore */ }
  }, [isDarkMode]);
  const toggleDarkMode = useCallback(() => setIsDarkMode(v => !v), []);
  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const toastSeq = useRef(0);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() * 100 + (toastSeq.current++ % 100);
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), type === 'error' ? 12000 : 4000);
  }, []);

  const errText = useCallback((e: unknown) => {
    const { code, message } = parseError(e);
    const known = ERR[code];
    return known ? translate(language, known[0], known[1]) : message || translate(language, 'err.unknown', 'Something went wrong.');
  }, [language]);

  const signOutLocal = useCallback(() => { setSession(null); setActiveTab('dashboard'); setParams({}); setWaitingCount(0); }, []);

  const showError = useCallback((e: unknown) => {
    const { code } = parseError(e);
    showToast(errText(e), 'error');
    if (code === 'E_SESSION') signOutLocal();
  }, [errText, showToast, signOutLocal]);

  const go = useCallback((tab: NavTab, p: NavParams = {}) => { setActiveTab(tab); setParams(p); }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await call('signIn', email, password);
    setSession(s);
    setActiveTab('dashboard'); setParams({});
    setRefreshKey(k => k + 1);
  }, []);

  const signOut = useCallback(async () => {
    try { await call('signOut'); } finally { signOutLocal(); }
  }, [signOutLocal]);

  const can = useCallback((role: StaffRole) => !!session && ROLE_RANK[session.role] >= ROLE_RANK[role], [session]);

  // Saved session (the main process re-checks the staff row on start)
  useEffect(() => {
    let cancelled = false;
    call('getSession').then(s => { if (!cancelled) setSession(s); }, () => undefined).finally(() => { if (!cancelled) setSessionChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Surface unexpected async errors instead of failing silently.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => showToast(errText(e.reason), 'error');
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [showToast, errText]);

  const handleCopyToast = (id: number, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedToastId(id);
    setTimeout(() => setCopiedToastId(null), 2500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(x => x.id !== id));

  const value = useMemo<AppContextType>(() => ({
    activeTab, params, go, t, language, toggleLanguage, isDarkMode, toggleDarkMode, showToast, showError, errText, num, fmtDate, relTime,
    session, sessionChecked, signIn, signOut, can, refreshKey, triggerRefresh, waitingCount, setWaitingCount,
  }), [activeTab, params, go, t, language, toggleLanguage, isDarkMode, toggleDarkMode, showToast, showError, errText, num, fmtDate, relTime,
    session, sessionChecked, signIn, signOut, can, refreshKey, triggerRefresh, waitingCount]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[1100] flex flex-col gap-2 max-w-md pointer-events-none">
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isCopied = copiedToastId === toast.id;
          return (
            <div key={toast.id} role={isError ? 'alert' : 'status'}
              className={`pointer-events-auto p-3.5 rounded-xl shadow-2xl border text-xs toast-in ${toast.type === 'success'
                ? 'bg-accent-800 text-white border-accent-700'
                : isError ? 'bg-rose-900 text-white border-rose-700 ring-1 ring-rose-500' : 'bg-slate-900 text-white border-slate-700'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {toast.type === 'success' ? <CheckCircle2 size={16} className="text-accent-200" /> : isError ? <AlertCircle size={16} className="text-rose-300" /> : <Info size={16} className="text-sky-300" />}
                  </div>
                  <p className="font-medium leading-relaxed select-text break-words flex-1 min-w-0">{toast.message}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isError && (
                    <button onClick={() => handleCopyToast(toast.id, toast.message)} title={t('common.copy', 'Copy')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${isCopied ? 'bg-emerald-500 text-white' : 'bg-rose-800 hover:bg-rose-700 text-rose-100 border border-rose-600'}`}>
                      {isCopied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
                    </button>
                  )}
                  <button onClick={() => dismissToast(toast.id)} className="p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10" title={t('common.dismiss', 'Dismiss')}><X size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};

/** Load data for a screen: runs on mount, on refreshKey changes and when deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: React.DependencyList = []) {
  const { refreshKey, showError } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fn().then(d => { if (!cancelled) { setData(d); setError(null); } }, e => { if (!cancelled) { setError(e); showError(e); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey, tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick(x => x + 1), []);
  return { data, setData, loading, error, reload };
}
