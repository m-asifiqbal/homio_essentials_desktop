import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, Globe, Info, Moon, Palette, Server, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { appInfo } from '../services/api';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { HmLogo, PageHeader, Panel } from '../components/common/ui';
import { PRESETS, CUSTOM_ID, getTheme, setTheme, subscribeTheme, baseOf } from '../theme/themes';
import type { AppInfo } from '@shared/types';

/** This computer's preferences (bondhu-fund's Appearance card) and information about the app. */
export const SettingsView: React.FC = () => {
  const { t, language, toggleLanguage, isDarkMode, toggleDarkMode } = useApp();
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => { appInfo().then(setInfo, () => undefined); }, []);

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      <PageHeader caption={t('nav.section_system', 'System')} title={t('nav.settings', 'Settings')} sub={t('set.sub', 'Preferences for this computer only.')} />

      <Panel title={<span className="flex items-center gap-2"><Palette size={15} />{t('set.appearance', 'Appearance')}</span>} bodyClass="p-5 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><div className="form-label !mb-0.5">{t('set.mode', 'Day or night')}</div><span className="form-hint !mt-0">{t('set.mode_hint', 'Night mode is easier on the eyes in a dark room.')}</span></div>
          <SegmentedTabs value={isDarkMode ? 'night' : 'day'} onChange={(v: string) => (v === 'night') !== isDarkMode && toggleDarkMode()} items={[
            { key: 'day', label: t('top.day', 'Day mode'), icon: <Sun size={14} /> }, { key: 'night', label: t('top.night', 'Night mode'), icon: <Moon size={14} /> },
          ]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><div className="form-label !mb-0.5">{t('set.language', 'Language')}</div><span className="form-hint !mt-0">{t('set.language_hint', 'Menus and messages. Content is always edited in both languages.')}</span></div>
          <SegmentedTabs value={language} onChange={(v: string) => v !== language && toggleLanguage()} items={[
            { key: 'en', label: 'English', icon: <Globe size={14} /> }, { key: 'bn', label: 'বাংলা', icon: <Globe size={14} /> },
          ]} />
        </div>
        <div>
          <div className="form-label">{t('set.colour', 'Colour')}</div>
          <div role="radiogroup" className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {PRESETS.map(p => {
              const on = theme.id === p.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setTheme(p.id)}
                  className={`theme-swatch flex items-center gap-3 p-3 rounded-2xl border-[1.5px] text-left ${on ? 'border-accent-600 bg-accent-50 dark:bg-accent-400/10' : 'border-slate-200 dark:border-night-2a3f49 bg-white dark:bg-night-16252d'}`}>
                  <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white" style={{ background: `linear-gradient(140deg, ${p.base}, ${p.base}cc)` }}>{on && <Check size={16} strokeWidth={3} />}</span>
                  <span className="text-[12.5px] font-bold">{language === 'bn' ? p.bn : p.name}</span>
                </button>
              );
            })}
            <label className={`theme-swatch flex items-center gap-3 p-3 rounded-2xl border-[1.5px] cursor-pointer ${theme.id === CUSTOM_ID ? 'border-accent-600 bg-accent-50 dark:bg-accent-400/10' : 'border-slate-200 dark:border-night-2a3f49 bg-white dark:bg-night-16252d'}`} aria-checked={theme.id === CUSTOM_ID}>
              <input type="color" value={theme.id === CUSTOM_ID ? baseOf(theme) : theme.custom} onChange={e => setTheme(CUSTOM_ID, e.target.value)} className="w-9 h-9 rounded-xl border-0 p-0 bg-transparent cursor-pointer" />
              <span className="text-[12.5px] font-bold">{t('set.custom', 'Your colour')}</span>
            </label>
          </div>
        </div>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><Info size={15} />{t('set.about', 'About')}</span>} bodyClass="p-5">
        <div className="flex items-center gap-4">
          <HmLogo size={56} />
          <div>
            <div className="text-lg font-extrabold">{t('app.name', 'Homio Essentials')} <span className="text-peach-deep">{t('app.admin', 'Admin')}</span></div>
            <div className="text-xs text-slate-500">{t('set.version', 'Version {v}', { v: info?.version || '…' })}{info?.electron && info.electron !== '-' ? ` · Electron ${info.electron}` : ''}</div>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-[10rem_1fr] gap-y-2 text-[12.5px]">
          <dt className="text-slate-500 flex items-center gap-1.5"><Server size={13} />{t('set.server', 'Server')}</dt><dd className="font-mono text-[11.5px] break-all">{info?.serverUrl || '—'}</dd>
          <dt className="text-slate-500">{t('set.backups_dir', 'Backup folder')}</dt><dd className="font-mono text-[11.5px] break-all">{info?.backupsDir || '—'}</dd>
        </dl>
        <p className="mt-5 text-[11.5px] text-slate-500 leading-relaxed">{t('set.sources', 'Remedy text comes from Boericke\'s Pocket Manual of Homœopathic Materia Medica (1922) and Allen\'s Keynotes, both in the public domain. Content is reference information, not medical advice.')}</p>
      </Panel>
    </div>
  );
};

export default SettingsView;
