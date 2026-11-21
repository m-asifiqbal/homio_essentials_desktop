import React, { useEffect, useMemo, useState } from 'react';
import { Check, CircleHelp, GitMerge, ImageOff, Inbox, Loader2, Search, ThumbsDown, X, AlertTriangle, CheckCircle2, User } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { call } from '../services/api';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { Modal } from '../components/common/Modal';
import { EmptyState, LetterTile, RequestBadge, SkeletonRows, StatusBadge } from '../components/common/ui';
import type { MedicineRequest, RequestDetail, RequestStatus } from '@shared/types';

type Tab = 'new' | 'needs_info' | 'approved' | 'rejected';
const inTab = (r: MedicineRequest, tab: Tab) => (tab === 'approved' ? r.status === 'approved' || r.status === 'merged' : r.status === tab);
const titleOf = (r: MedicineRequest) => String(r.payload?.latin_name || r.payload?.name || '—');

/** Fields of the request payload, in display order, and whether the approval can carry them over. */
const FIELDS: { key: string; en: string; keepable: boolean }[] = [
  { key: 'latin_name', en: 'Latin name', keepable: false },
  { key: 'common_name', en: 'Common name', keepable: true },
  { key: 'bangla_name', en: 'Name in Bangla', keepable: true },
  { key: 'abbreviation', en: 'Abbreviation', keepable: true },
  { key: 'kingdom', en: 'Kingdom', keepable: true },
  { key: 'description', en: 'Description / notes', keepable: true },
  { key: 'brand', en: 'Brand', keepable: false },
  { key: 'potency', en: 'Potency', keepable: false },
];

export const RequestsView: React.FC = () => {
  const { t, params, num, relTime, setWaitingCount } = useApp();
  const { data, loading, reload } = useLoad(() => call('listRequests'));
  const [tab, setTab] = useState<Tab>('new');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(params.id || null);

  const rows = data || [];
  const counts = useMemo(() => ({
    new: rows.filter(r => r.status === 'new').length, needs_info: rows.filter(r => r.status === 'needs_info').length,
    approved: rows.filter(r => inTab(r, 'approved')).length, rejected: rows.filter(r => r.status === 'rejected').length,
  }), [rows]);
  useEffect(() => { if (data) setWaitingCount(counts.new + counts.needs_info); }, [data, counts, setWaitingCount]);

  // opening from a link: show the tab that holds the request
  useEffect(() => {
    if (!data || !params.id) return;
    const r = data.find(x => x.id === params.id);
    if (r) setTab(r.status === 'merged' ? 'approved' : (r.status as Tab));
  }, [data, params.id]);

  const list = rows.filter(r => inTab(r, tab)).filter(r => !filter.trim() || `${titleOf(r)} ${r.code} ${r.payload?.brand || ''}`.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => (tab === 'new' || tab === 'needs_info' ? a.created_at.localeCompare(b.created_at) : b.updated_at.localeCompare(a.updated_at)));
  useEffect(() => {
    if (!data) return;
    if (!selected || !list.some(r => r.id === selected)) setSelected(list[0]?.id || null);
  }, [tab, data, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-700 dark:text-accent-300">{t('req.caption', 'Moderation')}</div>
          <h1 className="text-[1.6rem] font-extrabold tracking-tight text-slate-900 dark:text-white">{t('req.title', 'Medicine requests')}</h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{t('req.sub', 'Sent from the app by readers. Nothing becomes public until an editor publishes it.')}</p></div>
        <SegmentedTabs value={tab} onChange={setTab} items={[
          { key: 'new', label: t('req.status.new', 'New'), count: num(counts.new) },
          { key: 'needs_info', label: t('req.status.needs_info', 'Needs info'), count: num(counts.needs_info) },
          { key: 'approved', label: t('req.status.approved', 'Approved'), count: num(counts.approved) },
          { key: 'rejected', label: t('req.status.rejected', 'Rejected'), count: num(counts.rejected) },
        ]} />
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        {/* queue */}
        <div className="card-base overflow-hidden flex-[1_1_300px] max-w-[380px] min-w-[280px]">
          <div className="p-3 border-b border-slate-100 dark:border-night-22353f relative">
            <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={filter} onChange={e => setFilter(e.target.value)} data-no-clear="" placeholder={t('req.filter', 'Filter requests')} className="form-input !h-10 !pl-9" />
          </div>
          {loading && !data ? <SkeletonRows rows={5} cols={2} /> : !list.length ? (
            <EmptyState icon={<Inbox size={22} />} title={t('req.empty', 'Nothing here')} body={tab === 'new' ? t('req.empty_new', 'No new requests. They arrive here when readers send a medicine from the app.') : undefined} />
          ) : (
            <div role="listbox" className="max-h-[calc(100vh-17rem)] overflow-y-auto">
              {list.map(r => (
                <button key={r.id} role="option" aria-selected={r.id === selected} type="button" onClick={() => setSelected(r.id)} className="rq-item">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className={`${r.kind === 'remedy' ? 'lat text-[15.5px]' : 'font-bold text-[13px]'} text-slate-900 dark:text-white truncate`}>{titleOf(r)}{r.payload?.brand && r.kind === 'product' ? ` · ${r.payload.brand}` : ''}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{relTime(r.created_at)}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className={`hm-badge ${r.kind === 'remedy' ? 'k-plant' : 'k-nosode'}`}>{r.kind === 'remedy' ? t('req.kind.Remedy', 'Remedy') : t('req.kind.Product', 'Brand')}</span>
                    {(tab === 'approved' || tab === 'rejected') && <RequestBadge s={r.status} />}
                  </div>
                  <div className="text-[11.5px] text-slate-500">{t(`requester.${r.requester_role || 'general'}`, r.requester_role || 'general')} · {r.photo_paths?.length ? t('req.photos', '{n} photo(s)', { n: r.photo_paths.length }) : t('req.no_photo', 'no photo')} · {r.code}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* detail */}
        <div className="flex-[999_1_560px] min-w-0">
          {selected ? <RequestDetailPane key={selected} id={selected} onChanged={reload} /> : !loading && (
            <div className="card-base"><EmptyState icon={<Inbox size={22} />} title={t('req.pick', 'Choose a request')} body={t('req.pick_body', 'Its details, the duplicate check and the actions appear here.')} /></div>
          )}
        </div>
      </div>
    </div>
  );
};

const RequestDetailPane: React.FC<{ id: string; onChanged: () => void }> = ({ id, onChanged }) => {
  const { t, can, go, fmtDate, showToast, showError } = useApp();
  const { data, loading } = useLoad<RequestDetail>(() => call('requestDetail', id), [id]);
  const [keep, setKeep] = useState<Set<string>>(new Set(['common_name', 'bangla_name', 'abbreviation', 'kingdom', 'description']));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'reject' | 'merge'>(null);
  const [mergeQ, setMergeQ] = useState('');
  const [mergeHits, setMergeHits] = useState<{ id: string; latin_name: string; status: string }[]>([]);
  const [mergeId, setMergeId] = useState<string | null>(null);
  const editable = can('editor');

  useEffect(() => { if (data) { setNote(data.request.reviewer_note || ''); if (data.exact[0]) setMergeId(data.exact[0].id); } }, [data]);
  useEffect(() => {
    if (dialog !== 'merge' || mergeQ.trim().length < 2) return;
    const h = setTimeout(() => call('searchRemedies', mergeQ).then(setMergeHits, () => setMergeHits([])), 220);
    return () => clearTimeout(h);
  }, [mergeQ, dialog]);

  if (loading && !data) return <div className="card-base"><SkeletonRows rows={7} cols={3} /></div>;
  if (!data) return null;
  const r = data.request;
  const open = r.status === 'new' || r.status === 'needs_info';
  const name = titleOf(r);

  const act = async (label: string, fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setBusy(label);
    try { await fn(); showToast(ok); onChanged(); after?.(); } catch (e) { showError(e); } finally { setBusy(null); setDialog(null); }
  };
  const approve = () => act('approve', async () => {
    if (r.kind === 'remedy') {
      const newId = await call('approveRequest', r.id, [...keep], note);
      go('editor', { id: newId });
    } else await call('setRequestStatus', r.id, 'approved', note);
  }, r.kind === 'remedy' ? t('req.approved_draft', 'Approved. A draft was created with the ticked fields.') : t('req.approved', 'Marked as approved.'));

  const toggle = (k: string) => setKeep(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const fields = FIELDS.filter(f => r.payload?.[f.key] !== undefined && r.payload?.[f.key] !== '');
  const extra = Object.keys(r.payload || {}).filter(k => !FIELDS.some(f => f.key === k));

  return (
    <div className="space-y-5">
      <div className="card-base p-5 flex flex-wrap items-center gap-4">
        <LetterTile size="lg" text={name[0]?.toUpperCase() || '?'} kingdom={r.kind === 'remedy' ? 'plant' : 'nosode'} />
        <div className="flex-1 min-w-0">
          <div className={`${r.kind === 'remedy' ? 'lat text-[1.6rem]' : 'text-xl font-extrabold'} leading-tight text-slate-900 dark:text-white`}>{name}</div>
          <div className="text-[12.5px] text-slate-500 mt-1">
            {r.code} · {r.kind === 'remedy' ? t('req.kind.new_remedy', 'new remedy') : t('req.kind.new_product', 'new brand / product')} · {fmtDate(r.created_at, true)} · {t(`requester.${r.requester_role || 'general'}`, r.requester_role || 'general')}
            {data.history.total > 0 && <> · {t('req.history', '{n} earlier requests, {a} approved', { n: data.history.total, a: data.history.approved })}</>}
          </div>
        </div>
        <RequestBadge s={r.status} />
      </div>

      {/* duplicate check */}
      {data.exact.length ? (
        <div className="hm-callout danger"><AlertTriangle size={17} className="shrink-0 mt-0.5" /><div className="flex-1"><b>{t('req.dup', 'Duplicate check.')}</b> {t('req.dup_exists', 'A medicine with this name already exists:')}{' '}
          {data.exact.map(e => <button key={e.id} type="button" onClick={() => go('editor', { id: e.id })} className="lat underline underline-offset-2 mr-2">{e.latin_name}</button>)}
          {t('req.dup_merge', 'Merge the request into it instead of approving a copy.')}</div></div>
      ) : data.similar.length || data.products.length ? (
        <div className="hm-callout warn"><Search size={16} className="shrink-0 mt-0.5" /><div className="flex-1"><b>{t('req.dup', 'Duplicate check.')}</b> {t('req.dup_similar', 'No exact match. Similar names:')}{' '}
          {data.similar.map(e => <button key={e.id} type="button" onClick={() => go('editor', { id: e.id })} className="lat underline underline-offset-2 mr-2">{e.latin_name}</button>)}
          {data.products.map(p => <span key={p.id} className="font-semibold mr-2">{p.name}{p.manufacturers ? ` (${p.manufacturers.name})` : ''}</span>)}</div></div>
      ) : (
        <div className="hm-callout ok"><CheckCircle2 size={16} className="shrink-0 mt-0.5" /><span><b>{t('req.dup', 'Duplicate check.')}</b> {t('req.dup_none', 'Nothing with this name is in the archive yet.')}</span></div>
      )}

      <div className="flex flex-wrap gap-5 items-start">
        <div className="card-base overflow-hidden flex-[999_1_420px] min-w-0">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 dark:border-night-22353f">
            <h2 className="text-[13.5px] font-extrabold">{t('req.details', 'Submitted details')}</h2>
            {open && r.kind === 'remedy' && <span className="text-xs font-semibold text-slate-500">{t('req.tick', 'Tick what to keep')}</span>}
          </div>
          <dl className="divide-y divide-slate-100 dark:divide-night-22353f text-[13px]">
            {fields.map(f => (
              <div key={f.key} className="flex gap-4 px-5 py-2.5 items-start">
                <dt className="w-40 shrink-0 font-semibold text-slate-500">{t(`req.f.${f.key}`, f.en)}</dt>
                <dd className={`flex-1 min-w-0 break-words ${f.key === 'latin_name' ? 'lat text-[15.5px]' : ''}`} lang={f.key === 'bangla_name' ? 'bn' : undefined}>{String(r.payload[f.key])}</dd>
                {open && r.kind === 'remedy' && f.keepable && (
                  <input type="checkbox" aria-label={t('req.keep', 'Keep')} className="mt-1" checked={keep.has(f.key)} onChange={() => toggle(f.key)} disabled={!editable} />
                )}
              </div>
            ))}
            {extra.map(k => (
              <div key={k} className="flex gap-4 px-5 py-2.5"><dt className="w-40 shrink-0 font-semibold text-slate-500">{k.replace(/_/g, ' ')}</dt><dd className="flex-1 min-w-0 break-words">{typeof r.payload[k] === 'object' ? JSON.stringify(r.payload[k]) : String(r.payload[k])}</dd></div>
            ))}
          </dl>
        </div>
        <div className="card-base p-4 flex-[1_1_200px] min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">{t('req.label_photo', 'Label photo')}</div>
          {data.photos.length ? (
            <div className="grid gap-2">{data.photos.map(p => p.url
              ? <a key={p.path} href={p.url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-slate-200 dark:border-night-2a3f49"><img src={p.url} alt="" className="w-full h-44 object-cover" /></a>
              : <div key={p.path} className="h-24 rounded-xl bg-slate-100 dark:bg-night-1d2e36 flex items-center justify-center text-xs text-slate-400">{t('req.photo_failed', 'Could not load')}</div>)}</div>
          ) : (
            <div className="promo-frame !aspect-square flex flex-col items-center justify-center gap-2 text-slate-500 text-xs"><ImageOff size={22} />{t('req.no_photo_sent', 'No photo was sent')}</div>
          )}
        </div>
      </div>

      <div className="card-base p-5 space-y-3">
        <label className="form-label !mb-0" htmlFor="rq-note">{t('req.note', 'Note to the requester')} <span className="font-medium text-slate-400">· {t('req.note_hint', 'shown in their "My requests" in the app')}</span></label>
        <textarea id="rq-note" className="form-input" rows={3} value={note} disabled={!editable || !open} onChange={e => setNote(e.target.value)}
          placeholder={t('req.note_ph', 'Thanks! We have added it and will publish it after a second review.')} />
        {open && editable ? (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" disabled={!!busy} className="btn btn-danger-outline" onClick={() => setDialog('reject')}><ThumbsDown size={15} />{t('req.reject', 'Reject…')}</button>
              {r.status !== 'needs_info' && <button type="button" disabled={!!busy} className="btn btn-outline" onClick={() => act('info', () => call('setRequestStatus', r.id, 'needs_info', note), t('req.asked', 'Moved to "Needs info". The reader sees your note.'))}>
                {busy === 'info' ? <Loader2 size={15} className="animate-spin" /> : <CircleHelp size={15} />}{t('req.ask_info', 'Ask for more info')}</button>}
              {r.kind === 'remedy' && <button type="button" disabled={!!busy} className="btn btn-outline" onClick={() => setDialog('merge')}><GitMerge size={15} />{t('req.merge', 'Merge into existing…')}</button>}
              <span className="flex-1" />
              <button type="button" disabled={!!busy || (r.kind === 'remedy' && data.exact.length > 0)} className="btn btn-primary" onClick={approve}
                title={data.exact.length ? t('req.approve_blocked', 'Already in the archive: merge instead') : undefined}>
                {busy === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2.6} />}
                {r.kind === 'remedy' ? t('req.approve_draft', 'Approve & open as draft') : t('req.approve_product', 'Mark as added')}
              </button>
            </div>
            <p className="text-[11.5px] text-slate-500">{r.kind === 'remedy' ? t('req.approve_note', 'Approving creates a draft with the ticked fields. Nothing is public until an editor publishes it.') : t('req.approve_product_note', 'Add the product under Brands & products, then mark the request as added.')}</p>
          </>
        ) : !open ? (
          <div className="flex items-center gap-2 text-xs text-slate-500"><User size={13} />{t('req.closed', 'Closed {date}.', { date: fmtDate(r.updated_at, true) })}
            {r.linked_remedy_id && <button type="button" className="font-bold text-accent-700 dark:text-accent-300 underline underline-offset-2" onClick={() => go('editor', { id: r.linked_remedy_id! })}>{t('req.open_linked', 'Open the linked medicine')}</button>}</div>
        ) : null}
      </div>

      <Modal open={dialog === 'reject'} onClose={() => setDialog(null)} locked={!!busy} size="sm" tone="danger" icon={<ThumbsDown size={18} />} title={t('req.reject_title', 'Reject this request?')}
        footer={<>
          <button type="button" className="btn btn-cancel" disabled={!!busy} onClick={() => setDialog(null)}>{t('common.cancel', 'Cancel')}</button>
          <button type="button" className="btn btn-danger" disabled={!!busy || !note.trim()} onClick={() => act('reject', () => call('setRequestStatus', r.id, 'rejected' as RequestStatus, note), t('req.rejected', 'Request rejected.'))}>
            {busy === 'reject' && <Loader2 size={14} className="animate-spin" />}{t('req.reject_btn', 'Reject')}</button>
        </>}>
        <p className="mb-3">{t('req.reject_body', 'The reader sees your note in the app. Say briefly why, for example "not a homeopathic remedy".')}</p>
        <textarea className="form-input" rows={3} value={note} onChange={e => setNote(e.target.value)} autoFocus />
      </Modal>

      <Modal open={dialog === 'merge'} onClose={() => setDialog(null)} locked={!!busy} size="md" icon={<GitMerge size={18} />} title={t('req.merge_title', 'Merge into an existing medicine')}
        subtitle={t('req.merge_sub', 'The request is closed and linked to the medicine you choose.')}
        footer={<>
          <button type="button" className="btn btn-cancel" disabled={!!busy} onClick={() => setDialog(null)}>{t('common.cancel', 'Cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!!busy || !mergeId} onClick={() => act('merge', () => call('mergeRequest', r.id, mergeId!, note), t('req.merged', 'Merged.'))}>
            {busy === 'merge' && <Loader2 size={14} className="animate-spin" />}{t('req.merge_btn', 'Merge')}</button>
        </>}>
        <div className="relative mb-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="form-input !pl-9" value={mergeQ} onChange={e => setMergeQ(e.target.value)} placeholder={t('req.merge_search', 'Search medicines…')} data-no-clear="" /></div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {[...data.exact, ...data.similar, ...mergeHits.filter(h => !data.exact.some(e => e.id === h.id) && !data.similar.some(e => e.id === h.id))].map(h => (
            <button key={h.id} type="button" onClick={() => setMergeId(h.id)} aria-pressed={mergeId === h.id}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border-[1.5px] text-left ${mergeId === h.id ? 'border-accent-600 bg-accent-50 dark:bg-accent-400/10' : 'border-slate-200 dark:border-night-2a3f49 hover:border-accent-300'}`}>
              <span className="lat text-[15px]">{h.latin_name}</span><span className="flex items-center gap-2"><StatusBadge s={h.status} />{mergeId === h.id && <Check size={15} className="text-accent-600" />}</span>
            </button>
          ))}
          {!data.exact.length && !data.similar.length && !mergeHits.length && <p className="text-xs text-slate-400 py-4 text-center">{t('req.merge_type', 'Type at least two letters to search.')}</p>}
        </div>
        {mergeId && <button type="button" className="mt-3 text-xs text-slate-500 inline-flex items-center gap-1" onClick={() => setMergeId(null)}><X size={12} />{t('common.clear', 'Clear')}</button>}
      </Modal>
    </div>
  );
};

export default RequestsView;
