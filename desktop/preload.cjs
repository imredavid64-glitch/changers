const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("changersDesktop", {
  getConfig: () => ipcRenderer.invoke("changers:get-config"),
  saveConfig: (appUrl) => ipcRenderer.invoke("changers:save-config", appUrl),
  openExternal: (url) => ipcRenderer.invoke("changers:open-external", url),
});
