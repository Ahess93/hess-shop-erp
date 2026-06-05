// Preload script runs in a privileged context before the web page loads.
// Expose only what the renderer needs — never expose the full Node API.
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
