import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "assets/videos");
const TEMPLATE = "file:///" + path.join(ROOT, ".video-frame-v4.html").replace(/\\/g, "/");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FORCE = process.argv.includes("--force");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "fatortak-v4-"));

fs.mkdirSync(OUT, { recursive: true });

const videos = [
  { id: "01-ui", lang: "en", theme: "purple", badge: "New UI", title: "See the new interface.", sub: "A calmer workspace, the same ledger.", chips: "Reports|Invoices|Projects", screen: "screens-reports.png", url: "fatortak / reports" },
  { id: "02-reports", lang: "en", theme: "green", badge: "Reports", title: "13 reports. 30 seconds.", sub: "Filter, export CSV or PDF, trace every number.", chips: "Reports|CSV + PDF|VAT", screen: "screens-reports.png", url: "fatortak / reports" },
  { id: "03-import", lang: "en", theme: "amber", badge: "Data import", title: "Your Excel file, mapped.", sub: "Review the columns and validate before saving.", chips: "Excel + CSV|Mapping|Validation", screen: "screens-import.png", url: "fatortak / data-import" },
  { id: "04-platform", lang: "en", theme: "cyan", badge: "Platform", title: "Every company. One console.", sub: "Tenants, users, invoices and collections.", chips: "Multi-tenant|Users|Activity", screen: "screens-platform.png", url: "fatortak / platform" },
  { id: "05-onboarding", lang: "en", theme: "purple", badge: "Getting started", title: "Zero to first invoice.", sub: "A guided checklist for the first setup.", chips: "Onboarding|Checklist|Demo data", screen: "screens-onboarding.png", url: "fatortak / onboarding" },
  { id: "06-templates", lang: "en", theme: "amber", badge: "Invoices", title: "Six invoices. Your brand.", sub: "Pick, preview and print in Arabic or English.", chips: "Templates|Branding|RTL", screen: "screens-templates.png", url: "fatortak / invoice-templates" },
  { id: "07-arabic-first", lang: "en", theme: "cyan", badge: "Arabic-first", title: "Arabic-first, not translated later.", sub: "RTL invoices, reports and a properly shaped Arabic UI.", chips: "Arabic|RTL|Reports", screen: "screens-reports-ar.png", url: "fatortak / reports" },
  { id: "11-ui-ar", lang: "ar", theme: "purple", badge: "واجهة جديدة", title: "شاهد الواجهة الجديدة.", sub: "مساحة أهدأ ونفس الدفتر.", chips: "تقارير|فواتير|مشاريع", screen: "screens-reports-ar.png", url: "fatortak / reports" },
  { id: "12-reports-ar", lang: "ar", theme: "green", badge: "تقارير", title: "13 تقريرًا في 30 ثانية.", sub: "صفِّ وصدّر CSV أو PDF وتتبّع كل رقم.", chips: "تقارير|CSV + PDF|ضريبة", screen: "screens-reports-ar.png", url: "fatortak / reports" },
  { id: "13-import-ar", lang: "ar", theme: "amber", badge: "استيراد", title: "ملف إكسل مربوط.", sub: "راجع الأعمدة وتحقق قبل الحفظ.", chips: "Excel + CSV|ربط|تحقق", screen: "screens-import.png", url: "fatortak / data-import" },
  { id: "14-platform-ar", lang: "ar", theme: "cyan", badge: "المنصة", title: "كل شركة. لوحة واحدة.", sub: "الشركات والمستخدمون والفواتير والتحصيل.", chips: "تعدد الشركات|مستخدمون|نشاط", screen: "screens-platform.png", url: "fatortak / platform" },
  { id: "15-onboarding-ar", lang: "ar", theme: "purple", badge: "البدء", title: "من الصفر إلى أول فاتورة.", sub: "قائمة بدء لأول إعداد.", chips: "بدء الاستخدام|قائمة مهام|بيانات تجريبية", screen: "screens-onboarding.png", url: "fatortak / onboarding" },
  { id: "16-templates-ar", lang: "ar", theme: "amber", badge: "الفواتير", title: "ستة قوالب. هويتك.", sub: "اختر وعاين واطبع بالعربية أو الإنجليزية.", chips: "قوالب|هوية|RTL", screen: "screens-templates.png", url: "fatortak / invoice-templates" },
  { id: "17-arabic-first-ar", lang: "ar", theme: "cyan", badge: "عربي أولاً", title: "عربي أولاً، لا ترجمة لاحقة.", sub: "واجهة RTL وفواتير وتقارير عربية مصممة معًا.", chips: "عربي|RTL|تقارير", screen: "screens-reports-ar.png", url: "fatortak / reports" },
];

const endCards = {
  en: { badge: "Fatortak", title: "Try Fatortak free.", cta: "Link in bio", sub: "Invoicing · Accounting · Projects · Payroll", chips: "Invoicing|Accounting|Projects|Payroll", screen: "screens-reports.png", theme: "purple", url: "fatortak" },
  ar: { badge: "فاتورتك", title: "جرّب فاتورتك مجانًا.", cta: "الرابط في البايو", sub: "فواتير · محاسبة · مشاريع · رواتب", chips: "فواتير|محاسبة|مشاريع|رواتب", screen: "screens-reports-ar.png", theme: "purple", url: "fatortak" },
};

function run(cmd, args, label) {
  const result = spawnSync(cmd, args, { stdio: "ignore", windowsHide: true });
  if (result.status !== 0) throw new Error(`${label} failed (${result.status})`);
}

function renderFrame(name, params) {
  const out = path.join(TMP, `${name}.png`);
  const query = new URLSearchParams(params).toString();
  const profile = path.join(TMP, `profile-${name}`);
  run(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--window-size=1080,1920",
      "--virtual-time-budget=3500",
      `--user-data-dir=${profile}`,
      `--screenshot=${out}`,
      `${TEMPLATE}?${query}`,
    ],
    `Chrome frame ${name}`
  );
  if (!fs.existsSync(out) || fs.statSync(out).size < 20_000) throw new Error(`Frame ${name} was not rendered`);
  return out;
}

function probe(file) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration,size", "-show_entries", "stream=width,height,codec_name,profile", "-of", "json", file],
    { encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) throw new Error(`ffprobe failed: ${file}`);
  return JSON.parse(result.stdout);
}

let generated = 0;
for (const video of videos) {
  const mp4 = path.join(OUT, `video-v4-${video.id}.mp4`);
  const poster = path.join(OUT, `video-v4-${video.id}.jpg`);
  if (!FORCE && fs.existsSync(mp4) && fs.existsSync(poster)) {
    console.log(`skip ${video.id}`);
    continue;
  }
  const main = renderFrame(`main-${video.id}`, {
    badge: video.badge,
    title: video.title,
    sub: video.sub,
    chips: video.chips,
    screen: video.screen,
    theme: video.theme,
    lang: video.lang,
    url: video.url,
  });
  const end = renderFrame(`end-${video.lang}`, {
    mode: "end",
    badge: endCards[video.lang].badge,
    title: endCards[video.lang].title,
    sub: endCards[video.lang].sub,
    chips: endCards[video.lang].chips,
    screen: endCards[video.lang].screen,
    theme: endCards[video.lang].theme,
    lang: video.lang,
    endTitle: endCards[video.lang].title,
    endCta: endCards[video.lang].cta,
    endSub: endCards[video.lang].sub,
  });
  const mainMp4 = path.join(TMP, `main-${video.id}.mp4`);
  const endMp4 = path.join(TMP, `end-${video.lang}.mp4`);
  run("ffmpeg", ["-y", "-loop", "1", "-i", main, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-t", "17.5", "-vf", "zoompan=z='min(zoom+0.00022,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,format=yuv420p,fade=t=out:st=17.15:d=0.35", "-c:v", "libx264", "-profile:v", "high", "-level", "4.2", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", mainMp4], `ffmpeg main ${video.id}`);
  run("ffmpeg", ["-y", "-loop", "1", "-i", end, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-t", "2.5", "-vf", "scale=1080:1920,format=yuv420p,fade=t=in:st=0:d=0.35", "-c:v", "libx264", "-profile:v", "high", "-level", "4.2", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", endMp4], `ffmpeg end ${video.id}`);
  run("ffmpeg", ["-y", "-i", mainMp4, "-i", endMp4, "-filter_complex", "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-profile:v", "high", "-level", "4.2", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", mp4], `ffmpeg concat ${video.id}`);
  run("ffmpeg", ["-y", "-ss", "1", "-i", mp4, "-frames:v", "1", "-q:v", "2", poster], `poster ${video.id}`);
  const info = probe(mp4);
  const duration = Number(info.format?.duration || 0);
  const streams = info.streams || [];
  const videoStream = streams.find((s) => s.codec_name === "h264");
  const audioStream = streams.find((s) => s.codec_type !== "video" && s.codec_name === "aac");
  if (duration < 19.5 || duration > 20.5) throw new Error(`${video.id}: duration ${duration}`);
  if (!videoStream || videoStream.width !== 1080 || videoStream.height !== 1920) throw new Error(`${video.id}: bad video stream`);
  if (!audioStream) throw new Error(`${video.id}: missing audio stream`);
  generated += 1;
  console.log(`ok ${video.id} ${Math.round(Number(info.format.size) / 1024)} KB ${duration.toFixed(1)}s`);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`Generated ${generated} videos in ${OUT}`);
