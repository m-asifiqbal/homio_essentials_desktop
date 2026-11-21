/**
 * Small shared pieces in the Homio look: logo, switch, badges, tag input, empty state, skeletons, page header.
 */
import React, { useState } from 'react';
import { X, Inbox, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ContentStatus, Kingdom, RequestStatus } from '@shared/types';

/** The Homio Essentials mark: leaf on a teal tile with a peach globule (same drawing as the mobile app icon). */
export const HmLogo: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className={`shrink-0 ${className}`}>
    <defs>
      <linearGradient id="hm-tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#13777A" /><stop offset="1" stopColor="#0B5557" /></linearGradient>
    </defs>
    <rect width="48" height="48" rx="14" fill="url(#hm-tile)" />
    <path d="M14 33c0-11 7-18 20-18 0 12-7 19-18 19" fill="#fff" />
    <path d="M14 33c4-7 9-11 14-14" stroke="#0F6466" strokeWidth="2" strokeLinecap="round" fill="none" />
    <circle cx="34" cy="34" r="4" fill="#FF9B7B" />
  </svg>
);

export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string; id?: string }> = ({ checked, onChange, disabled, label, id }) => (
  <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="hm-switch">
    <span />
  </button>
);

export const KingdomBadge: React.FC<{ k: Kingdom | null | undefined }> = ({ k }) => {
  const { t } = useApp();
  if (!k) return <span className="text-slate-400 text-xs">—</span>;
  return <span className={`hm-badge k-${k}`}>{t(`kingdom.${k}`, k[0].toUpperCase() + k.slice(1))}</span>;
};

const STATUS_CLASS: Record<string, string> = { published: 's-ok', draft: 's-draft', stub: 's-info', archived: 's-rej' };
export const StatusBadge: React.FC<{ s: ContentStatus | string }> = ({ s }) => {
  const { t } = useApp();
  return <span className={`hm-badge ${STATUS_CLASS[s] || 's-draft'}`}><i className="dot" />{t(`status.${s}`, s[0].toUpperCase() + s.slice(1))}</span>;
};

const REQ_CLASS: Record<RequestStatus, string> = { new: 's-pend', needs_info: 's-info', approved: 's-ok', merged: 's-ok', rejected: 's-rej' };
export const RequestBadge: React.FC<{ s: RequestStatus }> = ({ s }) => {
  const { t } = useApp();
  const en: Record<RequestStatus, string> = { new: 'New', needs_info: 'Needs info', approved: 'Approved', merged: 'Merged', rejected: 'Rejected' };
  return <span className={`hm-badge ${REQ_CLASS[s]}`}><i className="dot" />{t(`req.status.${s}`, en[s])}</span>;
};

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const { t } = useApp();
  const cls = role === 'owner' ? 's-peach' : role === 'editor' ? '' : 's-info';
  return <span className={`hm-badge ${cls}`}>{t(`role.${role}`, role[0].toUpperCase() + role.slice(1))}</span>;
};

/** Initial letter(s) on a soft tile, coloured by kingdom when given. */
export const LetterTile: React.FC<{ text: string; kingdom?: Kingdom | null; size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ text, kingdom, size = 'md', className = '' }) => (
  <span className={`hm-tile ${size === 'md' ? '' : size} ${kingdom ? `k-${kingdom}` : ''} ${className}`}>{text}</span>
);

/** Free-text list edited as chips (potencies, search keys, groups, keynotes). Enter or comma adds. */
export const TagInput: React.FC<{ value: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean; id?: string }> = ({ value, onChange, placeholder, disabled, id }) => {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean).filter(s => !value.includes(s));
    if (parts.length) onChange([...value, ...parts]);
    setDraft('');
  };
  return (
    <div className={`form-input !h-auto min-h-[2.75rem] flex flex-wrap items-center gap-1.5 !py-1.5 ${disabled ? 'opacity-60' : ''}`} onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
      {value.map(v => (
        <span key={v} className="tag-chip">{v}
          {!disabled && <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter(x => x !== v))}><X size={11} strokeWidth={3} /></button>}
        </span>
      ))}
      {!disabled && (
        <input id={id} value={draft} data-no-clear="" onChange={e => setDraft(e.target.value)} placeholder={value.length ? '' : placeholder}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ',') && draft.trim()) { e.preventDefault(); add(draft); }
            else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft.trim() && add(draft)}
          className="flex-1 min-w-[6rem] bg-transparent outline-none text-[13px] font-medium py-1" />
      )}
    </div>
  );
};

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }> = ({ icon, title, body, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6">
    <div className="w-14 h-14 rounded-2xl bg-accent-50 dark:bg-accent-400/10 text-accent-600 dark:text-accent-300 flex items-center justify-center">{icon || <Inbox size={24} />}</div>
    <h3 className="mt-4 text-sm font-extrabold text-slate-900 dark:text-white">{title}</h3>
    {body && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const SkeletonRows: React.FC<{ rows?: number; cols?: number }> = ({ rows = 6, cols = 5 }) => (
  <div className="p-4 space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 items-center">
        <div className="w-9 h-9 rounded-xl bg-slate-200/80 dark:bg-night-1d2e36 animate-pulse" />
        {Array.from({ length: cols - 1 }).map((__, j) => (
          <div key={j} className="h-3 rounded bg-slate-200/80 dark:bg-night-1d2e36 animate-pulse" style={{ width: `${[28, 14, 12, 10, 16][j % 5]}%`, animationDelay: `${(i * cols + j) * 30}ms` }} />
        ))}
      </div>
    ))}
  </div>
);

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => <Loader2 size={size} className={`animate-spin ${className}`} />;

/** Title row of a screen: small caption, big title, actions on the right. */
export const PageHeader: React.FC<{ caption?: string; title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }> = ({ caption, title, sub, actions }) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {caption && <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-700 dark:text-accent-300">{caption}</div>}
      <h1 className="text-[1.6rem] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight mt-0.5">{title}</h1>
      {sub && <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
  </div>
);

/** A card with an optional header line (title left, action right). */
export const Panel: React.FC<{ title?: React.ReactNode; action?: React.ReactNode; className?: string; bodyClass?: string; children: React.ReactNode }> = ({ title, action, className = '', bodyClass = '', children }) => (
  <section className={`card-base overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200/80 dark:border-night-22353f">
        <h2 className="text-[13.5px] font-extrabold text-slate-900 dark:text-white">{title}</h2>
        {action}
      </div>
    )}
    <div className={bodyClass}>{children}</div>
  </section>
);

/** Label + control + hint. */
export const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; htmlFor?: string; className?: string; children: React.ReactNode }> = ({ label, hint, htmlFor, className = '', children }) => (
  <div className={className}>
    <label className="form-label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <span className="form-hint">{hint}</span>}
  </div>
);

/** Two text fields side by side: English and বাংলা. */
export const I18nInputs: React.FC<{ value: { en?: string | null; bn?: string | null }; onChange: (v: { en: string; bn: string }) => void; multiline?: boolean; disabled?: boolean; placeholderEn?: string; placeholderBn?: string }> = ({ value, onChange, multiline, disabled, placeholderEn, placeholderBn }) => {
  const en = value?.en ?? '', bn = value?.bn ?? '';
  const Tag: any = multiline ? 'textarea' : 'input';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="relative"><span className="absolute -top-2 left-3 px-1 text-[9px] font-black tracking-wider bg-white dark:bg-night-142026 text-slate-400 z-[1]">EN</span>
        <Tag className="form-input" rows={multiline ? 3 : undefined} disabled={disabled} value={en} placeholder={placeholderEn} onChange={(e: any) => onChange({ en: e.target.value, bn })} /></div>
      <div className="relative"><span className="absolute -top-2 left-3 px-1 text-[9px] font-black tracking-wider bg-white dark:bg-night-142026 text-slate-400 z-[1]">বাংলা</span>
        <Tag lang="bn" className="form-input" rows={multiline ? 3 : undefined} disabled={disabled} value={bn} placeholder={placeholderBn} onChange={(e: any) => onChange({ en, bn: e.target.value })} /></div>
    </div>
  );
};
