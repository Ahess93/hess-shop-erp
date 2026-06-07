/**
 * Hess Solutions Shop ERP — Electron Main Process
 *
 * Responsibilities:
 *  1. Spawn (or connect to) the NestJS backend server
 *  2. Create the main BrowserWindow pointing at the server
 *  3. System tray — app stays running when the window is closed
 *  4. Auto-updater (electron-updater)
 *  5. IPC handlers for desktop-only operations (open file dialog, etc.)
 *  6. First-run: if the server returns a setup-needed flag, open /setup
 *  7. Auto-start with Windows (registry) — toggled via tray menu
 */

import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import { ServerManager, SERVER_PORT } from './server-manager';

// ─── Logging ────────────────────────────────────────────────────────────────

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
autoUpdater.logger = log;

// ─── Globals ────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const serverManager = new ServerManager();
const isDev = process.env['NODE_ENV'] !== 'production';
const APP_URL = `http://localhost:${SERVER_PORT}`;

// ─── Window ─────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false, // show after page loads to avoid white flash
    title: 'Hess Solutions — Shop ERP',
    icon: getAppIcon(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Only allow localhost in production
      webSecurity: !isDev,
    },
  });

  // Show window once it's ready to avoid white flash
  win.once('ready-to-show', () => {
    win.show();
    if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  });

  // Hide to tray instead of quitting on close
  win.on('close', (e) => {
    if (tray) {
      e.preventDefault();
      win.hide();
    }
  });

  void win.loadURL(APP_URL);
  return win;
}

// ─── Tray ────────────────────────────────────────────────────────────────────

function createTray(): Tray {
  const t = new Tray(getAppIcon());
  t.setToolTip('Hess Solutions Shop ERP');
  rebuildTrayMenu(t);

  t.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return t;
}

function rebuildTrayMenu(t: Tray): void {
  const autoLaunchEnabled = isAutoLaunchEnabled();

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Shop ERP',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Open in Browser',
      click: () => void shell.openExternal(APP_URL),
    },
    { type: 'separator' },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoLaunchEnabled,
      click: () => {
        toggleAutoLaunch(!autoLaunchEnabled);
        rebuildTrayMenu(t);
      },
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => void autoUpdater.checkForUpdatesAndNotify(),
    },
    { type: 'separator' },
    {
      label: 'Quit Shop ERP',
      click: () => {
        // Actually quit — remove the close listener
        mainWindow?.removeAllListeners('close');
        app.quit();
      },
    },
  ]);

  t.setContextMenu(menu);
}

// ─── Auto-launch helpers (Windows registry) ─────────────────────────────────

function isAutoLaunchEnabled(): boolean {
  if (process.platform !== 'win32') return false;
  try {
    // Use app.getLoginItemSettings() which works cross-platform in Electron
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}

function toggleAutoLaunch(enable: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: app.getPath('exe'),
    });
    log.info(`Auto-launch ${enable ? 'enabled' : 'disabled'}`);
  } catch (err) {
    log.warn(`Could not toggle auto-launch: ${String(err)}`);
  }
}

// ─── Icon helper ────────────────────────────────────────────────────────────

function getAppIcon(): Electron.NativeImage {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  // Fallback: empty image (no icon, but no crash)
  return nativeImage.createEmpty();
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  /** Let the renderer open a folder-picker dialog */
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Backup Folder',
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  /** Get the app version */
  ipcMain.handle('app:getVersion', () => app.getVersion());

  /** Check for updates manually */
  ipcMain.handle('app:checkForUpdates', () => autoUpdater.checkForUpdatesAndNotify());
}

// ─── Auto-updater events ─────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    mainWindow?.webContents.send('updater:update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    mainWindow?.webContents.send('updater:update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
  });
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

void app.whenReady().then(async () => {
  log.info(
    `Hess ERP starting — Electron ${process.versions['electron'] ?? 'unknown'}, Node ${process.version}`,
  );

  // Wire IPC before creating the window
  registerIpcHandlers();
  setupAutoUpdater();

  // Start the backend server
  try {
    const resourcesPath = process.resourcesPath ?? path.join(__dirname, '..', '..');
    await serverManager.start(resourcesPath);
  } catch (err) {
    log.error('Failed to start server:', err);
    dialog.showErrorBox(
      'Startup Error',
      `The Shop ERP server failed to start.\n\n${String(err)}\n\nPlease check the log file and try again.`,
    );
    app.quit();
    return;
  }

  // Create tray first so the app doesn't quit if window is hidden
  tray = createTray();
  mainWindow = createWindow();

  // Check for updates after a short delay (don't block startup)
  if (!isDev) {
    setTimeout(() => void autoUpdater.checkForUpdatesAndNotify(), 10_000);
  }

  app.on('activate', () => {
    // macOS: re-open window when clicking dock icon
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  // On Windows/Linux, keep running in the tray — don't quit
  // macOS: standard behavior (quit when no windows)
  if (process.platform === 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('App quitting — stopping server…');
  serverManager.stop();
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log.warn('Another instance is already running — quitting');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the existing window when user tries to open a second instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
