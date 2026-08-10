const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const PRODUCTION_URL = "https://changers-three.vercel.app";
const DEV_URL = "http://127.0.0.1:3000";

let mainWindow = null;

function configPath() {
  return path.join(app.getPath("userData"), "changers-desktop.json");
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
  if (process.env.CHANGERS_DESKTOP_URL) {
    return process.env.CHANGERS_DESKTOP_URL;
  }

  if (!app.isPackaged) {
    // Development: load the local Next.js dev server.
    return DEV_URL;
  }

  // Packaged: the saved URL if the user set one, otherwise production.
  return readConfig().appUrl || PRODUCTION_URL;
}

async function loadChangersWindow(window) {
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
    title: "Changers",
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
    if (!url.startsWith(DEV_URL) && !url.startsWith("https://")) {
      event.preventDefault();
    }
  });

  loadChangersWindow(mainWindow);
}

ipcMain.handle("changers:get-config", async () => {
  return {
    appUrl: readConfig().appUrl || "",
  };
});

ipcMain.handle("changers:save-config", async (_event, appUrl) => {
  const parsed = new URL(appUrl);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Changers desktop needs an http or https URL.");
  }

  writeConfig({ appUrl: parsed.toString() });

  if (mainWindow) {
    await mainWindow.loadURL(parsed.toString());
  }

  return { ok: true };
});

ipcMain.handle("changers:open-external", async (_event, url) => {
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
