import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Leaf, Pencil, Plus, Search, ShieldCheck, X } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { call } from '../services/api';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { EmptyState, KingdomBadge, LetterTile, PageHeader, SkeletonRows, StatusBadge } from '../components/common/ui';
import { KINGDOMS, STATUSES } from '@shared/types';

const PAGE = 50;

export const MedicinesView: React.FC = () => {
  const { t, go, can, num, relTime, params } = useApp();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [kingdom, setKingdom] = useState('');
  const [review, setReview] = useState<'' | 'needs' | 'done'>((params.review as any) || '');
  const [page, setPage] = useState(0);
  useEffect(() => { const id = setTimeout(() => { setDebounced(q.trim()); setPage(0); }, 250); return () => clearTimeout(id); }, [q]);
  useEffect(() => { setPage(0); }, [status, kingdom, review]);

  const { data, loading } = useLoad(() => call('listRemedies', { q: debounced, status, kingdom, review, offset: page * PAGE, limit: PAGE }), [debounced, status, kingdom, review, page]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <PageHeader caption={t('med.caption', 'Archive')} title={t('nav.medicines', 'Medicines')}
        sub={t('med.sub', '{n} medicines match. Click a row to edit its text, safety notes and review status.', { n: total })}
        actions={can('editor') && <button type="button" onClick={() => go('editor', {})} className="btn btn-primary"><Plus size={15} strokeWidth={2.6} />{t('top.new_medicine', 'New medicine')}</button>} />

      <div className="tbl-filter card-base !rounded-2xl p-3 flex flex-wrap items-center gap-2.5">
        <div className="filter-search relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('med.search', 'Latin, abbreviation or বাংলা name…')} className="form-input !pl-9" data-no-clear="" />
          {q && <button type="button" onClick={() => setQ('')} className="clear-x absolute right-2.5 top-1/2 -translate-y-1/2" aria-label={t('common.clear', 'Clear')}><X size={11} /></button>}
        </div>
        <div className="filter-select"><SearchableSelect size="sm" clearable value={status} onChange={v => setStatus(v || '')} placeholder={t('med.any_status', 'Any status')}
          options={STATUSES.map(s => ({ value: s, label: t(`status.${s}`, s) }))} /></div>
        <div className="filter-select"><SearchableSelect size="sm" clearable value={kingdom} onChange={v => setKingdom(v || '')} placeholder={t('med.any_kingdom', 'Any kingdom')}
          options={KINGDOMS.map(k => ({ value: k, label: t(`kingdom.${k}`, k) }))} /></div>
        <SegmentedTabs size="sm" value={review || 'all'} onChange={(v: string) => setReview(v === 'all' ? '' : (v as any))} items={[
          { key: 'all', label: t('common.all', 'All') },
          { key: 'needs', label: t('med.needs_review', 'Needs review') },
          { key: 'done', label: t('med.reviewed', 'Reviewed') },
        ]} />
      </div>

      <div className="card-base overflow-hidden">
        {loading && !data ? <SkeletonRows rows={8} cols={6} /> : !data?.rows.length ? (
          <EmptyState icon={<Leaf size={22} />} title={t('med.none', 'No medicines match')} body={t('med.none_body', 'Try another spelling, or clear the filters.')} />
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider">
                <th className="px-5 py-2.5 font-bold">{t('med.col.name', 'Medicine')}</th>
                <th className="px-3 py-2.5 font-bold">{t('med.col.bn', 'বাংলা name')}</th>
                <th className="px-3 py-2.5 font-bold">{t('med.col.kingdom', 'Kingdom')}</th>
                <th className="px-3 py-2.5 font-bold">{t('med.col.status', 'Status')}</th>
                <th className="px-3 py-2.5 font-bold">{t('med.col.review', 'Review')}</th>
                <th className="px-3 py-2.5 font-bold">{t('med.col.updated', 'Updated')}</th>
                <th className="px-5 py-2.5" />
              </tr></thead>
              <tbody>
                {data.rows.map(r => {
                  const en = r.remedy_translations.find(x => x.locale === 'en');
                  const bn = r.remedy_translations.find(x => x.locale === 'bn');
                  return (
                    <tr key={r.id} onClick={() => go('editor', { id: r.id })} className="cursor-pointer border-t border-slate-100 dark:border-night-22353f">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <LetterTile size="sm" text={r.latin_name[0]} kingdom={r.kingdom} />
                          <div className="min-w-0">
                            <div className="lat text-[15.5px] text-slate-900 dark:text-white truncate">{r.latin_name}{r.abbreviation && <span className="not-italic font-sans text-[11px] font-bold text-slate-400 ml-2">{r.abbreviation}</span>}</div>
                            <div className="text-[11.5px] text-slate-500 truncate">{en?.common_name || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5" lang="bn">{bn?.display_name || <span className="text-[11px] font-bold text-[var(--hm-amink)]">{t('med.no_bn', 'missing')}</span>}</td>
                      <td className="px-3 py-2.5"><KingdomBadge k={r.kingdom} /></td>
                      <td className="px-3 py-2.5"><StatusBadge s={r.status} /></td>
                      <td className="px-3 py-2.5">{r.needs_medical_review
                        ? <span className="hm-badge s-pend">{t('med.needs_review', 'Needs review')}</span>
                        : <span className="hm-badge s-ok"><ShieldCheck size={11} />{t('med.reviewed', 'Reviewed')}</span>}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{relTime(r.updated_at)}</td>
                      <td className="px-5 py-2.5 text-right"><button type="button" className="btn btn-outline btn-icon btn-act" title={t('common.edit', 'Edit')} aria-label={t('common.edit', 'Edit')} onClick={e => { e.stopPropagation(); go('editor', { id: r.id }); }}><Pencil size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 dark:border-night-22353f text-xs">
            <span className="text-slate-500">{t('common.showing', '{a}–{b} of {n}', { a: page * PAGE + 1, b: Math.min(total, (page + 1) * PAGE), n: total })}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} />{t('common.previous', 'Previous')}</button>
              <span className="font-bold tabular-nums">{num(page + 1)} / {num(pages)}</span>
              <button type="button" className="btn btn-outline btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>{t('common.next', 'Next')}<ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicinesView;
