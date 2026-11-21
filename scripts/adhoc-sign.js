// Mac builds: sign the finished app "ad-hoc" (no Apple certificate yet), after packaging and before the disk image
// is made. Packaging rewrites the Electron app inside (name, Info.plist), which breaks Electron's own signature;
// macOS on Apple silicon then calls the downloaded app "damaged". With a valid ad-hoc signature it shows the milder
// "can't verify the developer" message instead, which System Settings → Privacy & Security → Open Anyway gets past.
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signing ${app}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], { stdio: "inherit" });
};
