import React, { useEffect, useState } from 'react';
import { Building2, ExternalLink, Factory, Loader2, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { call, openExternal } from '../services/api';
import { Modal } from '../components/common/Modal';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { EmptyState, Field, PageHeader, SkeletonRows, StatusBadge, Switch } from '../components/common/ui';
import { PRODUCT_FORMS, type Manufacturer, type Product } from '@shared/types';

export const BrandsView: React.FC = () => {
  const { t, can, num } = useApp();
  const [tab, setTab] = useState<'products' | 'companies'>('products');
  const [q, setQ] = useState('');
  const [deb, setDeb] = useState('');
  const [company, setCompany] = useState('');
  useEffect(() => { const h = setTimeout(() => setDeb(q.trim()), 250); return () => clearTimeout(h); }, [q]);
  const makers = useLoad(() => call('listManufacturers'));
  const products = useLoad(() => call('listProducts', { q: deb, manufacturer: company }), [deb, company]);
  const [editP, setEditP] = useState<Product | null>(null);
  const [editM, setEditM] = useState<Manufacturer | null>(null);
  const editable = can('editor');
  const reloadAll = () => { makers.reload(); products.reload(); };

  const newProduct = (): Product => ({ remedy_id: null, manufacturer_id: company || makers.data?.[0]?.id || '', name: '', form: 'dilution', potency: '', pack_size: null, pack_unit: 'ml', price_bdt: null, price_tier: null, status: 'draft' });
  const newMaker = (): Manufacturer => ({ slug: '', name: '', short_name: '', country: 'Bangladesh', city: '', website: '', evidence_url: '', sold_in_bd: true, status: 'published' });
  const staleDays = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <PageHeader caption={t('med.caption', 'Archive')} title={t('nav.brands', 'Brands & products')}
        sub={t('brands.sub', 'Bottles readers can buy, with pack size and price in taka. Prices older than 90 days are flagged.')}
        actions={editable && (tab === 'products'
          ? <button type="button" className="btn btn-primary" disabled={!makers.data?.length} onClick={() => setEditP(newProduct())}><Plus size={15} strokeWidth={2.6} />{t('brands.new_product', 'New product')}</button>
          : <button type="button" className="btn btn-primary" onClick={() => setEditM(newMaker())}><Plus size={15} strokeWidth={2.6} />{t('brands.new_company', 'New manufacturer')}</button>)} />

      <div className="tbl-filter card-base !rounded-2xl p-3 flex flex-wrap items-center gap-2.5">
        <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[
          { key: 'products', label: t('brands.products', 'Products'), icon: <Package size={13} />, count: num(products.data?.length ?? 0) },
          { key: 'companies', label: t('brands.companies', 'Manufacturers'), icon: <Factory size={13} />, count: num(makers.data?.length ?? 0) },
        ]} />
        {tab === 'products' && <>
          <div className="filter-search relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} data-no-clear="" placeholder={t('brands.search', 'Product name…')} className="form-input !pl-9" />
            {q && <button type="button" onClick={() => setQ('')} className="clear-x absolute right-2.5 top-1/2 -translate-y-1/2"><X size={11} /></button>}</div>
          <div className="filter-select"><SearchableSelect size="sm" clearable value={company} onChange={v => setCompany(v || '')} placeholder={t('brands.any_company', 'Any manufacturer')}
            options={(makers.data || []).map(m => ({ value: m.id!, label: m.name, subLabel: m.country || undefined }))} /></div>
        </>}
      </div>

      <div className="card-base overflow-hidden">
        {tab === 'products' ? (
          products.loading && !products.data ? <SkeletonRows rows={6} /> : !products.data?.length ? (
            <EmptyState icon={<Package size={22} />} title={t('brands.no_products', 'No products yet')} body={t('brands.no_products_body', 'Add the bottles sold in Bangladesh with their price, so readers can compare brands.')} />
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-[13px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider">
                <th className="px-5 py-2.5 font-bold">{t('brands.col.product', 'Product')}</th><th className="px-3 py-2.5 font-bold">{t('brands.col.remedy', 'Remedy')}</th>
                <th className="px-3 py-2.5 font-bold">{t('brands.col.company', 'Manufacturer')}</th><th className="px-3 py-2.5 font-bold">{t('brands.col.pack', 'Pack')}</th>
                <th className="px-3 py-2.5 font-bold text-right">{t('brands.col.price', 'Price')}</th><th className="px-3 py-2.5 font-bold">{t('med.col.status', 'Status')}</th><th className="px-5 py-2.5" /></tr></thead>
              <tbody>{products.data.map(p => {
                const age = staleDays(p.price_updated_at);
                return (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-night-22353f">
                    <td className="px-5 py-2.5"><div className="font-bold text-slate-900 dark:text-white">{p.name}</div><div className="text-[11.5px] text-slate-500">{t(`form.${p.form}`, p.form.replace('_', ' '))}{p.potency ? ` · ${p.potency}` : ''}</div></td>
                    <td className="px-3 py-2.5">{p.remedies ? <span className="lat text-[14.5px]">{p.remedies.latin_name}</span> : <span className="text-[11px] font-bold text-slate-400">{t('brands.combination', 'combination / unlinked')}</span>}</td>
                    <td className="px-3 py-2.5">{p.manufacturers?.short_name || p.manufacturers?.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{p.pack_size ? `${num(p.pack_size)} ${t(`unit.${p.pack_unit}`, p.pack_unit || '')}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{p.price_bdt != null ? <><b>৳{num(p.price_bdt)}</b>{age !== null && age > 90 && <div className="text-[10.5px] font-bold text-[var(--hm-amink)]">{t('brands.stale', '{n} days old', { n: age })}</div>}</> : '—'}</td>
                    <td className="px-3 py-2.5"><StatusBadge s={p.status} /></td>
                    <td className="px-5 py-2.5 text-right">{editable && <button type="button" className="btn btn-outline btn-icon btn-act" onClick={() => setEditP(p)} aria-label={t('common.edit', 'Edit')}><Pencil size={13} /></button>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )
        ) : (
          makers.loading && !makers.data ? <SkeletonRows rows={6} /> : !makers.data?.length ? <EmptyState icon={<Factory size={22} />} title={t('brands.no_companies', 'No manufacturers yet')} /> : (
            <div className="overflow-x-auto"><table className="w-full text-[13px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider">
                <th className="px-5 py-2.5 font-bold">{t('brands.col.company', 'Manufacturer')}</th><th className="px-3 py-2.5 font-bold">{t('brands.col.where', 'Based in')}</th>
                <th className="px-3 py-2.5 font-bold">{t('brands.col.bd', 'Sold in Bangladesh')}</th><th className="px-3 py-2.5 font-bold text-right">{t('brands.products', 'Products')}</th>
                <th className="px-3 py-2.5 font-bold">{t('med.col.status', 'Status')}</th><th className="px-5 py-2.5" /></tr></thead>
              <tbody>{makers.data.map(m => (
                <tr key={m.id} className="border-t border-slate-100 dark:border-night-22353f">
                  <td className="px-5 py-2.5"><div className="flex items-center gap-3"><span className="hm-tile sm font-mono !text-[10px]">{(m.short_name || m.name).slice(0, 3).toUpperCase()}</span>
                    <div><div className="font-bold text-slate-900 dark:text-white">{m.name}</div>{m.website && <button type="button" onClick={() => openExternal(m.website!)} className="text-[11px] text-accent-700 dark:text-accent-300 inline-flex items-center gap-1 hover:underline">{m.website.replace(/^https?:\/\//, '')}<ExternalLink size={10} /></button>}</div></div></td>
                  <td className="px-3 py-2.5">{[m.city, m.country].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-3 py-2.5">{m.sold_in_bd === true ? <span className="hm-badge s-ok">{t('common.yes', 'Yes')}</span> : m.sold_in_bd === false ? <span className="hm-badge s-draft">{t('common.no', 'No')}</span> : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{num(m.product_count ?? 0)}</td>
                  <td className="px-3 py-2.5"><StatusBadge s={m.status} /></td>
                  <td className="px-5 py-2.5 text-right">{editable && <button type="button" className="btn btn-outline btn-icon btn-act" onClick={() => setEditM(m)} aria-label={t('common.edit', 'Edit')}><Pencil size={13} /></button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )
        )}
      </div>

      <ProductDialog item={editP} makers={makers.data || []} onClose={() => setEditP(null)} onSaved={() => { setEditP(null); reloadAll(); }} />
      <MakerDialog item={editM} onClose={() => setEditM(null)} onSaved={() => { setEditM(null); reloadAll(); }} />
    </div>
  );
};

const ProductDialog: React.FC<{ item: Product | null; makers: Manufacturer[]; onClose: () => void; onSaved: () => void }> = ({ item, makers, onClose, onSaved }) => {
  const { t, showToast, showError } = useApp();
  const [p, setP] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [rq, setRq] = useState('');
  const [hits, setHits] = useState<{ id: string; latin_name: string }[]>([]);
  const [remedyName, setRemedyName] = useState('');
  useEffect(() => { if (item) { setP(structuredClone(item)); setRemedyName(item.remedies?.latin_name || ''); setRq(''); setHits([]); setConfirmDel(false); } }, [item]);
  useEffect(() => { if (rq.trim().length < 2) { setHits([]); return; } const h = setTimeout(() => call('searchRemedies', rq).then(setHits, () => setHits([])), 220); return () => clearTimeout(h); }, [rq]);
  if (!p) return null;
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP(x => (x ? { ...x, [k]: v } : x));
  const save = async () => { setBusy(true); try { await call('saveProduct', p); showToast(t('brands.saved', 'Saved.')); onSaved(); } catch (e) { showError(e); } finally { setBusy(false); } };
  const remove = async () => { setBusy(true); try { await call('deleteProduct', p.id!); showToast(t('brands.deleted', 'Product deleted.')); onSaved(); } catch (e) { showError(e); } finally { setBusy(false); } };
  return (
    <Modal open={!!item} onClose={onClose} locked={busy} size="lg" icon={<Package size={18} />} title={p.id ? t('brands.edit_product', 'Edit product') : t('brands.new_product', 'New product')}
      footer={<>
        {p.id && (confirmDel
          ? <button type="button" className="btn btn-danger mr-auto" disabled={busy} onClick={remove}><Trash2 size={14} />{t('brands.confirm_delete', 'Yes, delete')}</button>
          : <button type="button" className="btn btn-danger-outline mr-auto" disabled={busy} onClick={() => setConfirmDel(true)}><Trash2 size={14} />{t('common.delete', 'Delete')}</button>)}
        <button type="button" className="btn btn-cancel" disabled={busy} onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 size={14} className="animate-spin" />}{t('common.save', 'Save')}</button>
      </>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field className="md:col-span-2" label={t('brands.name', 'Name on the label')}><input className="form-input" value={p.name} onChange={e => set('name', e.target.value)} placeholder="Arnica Montana 30" /></Field>
        <Field label={t('brands.col.company', 'Manufacturer')}><SearchableSelect value={p.manufacturer_id} onChange={v => set('manufacturer_id', v)} options={makers.map(m => ({ value: m.id!, label: m.name }))} /></Field>
        <Field label={t('brands.col.remedy', 'Remedy')} hint={t('brands.remedy_hint', 'Leave empty for combination products')}>
          {p.remedy_id ? (
            <div className="form-input flex items-center justify-between"><span className="lat text-[15px]">{remedyName || '…'}</span>
              <button type="button" className="clear-x" onClick={() => { set('remedy_id', null); setRemedyName(''); }}><X size={11} /></button></div>
          ) : (
            <div className="relative"><input className="form-input" value={rq} data-no-clear="" onChange={e => setRq(e.target.value)} placeholder={t('req.merge_search', 'Search medicines…')} />
              {hits.length > 0 && <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-night-16252d border border-slate-200 dark:border-night-283e4a rounded-xl shadow-xl p-1 animate-pop max-h-56 overflow-y-auto">
                {hits.map(h => <button key={h.id} type="button" className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-accent-50 dark:hover:bg-accent-400/10 lat text-[14.5px]" onClick={() => { set('remedy_id', h.id); setRemedyName(h.latin_name); setHits([]); setRq(''); }}>{h.latin_name}</button>)}
              </div>}</div>
          )}
        </Field>
        <Field label={t('brands.form', 'Form')}><SearchableSelect value={p.form} onChange={v => set('form', v)} options={PRODUCT_FORMS.map(f => ({ value: f, label: t(`form.${f}`, f.replace('_', ' ')) }))} /></Field>
        <Field label={t('brands.potency', 'Potency')}><input className="form-input" value={p.potency || ''} onChange={e => set('potency', e.target.value)} placeholder="30C" /></Field>
        <Field label={t('brands.pack', 'Pack size')}>
          <div className="flex gap-2"><input type="number" min={0} className="form-input" value={p.pack_size ?? ''} onChange={e => set('pack_size', e.target.value === '' ? null : Number(e.target.value))} />
            <div className="w-36 shrink-0"><SearchableSelect value={p.pack_unit} onChange={v => set('pack_unit', v)} options={['ml', 'g', 'tablets', 'pellets'].map(u => ({ value: u, label: t(`unit.${u}`, u) }))} /></div></div>
        </Field>
        <Field label={t('brands.price', 'Price (৳)')} hint={t('brands.price_hint', 'Changing it records today as the price date')}>
          <div className="money-field"><span className="money-prefix">৳</span><input type="number" min={0} className="form-input money-input" value={p.price_bdt ?? ''} onChange={e => set('price_bdt', e.target.value === '' ? null : Number(e.target.value))} /></div>
        </Field>
        <Field label={t('brands.tier', 'Price band')}><SegmentedTabs size="sm" value={p.price_tier || 'none'} onChange={(v: string) => set('price_tier', v === 'none' ? null : (v as any))} items={[
          { key: 'none', label: '—' }, { key: 'economy', label: t('tier.economy', 'Economy') }, { key: 'standard', label: t('tier.standard', 'Standard') }, { key: 'premium', label: t('tier.premium', 'Premium') },
        ]} /></Field>
        <Field label={t('ed.status', 'Status')}><SegmentedTabs size="sm" value={p.status} onChange={(v: any) => set('status', v)} items={[
          { key: 'draft', label: t('status.draft', 'Draft') }, { key: 'published', label: t('status.published', 'Published') }, { key: 'archived', label: t('status.archived', 'Archived') },
        ]} /></Field>
      </div>
    </Modal>
  );
};

const MakerDialog: React.FC<{ item: Manufacturer | null; onClose: () => void; onSaved: () => void }> = ({ item, onClose, onSaved }) => {
  const { t, showToast, showError } = useApp();
  const [m, setM] = useState<Manufacturer | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (item) setM(structuredClone(item)); }, [item]);
  if (!m) return null;
  const set = <K extends keyof Manufacturer>(k: K, v: Manufacturer[K]) => setM(x => (x ? { ...x, [k]: v } : x));
  const save = async () => { setBusy(true); try { await call('saveManufacturer', m); showToast(t('brands.saved', 'Saved.')); onSaved(); } catch (e) { showError(e); } finally { setBusy(false); } };
  return (
    <Modal open={!!item} onClose={onClose} locked={busy} size="md" icon={<Building2 size={18} />} title={m.id ? t('brands.edit_company', 'Edit manufacturer') : t('brands.new_company', 'New manufacturer')}
      footer={<>
        <button type="button" className="btn btn-cancel" disabled={busy} onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 size={14} className="animate-spin" />}{t('common.save', 'Save')}</button>
      </>}>
      <div className="grid grid-cols-2 gap-4">
        <Field className="col-span-2" label={t('brands.company_name', 'Company name')}><input className="form-input" value={m.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label={t('brands.short', 'Short name')}><input className="form-input" value={m.short_name || ''} onChange={e => set('short_name', e.target.value)} placeholder="SBL" /></Field>
        <Field label={t('ed.slug', 'Web address (slug)')}><input className="form-input font-mono !text-[12.5px]" value={m.slug} onChange={e => set('slug', e.target.value)} placeholder={t('brands.slug_auto', 'made from the name')} /></Field>
        <Field label={t('brands.country', 'Country')}><input className="form-input" value={m.country || ''} onChange={e => set('country', e.target.value)} /></Field>
        <Field label={t('brands.city', 'City')}><input className="form-input" value={m.city || ''} onChange={e => set('city', e.target.value)} /></Field>
        <Field className="col-span-2" label={t('brands.website', 'Website')}><input className="form-input" value={m.website || ''} onChange={e => set('website', e.target.value)} placeholder="https://" /></Field>
        <Field className="col-span-2" label={t('brands.evidence', 'Evidence link')} hint={t('brands.evidence_hint', 'Where you confirmed the company exists and sells in Bangladesh')}><input className="form-input" value={m.evidence_url || ''} onChange={e => set('evidence_url', e.target.value)} placeholder="https://" /></Field>
        <div className="col-span-2 flex items-center justify-between"><span className="form-label !mb-0">{t('brands.col.bd', 'Sold in Bangladesh')}</span><Switch checked={!!m.sold_in_bd} onChange={v => set('sold_in_bd', v)} /></div>
      </div>
    </Modal>
  );
};

export default BrandsView;
