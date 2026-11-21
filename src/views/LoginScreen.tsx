import React, { useEffect, useRef, useState } from 'react';
import { Globe, Loader2, LockKeyhole, LogIn, Mail, Moon, ShieldCheck, Sun, BookOpen, Languages, DatabaseBackup } from 'lucide-react';
import { PasswordInput } from '../components/common/PasswordInput';
import { Modal } from '../components/common/Modal';
import { HmLogo } from '../components/common/ui';
import { useApp } from '../context/AppContext';
import { call, isDemo } from '../services/api';

/** Full-screen sign-in (bondhu-fund's split layout, Homio's hero). Shown whenever there is no session. */
export const LoginScreen: React.FC = () => {
  const { t, signIn, language, toggleLanguage, isDarkMode, toggleDarkMode, errText } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { emailRef.current?.focus(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError(t('auth.fill_both', 'Enter your email and password.')); return; }
    setBusy(true); setError('');
    try { await signIn(email.trim(), password); }
    catch (err) { setError(errText(err)); setPassword(''); }
    finally { setBusy(false); }
  };

  const point = (icon: React.ReactNode, text: string) => (
    <li className="flex items-center gap-3 text-sm text-white/85"><span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">{icon}</span>{text}</li>
  );

  return (
    <div className="min-h-screen w-full flex bg-daybg dark:bg-night-0b1317">
      {/* brand panel */}
      <div className="hidden lg:flex w-[44%] relative overflow-hidden hm-hero p-12 flex-col justify-between">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/[0.06]" />
        <div className="absolute -left-20 bottom-8 w-80 h-80 rounded-full bg-[#FF9B7B]/[0.12]" />
        <svg aria-hidden viewBox="0 0 200 200" className="absolute right-10 bottom-24 w-56 h-56 opacity-[0.08]"><path d="M40 160c0-70 40-115 125-115 0 75-45 120-115 120" fill="#fff" /></svg>
        <div className="relative flex items-center gap-3">
          <HmLogo size={48} className="drop-shadow-lg" />
          <div>
            <div className="text-lg font-extrabold leading-tight">{t('app.name', 'Homio Essentials')}</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#FFD2C0]">{t('auth.tagline', 'Admin · content & moderation')}</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-[1.15] max-w-md tracking-tight">{t('auth.hero', 'Keep the archive accurate, in English and বাংলা.')}</h1>
          <ul className="mt-7 space-y-3">
            {point(<BookOpen size={15} />, t('auth.point1', 'Medicines checked against Boericke and Allen'))}
            {point(<Languages size={15} />, t('auth.point2', 'Requests from the app, reviewed before anything is public'))}
            {point(<DatabaseBackup size={15} />, t('auth.point3', 'Daily backup on this PC and in the cloud'))}
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck size={15} />{t('auth.staff_only', 'For the Homio Essentials team only. App readers never need an account.')}
        </div>
      </div>

      {/* form */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-end gap-2 p-5">
          <button type="button" onClick={toggleLanguage} className="btn btn-outline !h-9 !rounded-xl !px-3">
            <Globe size={14} />{language === 'bn' ? 'English' : 'বাংলা'}
          </button>
          <button type="button" onClick={toggleDarkMode} aria-label={t('top.theme', 'Day / night')} className="btn btn-outline btn-icon !w-9 !h-9 !rounded-xl">
            <span key={String(isDarkMode)} className="icon-swap inline-flex">{isDarkMode ? <Sun size={15} /> : <Moon size={15} />}</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-16">
          <form onSubmit={submit} className="login-zoom login-in w-full max-w-sm" noValidate>
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <HmLogo size={44} />
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">{t('app.name', 'Homio Essentials')}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t('auth.title', 'Sign in')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('auth.subtitle', 'Use the email and password of your team account.')}</p>

            <label className="form-label mt-7" htmlFor="login-email">{t('auth.email', 'Email')}</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="login-email" ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"
                className="form-input !pl-10 !text-sm" placeholder={t('auth.email_ph', 'name@example.org')} aria-invalid={!!error && !email ? true : undefined} />
            </div>

            <label className="form-label mt-4" htmlFor="login-pass">{t('auth.password', 'Password')}</label>
            <PasswordInput id="login-pass" value={password} onChange={e => setPassword(e.target.value)}
              onKeyUp={e => setCaps(e.getModifierState('CapsLock'))} autoComplete="current-password"
              icon={<LockKeyhole size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />}
              className="form-input !pl-10 !text-sm" placeholder="••••••••" />
            {caps && <p className="mt-1.5 text-[11px] font-semibold text-amber-600">{t('auth.caps', 'Caps Lock is on')}</p>}

            {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</div>}

            <button type="submit" disabled={busy} className="btn btn-primary btn-lg btn-block mt-6">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}{t('auth.sign_in', 'Sign in')}
            </button>
            <p className="mt-6 text-[11px] text-slate-400 text-center leading-relaxed">{t('auth.help', 'Forgot your password? Ask an owner to reset it from the Supabase dashboard.')}</p>
            {isDemo && <p className="mt-3 text-[11px] font-bold text-peach-deep text-center">{t('auth.demo', 'Demo preview: any email and a password of 4+ characters. Sample data only.')}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

/** Change the signed-in staff member's own password. */
export const ChangePasswordDialog: React.FC<{ open: boolean; onDone: () => void }> = ({ open, onDone }) => {
  const { t, showToast, errText } = useApp();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setCur(''); setNext(''); setAgain(''); setErr(''); } }, [open]);
  const save = async () => {
    setErr('');
    if (next !== again) { setErr(t('auth.mismatch', 'The new passwords do not match.')); return; }
    if (next.length < 8) { setErr(t('auth.rules', 'Use at least 8 characters.')); return; }
    setBusy(true);
    try { await call('changePassword', cur, next); showToast(t('auth.changed', 'Password changed')); onDone(); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onDone} locked={busy} size="sm" icon={<LockKeyhole size={18} />} title={t('auth.change_title', 'Change your password')}
      footer={<>
        <button type="button" onClick={onDone} disabled={busy} className="btn btn-cancel">{t('common.cancel', 'Cancel')}</button>
        <button type="button" onClick={save} disabled={busy || !cur || !next} className="btn btn-primary">{busy && <Loader2 size={14} className="animate-spin" />}{t('auth.change_btn', 'Change password')}</button>
      </>}>
      <div className="space-y-3.5">
        <div><label className="form-label">{t('auth.current', 'Current password')}</label><PasswordInput value={cur} onChange={e => setCur(e.target.value)} autoComplete="current-password" /></div>
        <div><label className="form-label">{t('auth.new', 'New password')}</label><PasswordInput value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
          <span className="form-hint">{t('auth.rules', 'Use at least 8 characters.')}</span></div>
        <div><label className="form-label">{t('auth.repeat', 'Repeat new password')}</label><PasswordInput value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" onKeyDown={e => { if (e.key === 'Enter') save(); }} /></div>
        {err && <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{err}</div>}
      </div>
    </Modal>
  );
};

export default LoginScreen;
