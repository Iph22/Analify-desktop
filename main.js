// Analify for Windows and Mac (beta): the Analify dashboard in its own window.
// It loads https://analify.dev, keeps you signed in, opens other links in your browser, and remembers its size.
const { app, BrowserWindow, Menu, shell, nativeTheme } = require("electron");
const fs = require("fs");
const path = require("path");

const HOME = process.env.ANALIFY_URL || "https://analify.dev/";
const ORIGIN = new URL(HOME).origin;
const STATE_FILE = () => path.join(app.getPath("userData"), "window.json");

// Only one window: opening Analify again brings the existing one forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE(), "utf8"));
  } catch {
    return { width: 1280, height: 860 };
  }
}

function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    fs.writeFileSync(STATE_FILE(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch {
    /* not important */
  }
}

/** Analify's own pages stay in the window; everything else opens in the browser. */
function isAnalify(url) {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
}

function createWindow() {
  const state = loadState();
  win = new BrowserWindow({
    x: state.x, y: state.y, width: state.width || 1280, height: state.height || 860,
    minWidth: 380, minHeight: 560,
    title: "Analify",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#050a1a" : "#ffffff",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  if (state.maximized) win.maximize();

  // Lets the dashboard know it's the desktop app (for example, to hide Google sign-in, which Google
  // doesn't allow inside apps; the email code works instead).
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} AnalifyDesktop/${app.getVersion()}`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAnalify(url)) shell.openExternal(url);
    else win.loadURL(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAnalify(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3: navigation replaced, not an error
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlinePage(url))}`);
  });

  win.once("ready-to-show", () => win.show());
  win.on("close", saveState);
  win.loadURL(HOME);
}

function offlinePage(url) {
  return `<!doctype html><meta name="viewport" content="width=device-width">
  <body style="margin:0;font-family:system-ui,sans-serif;background:#050a1a;color:#e8eefc;display:grid;place-items:center;height:100vh;text-align:center">
  <div><h1 style="font-size:22px">Can't reach Analify</h1>
  <p style="color:#9fb0d0">Check your internet connection, then try again.</p>
  <button onclick="location.href='${url.replace(/'/g, "")}'" style="margin-top:12px;padding:10px 18px;border:0;border-radius:999px;background:#2b8cff;color:#fff;font-size:15px;cursor:pointer">Try again</button></div>`;
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Home", accelerator: "CmdOrCtrl+Shift+H", click: () => win && win.loadURL(HOME) },
        { role: "reload" }, { role: "forceReload" }, { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Documentation", click: () => shell.openExternal(`${ORIGIN}/docs`) },
        { label: "Send feedback", click: () => shell.openExternal(`${ORIGIN}/contact`) },
        { type: "separator" },
        { label: `Analify ${app.getVersion()} (beta)`, enabled: false },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
