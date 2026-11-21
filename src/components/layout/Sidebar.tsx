/**
 * Sidebar — bondhu-fund's experience (collapsible icon rail, gliding selection pill re-measured while it folds,
 * big tooltips when collapsed, profile menu at the bottom) in the Homio design.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Leaf, Factory, MessageSquareText, Megaphone, PhoneCall, SlidersHorizontal, DatabaseBackup, UsersRound, Settings,
  ChevronsUpDown, ChevronLeft, ChevronRight, KeyRound, LogOut,
} from 'lucide-react';
import { useApp, type NavTab } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { HmLogo, RoleBadge } from '../common/ui';
import { ChangePasswordDialog } from '../../views/LoginScreen';
import type { StaffRole } from '@shared/types';

const COLLAPSE_KEY = 'homio_sidebar_collapsed';
const NARROW_QUERY = '(max-width: 1279px)';
const PW_EVENT = 'homio:change-password';
const SIGNOUT_EVENT = 'homio:sign-out';

export const initials = (name?: string | null) => {
  const w = (name || '').replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
};

export const Avatar: React.FC<{ name?: string | null; className?: string }> = ({ name, className = 'w-8 h-8 rounded-lg text-xs' }) => (
  <div className={`${className} shrink-0 bg-gradient-to-br from-accent-500 to-accent-800 text-white font-bold flex items-center justify-center select-none`}>{initials(name)}</div>
);

/** Signed-in staff member: change password, sign out (used by Sidebar and TopBar). */
export const ProfileMenu: React.FC<{ onClose: () => void; className?: string }> = ({ onClose, className = '' }) => {
  const { session, t } = useApp();
  const item = 'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-night-1d2e36 text-left font-semibold text-slate-800 dark:text-slate-200';
  return (
    <div role="menu" className={`bg-white dark:bg-night-16252d border border-slate-200 dark:border-night-283e4a rounded-2xl shadow-2xl p-2 z-50 text-xs animate-pop ${className}`}>
      {session && (
        <div className="flex items-center gap-3 px-2 py-2.5 mb-1 border-b border-slate-100 dark:border-night-22353f">
          <Avatar name={session.displayName} className="w-10 h-10 rounded-xl text-sm" />
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white truncate">{session.displayName}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{session.email}</div>
            <div className="mt-1"><RoleBadge role={session.role} /></div>
          </div>
        </div>
      )}
      <button type="button" role="menuitem" onClick={() => { window.dispatchEvent(new Event(PW_EVENT)); onClose(); }} className={item}>
        <KeyRound size={15} className="text-accent-600 dark:text-accent-300" />{t('shell.change_password', 'Change password')}
      </button>
      <button type="button" role="menuitem" onClick={() => { window.dispatchEvent(new Event(SIGNOUT_EVENT)); onClose(); }}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 mt-1 border-t border-slate-100 dark:border-night-22353f rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left font-semibold text-rose-600 dark:text-rose-400">
        <LogOut size={15} />{t('shell.sign_out', 'Sign out')}
      </button>
    </div>
  );
};

/** Dialogs opened from ProfileMenu; mounted once so they survive the popover closing. */
const AccountDialogs: React.FC = () => {
  const { signOut, t } = useApp();
  const [pwOpen, setPwOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onPw = () => setPwOpen(true);
    const onOut = () => setConfirmOut(true);
    window.addEventListener(PW_EVENT, onPw);
    window.addEventListener(SIGNOUT_EVENT, onOut);
    return () => { window.removeEventListener(PW_EVENT, onPw); window.removeEventListener(SIGNOUT_EVENT, onOut); };
  }, []);
  const doSignOut = async () => { setBusy(true); try { await signOut(); } finally { setBusy(false); setConfirmOut(false); } };
  return (
    <>
      <ChangePasswordDialog open={pwOpen} onDone={() => setPwOpen(false)} />
      <Modal open={confirmOut} onClose={() => setConfirmOut(false)} locked={busy} size="sm" tone="warning" icon={<LogOut size={18} />}
        title={t('shell.sign_out_title', 'Sign out?')}
        footer={<>
          <button type="button" onClick={() => setConfirmOut(false)} disabled={busy} className="btn btn-cancel">{t('common.cancel', 'Cancel')}</button>
          <button type="button" onClick={doSignOut} disabled={busy} className="btn btn-primary">{t('shell.sign_out', 'Sign out')}</button>
        </>}>
        {t('shell.sign_out_msg', 'You will need your email and password to sign in again.')}
      </Modal>
    </>
  );
};

/** Close a popover when clicking outside it or pressing Esc. */
export function useOutsideClose(ref: React.RefObject<HTMLElement>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, ref, close]);
}

interface NavItem { id: NavTab; label: string; icon: any; badge?: number; min?: StaffRole }
interface NavSection { key: string; title: string; items: NavItem[] }

export const Sidebar: React.FC = () => {
  const { activeTab, go, session, t, can, waitingCount, num } = useApp();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => !!window.matchMedia && window.matchMedia(NARROW_QUERY).matches);
  const [widePref, setWidePref] = useState<boolean>(() => { try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; } });
  const [narrowOverride, setNarrowOverride] = useState<boolean | null>(null);
  const isCollapsed = isNarrow ? (narrowOverride ?? true) : widePref;

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => { setIsNarrow(mq.matches); setNarrowOverride(null); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    if (isNarrow) setNarrowOverride(next);
    else { setWidePref(next); try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* ignore */ } }
  };

  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeMenu = React.useCallback(() => setShowUserMenu(false), []);
  useOutsideClose(userMenuRef, showUserMenu, closeMenu);

  const sections: NavSection[] = useMemo(() => ([
    { key: 'archive', title: t('nav.section_archive', 'Archive'), items: [
      { id: 'dashboard', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
      { id: 'medicines', label: t('nav.medicines', 'Medicines'), icon: Leaf },
      { id: 'brands', label: t('nav.brands', 'Brands & products'), icon: Factory },
      { id: 'requests', label: t('nav.requests', 'Requests'), icon: MessageSquareText, badge: waitingCount },
    ] },
    { key: 'app', title: t('nav.section_app', 'App content'), items: [
      { id: 'promotions', label: t('nav.promotions', 'Promotions'), icon: Megaphone },
      { id: 'contact', label: t('nav.contact', 'Contact info'), icon: PhoneCall },
      { id: 'appsettings', label: t('nav.appsettings', 'App settings'), icon: SlidersHorizontal },
    ] },
    { key: 'system', title: t('nav.section_system', 'System'), items: [
      { id: 'backups', label: t('nav.backups', 'Backups'), icon: DatabaseBackup },
      { id: 'team', label: t('nav.team', 'Team & roles'), icon: UsersRound },
      { id: 'settings', label: t('nav.settings', 'Settings'), icon: Settings },
    ] },
  ] as NavSection[]).map(s => ({ ...s, items: s.items.filter(i => !i.min || can(i.min)) })), [t, can, waitingCount]);

  // the remedy editor belongs to Medicines
  const highlighted: NavTab = activeTab === 'editor' ? 'medicines' : activeTab;

  // Large tooltip next to an icon when collapsed
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);
  const showTip = (label: string | undefined) => (e: React.SyntheticEvent<HTMLElement>) => {
    if (!isCollapsed || !label) return;
    const b = e.currentTarget.getBoundingClientRect();
    setTip({ label, x: b.right, y: b.top + b.height / 2 });
  };
  const hideTip = () => setTip(null);
  useEffect(() => { if (!isCollapsed) setTip(null); }, [isCollapsed]);

  // Gliding selection pill
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState<{ y: number; h: number } | null>(null);
  const [indReady, setIndReady] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const activeRef = useRef(highlighted);
  activeRef.current = highlighted;
  const measureInd = () => {
    const b = itemRefs.current[activeRef.current];
    const y = b ? b.offsetTop : -1, h = b ? b.offsetHeight : 0;
    setInd(prev => (b ? (prev && prev.y === y && prev.h === h ? prev : { y, h }) : prev === null ? prev : null));
  };
  const measureIndRef = useRef(measureInd);
  measureIndRef.current = measureInd;
  useLayoutEffect(() => {
    measureInd();
    const id = requestAnimationFrame(() => setIndReady(true));
    return () => cancelAnimationFrame(id);
  }, [highlighted, isCollapsed, sections]); // eslint-disable-line react-hooks/exhaustive-deps
  // While the rail opens or closes, the items move: re-measure every frame with the glide switched off.
  useLayoutEffect(() => {
    setSyncing(true);
    const start = performance.now();
    let id = 0;
    const loop = () => {
      measureIndRef.current();
      if (performance.now() - start < 420) id = requestAnimationFrame(loop); else { measureIndRef.current(); setSyncing(false); }
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [isCollapsed]);
  useLayoutEffect(() => {
    const run = () => measureIndRef.current();
    const ro = new ResizeObserver(run);
    if (navRef.current) ro.observe(navRef.current);
    (document as any).fonts?.ready?.then(run);
    return () => ro.disconnect();
  }, []);

  return (
    <aside onTransitionEnd={e => { if (e.target === e.currentTarget) measureIndRef.current(); }}
      className={`sb ${isCollapsed ? 'sb-collapsed' : ''} relative z-50 bg-white dark:bg-night-101b21 text-slate-700 dark:text-slate-300 flex flex-col justify-between shrink-0 h-screen select-none border-r border-slate-200/90 dark:border-night-22353f`}>
      <div className="min-h-0 flex flex-col">
        <div className="py-4 pl-5 pr-4 flex items-center overflow-hidden border-b border-slate-100 dark:border-night-22353f">
          <button type="button" onClick={() => go('dashboard')} className="flex items-center gap-3 text-left" title="Homio Essentials">
            <HmLogo size={40} />
            <div className="sb-label flex flex-col w-[10.5rem] shrink-0">
              <span className="text-[15.5px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">{t('app.name', 'Homio Essentials')}</span>
              <span className="text-[10px] font-bold text-peach-deep uppercase tracking-[0.16em]">{t('app.admin', 'Admin')}</span>
            </div>
          </button>
        </div>

        <nav ref={navRef} onMouseLeave={hideTip} className="relative p-3 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-150px)] nav-scroll space-y-5">
          <span aria-hidden className={`nav-ind ${indReady && !syncing ? 'nav-ind-anim' : ''}`}
            style={{ transform: `translateY(${ind?.y ?? 0}px)`, height: ind?.h ?? 0, opacity: ind ? 1 : 0 }} />
          {sections.map((section, si) => (
            <div key={section.key} className={si > 0 ? 'nav-section-sep pt-5' : ''}>
              <div className="sb-sec" aria-hidden={isCollapsed}>
                <div className="px-3 pb-1.5 text-[10.8px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase whitespace-nowrap">{section.title}</div>
              </div>
              <div className="space-y-1">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = highlighted === item.id;
                  return (
                    <button key={item.id} ref={el => { itemRefs.current[item.id] = el; }} onClick={() => go(item.id)}
                      aria-label={isCollapsed ? item.label : undefined} onMouseEnter={showTip(item.label)} onFocus={showTip(item.label)} onBlur={hideTip}
                      aria-current={isActive ? 'page' : undefined}
                      className={`nav-item ${isCollapsed ? 'nav-item-collapsed' : ''} relative z-[1] flex items-center w-full gap-3 pl-[1.2rem] pr-3 py-2.5 rounded-xl text-[13px] font-semibold overflow-hidden ${isActive ? 'nav-item-active font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                      <Icon size={17} strokeWidth={isActive ? 2.4 : 1.9} className="nav-icon shrink-0" />
                      <span className="sb-label truncate flex-1 text-left">{item.label}</span>
                      {!!item.badge && (
                        <span className={`${isCollapsed ? 'absolute top-1 right-2 min-w-[1.1rem] h-[1.1rem] text-[9px]' : 'sb-label min-w-[1.4rem] h-[1.3rem] text-[10.5px]'} px-1.5 rounded-full bg-[var(--hm-am)] text-[var(--hm-amink)] font-extrabold inline-flex items-center justify-center`}>
                          {num(item.badge)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="p-3 border-t border-slate-100 dark:border-night-22353f relative" ref={userMenuRef}>
        <button type="button" onClick={() => setShowUserMenu(v => !v)} aria-haspopup="menu" aria-expanded={showUserMenu}
          onMouseEnter={showTip(session?.displayName)} onMouseLeave={hideTip}
          className={`w-full flex items-center justify-between overflow-hidden py-2 pl-3 pr-2 rounded-xl cursor-pointer border ${showUserMenu
            ? 'bg-slate-100 dark:bg-night-1d2e36 border-slate-200 dark:border-night-2a3f49'
            : 'border-transparent hover:bg-slate-100 dark:hover:bg-night-1d2e36 hover:border-slate-200 dark:hover:border-night-2a3f49'}`}>
          <span className="flex items-center gap-3 min-w-0">
            <Avatar name={session?.displayName} />
            <span className="sb-label flex flex-col text-left min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{session?.displayName || '—'}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{session ? t(`role.${session.role}`, session.role) : ''}</span>
            </span>
          </span>
          <ChevronsUpDown size={15} className="sb-label text-slate-400 shrink-0" />
        </button>
        {showUserMenu && <ProfileMenu onClose={closeMenu} className={`absolute ${isCollapsed ? 'bottom-3 left-full ml-2' : 'bottom-16 left-3'} w-64`} />}
      </div>
      <button type="button" onClick={toggleCollapsed} className="sidebar-edge-toggle"
        onMouseEnter={showTip(isCollapsed ? t('shell.expand', 'Expand sidebar') : undefined)} onMouseLeave={hideTip}
        title={isCollapsed ? undefined : t('shell.collapse', 'Collapse sidebar')}
        aria-label={isCollapsed ? t('shell.expand', 'Expand sidebar') : t('shell.collapse', 'Collapse sidebar')} aria-expanded={!isCollapsed}>
        {isCollapsed ? <ChevronRight size={14} strokeWidth={2.6} /> : <ChevronLeft size={14} strokeWidth={2.6} />}
      </button>
      {isCollapsed && tip && <div role="tooltip" className="nav-tip" style={{ left: tip.x + 14, top: tip.y }}>{tip.label}</div>}
      <AccountDialogs />
    </aside>
  );
};
