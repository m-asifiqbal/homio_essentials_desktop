/**
 * Top bar — bondhu-fund's layout: quick search (Ctrl K), language, refresh, day / night (icon swap),
 * notifications popover, the main action, and the profile menu.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Globe, Moon, Plus, RefreshCw, Search, Sun, X, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { call } from '../../services/api';
import { Avatar, ProfileMenu, useOutsideClose } from './Sidebar';
import { ChipTabs } from '../common/ChipTabs';
import { RequestBadge, Spinner } from '../common/ui';
import type { MedicineRequest } from '@shared/types';

const SearchBox: React.FC = () => {
  const { t, go } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<{ id: string; latin_name: string; status: string }[]>([]);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useOutsideClose(ref, open, useCallback(() => setOpen(false), []));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    setBusy(true);
    const id = setTimeout(() => {
      call('searchRemedies', term).then(r => { setHits(r); setSel(0); }, () => setHits([])).finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  const pick = (id: string) => { go('editor', { id }); setOpen(false); setQ(''); inputRef.current?.blur(); };

  return (
    <div ref={ref} className="relative w-full max-w-[26rem]">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input ref={inputRef} value={q} data-no-clear="" onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, hits.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
          else if (e.key === 'Enter' && hits[sel]) pick(hits[sel].id);
          else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
        }}
        placeholder={t('top.search', 'Search medicines…')} aria-label={t('top.search', 'Search medicines…')}
        className="form-input !h-10 !pl-10 !pr-16 !rounded-xl !bg-slate-50 dark:!bg-night-0f1a20" />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {busy ? <Spinner size={13} className="text-slate-400" /> : q ? (
          <button type="button" onClick={() => { setQ(''); inputRef.current?.focus(); }} className="clear-x" aria-label={t('common.clear', 'Clear')}><X size={11} /></button>
        ) : <kbd className="text-[10px] font-bold text-slate-400 border border-slate-300 dark:border-night-2f4a58 rounded-md px-1.5 py-0.5">Ctrl K</kbd>}
      </span>
      {open && q.trim().length >= 2 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-night-16252d border border-slate-200 dark:border-night-283e4a rounded-2xl shadow-2xl p-1.5 z-50 animate-pop">
          {hits.length === 0 && !busy && <div className="px-3 py-5 text-center text-xs text-slate-400">{t('top.no_hits', 'No medicine matches.')}</div>}
          {hits.map((h, i) => (
            <button key={h.id} type="button" onMouseEnter={() => setSel(i)} onClick={() => pick(h.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left ${i === sel ? 'bg-accent-50 dark:bg-accent-400/10' : ''}`}>
              <span className="lat text-[15px] text-slate-900 dark:text-white truncate">{h.latin_name}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{t(`status.${h.status}`, h.status)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const TopBar: React.FC = () => {
  const { t, language, toggleLanguage, isDarkMode, toggleDarkMode, triggerRefresh, go, can, session, relTime, setWaitingCount, refreshKey } = useApp();
  const [spin, setSpin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [filter, setFilter] = useState<'all' | 'new' | 'needs_info'>('all');
  const [waiting, setWaiting] = useState<MedicineRequest[] | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  useOutsideClose(menuRef, menu, useCallback(() => setMenu(false), []));
  useOutsideClose(bellRef, bell, useCallback(() => setBell(false), []));

  // waiting requests: the sidebar badge and the notifications list (every 2 minutes and on refresh)
  useEffect(() => {
    let alive = true;
    const load = () => call('listRequests').then(rows => {
      if (!alive) return;
      const w = rows.filter(r => r.status === 'new' || r.status === 'needs_info');
      setWaiting(w); setWaitingCount(w.length);
    }, () => undefined);
    load();
    const id = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, [refreshKey, setWaitingCount]);

  const refresh = () => { setSpin(true); triggerRefresh(); setTimeout(() => setSpin(false), 700); };
  const shown = (waiting || []).filter(r => filter === 'all' || r.status === filter);
  const iconBtn = 'btn btn-outline btn-icon btn-md !rounded-xl';

  return (
    <header className="h-[4.25rem] shrink-0 flex items-center gap-3 px-6 lg:px-8 bg-white/90 dark:bg-night-101b21/90 backdrop-blur border-b border-slate-200/90 dark:border-night-22353f relative z-40">
      <SearchBox />
      <div className="flex-1" />
      <button type="button" onClick={toggleLanguage} className="btn btn-outline !h-10 !rounded-xl !px-3" title={t('top.language', 'Language')}>
        <Globe size={15} /><span lang={language === 'en' ? 'bn' : 'en'}>{language === 'bn' ? 'ENG' : 'বাংলা'}</span>
      </button>
      <button type="button" onClick={refresh} className={iconBtn} title={t('top.refresh', 'Refresh')} aria-label={t('top.refresh', 'Refresh')}>
        <RefreshCw size={16} className={spin ? 'animate-spin' : ''} />
      </button>
      <button type="button" onClick={toggleDarkMode} className={iconBtn} title={isDarkMode ? t('top.day', 'Day mode') : t('top.night', 'Night mode')} aria-label={t('top.theme', 'Day / night')}>
        <span key={String(isDarkMode)} className="icon-swap inline-flex">{isDarkMode ? <Sun size={16} /> : <Moon size={16} />}</span>
      </button>

      <div className="relative" ref={bellRef}>
        <button type="button" onClick={() => setBell(v => !v)} className={`${iconBtn} relative`} aria-haspopup="dialog" aria-expanded={bell} title={t('top.notifications', 'Notifications')}>
          <Bell size={16} />
          {!!waiting?.length && <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-peach-deep text-white text-[9px] font-extrabold inline-flex items-center justify-center num-in">{waiting.length > 9 ? '9+' : waiting.length}</span>}
        </button>
        {bell && (
          <div className="absolute right-0 top-full mt-2 w-[24rem] bg-white dark:bg-night-16252d border border-slate-200 dark:border-night-283e4a rounded-2xl shadow-2xl z-50 animate-pop overflow-hidden">
            <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 dark:border-night-22353f">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">{t('top.notifications', 'Notifications')}</div>
              <ChipTabs className="mt-2.5" value={filter} onChange={setFilter} items={[
                { key: 'all', label: t('common.all', 'All'), count: waiting?.length ?? 0 },
                { key: 'new', label: t('req.status.new', 'New'), count: (waiting || []).filter(r => r.status === 'new').length },
                { key: 'needs_info', label: t('req.status.needs_info', 'Needs info'), count: (waiting || []).filter(r => r.status === 'needs_info').length },
              ]} />
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {shown.length === 0 && <div className="px-4 py-8 text-center text-xs text-slate-400">{t('top.no_notifications', 'Nothing is waiting. Every request has been answered.')}</div>}
              {shown.map(r => (
                <button key={r.id} type="button" onClick={() => { go('requests', { id: r.id }); setBell(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-night-1d2e36 flex items-start gap-3">
                  <span className="mt-0.5 w-2 h-2 rounded-full bg-peach-deep shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-bold text-slate-900 dark:text-white truncate">
                      {t('top.request_from', 'New {kind} request', { kind: r.kind === 'remedy' ? t('req.kind.remedy', 'remedy') : t('req.kind.product', 'product') })}: <span className="lat font-semibold">{r.payload?.latin_name || r.payload?.name || '—'}</span>
                    </span>
                    <span className="flex items-center gap-2 mt-1 text-[11px] text-slate-500"><RequestBadge s={r.status} />{relTime(r.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { go('requests'); setBell(false); }} className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-slate-100 dark:border-night-22353f text-xs font-bold text-accent-700 dark:text-accent-300 hover:bg-slate-50 dark:hover:bg-night-1d2e36">
              {t('top.open_queue', 'Open the request queue')}<ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {can('editor') && (
        <button type="button" onClick={() => go('editor', {})} className="btn btn-primary !h-10 !rounded-xl">
          <Plus size={16} strokeWidth={2.6} />{t('top.new_medicine', 'New medicine')}
        </button>
      )}

      <div className="relative" ref={menuRef}>
        <button type="button" onClick={() => setMenu(v => !v)} className="rounded-xl p-0.5 hover:ring-2 hover:ring-accent-200 dark:hover:ring-accent-800" aria-haspopup="menu" aria-expanded={menu} title={session?.displayName}>
          <Avatar name={session?.displayName} className="w-9 h-9 rounded-xl text-xs" />
        </button>
        {menu && <ProfileMenu onClose={() => setMenu(false)} className="absolute right-0 top-full mt-2 w-64" />}
      </div>
    </header>
  );
};
