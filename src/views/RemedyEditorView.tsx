import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Link2, Loader2, Package, Plus, Save, ShieldAlert, ShieldCheck, Stethoscope, Trash2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { call } from '../services/api';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { Modal } from '../components/common/Modal';
import { Field, I18nInputs, KingdomBadge, LetterTile, Panel, SkeletonRows, StatusBadge, Switch, TagInput } from '../components/common/ui';
import { KINGDOMS, PRODUCT_FORMS, type RemedyDetail, type RemedyInput, type SafetyNote } from '@shared/types';

const blank = (): RemedyInput => ({
  slug: '', latin_name: '', abbreviation: '', kingdom: 'plant', family: '', groups: [], potencies: ['6C', '30C', '200C'], forms: ['globules', 'dilution'],
  external_use: false, search_keys: [], status: 'draft', needs_medical_review: true,
  translations: { en: { locale: 'en', common_name: '', summary: '', origin: '', preparation: '', keynotes: [] }, bn: { locale: 'bn', display_name: '', common_name: '', summary: '', keynotes: [] } },
  safety: [],
});

const toInput = (r: RemedyDetail): RemedyInput => {
  const tr = (l: 'en' | 'bn') => ({ locale: l, display_name: '', common_name: '', summary: '', origin: '', preparation: '', keynotes: [], ...(r.remedy_translations.find(x => x.locale === l) || {}) });
  return {
    id: r.id, slug: r.slug, latin_name: r.latin_name, abbreviation: r.abbreviation || '', kingdom: r.kingdom, family: r.family || '', groups: r.groups || [],
    potencies: r.potencies || [], forms: r.forms || [], external_use: r.external_use, search_keys: r.search_keys || [], status: r.status,
    needs_medical_review: r.needs_medical_review, translations: { en: tr('en') as any, bn: tr('bn') as any },
    safety: (r.remedy_safety_notes || []).map(s => ({ id: s.id, severity: s.severity, body: { en: s.body?.en || '', bn: s.body?.bn || '' }, sort_order: s.sort_order })),
  };
};

const lines = (a: string[] | undefined) => (a || []).join('\n');
const unlines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

export const RemedyEditorView: React.FC = () => {
  const { t, params, go, can, showToast, showError, fmtDate, num, triggerRefresh } = useApp();
  const id = params.id;
  const editable = can('editor');
  const [detail, setDetail] = useState<RemedyDetail | null>(null);
  const [form, setForm] = useState<RemedyInput>(blank);
  const [saved, setSaved] = useState<string>(JSON.stringify(blank()));
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [leave, setLeave] = useState(false);
  const [keynotesEn, setKeynotesEn] = useState('');
  const [keynotesBn, setKeynotesBn] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await call('getRemedy', id);
      const f = toInput(r);
      setDetail(r); setForm(f); setSaved(JSON.stringify(f));
      setKeynotesEn(lines(f.translations.en.keynotes)); setKeynotesBn(lines(f.translations.bn.keynotes));
    } catch (e) { showError(e); go('medicines'); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo<RemedyInput>(() => ({
    ...form,
    translations: { en: { ...form.translations.en, keynotes: unlines(keynotesEn) }, bn: { ...form.translations.bn, keynotes: unlines(keynotesBn) } },
  }), [form, keynotesEn, keynotesBn]);
  const dirty = JSON.stringify(current) !== saved;

  const set = <K extends keyof RemedyInput>(k: K, v: RemedyInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const setTr = (l: 'en' | 'bn', k: string, v: string) => setForm(f => ({ ...f, translations: { ...f.translations, [l]: { ...f.translations[l], [k]: v } } }));
  const setNote = (i: number, n: Partial<SafetyNote>) => setForm(f => ({ ...f, safety: f.safety.map((s, j) => (j === i ? { ...s, ...n } : s)) }));

  const save = async (patch: Partial<RemedyInput> = {}) => {
    const input = { ...current, ...patch };
    if (!input.latin_name.trim()) { showToast(t('ed.need_latin', 'Enter the Latin name first.'), 'error'); return; }
    setBusy(true);
    try {
      const newId = await call('saveRemedy', input);
      showToast(t('ed.saved', 'Saved. The app picks up the change on its next sync.'));
      triggerRefresh();
      if (!id) go('editor', { id: newId }); else await load();
    } catch (e) { showError(e); } finally { setBusy(false); }
  };

  const back = () => (dirty ? setLeave(true) : go('medicines'));
  const title = form.latin_name || t('ed.new_title', 'New medicine');
  const enCommon = form.translations.en.common_name;

  if (loading) return <div className="p-6 lg:p-8 max-w-[1400px] mx-auto"><div className="card-base"><SkeletonRows rows={8} /></div></div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={back} className="btn btn-outline btn-icon btn-md !rounded-xl" title={t('common.back', 'Back')} aria-label={t('common.back', 'Back')}><ArrowLeft size={17} /></button>
        <LetterTile size="lg" text={(form.latin_name || '?')[0].toUpperCase()} kingdom={form.kingdom} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-700 dark:text-accent-300">{id ? t('ed.caption_edit', 'Edit medicine') : t('ed.caption_new', 'New medicine')}</div>
          <h1 className="lat text-[1.9rem] leading-tight text-slate-900 dark:text-white truncate">{title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
            <StatusBadge s={form.status} /><KingdomBadge k={form.kingdom} />
            {enCommon && <span>· {enCommon}</span>}
            {dirty && <span className="hm-badge s-peach">{t('ed.unsaved', 'Unsaved changes')}</span>}
          </div>
        </div>
        {editable && (
          <div className="flex flex-wrap items-center gap-2.5">
            {id && form.needs_medical_review && (
              <button type="button" disabled={busy} onClick={() => save({ needs_medical_review: false })} className="btn btn-green-outline"><ShieldCheck size={15} />{t('ed.mark_reviewed', 'Mark as reviewed')}</button>
            )}
            {id && form.status !== 'published' && (
              <button type="button" disabled={busy} onClick={() => save({ status: 'published' })} className="btn btn-outline">{t('ed.save_publish', 'Save & publish')}</button>
            )}
            <button type="button" disabled={busy || (!dirty && !!id)} onClick={() => save()} className="btn btn-primary">{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{t('common.save', 'Save')}</button>
          </div>
        )}
      </div>

      {!editable && <div className="hm-callout note"><ShieldAlert size={16} className="shrink-0 mt-0.5" /><span>{t('ed.read_only', 'You can read this medicine. Editors and owners can change it.')}</span></div>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <Panel title={t('ed.identity', 'Identity')} bodyClass="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('ed.latin', 'Latin name')} htmlFor="ed-latin"><input id="ed-latin" className="form-input lat !text-[16px]" disabled={!editable} value={form.latin_name}
              onChange={e => { const v = e.target.value; setForm(f => ({ ...f, latin_name: v, slug: id ? f.slug : v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })); }} placeholder="Arnica montana" /></Field>
            <Field label={t('ed.slug', 'Web address (slug)')} hint={t('ed.slug_hint', 'Lowercase, used in links: arnica-montana')}><input className="form-input font-mono !text-[12.5px]" disabled={!editable} value={form.slug} onChange={e => set('slug', e.target.value)} /></Field>
            <Field label={t('ed.abbr', 'Abbreviation')}><input className="form-input" disabled={!editable} value={form.abbreviation || ''} onChange={e => set('abbreviation', e.target.value)} placeholder="Arn." /></Field>
            <Field label={t('ed.kingdom', 'Kingdom')}><SearchableSelect disabled={!editable} value={form.kingdom} onChange={v => set('kingdom', v)} options={KINGDOMS.map(k => ({ value: k, label: t(`kingdom.${k}`, k) }))} /></Field>
            <Field label={t('ed.family', 'Botanical / chemical family')}><input className="form-input" disabled={!editable} value={form.family || ''} onChange={e => set('family', e.target.value)} placeholder="Compositae" /></Field>
            <Field label={t('ed.external', 'Also used externally')} hint={t('ed.external_hint', 'Ointments, lotions or mother tincture on the skin')}>
              <div className="h-[var(--bf-ctrl-h)] flex items-center"><Switch disabled={!editable} checked={form.external_use} onChange={v => set('external_use', v)} label={t('ed.external', 'Also used externally')} /></div>
            </Field>
            <Field label={t('ed.potencies', 'Potencies')} hint={t('ed.enter_hint', 'Press Enter after each one')}><TagInput disabled={!editable} value={form.potencies} onChange={v => set('potencies', v)} placeholder="6C, 30C, 200C" /></Field>
            <Field label={t('ed.search_keys', 'Other spellings (search)')} hint={t('ed.search_keys_hint', 'Banglish and common misspellings: arnika, arnica mont')}><TagInput disabled={!editable} value={form.search_keys} onChange={v => set('search_keys', v)} placeholder="arnika" /></Field>
            <Field className="md:col-span-2" label={t('ed.forms', 'Forms')}>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_FORMS.map(f => {
                  const on = form.forms.includes(f);
                  return <button key={f} type="button" disabled={!editable} aria-selected={on} className="chip" onClick={() => set('forms', on ? form.forms.filter(x => x !== f) : [...form.forms, f])}>{t(`form.${f}`, f.replace('_', ' '))}</button>;
                })}
              </div>
            </Field>
            <Field className="md:col-span-2" label={t('ed.groups', 'Groups')} hint={t('ed.groups_hint', 'For lists in the app, e.g. first_aid, polychrest, tissue_salt')}><TagInput disabled={!editable} value={form.groups} onChange={v => set('groups', v)} placeholder="first_aid" /></Field>
          </Panel>

          <Panel title={t('ed.text', 'Names and text')} action={<span className="text-[11px] font-bold text-slate-400">EN · বাংলা</span>} bodyClass="p-5 space-y-4">
            <Field label={t('ed.bn_name', 'Name in Bangla script')} hint={t('ed.bn_name_hint', 'How the app shows the name in বাংলা, e.g. আর্নিকা মন্টানা')}>
              <input lang="bn" className="form-input" disabled={!editable} value={form.translations.bn.display_name || ''} onChange={e => setTr('bn', 'display_name', e.target.value)} placeholder="আর্নিকা মন্টানা" />
            </Field>
            <Field label={t('ed.common', 'Common name')}><I18nInputs disabled={!editable} value={{ en: form.translations.en.common_name, bn: form.translations.bn.common_name }} onChange={v => { setTr('en', 'common_name', v.en); setTr('bn', 'common_name', v.bn); }} placeholderEn="Leopard's bane" /></Field>
            <Field label={t('ed.summary', 'Summary')} hint={t('ed.summary_hint', 'Two or three plain sentences: what it is mostly used for. Shown at the top of the remedy page.')}>
              <I18nInputs multiline disabled={!editable} value={{ en: form.translations.en.summary, bn: form.translations.bn.summary }} onChange={v => { setTr('en', 'summary', v.en); setTr('bn', 'summary', v.bn); }} />
            </Field>
            <Field label={t('ed.origin', 'Source (plant, mineral, animal…)')}><I18nInputs disabled={!editable} value={{ en: form.translations.en.origin, bn: form.translations.bn.origin }} onChange={v => { setTr('en', 'origin', v.en); setTr('bn', 'origin', v.bn); }} /></Field>
            <Field label={t('ed.keynotes', 'Keynotes')} hint={t('ed.keynotes_hint', 'One per line. Short, characteristic symptoms (Allen\'s Keynotes style).')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <textarea className="form-input" rows={5} disabled={!editable} value={keynotesEn} onChange={e => setKeynotesEn(e.target.value)} />
                <textarea lang="bn" className="form-input" rows={5} disabled={!editable} value={keynotesBn} onChange={e => setKeynotesBn(e.target.value)} />
              </div>
            </Field>
          </Panel>

          <Panel title={t('ed.safety', 'Safety notes')}
            action={editable && <button type="button" className="btn btn-outline btn-sm" onClick={() => set('safety', [...form.safety, { severity: 'caution', body: { en: '', bn: '' }, sort_order: form.safety.length }])}><Plus size={13} />{t('ed.add_note', 'Add note')}</button>}
            bodyClass="p-5 space-y-4">
            {!form.safety.length && <p className="text-xs text-slate-500">{t('ed.no_notes', 'No safety notes. Add one for cautions such as "mother tincture is for external use only".')}</p>}
            {form.safety.map((n, i) => (
              <div key={n.id || `new-${i}`} className={`rounded-2xl border p-4 space-y-3 ${n.severity === 'danger' ? 'border-rose-200 dark:border-rose-900/60' : n.severity === 'caution' ? 'border-amber-200 dark:border-amber-900/50' : 'border-slate-200 dark:border-night-2a3f49'}`}>
                <div className="flex items-center justify-between gap-3">
                  <SegmentedTabs size="sm" value={n.severity} onChange={(v: any) => editable && setNote(i, { severity: v })} items={[
                    { key: 'info', label: t('sev.info', 'Info') }, { key: 'caution', label: t('sev.caution', 'Caution') }, { key: 'danger', label: t('sev.danger', 'Danger') },
                  ]} />
                  {editable && <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => set('safety', form.safety.filter((_, j) => j !== i))}><Trash2 size={13} />{t('common.remove', 'Remove')}</button>}
                </div>
                <I18nInputs multiline disabled={!editable} value={n.body} onChange={v => setNote(i, { body: v })} />
              </div>
            ))}
          </Panel>
        </div>

        {/* side column */}
        <div className="space-y-5 min-w-0 xl:sticky xl:top-5">
          <Panel title={t('ed.publishing', 'Publishing')} bodyClass="p-5 space-y-4">
            <Field label={t('ed.status', 'Status')} hint={form.status === 'published' ? t('ed.status_pub', 'Visible in the app.') : t('ed.status_hidden', 'Hidden from the app.')}>
              <SegmentedTabs size="sm" value={form.status} onChange={(v: any) => editable && set('status', v)} items={[
                { key: 'draft', label: t('status.draft', 'Draft') }, { key: 'published', label: t('status.published', 'Published') }, { key: 'archived', label: t('status.archived', 'Archived') },
              ]} />
            </Field>
            <div className="flex items-start justify-between gap-3">
              <div><div className="form-label !mb-0.5">{t('ed.needs_review', 'Needs practitioner review')}</div>
                <span className="form-hint !mt-0">{form.needs_medical_review ? t('ed.review_on', 'The app shows a "not yet reviewed" note.') : detail?.reviewed_at ? t('ed.reviewed_on', 'Reviewed {date}', { date: fmtDate(detail.reviewed_at) }) : t('ed.review_off', 'Marked as reviewed.')}</span></div>
              <Switch disabled={!editable} checked={form.needs_medical_review} onChange={v => set('needs_medical_review', v)} label={t('ed.needs_review', 'Needs practitioner review')} />
            </div>
            {detail && <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-night-22353f">{t('ed.created', 'Created {c} · updated {u}', { c: fmtDate(detail.created_at), u: fmtDate(detail.updated_at, true) })}</div>}
          </Panel>

          {detail && (
            <Panel title={t('ed.linked', 'Linked in the archive')} bodyClass="divide-y divide-slate-100 dark:divide-night-22353f text-[12.5px]">
              <div className="px-5 py-3"><div className="flex items-center gap-2 font-bold mb-1.5"><BookOpen size={14} className="text-accent-600" />{t('ed.books', 'Materia medica text')}</div>
                {detail.materia.length ? detail.materia.map(m => <div key={m.source_book} className="flex justify-between text-slate-600 dark:text-slate-300"><span>{t(`book.${m.source_book}`, m.source_book)}</span><span>{t('ed.sections', '{n} sections', { n: m.count })}</span></div>)
                  : <span className="text-slate-400">{t('ed.no_books', 'No book text yet')}</span>}</div>
              <div className="px-5 py-3"><div className="flex items-center gap-2 font-bold mb-1.5"><Stethoscope size={14} className="text-accent-600" />{t('ed.uses', 'Used for')} <span className="text-slate-400 font-semibold">({num(detail.remedy_uses.length)})</span></div>
                <div className="flex flex-wrap gap-1.5">{detail.remedy_uses.slice(0, 12).map(u => <span key={u.id} className="hm-badge s-draft">{u.conditions?.condition_translations.find(c => c.locale === 'en')?.name || u.remedy_use_translations.find(x => x.locale === 'en')?.title || '—'}</span>)}
                  {!detail.remedy_uses.length && <span className="text-slate-400">—</span>}</div></div>
              <div className="px-5 py-3"><div className="flex items-center gap-2 font-bold mb-1.5"><Package size={14} className="text-accent-600" />{t('ed.products', 'Products')} <span className="text-slate-400 font-semibold">({num(detail.products.length)})</span></div>
                {detail.products.slice(0, 6).map(p => <div key={p.id} className="flex justify-between gap-2 text-slate-600 dark:text-slate-300"><span className="truncate">{p.name}{p.manufacturers ? ` · ${p.manufacturers.name}` : ''}</span><span className="shrink-0">{p.price_bdt != null ? `৳${num(p.price_bdt)}` : '—'}</span></div>)}
                {!detail.products.length && <span className="text-slate-400">{t('ed.no_products', 'No products linked')}</span>}</div>
              <div className="px-5 py-3"><div className="flex items-center gap-2 font-bold mb-1.5"><Link2 size={14} className="text-accent-600" />{t('ed.relations', 'Related remedies')} <span className="text-slate-400 font-semibold">({num(detail.relations.length)})</span></div>
                <div className="flex flex-wrap gap-1.5">{detail.relations.slice(0, 14).map((r, i) => <span key={i} className="hm-badge s-info" title={t(`rel.${r.relation_type}`, r.relation_type)}><span className="lat text-[12.5px]">{r.related?.latin_name}</span></span>)}
                  {!detail.relations.length && <span className="text-slate-400">—</span>}</div></div>
            </Panel>
          )}
          {form.status === 'published' && form.needs_medical_review && (
            <div className="hm-callout warn"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{t('ed.pub_unreviewed', 'Published but not yet reviewed: the app shows it with a caution note until a practitioner marks it as reviewed.')}</span></div>
          )}
        </div>
      </div>

      <Modal open={leave} onClose={() => setLeave(false)} size="sm" tone="warning" icon={<AlertTriangle size={18} />} title={t('ed.leave_title', 'Leave without saving?')}
        footer={<>
          <button type="button" className="btn btn-cancel" onClick={() => setLeave(false)}>{t('ed.keep_editing', 'Keep editing')}</button>
          <button type="button" className="btn btn-primary" onClick={() => { setLeave(false); go('medicines'); }}>{t('ed.discard', 'Discard changes')}</button>
        </>}>
        {t('ed.leave_body', 'Your changes to this medicine have not been saved.')}
      </Modal>
    </div>
  );
};

export default RemedyEditorView;
