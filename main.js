// Analify for Windows and Mac (beta). Loads https://analify.dev in a native-feeling window, and adds what only an
// app can: a menu bar / tray icon with who's on your sites right now, native notifications while the window is
// closed, an unread badge, start at login, and updates (automatic on Windows; a prompt on Mac, where automatic
// updates need a signed app).
//
// Because the dashboard itself is loaded live from analify.dev, every dashboard feature and fix reaches the app the
// moment it's deployed. Only changes to this file (the window, tray, menus) need a new version of the app.
const { app, BrowserWindow, Menu, Notification, Tray, dialog, nativeImage, nativeTheme, shell, ipcMain, net } = require("electron");
const fs = require("fs");
const path = require("path");

const HOME = process.env.ANALIFY_URL || "https://analify.dev/";
const ORIGIN = new URL(HOME).origin;
const RELEASES_API = "https://api.github.com/repos/Iph22/Analify-desktop/releases/latest";
const DOWNLOAD_PAGE = "https://analify.dev/download";
// The Mac download for this Mac's processor (Apple silicon or Intel), always the newest release.
const MAC_DOWNLOAD = `https://github.com/Iph22/Analify-desktop/releases/latest/download/Analify-mac-${process.arch === "arm64" ? "arm64" : "x64"}.dmg`;
const isMac = process.platform === "darwin";

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// analify:// links come back to the app (Google sign-in finishes in the browser, then hands over here).
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("analify", process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient("analify");
}
let pendingLink = process.argv.find((a) => a.startsWith("analify://")) || null;

let win = null;
let tray = null;
let quitting = false;
let trayData = { total: 0, sites: [] };
let newVersion = null;
let toldAboutTray = false;
let pendingAnnouncement = null;  // "updated to ..." waits until the window is on screen
let readyVersion = null;  // a downloaded update waiting for a restart (also offered in the tray menu)

// ---- settings kept between launches ----
const SETTINGS_FILE = () => path.join(app.getPath("userData"), "settings.json");
function settings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE(), "utf8")); } catch { return {}; }
}
function saveSettings(change) {
  try { fs.writeFileSync(SETTINGS_FILE(), JSON.stringify({ ...settings(), ...change })); } catch { /* not important */ }
}

function isAnalify(url) {
  try { return new URL(url).origin === ORIGIN; } catch { return false; }
}

function iconImage(size) {
  return nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")).resize({ width: size, height: size });
}

// ---- the window ----
function createWindow() {
  const s = settings();
  const dark = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    x: s.x, y: s.y, width: s.width || 1280, height: s.height || 860,
    minWidth: 380, minHeight: 560,
    title: "Analify",
    icon: iconImage(256),
    backgroundColor: dark ? "#050a1a" : "#f6f8fc",
    show: false,
    // The top bar of the dashboard becomes the title bar: traffic lights inset on Mac, overlay buttons on Windows.
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 18, y: 20 },
    titleBarOverlay: isMac ? undefined : { color: "#00000000", symbolColor: dark ? "#e8eefc" : "#1b2440", height: 56 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true,
      additionalArguments: [`--analify-version=${app.getVersion()}`],
    },
  });
  if (s.maximized) win.maximize();

  // Tells the dashboard it's the desktop app (app layout, no Google sign-in, which Google blocks in app windows).
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} AnalifyDesktop/${app.getVersion()}`);

  // New windows (target=_blank, "Open in browser") go to the browser; the app stays one window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAnalify(url)) { event.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlinePage(url))}`);
  });

  win.once("ready-to-show", () => {
    if (!process.argv.includes("--hidden")) win.show();
    if (pendingAnnouncement) {
      const message = pendingAnnouncement;
      pendingAnnouncement = null;
      setTimeout(() => showOnWindow(message), 800);
    }
  });
  win.on("close", (event) => {
    saveSettings({ ...win.getNormalBounds(), maximized: win.isMaximized() });
    // Closing the window keeps Analify running in the menu bar / tray, so alerts still arrive.
    if (!quitting && tray) {
      event.preventDefault();
      win.hide();
      if (!isMac && !toldAboutTray && Notification.isSupported()) {
        toldAboutTray = true;
        new Notification({ title: "Analify is still running", body: "It's in the tray by the clock, so alerts still reach you. Right-click it to quit." }).show();
      }
    }
  });
  win.on("focus", () => { if (!isMac) win.flashFrame(false); });
  win.loadURL(HOME);
}

function showWindow(pathname) {
  if (!win) createWindow();
  if (pathname) win.webContents.send("navigate", pathname);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function offlinePage(url) {
  return `<!doctype html><meta name="viewport" content="width=device-width">
  <body style="margin:0;font-family:system-ui,sans-serif;background:#050a1a;color:#e8eefc;display:grid;place-items:center;height:100vh;text-align:center;-webkit-app-region:drag">
  <div><h1 style="font-size:22px">Can't reach Analify</h1>
  <p style="color:#9fb0d0">Check your internet connection, then try again.</p>
  <button onclick="location.href='${url.replace(/'/g, "")}'" style="-webkit-app-region:no-drag;margin-top:12px;padding:10px 18px;border:0;border-radius:999px;background:#2b8cff;color:#fff;font-size:15px;cursor:pointer">Try again</button></div>`;
}

// ---- menu bar / tray ----
function createTray() {
  tray = new Tray(iconImage(isMac ? 18 : 16));
  tray.setToolTip("Analify");
  tray.on("click", () => (isMac ? tray.popUpContextMenu() : showWindow()));
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const { total, sites } = trayData;
  if (isMac) tray.setTitle(total ? ` ${total}` : "");
  tray.setToolTip(total ? `Analify: ${total} ${total === 1 ? "person" : "people"} on your sites now` : "Analify");
  const login = app.getLoginItemSettings().openAtLogin;
  const template = [
    { label: total ? `${total} ${total === 1 ? "person" : "people"} on your sites right now` : "Nobody on your sites right now", enabled: false },
    ...(sites.length ? [{ type: "separator" }] : []),
    ...sites.map((s) => ({
      label: `${s.name}${s.online ? `  ·  ${s.online} online` : ""}`,
      click: () => showWindow(`/sites/${s.id}${s.online ? "/live" : ""}`),
    })),
    { type: "separator" },
    { label: "Open Analify", click: () => showWindow() },
    { label: "Start Analify when I log in", type: "checkbox", checked: login,
      click: (item) => { app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--hidden"] }); updateTray(); } },
    ...(readyVersion ? [{ label: `Restart to update to ${readyVersion}`, click: () => {
      quitting = true; require("electron-updater").autoUpdater.quitAndInstall(false, true);
    } }] : []),
    ...(newVersion ? [{ label: `Download Analify ${newVersion}`, click: () => shell.openExternal(isMac ? MAC_DOWNLOAD : DOWNLOAD_PAGE) }] : []),
    { label: "Check for updates…", click: () => checkForUpdates(true) },
    { type: "separator" },
    { label: `Analify ${app.getVersion()} (beta)`, enabled: false },
    { label: "Quit Analify", click: () => { quitting = true; app.quit(); } },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ---- what the dashboard asks for (preload.js) ----
ipcMain.on("tray", (_e, data) => {
  if (!data || !Array.isArray(data.sites)) return;
  trayData = {
    total: Number(data.total) || 0,
    sites: data.sites.slice(0, 10).map((s) => ({ id: String(s.id), name: String(s.name).slice(0, 60), online: Number(s.online) || 0 })),
  };
  updateTray();
});
/** Windows: a red dot drawn over the taskbar icon (Windows has no number badges for desktop apps). */
let dot = null;
function badgeDot() {
  if (dot) return dot;
  const size = 16, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5), i = (y * size + x) * 4;
      const a = d <= 6.5 ? 255 : d <= 7.5 ? Math.round(255 * (7.5 - d)) : 0;  // soft edge
      const ring = d > 5.5 && d <= 7.5;  // a white ring so the dot stands out on any icon
      buf[i] = ring ? 255 : 48; buf[i + 1] = ring ? 255 : 59; buf[i + 2] = ring ? 255 : 255; buf[i + 3] = a;  // BGRA
    }
  }
  dot = nativeImage.createFromBitmap(buf, { width: size, height: size });
  return dot;
}

ipcMain.on("badge", (_e, count) => {
  const n = Math.max(0, Math.min(999, Number(count) || 0));
  if (isMac || process.platform === "linux") app.setBadgeCount(n);
  else if (win) {
    win.setOverlayIcon(n > 0 ? badgeDot() : null, n > 0 ? `${n} unread alert${n === 1 ? "" : "s"}` : "");
    if (n > 0 && !win.isFocused()) win.flashFrame(true);
  }
});
ipcMain.on("theme", (_e, dark) => {
  if (!isMac && win) {
    try { win.setTitleBarOverlay({ color: "#00000000", symbolColor: dark ? "#e8eefc" : "#1b2440", height: 56 }); } catch { /* older Windows */ }
  }
});
ipcMain.on("focus", () => showWindow());

// ---- updates ----
function newer(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}

const askedToRestart = { listening: false, version: null };

async function checkForUpdates(manual = false) {
  try {
    if (!isMac && app.isPackaged) {
      // Windows: downloads quietly and installs the next time Analify restarts.
      const { autoUpdater } = require("electron-updater");
      autoUpdater.autoInstallOnAppQuit = true;
      // Closing the window keeps Analify in the tray, so "install when it quits" could wait for days: once the
      // update is downloaded, ask to restart now.
      if (!askedToRestart.listening) {
        askedToRestart.listening = true;
        autoUpdater.on("update-downloaded", async (info) => {
          if (askedToRestart.version === info.version) return;
          askedToRestart.version = info.version;
          readyVersion = info.version;
          updateTray();  // "Restart to update" in the tray menu, whatever happens next
          const restart = () => { quitting = true; autoUpdater.quitAndInstall(false, true); };
          if (win && !win.isDestroyed() && win.isVisible()) {
            const { response } = await showOnWindow({
              type: "info", message: `Analify ${info.version} is ready`,
              detail: "Restart Analify to finish updating. It takes a few seconds, and you stay signed in.",
              buttons: ["Restart now", "Later"], defaultId: 0, cancelId: 1,
            });
            if (response === 0) restart();
          } else if (Notification.isSupported()) {  // the window is closed to the tray
            const n = new Notification({ title: `Analify ${info.version} is ready`, body: "Click to restart Analify and finish updating." });
            n.on("click", restart);
            n.show();
          }
        });
      }
      const result = await autoUpdater.checkForUpdatesAndNotify({
        title: "Analify update ready", body: "The new version installs the next time Analify restarts.",
      });
      const found = result && result.updateInfo && newer(result.updateInfo.version, app.getVersion());
      if (manual) {
        showOnWindow({ type: "info", message: found ? `Analify ${result.updateInfo.version} is downloading` : "You're up to date",
          detail: found ? "It installs the next time Analify restarts." : `Analify ${app.getVersion()} is the newest version.` });
      }
      return;
    }
    // Mac (automatic updates need a signed app): tell the person, and link to the download.
    const res = await net.fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const latest = String((await res.json()).tag_name || "").replace(/^v/, "");
    const found = latest && newer(latest, app.getVersion());
    if (found && (newVersion !== latest || manual)) {
      newVersion = latest;
      updateTray();
      const install = "Open the download, drag Analify to Applications and replace the old one, then open it (the first time: System Settings → Privacy & Security → Open Anyway). Your sign-in and settings stay as they are.";
      if (manual) {
        const { response } = await showOnWindow({ type: "info", message: `Analify ${latest} is available`, detail: install,
          buttons: ["Download", "Later"], defaultId: 0, cancelId: 1 });
        if (response === 0) shell.openExternal(MAC_DOWNLOAD);
      } else if (Notification.isSupported()) {
        const n = new Notification({ title: `Analify ${latest} is available`, body: "Click to download it. Your sign-in and settings stay as they are." });
        n.on("click", () => shell.openExternal(MAC_DOWNLOAD));
        n.show();
      }
    } else if (manual) {
      showOnWindow({ type: "info", message: "You're up to date", detail: `Analify ${app.getVersion()} is the newest version.` });
    }
  } catch (e) {
    if (manual) showOnWindow({ type: "warning", message: "Couldn't check for updates", detail: "Check your internet connection and try again." });
  }
}

// ---- menus ----
function buildMenu() {
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "All websites", accelerator: "CmdOrCtrl+Shift+H", click: () => showWindow("/") },
        { label: "Quick switcher", accelerator: "CmdOrCtrl+K", click: () => win && win.webContents.sendInputEvent({ type: "keyDown", keyCode: "K", modifiers: [isMac ? "meta" : "control"] }) },
        { type: "separator" },
        { role: "reload" }, { role: "forceReload" }, { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      label: "Help",  // Windows and Linux don't name the "help" role by themselves, which left it invisible
      submenu: [
        { label: "Documentation", click: () => shell.openExternal(`${ORIGIN}/docs`) },
        { label: "Send feedback", click: () => shell.openExternal(`${ORIGIN}/contact`) },
        { label: "Check for updates…", click: () => checkForUpdates(true) },
        { type: "separator" },
        { label: `Analify ${app.getVersion()} (beta)`, enabled: false },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** analify://auth?code=... : finish the Google sign-in started from this app. */
function openLink(link) {
  try {
    const url = new URL(link);
    const code = url.searchParams.get("code");
    if (url.hostname === "auth" && code && /^[A-Za-z0-9_-]{10,100}$/.test(code)) {
      showWindow();
      win.loadURL(`${ORIGIN}/auth/google#code=${encodeURIComponent(code)}`);
      return;
    }
  } catch { /* not a link we know */ }
  showWindow();
}

app.on("open-url", (event, link) => {  // Mac
  event.preventDefault();
  if (app.isReady()) openLink(link); else pendingLink = link;
});
app.on("second-instance", (_event, argv) => {  // Windows: the link arrives as an argument
  const link = argv.find((a) => a.startsWith("analify://"));
  if (link) openLink(link); else showWindow();
});
app.on("before-quit", () => { quitting = true; });

/** The first launch after an update says so, in a plain window (notifications may be turned off). */
function announceUpdate() {
  const saved = settings();
  const before = saved.version;
  // 0.2.1 and earlier didn't note their version, but did save the window's size: that means an earlier install.
  const earlier = before ? before !== app.getVersion() : saved.width !== undefined;
  saveSettings({ version: app.getVersion() });
  if (earlier) {
    pendingAnnouncement = { type: "info", message: `Analify was updated to ${app.getVersion()}`,
      detail: `${before ? `You were on ${before}. ` : ""}Your sign-in and settings are as you left them.` };
  }
}

/** A message attached to Analify's window, so Windows shows it in front instead of behind other windows. */
function showOnWindow(options) {
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.focus();
    return dialog.showMessageBox(win, options);
  }
  return dialog.showMessageBox(options);
}

app.whenReady().then(() => {
  if (process.platform === "win32") app.setAppUserModelId("dev.analify.desktop");  // notifications show "Analify"
  announceUpdate();
  buildMenu();
  createWindow();
  createTray();
  checkForUpdates();
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
  if (pendingLink) { const link = pendingLink; pendingLink = null; win.webContents.once("did-finish-load", () => openLink(link)); }
  app.on("activate", () => showWindow());
});

app.on("window-all-closed", () => {
  if (!isMac && !tray) app.quit();
});
