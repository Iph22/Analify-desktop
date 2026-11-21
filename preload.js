// The small, fixed set of things the Analify dashboard may ask the desktop app to do (lib/platform.ts DesktopBridge).
// Nothing else from Electron or Node is reachable from the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("analifyDesktop", {
  platform: process.platform,
  version: (process.argv.find((a) => a.startsWith("--analify-version=")) || "").split("=")[1] || "",
  setBadge: (count) => ipcRenderer.send("badge", Number(count) || 0),
  setTray: (data) => ipcRenderer.send("tray", data),
  setTheme: (dark) => ipcRenderer.send("theme", !!dark),
  focus: () => ipcRenderer.send("focus"),
  onNavigate: (go) => ipcRenderer.on("navigate", (_event, path) => go(String(path))),
});
