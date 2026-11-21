/**
 * ============================================================
 * MAIN PROCESS — window, session, every server call, backups
 * ============================================================
 * Same shape as bondhu-fund-desktop: the screen code never talks to the server or the disk itself.
 * It calls `window.electronAPI.call(method, args)`; this process checks the staff role (authorize) and
 * runs the operation from shared/core.ts. The sign-in tokens stay here, encrypted on disk with the
 * operating system's key store (safeStorage).
 * ============================================================
 */
import { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Supa, makeApi, authorize, type SessionStore } from '../shared/core';
import type { Session, AppInfo } from '../shared/types';
import { Backups } from './backup';

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
const APP_NAME = 'Homio Essentials Admin';
app.setName(APP_NAME);

// Software rendering: a forms-and-tables app must never be left without a window by a faulty graphics driver.
if (process.env.HM_ALLOW_GPU !== '1') app.disableHardwareAcceleration();

function startupLog(msg: string) {
  try {
    const f = path.join(app.getPath('userData'), 'startup.log');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    try { if (fs.statSync(f).size > 200_000) fs.writeFileSync(f, ''); } catch { /* new file */ }
    fs.appendFileSync(f, `${new Date().toISOString()}  ${msg}\n`);
  } catch { /* logging must never break startup */ }
}
process.on('uncaughtException', err => {
  startupLog('uncaughtException: ' + (err?.stack || err));
  try { dialog.showErrorBox(APP_NAME, String(err?.stack || err)); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// Server + session (tokens encrypted with the OS key store)
// ---------------------------------------------------------------------------
const SERVER_URL = process.env.HM_SUPABASE_URL_BUILT || process.env.HM_SUPABASE_URL || '';
const SERVER_KEY = process.env.HM_SUPABASE_KEY_BUILT || process.env.HM_SUPABASE_ANON_KEY || '';

const sessionFile = () => path.join(app.getPath('userData'), 'session.bin');
const fileStore: SessionStore = {
  load() {
    try {
      const raw = fs.readFileSync(sessionFile());
      const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : '';
      return text ? (JSON.parse(text) as Session) : null;
    } catch { return null; }
  },
  save(s) {
    try {
      if (!s) { fs.rmSync(sessionFile(), { force: true }); return; }
      // without an OS key store the session is kept in memory only (sign in again next time)
      if (!safeStorage.isEncryptionAvailable()) return;
      fs.mkdirSync(path.dirname(sessionFile()), { recursive: true });
      fs.writeFileSync(sessionFile(), safeStorage.encryptString(JSON.stringify(s)));
    } catch (e) { startupLog('session save failed: ' + e); }
  },
};

let sb: Supa;
let api: ReturnType<typeof makeApi>;
let backups: Backups;

// ---------------------------------------------------------------------------
// Single instance
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(start).catch(err => {
    dialog.showErrorBox(`${APP_NAME} failed to start`, String(err?.stack || err));
    app.exit(1);
  });
}

async function start() {
  startupLog(`start v${app.getVersion()} (${isDev ? 'dev' : 'packaged'})`);
  sb = new Supa(SERVER_URL, SERVER_KEY, fileStore);
  api = makeApi(sb);
  backups = new Backups(sb, path.join(app.getPath('documents'), 'Homio Essentials Backups'),
    p => mainWindow?.webContents.send('backup:progress', p));
  registerIpc();
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]) : null);
  createWindow();
}

// Interface scale (bondhu-fund uses the same): text and controls a touch smaller than Chromium's default.
const UI_SCALE = 0.9765;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#F3F9F8',
    title: APP_NAME,
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });
  const applyScale = () => mainWindow?.webContents.setZoomFactor(UI_SCALE);
  mainWindow.webContents.on('dom-ready', applyScale);
  mainWindow.webContents.on('did-finish-load', applyScale);
  let shown = false;
  const showNow = (why: string) => {
    if (shown || !mainWindow) return;
    shown = true;
    startupLog('window shown (' + why + ')');
    mainWindow.maximize(); mainWindow.show();
  };
  mainWindow.once('ready-to-show', () => showNow('ready-to-show'));
  setTimeout(() => showNow('timeout'), 5000);
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMain) => {
    startupLog(`did-fail-load ${code} ${desc} ${url}`);
    if (!isMain || code === -3) return;
    showNow('load-failed');
    dialog.showErrorBox(APP_NAME, `The application screen could not be loaded.\n\n${desc} (${code})\n${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, d) => {
    startupLog('render-process-gone ' + d.reason);
    dialog.showErrorBox(APP_NAME, `The application screen stopped working (${d.reason}). The app will restart.`);
    app.relaunch(); app.exit(0);
  });

  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Never navigate away or open new windows inside the app; send web links to the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const own = url.split('#')[0] === mainWindow?.webContents.getURL().split('#')[0];
    if (!own) e.preventDefault();
  });
  mainWindow.webContents.on('context-menu', (_e, params) => { void showContextMenu(params); });
  mainWindow.on('closed', () => { mainWindow = null; });
}

/** Right-click menu in fields and on selected text; labels follow the app language. */
async function showContextMenu(params: Electron.ContextMenuParams) {
  const wc = mainWindow?.webContents;
  if (!wc) return;
  const { isEditable, selectionText, editFlags } = params;
  if (!isEditable && !selectionText.trim()) return;
  let bn = false;
  try { bn = (await wc.executeJavaScript('document.documentElement.lang', true)) === 'bn'; } catch { /* English */ }
  const L = (en: string, b: string) => (bn ? b : en);
  const items: Electron.MenuItemConstructorOptions[] = isEditable
    ? [
        { label: L('Undo', 'পূর্বাবস্থা'), role: 'undo', enabled: editFlags.canUndo },
        { label: L('Redo', 'পুনরায় করুন'), role: 'redo', enabled: editFlags.canRedo },
        { type: 'separator' },
        { label: L('Cut', 'কাটুন'), role: 'cut', enabled: editFlags.canCut },
        { label: L('Copy', 'কপি'), role: 'copy', enabled: editFlags.canCopy },
        { label: L('Paste', 'পেস্ট'), role: 'paste', enabled: editFlags.canPaste },
        { type: 'separator' },
        { label: L('Select all', 'সব নির্বাচন'), role: 'selectAll', enabled: editFlags.canSelectAll },
      ]
    : [{ label: L('Copy', 'কপি'), role: 'copy' }, { type: 'separator' }, { label: L('Select all', 'সব নির্বাচন'), role: 'selectAll' }];
  if (mainWindow) Menu.buildFromTemplate(items).popup({ window: mainWindow });
}

app.on('window-all-closed', () => app.quit());

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
type Result<T = any> = { ok: true; data: T } | { ok: false; error: string };
const wrap = async <T>(fn: () => T | Promise<T>): Promise<Result<T>> => {
  try { return { ok: true, data: await fn() }; } catch (e: any) { return { ok: false, error: e?.message || String(e) }; }
};
const requireOwner = () => {
  if (!sb.session) throw new Error('E_SESSION: Please sign in.');
  if (sb.session.staff.role !== 'owner') throw new Error('E_FORBIDDEN: Only owners can do this.');
};

function registerIpc() {
  ipcMain.handle('api:call', (_e, method: string, args: any[]) => wrap(async () => {
    const fn = (api as any)[method];
    if (typeof fn !== 'function') throw new Error(`Unknown operation: ${method}`);
    authorize(sb, method);
    const out = await fn(...(Array.isArray(args) ? args : []));
    // an owner's first sign-in of the day starts the daily backup in the background
    if (method === 'signIn' || method === 'getSession') setTimeout(() => { backups.dailyIfDue().then(r => { if (r) mainWindow?.webContents.send('backup:done', r); }, e => startupLog('daily backup failed: ' + e)); }, 4000);
    return out;
  }));

  ipcMain.handle('app:info', () => wrap<AppInfo>(() => ({
    version: app.getVersion(), electron: process.versions.electron, backupsDir: backups.dir, serverUrl: SERVER_URL, platform: process.platform,
  })));

  ipcMain.handle('backup:list', () => wrap(() => { if (!sb.session) throw new Error('E_SESSION: Please sign in.'); return backups.listLocal(); }));
  ipcMain.handle('backup:run', () => wrap(() => backups.run('manual')));
  ipcMain.handle('backup:open-folder', () => wrap(async () => { backups.ensureDir(); await shell.openPath(backups.dir); return true; }));
  ipcMain.handle('backup:pick', () => wrap(async () => {
    if (!sb.session) throw new Error('E_SESSION: Please sign in.');
    const r = await dialog.showOpenDialog(mainWindow!, { title: 'Choose a backup', defaultPath: backups.dir, properties: ['openFile'], filters: [{ name: 'Homio backup', extensions: ['gz'] }] });
    return r.canceled ? null : r.filePaths[0];
  }));
  ipcMain.handle('backup:verify', (_e, file: string) => wrap(() => { if (!sb.session) throw new Error('E_SESSION: Please sign in.'); return backups.verify(String(file)); }));
  ipcMain.handle('backup:restore', (_e, file: string) => wrap(() => { requireOwner(); return backups.restore(String(file)); }));
  ipcMain.handle('backup:reveal', (_e, file: string) => wrap(() => { shell.showItemInFolder(String(file)); return true; }));

  ipcMain.handle('shell:open', (_e, url: string) => wrap(async () => {
    if (!/^(https?:|mailto:|tel:)/i.test(String(url))) throw new Error('E_INPUT: Only web, email and phone links can be opened.');
    await shell.openExternal(String(url));
    return true;
  }));
}
