import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_HEADER, startServer } from './server.mjs';

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PRELOAD = join(APP_DIR, 'desktop', 'preload.cjs');
const DEV = process.env.REPOSCOPE_DEV === '1';
const BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];
const WINDOW_SIZE = { width: 1440, height: 900 };
const launch = { cwd: process.cwd(), args: launchArgs(process.argv) };

app.setName('reposcope');

if (app.requestSingleInstanceLock(launch)) {
  const ready = app.whenReady().then(startUp);
  ready.then((origin) => openLaunch(origin, launch), failStartUp);
  app.on('second-instance', (_event, _argv, _cwd, request) => void ready.then((origin) => openLaunch(origin, request)));
  app.on('window-all-closed', () => app.quit());
} else {
  app.quit();
}

// bin/reposcope.mjs puts `--` before the user's arguments so Chromium never parses them as switches.
function launchArgs(argv) {
  const split = argv.indexOf('--');
  return split === -1 ? [] : argv.slice(split + 1);
}

async function startUp() {
  if (!DEV && !existsSync(join(APP_DIR, '.next', 'BUILD_ID'))) {
    throw new Error('There is no production build yet. Run `npm run build`, or start with `reposcope --dev`.');
  }
  extendPath();
  const secret = randomBytes(32).toString('hex');
  const origin = await startServer({ dir: APP_DIR, dev: DEV, secret });
  signRequests(origin, secret);
  guardNavigation(origin);
  ipcMain.handle('choose-repository', (event) => chooseDirectory(BrowserWindow.fromWebContents(event.sender)));
  Menu.setApplicationMenu(appMenu(origin));
  return origin;
}

function failStartUp(error) {
  dialog.showErrorBox('reposcope could not start', error instanceof Error ? error.message : String(error));
  app.quit();
}

// Apps opened from the Finder get a minimal PATH, without Homebrew's git or gh.
function extendPath() {
  const known = (process.env.PATH ?? '').split(delimiter);
  process.env.PATH = [...known, ...BIN_DIRS.filter((dir) => !known.includes(dir))].join(delimiter);
}

function signRequests(origin, secret) {
  const own = [`${origin}/`, `${origin.replace(/^http/, 'ws')}/`];
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const signed = own.some((prefix) => details.url.startsWith(prefix));
    callback({ requestHeaders: signed ? { ...details.requestHeaders, [SECRET_HEADER]: secret } : details.requestHeaders });
  });
}

function guardNavigation(origin) {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => windowRequest(origin, url));
    contents.on('will-navigate', (event, url) => {
      if (isOwn(origin, url)) return;
      event.preventDefault();
      openExternally(url);
    });
  });
}

function windowRequest(origin, url) {
  if (isOwn(origin, url) || url.startsWith(`blob:${origin}/`)) {
    return { action: 'allow', overrideBrowserWindowOptions: { ...WINDOW_SIZE, webPreferences: { preload: PRELOAD } } };
  }
  openExternally(url);
  return { action: 'deny' };
}

function isOwn(origin, url) {
  return url === origin || url.startsWith(`${origin}/`);
}

function openExternally(url) {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url);
}

function openLaunch(origin, { cwd, args }) {
  openWindow(`${origin}/launch?${new URLSearchParams([['cwd', cwd], ...args.map((arg) => ['arg', arg])])}`);
}

function openWindow(url) {
  const window = new BrowserWindow({ ...WINDOW_SIZE, title: 'reposcope', webPreferences: { preload: PRELOAD } });
  void window.loadURL(url);
}

async function chooseDirectory(parent) {
  const options = { title: 'Open repository', buttonLabel: 'Open', properties: ['openDirectory'] };
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

async function openRepository(origin) {
  const repo = await chooseDirectory(BrowserWindow.getFocusedWindow());
  if (repo) openWindow(`${origin}/local?${new URLSearchParams({ repo })}`);
}

function appMenu(origin) {
  const history = (step) => BrowserWindow.getFocusedWindow()?.webContents.navigationHistory[step]();
  const file = [
    { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => openWindow(`${origin}/`) },
    { label: 'Open Repository…', accelerator: 'CmdOrCtrl+O', click: () => void openRepository(origin) },
    { type: 'separator' },
    { role: 'close' },
  ];
  const go = [
    { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => history('goBack') },
    { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => history('goForward') },
  ];
  const mac = process.platform === 'darwin' ? [{ role: 'appMenu' }] : [];
  const menus = [{ label: 'File', submenu: file }, { role: 'editMenu' }, { role: 'viewMenu' }, { label: 'Go', submenu: go }];
  return Menu.buildFromTemplate([...mac, ...menus, { role: 'windowMenu' }]);
}
