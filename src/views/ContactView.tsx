import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Facebook, Globe, Loader2, Mail, MapPin, MessageCircle, Pencil, Phone, PhoneCall, Plus, Trash2, Youtube, MessagesSquare, EyeOff } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { call } from '../services/api';
import { Modal } from '../components/common/Modal';
import { SearchableSelect } from '../components/common/SearchableSelect';
import { EmptyState, Field, I18nInputs, PageHeader, SkeletonRows, Switch } from '../components/common/ui';
import { CONTACT_TYPES, type ContactChannel, type ContactType } from '@shared/types';

const ICON: Record<ContactType, React.ReactNode> = {
  phone: <Phone size={16} />, whatsapp: <MessageCircle size={16} />, email: <Mail size={16} />, facebook: <Facebook size={16} />,
  messenger: <MessagesSquare size={16} />, youtube: <Youtube size={16} />, website: <Globe size={16} />, address: <MapPin size={16} />,
};
const PH: Record<ContactType, string> = {
  phone: '+8801XXXXXXXXX', whatsapp: '+8801XXXXXXXXX', email: 'hello@example.org', facebook: 'https://facebook.com/yourpage',
  messenger: 'https://m.me/yourpage', youtube: 'https://youtube.com/@yourchannel', website: 'https://example.org', address: 'House, road, area, Dhaka',
};

export const ContactView: React.FC = () => {
  const { t, can, showToast, showError } = useApp();
  const { data, loading, reload, setData } = useLoad(() => call('listContacts'));
  const [edit, setEdit] = useState<ContactChannel | null>(null);
  const [del, setDel] = useState<ContactChannel | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = can('editor');
  const rows = data || [];

  const move = async (i: number, dir: -1 | 1) => {
    const next = rows.slice();
    const [x] = next.splice(i, 1);
    next.splice(i + dir, 0, x);
    setData(next.map((c, k) => ({ ...c, sort_order: k })));
    try { await call('reorderContacts', next.map(c => c.id!)); } catch (e) { showError(e); reload(); }
  };
  const toggle = async (c: ContactChannel, v: boolean) => {
    setData(rows.map(x => (x.id === c.id ? { ...x, is_visible: v } : x)));
    try { await call('saveContact', { ...c, is_visible: v }); } catch (e) { showError(e); reload(); }
  };
  const remove = async () => {
    if (!del?.id) return;
    setBusy(true);
    try { await call('deleteContact', del.id); showToast(t('contact.deleted', 'Removed.')); setDel(null); reload(); } catch (e) { showError(e); } finally { setBusy(false); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      <PageHeader caption={t('nav.section_app', 'App content')} title={t('nav.contact', 'Contact info')}
        sub={t('contact.sub', 'The ways readers can reach you, shown on the app\'s contact page in this order.')}
        actions={editable && <button type="button" className="btn btn-primary" onClick={() => setEdit({ type: 'phone', label: { en: '', bn: '' }, value: '', is_visible: true, sort_order: rows.length })}><Plus size={15} strokeWidth={2.6} />{t('contact.add', 'Add contact')}</button>} />

      <div className="card-base overflow-hidden">
        {loading && !data ? <SkeletonRows rows={4} cols={3} /> : !rows.length ? (
          <EmptyState icon={<PhoneCall size={22} />} title={t('contact.none', 'No contact details yet')} />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-night-22353f">
            {rows.map((c, i) => (
              <li key={c.id} className={`flex items-center gap-4 px-5 py-3.5 ${c.is_visible ? '' : 'opacity-60'}`}>
                <span className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-400/10 text-accent-600 dark:text-accent-300 flex items-center justify-center shrink-0">{ICON[c.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13.5px] text-slate-900 dark:text-white">{c.label.en || t(`contact.type.${c.type}`, c.type)} <span className="font-medium text-slate-400" lang="bn">· {c.label.bn}</span></div>
                  <div className="text-[12.5px] text-slate-500 truncate font-mono">{c.value}</div>
                </div>
                {!c.is_visible && <span className="hm-badge s-draft"><EyeOff size={11} />{t('contact.hidden', 'Hidden')}</span>}
                {editable && (
                  <div className="flex items-center gap-1.5">
                    <Switch checked={c.is_visible} onChange={v => toggle(c, v)} label={t('contact.visible', 'Visible in the app')} />
                    <button type="button" className="btn btn-outline btn-icon btn-act" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('common.up', 'Move up')}><ArrowUp size={13} /></button>
                    <button type="button" className="btn btn-outline btn-icon btn-act" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={t('common.down', 'Move down')}><ArrowDown size={13} /></button>
                    <button type="button" className="btn btn-outline btn-icon btn-act" onClick={() => setEdit(c)} aria-label={t('common.edit', 'Edit')}><Pencil size={13} /></button>
                    <button type="button" className="btn btn-danger-outline btn-icon btn-act" onClick={() => setDel(c)} aria-label={t('common.delete', 'Delete')}><Trash2 size={13} /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ContactDialog item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
      <Modal open={!!del} onClose={() => setDel(null)} locked={busy} size="sm" tone="danger" icon={<Trash2 size={18} />} title={t('contact.delete_title', 'Remove this contact?')}
        footer={<>
          <button type="button" className="btn btn-cancel" disabled={busy} onClick={() => setDel(null)}>{t('common.cancel', 'Cancel')}</button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>{busy && <Loader2 size={14} className="animate-spin" />}{t('common.remove', 'Remove')}</button>
        </>}>
        {t('contact.delete_body', 'It disappears from the app after the next sync. To hide it for a while, switch it off instead.')}
      </Modal>
    </div>
  );
};

const ContactDialog: React.FC<{ item: ContactChannel | null; onClose: () => void; onSaved: () => void }> = ({ item, onClose, onSaved }) => {
  const { t, showToast, showError } = useApp();
  const [c, setC] = useState<ContactChannel | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (item) setC(structuredClone(item)); }, [item]);
  const save = async () => {
    if (!c) return;
    setBusy(true);
    try { await call('saveContact', c); showToast(t('contact.saved', 'Saved.')); onSaved(); } catch (e) { showError(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!item} onClose={onClose} locked={busy} size="md" icon={<PhoneCall size={18} />} title={item?.id ? t('contact.edit', 'Edit contact') : t('contact.add', 'Add contact')}
      footer={<>
        <button type="button" className="btn btn-cancel" disabled={busy} onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
        <button type="button" className="btn btn-primary" disabled={busy || !c?.value.trim()} onClick={save}>{busy && <Loader2 size={14} className="animate-spin" />}{t('common.save', 'Save')}</button>
      </>}>
      {c && (
        <div className="space-y-4">
          <Field label={t('contact.type', 'Type')}><SearchableSelect value={c.type} onChange={v => setC({ ...c, type: v })} options={CONTACT_TYPES.map(x => ({ value: x, label: t(`contact.type.${x}`, x) }))} /></Field>
          <Field label={t('contact.label', 'Label in the app')}><I18nInputs value={c.label} onChange={v => setC({ ...c, label: v })} placeholderEn={t(`contact.type.${c.type}`, c.type)} /></Field>
          <Field label={c.type === 'phone' || c.type === 'whatsapp' ? t('contact.number', 'Number') : c.type === 'email' ? t('cfg.email', 'Email') : c.type === 'address' ? t('cfg.address', 'Office address') : t('contact.link', 'Link')}
            hint={c.type === 'whatsapp' ? t('contact.wa_hint', 'With the country code, e.g. +8801…') : undefined}>
            <input className="form-input" value={c.value} onChange={e => setC({ ...c, value: e.target.value })} placeholder={PH[c.type]} />
          </Field>
          <div className="flex items-center justify-between"><span className="form-label !mb-0">{t('contact.visible', 'Visible in the app')}</span><Switch checked={c.is_visible} onChange={v => setC({ ...c, is_visible: v })} /></div>
        </div>
      )}
    </Modal>
  );
};

export default ContactView;
