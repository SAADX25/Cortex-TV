/* ─────────────────────────────────────────────────
   electron/preload.ts – Runs in a sandboxed context
   before the renderer page loads. Exposes safe APIs
   to the renderer via contextBridge.
   ───────────────────────────────────────────────── */

import { contextBridge, ipcRenderer } from "electron";

// Expose a minimal, safe API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  /** Send a one-way message to the main process */
  send: (channel: string, ...args: unknown[]) => {
    const allowedChannels = ["select-country", "app-ready"];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  /** Invoke an async handler in main and await the result */
  invoke: (channel: string, ...args: unknown[]) => {
    const allowedChannels = ["get-channels"];
    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel "${channel}" not allowed`));
  },

  /** Listen for messages from the main process */
  on: (
    channel: string,
    callback: (...args: unknown[]) => void
  ) => {
    const allowedChannels = ["country-selected", "channels-loaded"];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
});
