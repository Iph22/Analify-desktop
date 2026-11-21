# Analify for Windows and Mac (beta)

Your [Analify](https://analify.dev) dashboard in its own window: privacy-first analytics for your websites and apps, a click away on your desktop.

## Download

- **Windows 10 and 11:** [Analify-Setup.exe](https://github.com/Iph22/Analify-desktop/releases/latest/download/Analify-Setup.exe)
- **Mac with Apple silicon (M1 and later):** [Analify-mac-arm64.dmg](https://github.com/Iph22/Analify-desktop/releases/latest/download/Analify-mac-arm64.dmg)
- **Intel Mac:** [Analify-mac-x64.dmg](https://github.com/Iph22/Analify-desktop/releases/latest/download/Analify-mac-x64.dmg)

Or from [analify.dev/download](https://analify.dev/download).

This is a beta and isn't code-signed yet:

- **Windows** may say it protected your PC: choose **More info → Run anyway**.
- **macOS** may say it can't check the app: open **System Settings → Privacy & Security** and choose **Open Anyway**.

## What it does

- Your dashboard in a native window: on Mac the title bar blends in with the traffic lights; on Windows the window buttons sit over Analify's own colours.
- A menu bar / tray icon with how many people are on your sites right now, and a quick menu to open any website.
- Closing the window keeps Analify running there, so alerts arrive as native notifications. Unread alerts show on the Dock icon (Mac) or flash the taskbar button (Windows).
- Ctrl/⌘+K quick switcher, Ctrl/⌘+1–9 to jump between websites, and it reopens the website you were last on.
- Sign in with your email or with Google (Google finishes in your browser and hands you back to the app).
- Optionally starts when you log in.

## Updates

- Everything on the dashboard updates the moment Analify ships it: the app loads it live from analify.dev.
- The app itself: **Windows** downloads new versions quietly and installs them the next time Analify restarts. **Mac** shows a notification when a new version is ready (automatic updates on Mac need an Apple-signed app, coming later).

## "Analify is damaged and can't be opened" (version 0.1.0 on Mac)

0.1.0's Mac build wasn't signed at all, which macOS reports as damaged. 0.2.0 fixes this. To open 0.1.0 anyway, drag it to Applications and run `xattr -cr /Applications/Analify.app` in Terminal.

## Build it yourself

```sh
npm install
npm start        # run it
npm run dist     # build the installer for this computer into dist/
```

Releases are built by GitHub Actions when a `v*` tag is pushed (`.github/workflows/release.yml`).

MIT licence.
