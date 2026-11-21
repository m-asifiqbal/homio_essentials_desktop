/**
 * ============================================================
 * SERVICE LAYER — the only way screens reach the server
 * ============================================================
 * Inside Electron every call goes to the main process (`electronAPI.call`), like bondhu-fund's services/db.ts.
 * In a plain browser (`npm run dev`, for previewing screens) the same API core runs here instead, or — with
 * `#demo` in the address, or without config/supabase.json — a demo store with sample data that never writes anywhere.
 * ============================================================
 */
import { Supa, makeApi, authorize, type Api, type ApiMethod } from '@shared/core';
import type { AppInfo, BackupRun, LocalBackupFile, Session } from '@shared/types';
import { demoCall } from './demo';

declare const __SB_URL__: string;
declare const __SB_KEY__: string;

interface ElectronAPI {
  isElectron: true;
  call(method: string, args: unknown[]): Promise<Res>;
  appInfo(): Promise<Res>;
  openExternal(url: string): Promise<Res>;
  backupList(): Promise<Res>;
  backupRun(): Promise<Res>;
  backupOpenFolder(): Promise<Res>;
  backupPick(): Promise<Res>;
  backupVerify(file: string): Promise<Res>;
  backupRestore(file: string): Promise<Res>;
  backupReveal(file: string): Promise<Res>;
  onBackupProgress(cb: (p: BackupProgress) => void): () => void;
  onBackupDone(cb: (r: BackupRun) => void): () => void;
}
type Res = { ok: true; data: any } | { ok: false; error: string };
export interface BackupProgress { step: string; done: number; total: number }

declare global { interface Window { electronAPI?: ElectronAPI } }

const el = typeof window !== 'undefined' ? window.electronAPI : undefined;
export const isElectron = !!el?.isElectron;
export const isDemo = !isElectron && (typeof location !== 'undefined' && (location.hash.includes('demo') || !__SB_KEY__));

const unwrap = (r: Res) => { if (!r || !r.ok) throw new Error((r as any)?.error || 'E_SERVER: No answer'); return r.data; };

// ---- browser preview: the API core with the session in sessionStorage ----
let web: { sb: Supa; api: Api } | null = null;
function webApi() {
  if (!web) {
    const store = {
      load: (): Session | null => { try { return JSON.parse(sessionStorage.getItem('homio_session') || 'null'); } catch { return null; } },
      save: (s: Session | null) => { try { s ? sessionStorage.setItem('homio_session', JSON.stringify(s)) : sessionStorage.removeItem('homio_session'); } catch { /* ignore */ } },
    };
    const sb = new Supa(__SB_URL__, __SB_KEY__, store);
    web = { sb, api: makeApi(sb) };
  }
  return web;
}

export async function call<M extends ApiMethod>(method: M, ...args: Parameters<Api[M]>): Promise<Awaited<ReturnType<Api[M]>>> {
  if (isElectron) return unwrap(await el!.call(method, args));
  if (isDemo) return demoCall(method, args) as any;
  const w = webApi();
  authorize(w.sb, method);
  return (w.api[method] as any)(...args);
}

const desktopOnly = () => { throw new Error('E_DESKTOP: This works in the desktop app only.'); };

export const appInfo = async (): Promise<AppInfo> =>
  isElectron ? unwrap(await el!.appInfo()) : { version: '1.0.0', electron: '-', backupsDir: 'Documents\\Homio Essentials Backups', serverUrl: __SB_URL__ || 'demo', platform: 'web' };
export const openExternal = async (url: string) => { if (isElectron) unwrap(await el!.openExternal(url)); else window.open(url, '_blank', 'noopener'); };

export const backups = {
  list: async (): Promise<LocalBackupFile[]> => (isElectron ? unwrap(await el!.backupList()) : isDemo ? (demoCall('__localBackups' as any, []) as any) : []),
  run: async (): Promise<BackupRun> => (isElectron ? unwrap(await el!.backupRun()) : isDemo ? (demoCall('__runBackup' as any, []) as any) : desktopOnly()),
  openFolder: async () => (isElectron ? unwrap(await el!.backupOpenFolder()) : desktopOnly()),
  pick: async (): Promise<string | null> => (isElectron ? unwrap(await el!.backupPick()) : desktopOnly()),
  verify: async (file: string) => (isElectron ? unwrap(await el!.backupVerify(file)) : desktopOnly()),
  restore: async (file: string) => (isElectron ? unwrap(await el!.backupRestore(file)) : desktopOnly()),
  reveal: async (file: string) => (isElectron ? unwrap(await el!.backupReveal(file)) : desktopOnly()),
  onProgress: (cb: (p: BackupProgress) => void) => (isElectron ? el!.onBackupProgress(cb) : () => undefined),
  onDone: (cb: (r: BackupRun) => void) => (isElectron ? el!.onBackupDone(cb) : () => undefined),
};

/** Public URL of an object in a public bucket (promotions, remedy-media). */
export const publicUrl = (bucket: string, path: string) =>
  !path ? '' : /^(https?:|data:|blob:)/.test(path) ? path : `${__SB_URL__ || 'https://snpdariolegcdmdxyhlo.supabase.co'}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

/** Splits "E_CODE: message" into its parts. */
export function parseError(e: unknown): { code: string; message: string } {
  const raw = String((e as any)?.message ?? e ?? '');
  const m = /^(E_[A-Z_]+):\s*([\s\S]*)$/.exec(raw);
  return m ? { code: m[1], message: m[2] } : { code: 'E_UNKNOWN', message: raw };
}
