import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, DatabaseBackup, FileSearch, FolderOpen, HardDrive, History, Loader2, RotateCcw, ShieldCheck, AlertTriangle, Monitor } from 'lucide-react';
import { useApp, useLoad } from '../context/AppContext';
import { backups, call, isElectron, type BackupProgress } from '../services/api';
import { Modal } from '../components/common/Modal';
import { EmptyState, PageHeader, Panel, SkeletonRows } from '../components/common/ui';
import type { BackupRun } from '@shared/types';

const STATUS_CLASS: Record<string, string> = { succeeded: 's-ok', verified: 's-ok', test_restored: 's-ok', running: 's-info', failed: 's-rej' };
const mb = (b?: number | null) => (b ? `${(b / 1048576).toFixed(b > 10485760 ? 0 : 1)} MB` : '—');

export const BackupsView: React.FC = () => {
  const { t, can, num, fmtDate, relTime, showToast, showError } = useApp();
  const runs = useLoad(() => call('listBackupRuns'));
  const local = useLoad(() => backups.list());
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [busy, setBusy] = useState<'' | 'run' | 'verify' | 'restore'>('');
  const [verified, setVerified] = useState<null | { ok: boolean; problems: string[]; created_at: string; counts: Record<string, number>; marked: boolean; file: string }>(null);
  const [restoreFile, setRestoreFile] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const owner = can('owner');

  useEffect(() => backups.onProgress(p => setProgress(p.step === 'done' ? null : p)), []);
  const refresh = () => { runs.reload(); local.reload(); };

  const runNow = async () => {
    setBusy('run');
    try { await backups.run(); showToast(t('backup.done', 'Backup saved on this PC and in the cloud.')); refresh(); } catch (e) { showError(e); } finally { setBusy(''); setProgress(null); }
  };
  const verify = async (file?: string) => {
    const f = file || (await backups.pick().catch(e => { showError(e); return null; }));
    if (!f) return;
    setBusy('verify');
    try { const r = await backups.verify(f); setVerified({ ...r, file: f }); if (r.marked) runs.reload(); } catch (e) { showError(e); } finally { setBusy(''); }
  };
  const restore = async () => {
    if (!restoreFile) return;
    setBusy('restore');
    try {
      const r = await backups.restore(restoreFile);
      showToast(t('backup.restored', 'Restored the archive as it was on {date}.', { date: fmtDate(r.created_at, true) }));
      setRestoreFile(null); setTyped(''); refresh();
    } catch (e) { showError(e); } finally { setBusy(''); setProgress(null); }
  };

  const last = runs.data?.[0];
  const lastOk = runs.data?.find(r => r.status !== 'failed' && r.status !== 'running');
  const ageH = lastOk ? (Date.now() - new Date(lastOk.started_at).getTime()) / 3600e3 : Infinity;

  const stat = (icon: React.ReactNode, label: string, value: React.ReactNode, foot: React.ReactNode, tone = '') => (
    <div className={`card-base p-5 flex flex-col gap-1.5 ${tone}`}>
      <span className="flex items-center gap-2 text-[12px] font-bold text-slate-500">{icon}{label}</span>
      <span className="text-[1.35rem] font-extrabold text-slate-900 dark:text-white leading-tight">{value}</span>
      <span className="text-[11.5px] text-slate-500">{foot}</span>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <PageHeader caption={t('nav.section_system', 'System')} title={t('nav.backups', 'Backups')}
        sub={t('backup.sub', 'A full copy of the archive: every medicine, translation, request, promotion and setting. Saved on this PC and in the cloud.')}
        actions={<>
          {isElectron && <button type="button" className="btn btn-outline" onClick={() => backups.openFolder().catch(showError)}><FolderOpen size={15} />{t('backup.open_folder', 'Open folder')}</button>}
          <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => verify()}>{busy === 'verify' ? <Loader2 size={15} className="animate-spin" /> : <FileSearch size={15} />}{t('backup.check', 'Check a backup file')}</button>
          {owner && <button type="button" className="btn btn-danger-outline" disabled={!!busy || !isElectron} onClick={async () => { const f = await backups.pick().catch(e => { showError(e); return null; }); if (f) { setRestoreFile(f); setTyped(''); } }}><RotateCcw size={15} />{t('backup.restore', 'Restore…')}</button>}
          {owner && <button type="button" className="btn btn-primary" disabled={!!busy} onClick={runNow}>{busy === 'run' ? <Loader2 size={15} className="animate-spin" /> : <DatabaseBackup size={15} />}{t('backup.now', 'Back up now')}</button>}
        </>} />

      {!owner && <div className="hm-callout note"><ShieldCheck size={16} className="shrink-0 mt-0.5" /><span>{t('backup.owner_only', 'Only owners can make or restore backups. You can see when the last one ran and check a backup file.')}</span></div>}
      {!isElectron && <div className="hm-callout note"><Monitor size={16} className="shrink-0 mt-0.5" /><span>{t('backup.desktop_only', 'Backups are saved by the desktop app. This browser preview shows the history only.')}</span></div>}

      {progress && (
        <div className="card-base p-4">
          <div className="flex justify-between text-xs font-bold mb-2"><span>{busy === 'restore' ? t('backup.restoring', 'Restoring') : t('backup.saving', 'Backing up')} · <code className="font-mono">{progress.step}</code></span><span>{num(Math.round((progress.done / Math.max(1, progress.total)) * 100))}%</span></div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-night-1d2e36 overflow-hidden"><div className="h-full rounded-full bg-accent-600 bf-bar-glide transition-[width] duration-300" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>
        </div>
      )}

      <div className="kpi-zoom grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {stat(<History size={14} />, t('backup.last', 'Last backup'), lastOk ? relTime(lastOk.started_at) : t('dash.no_backup', 'Never'),
          lastOk ? `${fmtDate(lastOk.started_at, true)} · ${t(`backup.kind.${lastOk.kind}`, lastOk.kind)}` : t('backup.none_yet', 'Make the first one now'), ageH > 30 ? '!border-[#E9A3A0] dark:!border-[#6b2a26]' : '')}
        {stat(<ShieldCheck size={14} />, t('backup.state', 'State'), last ? <span className={`hm-badge ${STATUS_CLASS[last.status]} !text-[12px] !h-7`}>{t(`backup.status.${last.status}`, last.status)}</span> : '—',
          last?.error ? last.error : t('backup.state_hint', '"Verified" means the file was opened and every table counted.'))}
        {stat(<HardDrive size={14} />, t('backup.on_pc', 'Copies on this PC'), num(local.data?.length ?? 0), t('backup.keep_rule', 'The newest 30 daily copies are kept; manual ones are never removed.'))}
        {stat(<Cloud size={14} />, t('backup.cloud', 'Cloud copies'), num(runs.data?.filter(r => r.locations?.includes('cloud')).length ?? 0), t('backup.cloud_hint', 'Private storage, readable by owners only.'))}
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        <Panel className="flex-[999_1_560px] min-w-0" title={t('backup.history', 'History')}>
          {runs.loading && !runs.data ? <SkeletonRows rows={5} /> : !runs.data?.length ? (
            <EmptyState icon={<DatabaseBackup size={22} />} title={t('backup.none', 'No backups yet')} body={t('backup.none_body', 'Owners get an automatic backup on their first sign-in each day.')} />
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-[13px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider">
                <th className="px-5 py-2.5 font-bold">{t('backup.col.when', 'When')}</th><th className="px-3 py-2.5 font-bold">{t('backup.col.kind', 'Kind')}</th>
                <th className="px-3 py-2.5 font-bold">{t('backup.col.status', 'Status')}</th><th className="px-3 py-2.5 font-bold text-right">{t('backup.col.size', 'Size')}</th>
                <th className="px-3 py-2.5 font-bold">{t('backup.col.where', 'Saved to')}</th><th className="px-5 py-2.5 font-bold">{t('backup.col.check', 'Checksum')}</th></tr></thead>
              <tbody>{runs.data.map((r: BackupRun) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-night-22353f">
                  <td className="px-5 py-2.5 whitespace-nowrap"><div className="font-bold">{fmtDate(r.started_at, true)}</div><div className="text-[11px] text-slate-500">{relTime(r.started_at)}</div></td>
                  <td className="px-3 py-2.5">{t(`backup.kind.${r.kind}`, r.kind)}</td>
                  <td className="px-3 py-2.5"><span className={`hm-badge ${STATUS_CLASS[r.status] || 's-draft'}`}>{r.status === 'verified' && <CheckCircle2 size={11} />}{t(`backup.status.${r.status}`, r.status)}</span></td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">{mb(r.db_size_bytes)}</td>
                  <td className="px-3 py-2.5"><div className="flex gap-1">{(r.locations || []).map(l => <span key={l} className="hm-badge s-draft">{l === 'cloud' ? <Cloud size={11} /> : <HardDrive size={11} />}{t(`backup.loc.${l}`, l)}</span>)}</div></td>
                  <td className="px-5 py-2.5 font-mono text-[11px] text-slate-500">{r.sha256 ? `${r.sha256.slice(0, 10)}…` : '—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Panel>

        <Panel className="flex-[1_1_320px] min-w-0" title={t('backup.files', 'Files on this PC')}>
          {!local.data?.length ? <div className="px-5 py-8 text-center text-xs text-slate-400">{t('backup.no_files', 'No backup files here yet.')}</div> : (
            <ul className="divide-y divide-slate-100 dark:divide-night-22353f max-h-[26rem] overflow-y-auto">
              {local.data.map(f => (
                <li key={f.name} className="px-5 py-2.5 flex items-center gap-3 text-[12.5px]">
                  <HardDrive size={15} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0"><div className="font-mono text-[11.5px] truncate" title={f.name}>{f.name}</div><div className="text-[11px] text-slate-500">{mb(f.size)} · {relTime(f.modified)}</div></div>
                  {isElectron && <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => verify(f.path)}>{t('backup.check_short', 'Check')}</button>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Modal open={!!verified} onClose={() => setVerified(null)} size="md" tone={verified?.ok ? 'brand' : 'danger'} icon={verified?.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        title={verified?.ok ? t('backup.ok_title', 'This backup is complete') : t('backup.bad_title', 'This backup has problems')}
        footer={<button type="button" className="btn btn-primary" onClick={() => setVerified(null)}>{t('common.ok', 'OK')}</button>}>
        {verified && (<>
          <p>{t('backup.made_on', 'Made on {date}.', { date: fmtDate(verified.created_at, true) })} {verified.marked && t('backup.marked', 'Its history entry is now marked as verified.')}</p>
          {verified.problems.length > 0 && <ul className="mt-2 list-disc pl-5 text-rose-700 dark:text-rose-300">{verified.problems.map(p => <li key={p}>{p}</li>)}</ul>}
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] max-h-56 overflow-y-auto">
            {Object.entries(verified.counts || {}).map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-100 dark:border-night-22353f py-0.5"><span className="font-mono text-slate-500">{k}</span><b>{num(v)}</b></div>)}
          </div>
        </>)}
      </Modal>

      <Modal open={!!restoreFile} onClose={() => setRestoreFile(null)} locked={busy === 'restore'} size="md" tone="danger" icon={<RotateCcw size={18} />} title={t('backup.restore_title', 'Restore from this backup?')}
        footer={<>
          <button type="button" className="btn btn-cancel" disabled={busy === 'restore'} onClick={() => setRestoreFile(null)}>{t('common.cancel', 'Cancel')}</button>
          <button type="button" className="btn btn-danger" disabled={busy === 'restore' || typed.trim().toUpperCase() !== 'RESTORE'} onClick={restore}>{busy === 'restore' && <Loader2 size={14} className="animate-spin" />}{t('backup.restore_btn', 'Restore')}</button>
        </>}>
        <p className="font-mono text-[11.5px] break-all mb-2">{restoreFile}</p>
        <p>{t('backup.restore_body', 'Every medicine, translation, product, promotion, contact and setting in the file is written back as it was. Rows added after the backup stay. Team accounts and the history are not changed. Make a fresh backup first.')}</p>
        <label className="form-label mt-4">{t('backup.type_restore', 'Type RESTORE to continue')}</label>
        <input className="form-input font-mono" value={typed} onChange={e => setTyped(e.target.value)} placeholder="RESTORE" autoFocus data-no-clear="" />
      </Modal>
    </div>
  );
};

export default BackupsView;
