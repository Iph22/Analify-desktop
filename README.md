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

- Opens analify.dev in its own window and keeps you signed in. Sign in with the code Analify emails you.
- Links to other websites open in your browser.
- Remembers its size and position, and opens only once (opening it again brings the window forward).

## Build it yourself

```sh
npm install
npm start        # run it
npm run dist     # build the installer for this computer into dist/
```

Releases are built by GitHub Actions when a `v*` tag is pushed (`.github/workflows/release.yml`).

MIT licence.
