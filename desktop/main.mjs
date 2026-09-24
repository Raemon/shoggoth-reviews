import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_HEADER, startServer } from './server.mjs';

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const DEV = process.env.REPOSCOPE_DEV === '1';
const WINDOW_SIZE = { width: 1440, height: 900 };
const APP_WINDOW = { ...WINDOW_SIZE, title: 'reposcope', webPreferences: { preload: join(APP_DIR, 'desktop', 'preload.cjs') } };
// No scripts: an SVG opened as a blob: URL would otherwise run with this app's origin.
const IMAGE_WINDOW = { ...WINDOW_SIZE, webPreferences: { javascript: false } };
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

// The launcher adds `--` so Chromium never parses the user's git arguments as switches.
function launchArgs(argv) {
  const split = argv.indexOf('--');
  return split === -1 ? [] : argv.slice(split + 1);
}

async function startUp() {
  if (!DEV && !existsSync(join(APP_DIR, '.next', 'BUILD_ID'))) {
    throw new Error('There is no production build yet. Run `npm run build`, or start with `reposcope --dev`.');
  }
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

function signRequests(origin, secret) {
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${origin}/*`] }, ({ requestHeaders }, callback) => {
    callback({ requestHeaders: { ...requestHeaders, [SECRET_HEADER]: secret } });
  });
}

// Server redirects skip will-navigate, so both events keep other sites out of app windows.
function guardNavigation(origin) {
  const keepInApp = (event) => {
    if (isOwn(origin, event.url)) return;
    event.preventDefault();
    openExternally(event.url);
  };
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => windowRequest(origin, url));
    contents.on('will-navigate', keepInApp);
    contents.on('will-redirect', keepInApp);
  });
}

function windowRequest(origin, url) {
  if (isOwn(origin, url)) return { action: 'allow', outlivesOpener: true, overrideBrowserWindowOptions: APP_WINDOW };
  if (url.startsWith(`blob:${origin}/`)) return { action: 'allow', overrideBrowserWindowOptions: IMAGE_WINDOW };
  openExternally(url);
  return { action: 'deny' };
}

function isOwn(origin, url) {
  return url.startsWith(`${origin}/`);
}

function openExternally(url) {
  if (/^https?:\/\//.test(url)) void shell.openExternal(url);
}

function openLaunch(origin, { cwd, args }) {
  const params = [['cwd', cwd], ...args.map((arg) => ['arg', arg])];
  openWindow(`${origin}/launch?${new URLSearchParams(params)}`);
}

function openWindow(url) {
  const window = new BrowserWindow({ ...APP_WINDOW, show: false });
  window.maximize();
  window.show();
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
  const mac = process.platform === 'darwin' ? [{ role: 'appMenu' }] : [];
  const menus = [fileMenu(origin), { role: 'editMenu' }, { role: 'viewMenu' }, goMenu(), { role: 'windowMenu' }];
  return Menu.buildFromTemplate([...mac, ...menus]);
}

function fileMenu(origin) {
  const submenu = [
    { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => openWindow(`${origin}/`) },
    { label: 'Open Repository…', accelerator: 'CmdOrCtrl+O', click: () => void openRepository(origin) },
    { type: 'separator' },
    { role: 'close' },
  ];
  return { label: 'File', submenu };
}

function goMenu() {
  const history = () => BrowserWindow.getFocusedWindow()?.webContents.navigationHistory;
  const submenu = [
    { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => history()?.goBack() },
    { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => history()?.goForward() },
  ];
  return { label: 'Go', submenu };
}
