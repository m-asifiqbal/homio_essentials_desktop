import React, { useRef, useState } from 'react';
import { CalendarRange, Eye, ImagePlus, Loader2, Megaphone, MousePointerClick, Pencil, Phone, Plus, Trash2, Link as LinkIcon, MessageCircle, AlertTriangle } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { call, publicUrl } from '../services/api';
import { Modal } from '../components/common/Modal';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { EmptyState, Field, I18nInputs, PageHeader, SkeletonRows } from '../components/common/ui';
import type { Promotion } from '@shared/types';

const toLocalInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocalInput = (v: string) => new Date(v).toISOString();

const blank = (): Promotion => {
  const start = new Date(); start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 864e5);
  return { advertiser: '', title: { en: '', bn: '' }, image_path: '', image_bn_path: null, tap_action: 'link', tap_value: '', placements: ['home'], remedy_ids: [], starts_at: start.toISOString(), ends_at: end.toISOString(), sort_order: 0, status: 'draft' };
};

type Phase = 'live' | 'scheduled' | 'ended' | 'draft' | 'archived';
const phaseOf = (p: Promotion): Phase => {
  if (p.status !== 'published') return p.status as Phase;
  const now = Date.now();
  return now < new Date(p.starts_at).getTime() ? 'scheduled' : now > new Date(p.ends_at).getTime() ? 'ended' : 'live';
};
const PHASE_CLASS: Record<Phase, string> = { live: 's-ok', scheduled: 's-info', ended: 's-draft', draft: 's-pend', archived: 's-rej' };

export const PromotionsView: React.FC = () => {
  const { t, can, num, fmtDate, showToast, showError } = useApp();
  const { data, loading, reload } = useLoad(() => call('listPromotions'));
  const [edit, setEdit] = useState<Promotion | null>(null);
  const [del, setDel] = useState<Promotion | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = can('editor');

  const remove = async () => {
    if (!del?.id) return;
    setBusy(true);
    try { await call('deletePromotion', del.id); showToast(t('promo.deleted', 'Promotion deleted.')); setDel(null); reload(); } catch (e) { showError(e); } finally { setBusy(false); }
  };

  const tapIcon = (a: string) => (a === 'call' ? <Phone size={12} /> : a === 'whatsapp' ? <MessageCircle size={12} /> : <LinkIcon size={12} />);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <PageHeader caption={t('nav.section_app', 'App content')} title={t('nav.promotions', 'Promotions')}
        sub={t('promo.sub', 'Paid banners shown on the home screen and on remedy pages, between the start and end dates.')}
        actions={editable && <button type="button" className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={15} strokeWidth={2.6} />{t('promo.new', 'New promotion')}</button>} />

      {loading && !data ? <div className="card-base"><SkeletonRows rows={4} /></div> : !data?.rows.length ? (
        <div className="card-base"><EmptyState icon={<Megaphone size={22} />} title={t('promo.none', 'No promotions yet')} body={t('promo.none_body', 'When none is live, the app shows the "advertise here" message from App settings.')}
          action={editable && <button type="button" className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={15} />{t('promo.new', 'New promotion')}</button>} /></div>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(330px,1fr))]">
          {data.rows.map(p => {
            const ph = phaseOf(p);
            const st = data.stats[p.id!] || { impressions: 0, taps: 0 };
            const ctr = st.impressions ? ((st.taps / st.impressions) * 100).toFixed(1) : '0.0';
            return (
              <article key={p.id} className="card-base overflow-hidden flex flex-col hover:shadow-[0_14px_32px_-18px_rgba(15,60,62,.45)]">
                <div className="promo-frame !rounded-none relative">
                  {p.image_path ? <img src={publicUrl('promotions', p.image_path)} alt="" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Megaphone size={28} /></div>}
                  <span className={`hm-badge ${PHASE_CLASS[ph]} absolute top-3 left-3 shadow-sm`}><i className="dot" />{t(`promo.phase.${ph}`, ph)}</span>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{p.advertiser}</div>
                  <div className="font-extrabold text-slate-900 dark:text-white leading-snug">{p.title.en}</div>
                  <div className="text-[13px] text-slate-500" lang="bn">{p.title.bn}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {p.placements.map(pl => <span key={pl} className="hm-badge s-draft">{t(`promo.place.${pl}`, pl)}</span>)}
                    <span className="hm-badge s-info">{tapIcon(p.tap_action)}{t(`promo.tap.${p.tap_action}`, p.tap_action)}</span>
                  </div>
                  <div className="text-[11.5px] text-slate-500 flex items-center gap-1.5 mt-1"><CalendarRange size={12} />{fmtDate(p.starts_at)} – {fmtDate(p.ends_at)}</div>
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-night-22353f text-center">
                    <div><div className="text-[15px] font-extrabold flex items-center justify-center gap-1"><Eye size={13} className="text-slate-400" />{num(st.impressions)}</div><div className="text-[10.5px] text-slate-500">{t('promo.views', 'views · 30 d')}</div></div>
                    <div><div className="text-[15px] font-extrabold flex items-center justify-center gap-1"><MousePointerClick size={13} className="text-slate-400" />{num(st.taps)}</div><div className="text-[10.5px] text-slate-500">{t('promo.taps', 'taps')}</div></div>
                    <div><div className="text-[15px] font-extrabold">{ctr}%</div><div className="text-[10.5px] text-slate-500">{t('promo.ctr', 'tap rate')}</div></div>
                  </div>
                </div>
                {editable && (
                  <div className="flex gap-2 px-4 pb-4">
                    <button type="button" className="btn btn-outline btn-sm flex-1" onClick={() => setEdit(p)}><Pencil size={13} />{t('common.edit', 'Edit')}</button>
                    <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setDel(p)} aria-label={t('common.delete', 'Delete')}><Trash2 size={13} /></button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <PromotionDialog promo={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
      <Modal open={!!del} onClose={() => setDel(null)} locked={busy} size="sm" tone="danger" icon={<Trash2 size={18} />} title={t('promo.delete_title', 'Delete this promotion?')}
        footer={<>
          <button type="button" className="btn btn-cancel" disabled={busy} onClick={() => setDel(null)}>{t('common.cancel', 'Cancel')}</button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>{busy && <Loader2 size={14} className="animate-spin" />}{t('common.delete', 'Delete')}</button>
        </>}>
        {t('promo.delete_body', 'The banner and its images are removed. Its view and tap counts are deleted too. To keep them, set it to Archived instead.')}
      </Modal>
    </div>
  );
};

const PromotionDialog: React.FC<{ promo: Promotion | null; onClose: () => void; onSaved: () => void }> = ({ promo, onClose, onSaved }) => {
  const { t, showToast, showError } = useApp();
  const [p, setP] = useState<Promotion>(blank());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'' | 'en' | 'bn'>('');
  const fileEn = useRef<HTMLInputElement>(null);
  const fileBn = useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (promo) setP(structuredClone(promo)); }, [promo]);
  const set = <K extends keyof Promotion>(k: K, v: Promotion[K]) => setP(x => ({ ...x, [k]: v }));

  const upload = async (which: 'en' | 'bn', file: File | undefined) => {
    if (!file) return;
    if (file.size > 512 * 1024) { showToast(t('promo.too_big', 'The image must be 512 KB or smaller.'), 'error'); return; }
    setUploading(which);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let path = await call('uploadPromotionImage', bytes, file.name, file.type);
      if (!path) path = URL.createObjectURL(file);                 // demo preview: keep the picked file on screen
      set(which === 'en' ? 'image_path' : 'image_bn_path', path);
    } catch (e) { showError(e); } finally { setUploading(''); }
  };

  const save = async () => {
    setBusy(true);
    try { await call('savePromotion', p); showToast(t('promo.saved', 'Promotion saved.')); onSaved(); } catch (e) { showError(e); } finally { setBusy(false); }
  };

  const tapPlaceholder = p.tap_action === 'link' ? 'https://…' : '+8801XXXXXXXXX';
  const imgBox = (which: 'en' | 'bn', path: string | null, ref: React.RefObject<HTMLInputElement>) => (
    <div>
      <div className="promo-frame relative group">
        {path ? <img src={publicUrl('promotions', path)} alt="" /> : <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-500 text-xs"><ImagePlus size={22} />{t('promo.pick', 'JPG, PNG or WebP · up to 512 KB · 16:7')}</div>}
        {uploading === which && <div className="absolute inset-0 bg-white/60 dark:bg-black/40 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { void upload(which, e.target.files?.[0]); e.target.value = ''; }} />
      <div className="flex gap-2 mt-2">
        <button type="button" className="btn btn-outline btn-sm" disabled={!!uploading} onClick={() => ref.current?.click()}><ImagePlus size={13} />{path ? t('promo.replace', 'Replace') : t('promo.upload', 'Upload')}</button>
        {which === 'bn' && path && <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => set('image_bn_path', null)}><Trash2 size={13} /></button>}
      </div>
    </div>
  );

  return (
    <Modal open={!!promo} onClose={onClose} locked={busy} size="lg" icon={<Megaphone size={18} />}
      title={promo?.id ? t('promo.edit', 'Edit promotion') : t('promo.new', 'New promotion')}
      footer={<>
        <button type="button" className="btn btn-cancel" disabled={busy} onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
        <button type="button" className="btn btn-primary" disabled={busy || !!uploading} onClick={save}>{busy && <Loader2 size={14} className="animate-spin" />}{t('common.save', 'Save')}</button>
      </>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('promo.banner', 'Banner')} hint={t('promo.banner_hint', 'Shown to everyone')}>{imgBox('en', p.image_path, fileEn)}</Field>
        <Field label={t('promo.banner_bn', 'Bangla banner (optional)')} hint={t('promo.banner_bn_hint', 'Shown instead when the app is in বাংলা')}>{imgBox('bn', p.image_bn_path, fileBn)}</Field>
        <Field className="md:col-span-2" label={t('promo.advertiser', 'Advertiser')}><input className="form-input" value={p.advertiser} onChange={e => set('advertiser', e.target.value)} placeholder="Hahnemann Laboratory" /></Field>
        <Field className="md:col-span-2" label={t('promo.title_f', 'Title (for screen readers and the list)')}><I18nInputs value={p.title} onChange={v => set('title', v)} /></Field>
        <Field label={t('promo.tap_f', 'When tapped')}>
          <SegmentedTabs size="sm" value={p.tap_action} onChange={(v: any) => set('tap_action', v)} items={[
            { key: 'link', label: t('promo.tap.link', 'Open link') }, { key: 'call', label: t('promo.tap.call', 'Call') }, { key: 'whatsapp', label: t('promo.tap.whatsapp', 'WhatsApp') },
          ]} />
        </Field>
        <Field label={p.tap_action === 'link' ? t('promo.url', 'Web address') : t('promo.phone', 'Phone number')}><input className="form-input" value={p.tap_value} onChange={e => set('tap_value', e.target.value)} placeholder={tapPlaceholder} /></Field>
        <Field label={t('promo.starts', 'Starts')}><input type="datetime-local" className="form-input" value={toLocalInput(p.starts_at)} onChange={e => e.target.value && set('starts_at', fromLocalInput(e.target.value))} /></Field>
        <Field label={t('promo.ends', 'Ends')}><input type="datetime-local" className="form-input" value={toLocalInput(p.ends_at)} onChange={e => e.target.value && set('ends_at', fromLocalInput(e.target.value))} /></Field>
        <Field label={t('promo.where', 'Where it shows')}>
          <div className="flex gap-2">{(['home', 'remedy'] as const).map(pl => {
            const on = p.placements.includes(pl);
            return <button key={pl} type="button" className="chip" aria-selected={on} onClick={() => set('placements', on ? p.placements.filter(x => x !== pl) : [...p.placements, pl])}>{t(`promo.place.${pl}`, pl)}</button>;
          })}</div>
        </Field>
        <Field label={t('promo.status', 'Status')}>
          <SegmentedTabs size="sm" value={p.status} onChange={(v: any) => set('status', v)} items={[
            { key: 'draft', label: t('status.draft', 'Draft') }, { key: 'published', label: t('status.published', 'Published') }, { key: 'archived', label: t('status.archived', 'Archived') },
          ]} />
        </Field>
        {p.status === 'published' && new Date(p.ends_at) < new Date() && (
          <div className="md:col-span-2 hm-callout warn"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{t('promo.ended_warn', 'The end date has passed, so this banner will not show.')}</div>
        )}
      </div>
    </Modal>
  );
};

export default PromotionsView;
