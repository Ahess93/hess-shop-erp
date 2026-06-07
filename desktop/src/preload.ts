/**
 * Preload script — runs in the renderer context but has access to Node APIs.
 * Exposes a safe, narrow API surface to the web app via contextBridge.
 */
import { contextBridge, ipcRenderer } from 'electron';

/** API exposed to the renderer under window.electronAPI */
const electronAPI = {
  /** Open a native folder-picker dialog; returns the selected path or null. */
  openFolderDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder') as Promise<string | null>,

  /** Get the installed app version string (e.g. "1.0.0"). */
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion') as Promise<string>,

  /** Trigger a manual update check. */
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('app:checkForUpdates') as Promise<void>,

  /** Subscribe to update-available event from the main process. */
  onUpdateAvailable: (callback: (info: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info);
    ipcRenderer.on('updater:update-available', handler);
    return () => ipcRenderer.removeListener('updater:update-available', handler);
  },

  /** Subscribe to update-downloaded event from the main process. */
  onUpdateDownloaded: (callback: (info: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info);
    ipcRenderer.on('updater:update-downloaded', handler);
    return () => ipcRenderer.removeListener('updater:update-downloaded', handler);
  },

  /** True when running inside Electron (false in the browser). */
  isElectron: true as const,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

/** TypeScript declaration for consumers in the web workspace */
export type ElectronAPI = typeof electronAPI;
