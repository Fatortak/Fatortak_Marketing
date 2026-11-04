import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SHOTS = path.join(ROOT, "assets/screenshots");
const OUT = path.join(ROOT, "assets/videos");
const FORCE = process.argv.includes("--force");

fs.mkdirSync(OUT, { recursive: true });

const cards = fs
  .readdirSync(SHOTS)
  .filter((name) => /^social-v3-.*\.jpg$/i.test(name))
  .sort();

if (!cards.length) {
  console.error("No social-v3 cards found in assets/screenshots.");
  process.exit(1);
}

function run(args) {
  const result = spawnSync("ffmpeg", args, { stdio: "ignore", windowsHide: true });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.at(-1)}`);
}

for (const card of cards) {
  const base = card.replace(/^social-v3-/, "video-v3-").replace(/\.jpg$/i, "");
  const video = path.join(OUT, `${base}.mp4`);
  const poster = path.join(OUT, `${base}.png`);
  if (!FORCE && fs.existsSync(video) && fs.statSync(video).size > 20_000 && fs.existsSync(poster)) {
    console.log(`skip ${base}`);
    continue;
  }
  run([
    "-y",
    "-loop", "1",
    "-i", path.join(SHOTS, card),
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t", "8",
    "-filter_complex",
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:4,eq=brightness=-0.25:saturation=0.85[bg];" +
      "[0:v]scale=1000:-1[fg];" +
      "[bg][fg]overlay=(W-w)/2:(H-h)/2-90," +
      "drawbox=x=0:y=1890:w=1080:h=6:color=#a78bfa@0.85:t=fill," +
      "fade=t=in:st=0:d=0.4,fade=t=out:st=7.3:d=0.7,format=yuv420p[v]",
    "-map", "[v]",
    "-map", "1:a",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "22",
    "-c:a", "aac",
    "-b:a", "96k",
    "-shortest",
    "-movflags", "+faststart",
    video,
  ]);
  run(["-y", "-ss", "1", "-i", video, "-frames:v", "1", poster]);
  console.log(`ok ${base}`);
}

console.log(`Generated ${cards.length} videos in ${OUT}`);
