import React, { useEffect, useState } from 'react';
import { BadgeDollarSign, Clock, FileWarning, Loader2, MapPin, Megaphone, Save, Smartphone, Code2, Info, AlertTriangle } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { call } from '../services/api';
import { Field, I18nInputs, PageHeader, SkeletonRows, Switch } from '../components/common/ui';
import type { AppConfigRow } from '@shared/types';

/**
 * App settings = the `app_config` table the mobile app reads on every sync. Known keys get a proper form,
 * anything else is shown as JSON under "Advanced". Each card saves on its own.
 */
const KNOWN = ['admob', 'disclaimer', 'promo_fallback', 'ads_contact', 'address', 'office_hours', 'content_notice', 'min_app_version'];
const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

const ConfigCard: React.FC<{
  row: AppConfigRow | undefined; k: string; icon: React.ReactNode; title: string; desc: string; editable: boolean; onSaved: () => void;
  children: (v: any, set: (v: any) => void) => React.ReactNode;
}> = ({ row, k, icon, title, desc, editable, onSaved, children }) => {
  const { t, showToast, showError, relTime } = useApp();
  const [value, setValue] = useState<any>(row?.value ?? {});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(row?.value ?? {}); }, [row]);
  const dirty = JSON.stringify(value) !== JSON.stringify(row?.value ?? {});
  const save = async () => {
    setBusy(true);
    try { await call('saveConfig', k, value); showToast(t('cfg.saved', 'Saved. The app uses it after its next sync.')); onSaved(); } catch (e) { showError(e); } finally { setBusy(false); }
  };
  return (
    <section className="card-base overflow-hidden flex flex-col">
      <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-night-22353f">
        <span className="w-9 h-9 rounded-xl bg-accent-50 dark:bg-accent-400/10 text-accent-600 dark:text-accent-300 flex items-center justify-center shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13.5px] font-extrabold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
        </div>
        <code className="text-[10px] font-bold text-slate-400 mt-1">{k}</code>
      </div>
      <div className="p-5 space-y-4 flex-1">{children(value, setValue)}</div>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 dark:border-night-22353f bg-slate-50/60 dark:bg-night-0f1a20/60">
        <span className="text-[11px] text-slate-400">{row?.updated_at ? t('cfg.updated', 'Changed {when}', { when: relTime(row.updated_at) }) : t('cfg.not_set', 'Not set yet')}</span>
        {editable && <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={save}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}{t('common.save', 'Save')}</button>}
      </div>
    </section>
  );
};

const Toggle: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, hint, checked, onChange, disabled }) => (
  <div className="flex items-start justify-between gap-4">
    <div><div className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{label}</div>{hint && <div className="text-[11.5px] text-slate-500 mt-0.5">{hint}</div>}</div>
    <Switch checked={!!checked} onChange={onChange} disabled={disabled} label={label} />
  </div>
);

export const AppSettingsView: React.FC = () => {
  const { t, can, showToast, showError } = useApp();
  const { data, loading, reload } = useLoad(() => call('listConfig'));
  const editable = can('editor');
  const row = (k: string) => data?.find(r => r.key === k);
  const others = (data || []).filter(r => !KNOWN.includes(r.key));
  const [json, setJson] = useState<Record<string, string>>({});
  useEffect(() => { setJson(Object.fromEntries(others.map(r => [r.key, JSON.stringify(r.value, null, 2)]))); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = (k: string, icon: React.ReactNode, title: string, desc: string, body: (v: any, set: (v: any) => void) => React.ReactNode) =>
    <ConfigCard key={k} k={k} row={row(k)} icon={icon} title={title} desc={desc} editable={editable} onSaved={reload}>{body}</ConfigCard>;

  if (loading && !data) return <div className="p-6 lg:p-8 max-w-[1400px] mx-auto"><div className="card-base"><SkeletonRows rows={6} /></div></div>;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <PageHeader caption={t('nav.section_app', 'App content')} title={t('nav.appsettings', 'App settings')}
        sub={t('cfg.sub', 'What the mobile app reads on every sync: ads, disclaimer, office hours and more.')} />

      <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(420px,1fr))] items-start">
        {card('admob', <BadgeDollarSign size={17} />, t('cfg.admob', 'Google AdMob banners'), t('cfg.admob_desc', 'Small banner ads in the app. Turning this on shows real ads in every installed copy within a day.'), (v, set) => (<>
          <Toggle disabled={!editable} label={t('cfg.admob_on', 'Show ads')} hint={t('cfg.admob_on_hint', 'Main switch. Off = no ads anywhere.')} checked={v.enabled} onChange={x => set({ ...v, enabled: x })} />
          <Toggle disabled={!editable || !v.enabled} label={t('cfg.admob_tabs', 'Banner above the tab bar')} checked={v.anchored_on_main_tabs} onChange={x => set({ ...v, anchored_on_main_tabs: x })} />
          <Toggle disabled={!editable || !v.enabled} label={t('cfg.admob_inline', 'Banner inside remedy pages')} checked={v.inline_on_detail_pages} onChange={x => set({ ...v, inline_on_detail_pages: x })} />
          <Toggle disabled={!editable || !v.enabled} label={t('cfg.admob_forms', 'Also on onboarding and forms')} hint={t('cfg.admob_forms_hint', 'Usually left off.')} checked={v.in_onboarding_and_forms} onChange={x => set({ ...v, in_onboarding_and_forms: x })} />
          {v.enabled && <div className="hm-callout warn"><AlertTriangle size={15} className="shrink-0 mt-0.5" /><span>{t('cfg.admob_warn', 'Release builds must carry your real AdMob app and banner IDs first. With Google\'s test IDs no money is earned.')}</span></div>}
        </>))}

        {card('disclaimer', <FileWarning size={17} />, t('cfg.disclaimer', 'Medical disclaimer'), t('cfg.disclaimer_desc', 'Shown during onboarding and at the bottom of every remedy page.'), (v, set) => (
          <I18nInputs multiline disabled={!editable} value={v} onChange={x => set(x)} />
        ))}

        {card('promo_fallback', <Megaphone size={17} />, t('cfg.promo_fb', '"Advertise here" card'), t('cfg.promo_fb_desc', 'Shown in the promotion slot when no paid promotion is live.'), (v, set) => (<>
          <Toggle disabled={!editable} label={t('cfg.promo_fb_on', 'Show the card')} checked={v.enabled} onChange={x => set({ ...v, enabled: x })} />
          <Field label={t('cfg.title', 'Title')}><I18nInputs disabled={!editable} value={v.title || {}} onChange={x => set({ ...v, title: x })} /></Field>
          <Field label={t('cfg.body', 'Text')}><I18nInputs multiline disabled={!editable} value={v.body || {}} onChange={x => set({ ...v, body: x })} /></Field>
        </>))}

        {card('ads_contact', <Smartphone size={17} />, t('cfg.ads_contact', 'Advertising contact'), t('cfg.ads_contact_desc', 'Where advertisers reach you from the "Advertise here" card.'), (v, set) => (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('cfg.email', 'Email')}><input className="form-input" disabled={!editable} value={v.email || ''} onChange={e => set({ ...v, email: e.target.value })} /></Field>
            <Field label="WhatsApp"><input className="form-input" disabled={!editable} value={v.whatsapp || ''} onChange={e => set({ ...v, whatsapp: e.target.value })} placeholder="+8801XXXXXXXXX" /></Field>
          </div>
        ))}

        {card('office_hours', <Clock size={17} />, t('cfg.hours', 'Office hours'), t('cfg.hours_desc', 'The app shows "open now" or the closed message on the contact page.'), (v, set) => (<>
          <Field label={t('cfg.days', 'Open on')}>
            <div className="flex flex-wrap gap-1.5">{DAYS.map(d => {
              const on = (v.days || []).includes(d);
              return <button key={d} type="button" disabled={!editable} className="chip !h-8" aria-selected={on} onClick={() => set({ ...v, days: on ? v.days.filter((x: string) => x !== d) : [...(v.days || []), d] })}>{t(`day.${d}`, d[0].toUpperCase() + d.slice(1))}</button>;
            })}</div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('cfg.opens', 'Opens')}><input type="time" className="form-input" disabled={!editable} value={v.opens || ''} onChange={e => set({ ...v, opens: e.target.value })} /></Field>
            <Field label={t('cfg.closes', 'Closes')}><input type="time" className="form-input" disabled={!editable} value={v.closes || ''} onChange={e => set({ ...v, closes: e.target.value })} /></Field>
          </div>
          <Toggle disabled={!editable} label={t('cfg.open_now', 'Show "open now"')} checked={v.show_open_now} onChange={x => set({ ...v, show_open_now: x })} />
          <Field label={t('cfg.closed_msg', 'Message while closed')}><I18nInputs multiline disabled={!editable} value={v.closed_message || {}} onChange={x => set({ ...v, closed_message: x })} /></Field>
        </>))}

        {card('address', <MapPin size={17} />, t('cfg.address', 'Office address'), t('cfg.address_desc', 'Shown on the contact page.'), (v, set) => (<>
          <I18nInputs multiline disabled={!editable} value={v.text || {}} onChange={x => set({ ...v, text: x })} />
          <Toggle disabled={!editable} label={t('cfg.show_map', 'Show a map link')} checked={v.show_map} onChange={x => set({ ...v, show_map: x })} />
        </>))}

        {card('content_notice', <Info size={17} />, t('cfg.notice', 'Content notice'), t('cfg.notice_desc', 'While on, the app says the content is still being reviewed.'), (v, set) => (<>
          <Toggle disabled={!editable} label={t('cfg.sample', 'Content still under review')} checked={v.sample_data} onChange={x => set({ ...v, sample_data: x })} />
          <Field label={t('cfg.note', 'Internal note')}><input className="form-input" disabled={!editable} value={v.note || ''} onChange={e => set({ ...v, note: e.target.value })} /></Field>
        </>))}

        {card('min_app_version', <Smartphone size={17} />, t('cfg.min_version', 'Minimum app versions'), t('cfg.min_version_desc', 'Older copies are asked to update.'), (v, set) => (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Android"><input className="form-input font-mono" disabled={!editable} value={v.android || ''} onChange={e => set({ ...v, android: e.target.value })} placeholder="1.0.0" /></Field>
            <Field label={t('cfg.admin_app', 'Admin app (Windows)')}><input className="form-input font-mono" disabled={!editable} value={v.windows_admin || ''} onChange={e => set({ ...v, windows_admin: e.target.value })} placeholder="1.0.0" /></Field>
          </div>
        ))}
      </div>

      {others.length > 0 && (
        <section className="card-base overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-night-22353f"><Code2 size={15} className="text-slate-400" /><h2 className="text-[13.5px] font-extrabold">{t('cfg.advanced', 'Advanced (JSON)')}</h2></div>
          <div className="p-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
            {others.map(r => (
              <div key={r.key}>
                <label className="form-label font-mono">{r.key}</label>
                <textarea className="form-input font-mono !text-[12px]" rows={6} disabled={!editable} value={json[r.key] ?? ''} onChange={e => setJson(j => ({ ...j, [r.key]: e.target.value }))} />
                {editable && <button type="button" className="btn btn-outline btn-sm mt-2" onClick={async () => {
                  let parsed: unknown;
                  try { parsed = JSON.parse(json[r.key]); } catch { showToast(t('cfg.bad_json', 'This is not valid JSON.'), 'error'); return; }
                  try { await call('saveConfig', r.key, parsed); showToast(t('cfg.saved', 'Saved. The app uses it after its next sync.')); reload(); } catch (e) { showError(e); }
                }}><Save size={13} />{t('common.save', 'Save')}</button>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default AppSettingsView;
