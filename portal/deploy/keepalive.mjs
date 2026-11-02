import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(HERE, "data");
const HEARTBEAT = path.join(DATA_DIR, "keepalive.txt");
const LOG = path.join(DATA_DIR, "keepalive.log");
const URL = process.env.PORTAL_KEEPALIVE_URL || "https://fatortak.rabbeh.com/portal/?ping=1";
const INTERVAL = Number(process.env.PORTAL_KEEPALIVE_INTERVAL_MS || 5 * 60 * 1000);

fs.mkdirSync(DATA_DIR, { recursive: true });

function record(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    fs.appendFileSync(LOG, line);
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 1024 * 1024) {
      fs.renameSync(LOG, `${LOG}.1`);
    }
  } catch {}
  try {
    fs.writeFileSync(HEARTBEAT, new Date().toISOString());
  } catch {}
}

async function ping() {
  try {
    const response = await fetch(URL, {
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "FatortakPortalKeepalive/1.0" },
    });
    record(`ping ${response.status}`);
  } catch (error) {
    record(`ping failed: ${error?.message || error}`);
  }
}

record(`started pid=${process.pid} interval=${INTERVAL}`);
ping();
setInterval(ping, INTERVAL);

process.on("uncaughtException", (error) => record(`uncaught: ${error?.message || error}`));
process.on("unhandledRejection", (reason) => record(`unhandled: ${reason?.message || reason}`));
