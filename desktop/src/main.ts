import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const SERVER_PORT = 3001;
const WEB_PORT = 5173;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Hess Solutions — Shop ERP',
  });

  // In development, load the Vite dev server
  // In production, load the built web app served by the backend
  const isDev = process.env['NODE_ENV'] !== 'production';
  const url = isDev
    ? `http://localhost:${WEB_PORT}`
    : `http://localhost:${SERVER_PORT}`;

  void win.loadURL(url);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
