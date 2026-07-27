const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow = null;

function configPath() {
  return path.join(app.getPath("userData"), "bridge-desktop.json");
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8");
}

function resolveAppUrl() {
  if (process.env.BRIDGE_DESKTOP_URL) {
    return process.env.BRIDGE_DESKTOP_URL;
  }

  if (!app.isPackaged) {
    return "http://127.0.0.1:3000";
  }

  return readConfig().appUrl;
}

async function loadBridgeWindow(window) {
  const appUrl = resolveAppUrl();

  if (appUrl) {
    try {
      await window.loadURL(appUrl);
      return;
    } catch {
      await window.loadFile(path.join(__dirname, "setup.html"));
      return;
    }
  }

  await window.loadFile(path.join(__dirname, "setup.html"));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#f4efe6",
    title: "Bridge",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("http://127.0.0.1:3000") && !url.startsWith("https://")) {
      event.preventDefault();
    }
  });

  loadBridgeWindow(mainWindow);
}

ipcMain.handle("bridge:get-config", async () => {
  return {
    appUrl: readConfig().appUrl || "",
  };
});

ipcMain.handle("bridge:save-config", async (_event, appUrl) => {
  const parsed = new URL(appUrl);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Bridge desktop needs an http or https URL.");
  }

  writeConfig({ appUrl: parsed.toString() });

  if (mainWindow) {
    await mainWindow.loadURL(parsed.toString());
  }

  return { ok: true };
});

ipcMain.handle("bridge:open-external", async (_event, url) => {
  await shell.openExternal(url);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
