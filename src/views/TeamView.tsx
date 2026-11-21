import React, { useState } from 'react';
import { Eye, Loader2, PenLine, Crown, Trash2, UserPlus, UsersRound, MailWarning } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { call } from '../services/api';
import { Modal } from '../components/common/Modal';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { PasswordInput } from '../components/common/PasswordInput';
import { EmptyState, Field, PageHeader, RoleBadge, SkeletonRows } from '../components/common/ui';
import { Avatar } from '../components/layout/Sidebar';
import type { StaffMember, StaffRole } from '@shared/types';

export const TeamView: React.FC = () => {
  const { t, can, session, fmtDate, showToast, showError } = useApp();
  const { data, loading, reload, setData } = useLoad(() => call('listStaff'));
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = can('owner');

  const setRole = async (m: StaffMember, role: StaffRole) => {
    const before = data;
    setData((data || []).map(x => (x.user_id === m.user_id ? { ...x, role } : x)));
    try { await call('setStaffRole', m.user_id, role); showToast(t('team.role_changed', '{name} is now {role}.', { name: m.display_name, role: t(`role.${role}`, role) })); }
    catch (e) { showError(e); setData(before); }
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try { await call('removeStaff', del.user_id); showToast(t('team.removed', 'Removed from the team.')); setDel(null); reload(); } catch (e) { showError(e); } finally { setBusy(false); }
  };

  const role = (icon: React.ReactNode, r: StaffRole, en: string, body: string) => (
    <div className="card-base p-4 flex gap-3">
      <span className="w-9 h-9 rounded-xl bg-accent-50 dark:bg-accent-400/10 text-accent-600 dark:text-accent-300 flex items-center justify-center shrink-0">{icon}</span>
      <div><div className="font-extrabold text-[13px]">{t(`role.${r}`, en)}</div><p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{body}</p></div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      <PageHeader caption={t('nav.section_system', 'System')} title={t('nav.team', 'Team & roles')} sub={t('team.sub', 'People who can sign in to this admin app. Readers of the mobile app never need an account.')}
        actions={owner && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><UserPlus size={15} />{t('team.add', 'Add team member')}</button>} />

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {role(<Eye size={16} />, 'reviewer', 'Reviewer', t('team.reviewer', 'Reads everything, including requests and history. Cannot change content.'))}
        {role(<PenLine size={16} />, 'editor', 'Editor', t('team.editor', 'Edits medicines, products, promotions, contact info and app settings. Answers requests.'))}
        {role(<Crown size={16} />, 'owner', 'Owner', t('team.owner', 'Everything editors do, plus backups, restore and the team list.'))}
      </div>

      <div className="card-base overflow-hidden">
        {loading && !data ? <SkeletonRows rows={3} cols={3} /> : !data?.length ? <EmptyState icon={<UsersRound size={22} />} title={t('team.none', 'No team members')} /> : (
          <ul className="divide-y divide-slate-100 dark:divide-night-22353f">
            {data.map(m => {
              const me = m.user_id === session?.userId;
              return (
                <li key={m.user_id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <Avatar name={m.display_name} className="w-10 h-10 rounded-xl text-sm" />
                  <div className="flex-1 min-w-[10rem]">
                    <div className="font-bold text-[13.5px] text-slate-900 dark:text-white">{m.display_name}{me && <span className="ml-2 text-[11px] font-bold text-accent-700 dark:text-accent-300">{t('team.you', '(you)')}</span>}</div>
                    <div className="text-[11.5px] text-slate-500">{t('team.since', 'Since {date}', { date: fmtDate(m.created_at) })}</div>
                  </div>
                  {owner && !me ? (
                    <SegmentedTabs size="sm" value={m.role} onChange={(r: StaffRole) => r !== m.role && setRole(m, r)} items={[
                      { key: 'reviewer', label: t('role.reviewer', 'Reviewer') }, { key: 'editor', label: t('role.editor', 'Editor') }, { key: 'owner', label: t('role.owner', 'Owner') },
                    ]} />
                  ) : <RoleBadge role={m.role} />}
                  {owner && !me && <button type="button" className="btn btn-danger-outline btn-icon btn-act" onClick={() => setDel(m)} aria-label={t('common.remove', 'Remove')}><Trash2 size={13} /></button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AddMemberDialog open={adding} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); reload(); }} />
      <Modal open={!!del} onClose={() => setDel(null)} locked={busy} size="sm" tone="danger" icon={<Trash2 size={18} />} title={t('team.remove_title', 'Remove {name}?', { name: del?.display_name || '' })}
        footer={<>
          <button type="button" className="btn btn-cancel" disabled={busy} onClick={() => setDel(null)}>{t('common.cancel', 'Cancel')}</button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>{busy && <Loader2 size={14} className="animate-spin" />}{t('common.remove', 'Remove')}</button>
        </>}>
        {t('team.remove_body', 'They can no longer sign in to the admin app. Their past changes stay in the history.')}
      </Modal>
    </div>
  );
};

const AddMemberDialog: React.FC<{ open: boolean; onClose: () => void; onAdded: () => void }> = ({ open, onClose, onAdded }) => {
  const { t, showToast, errText } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [role, setRole] = useState<StaffRole>('editor');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  React.useEffect(() => { if (open) { setName(''); setEmail(''); setPw(''); setRole('editor'); setErr(''); } }, [open]);
  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await call('addStaff', email, pw, name, role);
      showToast(r.confirmed ? t('team.added', 'Added. They can sign in now.') : t('team.added_confirm', 'Added. They must open the confirmation email before the first sign-in.'));
      onAdded();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} locked={busy} size="md" icon={<UserPlus size={18} />} title={t('team.add', 'Add team member')}
      subtitle={t('team.add_sub', 'Creates their sign-in account and gives them a role. Share the first password with them in person.')}
      footer={<>
        <button type="button" className="btn btn-cancel" disabled={busy} onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
        <button type="button" className="btn btn-primary" disabled={busy || !name || !email || pw.length < 8} onClick={save}>{busy && <Loader2 size={14} className="animate-spin" />}{t('team.add_btn', 'Add')}</button>
      </>}>
      <div className="space-y-4">
        <Field label={t('team.name', 'Name')}><input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Farzana Rahman" /></Field>
        <Field label={t('auth.email', 'Email')}><input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.org" /></Field>
        <Field label={t('team.first_pw', 'First password')} hint={t('auth.rules', 'Use at least 8 characters.')}><PasswordInput value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Field label={t('team.role', 'Role')}><SegmentedTabs size="sm" value={role} onChange={setRole} items={[
          { key: 'reviewer', label: t('role.reviewer', 'Reviewer') }, { key: 'editor', label: t('role.editor', 'Editor') }, { key: 'owner', label: t('role.owner', 'Owner') },
        ]} /></Field>
        <div className="hm-callout note"><MailWarning size={15} className="shrink-0 mt-0.5" /><span>{t('team.confirm_note', 'If email confirmation is on in Supabase, they get an email and must confirm before signing in.')}</span></div>
        {err && <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{err}</div>}
      </div>
    </Modal>
  );
};

export default TeamView;
