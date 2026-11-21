/**
 * ============================================================
 * BACKUPS — a full copy of the archive, kept on this PC and in the cloud
 * ============================================================
 * A backup is every table of the archive as JSON, gzip-compressed, with a SHA-256 checksum:
 *   - saved on this computer (Documents\Homio Essentials Backups, the offline copy)
 *   - uploaded to the private `backups` storage bucket (owners only)
 *   - recorded in `backup_runs`, so every team member sees when the last one ran and whether it was verified
 * Owners get one automatic daily backup when they sign in (if the last one is older than 20 hours).
 * Restore merges rows back (insert-or-update); it never deletes rows that were added after the backup.
 * ============================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { ApiError, type Supa } from '../shared/core';
import type { BackupRun, LocalBackupFile } from '../shared/types';

/** Tables in foreign-key order, with a unique sort key for paging. */
export const BACKUP_TABLES: [table: string, order: string][] = [
  ['staff', 'user_id.asc'], ['age_groups', 'code.asc'], ['conditions', 'id.asc'], ['condition_translations', 'condition_id.asc,locale.asc'],
  ['remedies', 'id.asc'], ['remedy_translations', 'remedy_id.asc,locale.asc'], ['remedy_uses', 'id.asc'], ['remedy_use_translations', 'use_id.asc,locale.asc'],
  ['dosage_rules', 'id.asc'], ['remedy_safety_notes', 'id.asc'], ['remedy_relations', 'remedy_id.asc,related_remedy_id.asc,relation_type.asc'],
  ['materia_entries', 'id.asc'], ['rubrics', 'id.asc'], ['rubric_remedies', 'rubric_id.asc,remedy_id.asc,source_book.asc'],
  ['manufacturers', 'id.asc'], ['products', 'id.asc'], ['medicine_requests', 'id.asc'], ['content_reports', 'id.asc'],
  ['promotions', 'id.asc'], ['promotion_events', 'id.asc'], ['contact_channels', 'id.asc'], ['app_config', 'key.asc'],
  ['backup_runs', 'id.asc'], ['audit_log', 'id.asc'],
];
/** Restore writes only content tables (accounts, history and logs are kept as they are now). */
const RESTORE_SKIP = new Set(['staff', 'backup_runs', 'audit_log', 'promotion_events']);
/** Conflict keys for insert-or-update. */
const CONFLICT: Record<string, string> = {
  age_groups: 'code', condition_translations: 'condition_id,locale', remedy_translations: 'remedy_id,locale', remedy_use_translations: 'use_id,locale',
  remedy_relations: 'remedy_id,related_remedy_id,relation_type', rubric_remedies: 'rubric_id,remedy_id,source_book', app_config: 'key',
};

interface BackupFile { format: 'homio-essentials-backup'; version: 1; created_at: string; server: string; created_by: string | null; counts: Record<string, number>; tables: Record<string, any[]> }

export class Backups {
  constructor(private sb: Supa, public dir: string, private onProgress: (p: { step: string; done: number; total: number }) => void) {}

  ensureDir() { fs.mkdirSync(this.dir, { recursive: true }); }

  listLocal(): LocalBackupFile[] {
    this.ensureDir();
    return fs.readdirSync(this.dir).filter(f => /\.json\.gz$/i.test(f)).map(name => {
      const p = path.join(this.dir, name);
      const st = fs.statSync(p);
      return { name, path: p, size: st.size, modified: st.mtime.toISOString() };
    }).sort((a, b) => b.modified.localeCompare(a.modified));
  }

  private requireOwner() {
    if (!this.sb.session) throw new ApiError('E_SESSION', 'Please sign in.');
    if (this.sb.session.staff.role !== 'owner') throw new ApiError('E_FORBIDDEN', 'Only owners can make or restore backups.');
  }

  /** Makes a backup now. Returns the run as recorded in backup_runs. */
  async run(kind: 'daily' | 'manual' | 'monthly' = 'manual'): Promise<BackupRun> {
    this.requireOwner();
    this.ensureDir();
    const started = await this.sb.insert<BackupRun>('backup_runs', { kind, status: 'running', created_by: this.sb.session!.user.id });
    const runId = started[0].id;
    try {
      const tables: Record<string, any[]> = {};
      const counts: Record<string, number> = {};
      let i = 0;
      for (const [table, order] of BACKUP_TABLES) {
        this.onProgress({ step: table, done: i++, total: BACKUP_TABLES.length });
        tables[table] = await this.sb.getAll(table, { select: '*' }, order);
        counts[table] = tables[table].length;
      }
      this.onProgress({ step: 'compress', done: BACKUP_TABLES.length, total: BACKUP_TABLES.length });
      const doc: BackupFile = { format: 'homio-essentials-backup', version: 1, created_at: new Date().toISOString(), server: this.sb.url, created_by: this.sb.session!.user.email, counts, tables };
      const json = Buffer.from(JSON.stringify(doc));
      const gz = zlib.gzipSync(json, { level: 9 });
      const sha256 = crypto.createHash('sha256').update(gz).digest('hex');
      const stamp = doc.created_at.replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
      const name = `HomioBackup-${stamp}-${kind}.json.gz`;
      fs.writeFileSync(path.join(this.dir, name), gz);
      const locations = ['this-pc'];
      try {
        await this.sb.upload('backups', `${doc.created_at.slice(0, 4)}/${name}`, new Uint8Array(gz), 'application/gzip', true);
        locations.push('cloud');
      } catch { /* the PC copy still counts; the run shows where it was saved */ }
      this.prune();
      const done = await this.sb.update<BackupRun>('backup_runs', { id: `eq.${runId}` }, {
        status: 'succeeded', finished_at: new Date().toISOString(), db_size_bytes: json.length, files_size_bytes: gz.length,
        tables_count: BACKUP_TABLES.length, row_counts: counts, sha256, locations,
      });
      this.onProgress({ step: 'done', done: BACKUP_TABLES.length, total: BACKUP_TABLES.length });
      return done[0];
    } catch (e: any) {
      await this.sb.update('backup_runs', { id: `eq.${runId}` }, { status: 'failed', finished_at: new Date().toISOString(), error: String(e?.message || e).slice(0, 500) }).catch(() => undefined);
      throw e;
    }
  }

  /** Keeps the newest 30 daily copies on this PC (manual and monthly copies are never removed). */
  private prune() {
    const daily = this.listLocal().filter(f => /-daily\.json\.gz$/.test(f.name));
    for (const f of daily.slice(30)) { try { fs.unlinkSync(f.path); } catch { /* in use */ } }
  }

  /** One automatic backup a day for owners. */
  async dailyIfDue(): Promise<BackupRun | null> {
    if (this.sb.session?.staff.role !== 'owner') return null;
    const last = this.listLocal()[0];
    if (last && Date.now() - new Date(last.modified).getTime() < 20 * 3600e3) return null;
    return this.run('daily');
  }

  read(file: string): { doc: BackupFile; sha256: string } {
    const gz = fs.readFileSync(file);
    const sha256 = crypto.createHash('sha256').update(gz).digest('hex');
    let doc: BackupFile;
    try { doc = JSON.parse(zlib.gunzipSync(gz).toString('utf8')); } catch { throw new ApiError('E_INVALID', 'This file is not a Homio Essentials backup (it could not be opened).'); }
    if (doc?.format !== 'homio-essentials-backup' || !doc.tables) throw new ApiError('E_INVALID', 'This file is not a Homio Essentials backup.');
    return { doc, sha256 };
  }

  /** Opens a backup, checks every table's row count, and marks the matching run as verified. */
  async verify(file: string) {
    const { doc, sha256 } = this.read(file);
    const problems: string[] = [];
    for (const [table] of BACKUP_TABLES) {
      const rows = doc.tables[table];
      if (!Array.isArray(rows)) { problems.push(`${table}: missing`); continue; }
      if (doc.counts?.[table] !== rows.length) problems.push(`${table}: ${rows.length} rows, expected ${doc.counts?.[table]}`);
    }
    let marked = false;
    if (!problems.length && this.sb.session?.staff.role === 'owner') {
      const runs = await this.sb.update('backup_runs', { sha256: `eq.${sha256}`, status: 'eq.succeeded' }, { status: 'verified' }).catch(() => []);
      marked = runs.length > 0;
    }
    return { ok: problems.length === 0, problems, created_at: doc.created_at, counts: doc.counts, sha256, marked };
  }

  /** Writes the backup's content tables back (insert or update by primary key). */
  async restore(file: string) {
    this.requireOwner();
    const { doc } = this.read(file);
    const written: Record<string, number> = {};
    const tables = BACKUP_TABLES.filter(([t]) => !RESTORE_SKIP.has(t));
    let i = 0;
    for (const [table] of tables) {
      this.onProgress({ step: table, done: i++, total: tables.length });
      const rows = doc.tables[table] || [];
      for (let k = 0; k < rows.length; k += 500) {
        await this.sb.insert(table, rows.slice(k, k + 500), { onConflict: CONFLICT[table] || 'id', returning: false });
      }
      written[table] = rows.length;
    }
    await this.sb.insert('audit_log', { actor_id: this.sb.session!.user.id, action: 'restore_backup', entity: 'backup_runs', entity_id: null, diff: { file: path.basename(file), created_at: doc.created_at } }, { returning: false }).catch(() => undefined);
    this.onProgress({ step: 'done', done: tables.length, total: tables.length });
    return { created_at: doc.created_at, written };
  }
}
