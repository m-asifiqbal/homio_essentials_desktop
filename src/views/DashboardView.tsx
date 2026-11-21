import React, { useEffect } from 'react';
import { ArrowRight, BookCheck, Languages, MessageSquareText, ShieldCheck, Leaf, FileClock, DatabaseBackup, Sparkles } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { call } from '../services/api';
import { CountText } from '../components/common/CountText';
import { EmptyState, LetterTile, Panel, RequestBadge, SkeletonRows } from '../components/common/ui';
import { Avatar } from '../components/layout/Sidebar';
import type { AuditEntry } from '@shared/types';

const ACTION_TEXT: Record<string, [string, string]> = {
  create_remedy: ['act.create_remedy', 'added a medicine'], update_remedy: ['act.update_remedy', 'updated a medicine'], review_remedy: ['act.review_remedy', 'marked a medicine as reviewed'],
  remedy_published: ['act.remedy_published', 'published a medicine'], remedy_archived: ['act.remedy_archived', 'archived a medicine'], remedy_draft: ['act.remedy_draft', 'moved a medicine to drafts'],
  approve_request: ['act.approve_request', 'approved a request'], request_rejected: ['act.request_rejected', 'rejected a request'], request_needs_info: ['act.request_needs_info', 'asked for more information'],
  request_merged: ['act.request_merged', 'merged a request'], create_promotion: ['act.create_promotion', 'created a promotion'], update_promotion: ['act.update_promotion', 'updated a promotion'],
  delete_promotion: ['act.delete_promotion', 'deleted a promotion'], update_contact: ['act.update_contact', 'updated contact info'], create_contact: ['act.create_contact', 'added a contact'],
  update_config: ['act.update_config', 'changed an app setting'], create_product: ['act.create_product', 'added a product'], update_product: ['act.update_product', 'updated a product'],
  add_staff: ['act.add_staff', 'added a team member'], set_role: ['act.set_role', 'changed a role'], remove_staff: ['act.remove_staff', 'removed a team member'], restore_backup: ['act.restore_backup', 'restored a backup'],
};

export const DashboardView: React.FC = () => {
  const { t, session, go, num, relTime, setWaitingCount } = useApp();
  const { data, loading } = useLoad(() => call('dashboard'));
  useEffect(() => { if (data) setWaitingCount(data.stats.requests_waiting); }, [data, setWaitingCount]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? t('dash.morning', 'Good morning') : hour < 17 ? t('dash.afternoon', 'Good afternoon') : t('dash.evening', 'Good evening');
  const first = (session?.displayName || '').replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').split(/\s+/)[0];
  const s = data?.stats;
  const pub = s?.remedies_published || 0;
  const bnCoverage = pub ? Math.round(((pub - (s?.missing_bangla || 0)) / pub) * 100) : 0;
  const reviewed = pub ? Math.round(((pub - (s?.remedies_need_review || 0)) / pub) * 100) : 0;
  const nameOf = (id: string | null) => data?.staff.find(x => x.user_id === id)?.display_name || t('dash.someone', 'Someone');
  const lastBackup = s?.last_backup;
  const backupAge = lastBackup ? (Date.now() - new Date(lastBackup.started_at).getTime()) / 3600e3 : Infinity;

  const kpi = (icon: React.ReactNode, label: string, value: number | undefined, foot: React.ReactNode, tone = '', onClick?: () => void) => (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`card-base text-left p-5 flex flex-col gap-2 hover:shadow-[0_10px_28px_-14px_rgba(15,60,62,.35)] disabled:cursor-default ${tone}`}>
      <span className="flex items-center justify-between text-[12.5px] font-bold text-slate-500 dark:text-slate-400">{label}<span className="w-8 h-8 rounded-xl bg-accent-50 dark:bg-accent-400/10 text-accent-600 dark:text-accent-300 flex items-center justify-center">{icon}</span></span>
      <span className="text-[2rem] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none"><CountText value={loading && !data ? null : value} /></span>
      <span className="text-[11.5px] font-bold">{foot}</span>
    </button>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[1.75rem] font-extrabold tracking-tight text-slate-900 dark:text-white">{greet}{first ? `, ${first}` : ''}</h1>
            <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
              {s ? t('dash.summary', '{w} requests are waiting and {b} medicines still need Bangla text.', { w: s.requests_waiting, b: s.missing_bangla }) : t('common.loading', 'Loading…')}
            </p>
          </div>
          <button type="button" onClick={() => go('requests')} className="btn btn-green-outline !rounded-xl"><MessageSquareText size={15} />{t('dash.open_queue', 'Open request queue')}</button>
        </div>

        <div className="kpi-zoom grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {kpi(<Leaf size={16} />, t('dash.published', 'Published medicines'), s?.remedies_published,
            <span className="text-[var(--hm-okink)]">{t('dash.drafts', '{n} drafts · {s} stubs', { n: data?.drafts ?? 0, s: s?.remedies_stub ?? 0 })}</span>, '', () => go('medicines'))}
          {kpi(<MessageSquareText size={16} />, t('dash.waiting', 'Requests waiting'), s?.requests_waiting,
            <span className="text-[var(--hm-amink)]">{data?.waiting[0] ? t('dash.oldest', 'oldest {age}', { age: relTime(data.waiting[0].created_at) }) : t('dash.none_waiting', 'nothing waiting')}</span>,
            s?.requests_waiting ? '!border-[#E9B866] dark:!border-[#6b5420]' : '', () => go('requests'))}
          {kpi(<Languages size={16} />, t('dash.missing_bn', 'Missing Bangla text'), s?.missing_bangla,
            <span className="text-slate-500 dark:text-slate-400">{t('dash.missing_bn_foot', 'published medicines with no বাংলা summary')}</span>, '', () => go('medicines'))}
          {kpi(<ShieldCheck size={16} />, t('dash.need_review', 'Awaiting practitioner review'), s?.remedies_need_review,
            <span className="text-slate-500 dark:text-slate-400">{t('dash.need_review_foot', 'shown in the app with a "not yet reviewed" note')}</span>, '', () => go('medicines', { review: 'needs' }))}
        </div>

        <div className="flex flex-wrap gap-6 items-start">
          <Panel className="flex-[999_1_560px] min-w-0" title={t('dash.queue_title', 'Requests waiting for review')}
            action={<button type="button" onClick={() => go('requests')} className="text-xs font-bold text-accent-700 dark:text-accent-300 inline-flex items-center gap-1 hover:gap-2 transition-all">{t('dash.open', 'Open queue')}<ArrowRight size={13} /></button>}>
            {loading && !data ? <SkeletonRows rows={4} /> : !data?.waiting.length ? (
              <EmptyState icon={<Sparkles size={22} />} title={t('dash.all_clear', 'All clear')} body={t('dash.all_clear_body', 'Every request from the app has been answered.')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5 font-bold">{t('req.col.item', 'Submitted item')}</th><th className="px-3 py-2.5 font-bold">{t('req.col.type', 'Type')}</th>
                    <th className="px-3 py-2.5 font-bold">{t('req.col.from', 'From')}</th><th className="px-3 py-2.5 font-bold">{t('req.col.status', 'Status')}</th>
                    <th className="px-3 py-2.5 font-bold">{t('req.col.age', 'Age')}</th><th className="px-5 py-2.5" /></tr></thead>
                  <tbody>
                    {data.waiting.map(r => {
                      const name = String(r.payload?.latin_name || r.payload?.name || '—');
                      return (
                        <tr key={r.id} className="border-t border-slate-100 dark:border-night-22353f">
                          <td className="px-5 py-3"><div className="flex items-center gap-2.5 min-w-0"><LetterTile size="sm" text={name[0]?.toUpperCase() || '?'} kingdom={r.kind === 'remedy' ? 'plant' : 'nosode'} />
                            <span className={`${r.kind === 'remedy' ? 'lat text-[15px]' : 'font-bold'} truncate text-slate-900 dark:text-white`}>{name}</span></div></td>
                          <td className="px-3 py-3">{r.kind === 'remedy' ? t('req.kind.Remedy', 'Remedy') : t('req.kind.Product', 'Brand')}</td>
                          <td className="px-3 py-3">{t(`requester.${r.requester_role || 'general'}`, r.requester_role || 'general')}</td>
                          <td className="px-3 py-3"><RequestBadge s={r.status} /></td>
                          <td className="px-3 py-3 text-slate-500">{relTime(r.created_at)}</td>
                          <td className="px-5 py-3 text-right"><button type="button" onClick={() => go('requests', { id: r.id })} className="btn btn-outline btn-sm">{t('req.review', 'Review')}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-6">
            <Panel title={t('dash.health', 'Content health')}>
              <div className="divide-y divide-slate-100 dark:divide-night-22353f">
                <div className="px-5 py-3.5"><div className="flex justify-between text-[12.5px] mb-2"><b className="flex items-center gap-1.5"><Languages size={13} />{t('dash.bn_coverage', 'Bangla coverage')}</b><span>{num(bnCoverage)}%</span></div>
                  <div className="hm-bar"><i className={bnCoverage < 50 ? 'warn' : ''} style={{ width: `${bnCoverage}%` }} /></div></div>
                <div className="px-5 py-3.5"><div className="flex justify-between text-[12.5px] mb-2"><b className="flex items-center gap-1.5"><BookCheck size={13} />{t('dash.reviewed', 'Reviewed by a practitioner')}</b><span>{num(reviewed)}%</span></div>
                  <div className="hm-bar"><i className={reviewed < 50 ? 'warn' : ''} style={{ width: `${reviewed}%` }} /></div></div>
                <div className="px-5 py-3.5 flex justify-between text-[12.5px]"><b className="flex items-center gap-1.5"><FileClock size={13} />{t('dash.stale', 'Prices older than 90 days')}</b><span>{num(s?.stale_prices ?? 0)}</span></div>
                <button type="button" onClick={() => go('backups')} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-night-1d2e36">
                  <div className="flex justify-between text-[12.5px]"><b className="flex items-center gap-1.5"><DatabaseBackup size={13} />{t('dash.last_backup', 'Last backup')}</b>
                    <span className={`font-bold ${backupAge < 30 ? 'text-[var(--hm-okink)]' : 'text-[var(--hm-dgink)]'}`}>
                      {lastBackup ? `${relTime(lastBackup.started_at)} · ${t(`backup.status.${lastBackup.status}`, lastBackup.status)}` : t('dash.no_backup', 'Never')}
                    </span></div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">{t('dash.backup_hint', 'Owners get one automatic backup a day')}<ArrowRight size={11} /></div>
                </button>
              </div>
            </Panel>

            <Panel title={t('dash.activity', 'Recent activity')}>
              {!data?.activity.length ? <div className="px-5 py-6 text-xs text-slate-400 text-center">{t('dash.no_activity', 'No changes yet.')}</div> : (
                <ul className="divide-y divide-slate-100 dark:divide-night-22353f">
                  {data.activity.map((a: AuditEntry) => {
                    const who = a.actor_id === session?.userId ? t('dash.you', 'You') : nameOf(a.actor_id);
                    const [key, en] = ACTION_TEXT[a.action] || ['', a.action.replace(/_/g, ' ')];
                    const what = a.diff?.latin_name || a.diff?.name || a.diff?.advertiser || a.diff?.key;
                    return (
                      <li key={a.id} className="flex gap-3 px-5 py-3 text-[12.5px]">
                        <Avatar name={who} className="w-8 h-8 rounded-full text-[11px]" />
                        <div className="min-w-0"><b className="text-slate-900 dark:text-white">{who}</b> {key ? t(key, en) : en}{what ? <> · <span className={a.diff?.latin_name ? 'lat text-[14px]' : 'font-semibold'}>{what}</span></> : null}
                          <div className="text-[11px] text-slate-400 mt-0.5">{relTime(a.created_at)}</div></div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
    </div>
  );
};

export default DashboardView;
