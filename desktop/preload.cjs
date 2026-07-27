const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bridgeDesktop", {
  getConfig: () => ipcRenderer.invoke("bridge:get-config"),
  saveConfig: (appUrl) => ipcRenderer.invoke("bridge:save-config", appUrl),
  openExternal: (url) => ipcRenderer.invoke("bridge:open-external", url),
});
