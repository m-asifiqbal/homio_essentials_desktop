import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  call: (method: string, args: unknown[]) => ipcRenderer.invoke('api:call', method, args),
  appInfo: () => ipcRenderer.invoke('app:info'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
  backupList: () => ipcRenderer.invoke('backup:list'),
  backupRun: () => ipcRenderer.invoke('backup:run'),
  backupOpenFolder: () => ipcRenderer.invoke('backup:open-folder'),
  backupPick: () => ipcRenderer.invoke('backup:pick'),
  backupVerify: (file: string) => ipcRenderer.invoke('backup:verify', file),
  backupRestore: (file: string) => ipcRenderer.invoke('backup:restore', file),
  backupReveal: (file: string) => ipcRenderer.invoke('backup:reveal', file),
  /** live progress of a backup or restore */
  onBackupProgress: (cb: (p: unknown) => void) => { const h = (_e: unknown, p: unknown) => cb(p); ipcRenderer.on('backup:progress', h); return () => { ipcRenderer.removeListener('backup:progress', h); }; },
  /** the daily automatic backup finished */
  onBackupDone: (cb: (r: unknown) => void) => { const h = (_e: unknown, r: unknown) => cb(r); ipcRenderer.on('backup:done', h); return () => { ipcRenderer.removeListener('backup:done', h); }; },
});
