import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT_DIR = path.join(ROOT, "assets", "brand");
const TEMPLATE = "file:///" + path.join(ROOT, ".brand-cover.html").replace(/\\/g, "/");

const covers = [
  { variant: "og", width: 1280, height: 640, file: "cover-og.png" },
  { variant: "wide", width: 1600, height: 500, file: "cover-readme.png" },
  { variant: "wide", width: 1500, height: 500, file: "cover-x.png" },
  { variant: "facebook", width: 1640, height: 624, file: "cover-facebook.png" },
  { variant: "linkedin", width: 1128, height: 191, file: "cover-linkedin.png" },
  { variant: "youtube", width: 2560, height: 1440, file: "cover-youtube.png" },
  { variant: "avatar", width: 400, height: 400, file: "avatar.png" }
];

fs.mkdirSync(OUT_DIR, { recursive: true });

function shot(item, index) {
  return new Promise((resolve) => {
    const out = path.join(OUT_DIR, item.file);
    if (fs.existsSync(out) && fs.statSync(out).size > 12000) {
      resolve({ file: item.file, ok: true, size: fs.statSync(out).size, skipped: true });
      return;
    }
    const profile = path.join(os.tmpdir(), `fatortak-cover-${process.pid}-${index}`);
    const url = `${TEMPLATE}?variant=${encodeURIComponent(item.variant)}`;
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--force-device-scale-factor=1",
      `--window-size=${item.width},${item.height}`,
      "--virtual-time-budget=3500",
      `--user-data-dir=${profile}`,
      `--screenshot=${out}`,
      url
    ];
    const child = spawn(CHROME, args, { windowsHide: true, stdio: "ignore" });
    const started = Date.now();
    const timer = setInterval(() => {
      if (fs.existsSync(out) && fs.statSync(out).size > 12000) {
        clearInterval(timer);
        setTimeout(() => {
          try { child.kill(); } catch {}
          resolve({ file: item.file, ok: true, size: fs.statSync(out).size });
        }, 400);
      } else if (Date.now() - started > 25000) {
        clearInterval(timer);
        try { child.kill(); } catch {}
        resolve({ file: item.file, ok: fs.existsSync(out), size: fs.existsSync(out) ? fs.statSync(out).size : 0 });
      }
    }, 400);
  });
}

const results = [];
for (let i = 0; i < covers.length; i += 1) {
  const result = await shot(covers[i], i);
  results.push(result);
  console.log(`${i + 1}/${covers.length} ${result.ok ? "ok" : "failed"} ${result.file} ${result.size}`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log(JSON.stringify({ generated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length }, null, 2));
