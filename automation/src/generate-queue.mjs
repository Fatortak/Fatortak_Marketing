import {
  features,
  pains,
  painFixes,
  useCases,
  useCaseFixes,
  oss,
  commercial,
  tips,
  arabic,
  hooks,
  ctas,
} from "./content-bank.mjs";

const LIMITS = { x: 280, bluesky: 300, mastodon: 500, linkedin: 3000, telegram: 4096, discord: 2000 };

const pad = (n) => String(n).padStart(2, "0");

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

function fit(text, limit) {
  const clean = text.replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(": "), cut.lastIndexOf("\n"));
  return (lastStop > limit * 0.55 ? cut.slice(0, lastStop + 1) : cut).trim() + "…";
}

function compose(body, cta) {
  return cta ? `${body}\n\n${cta}` : body;
}

function pickCta(index) {
  const order = ["repo", "none", "site", "none", "demo", "repo"];
  return ctas[order[index % order.length]];
}

/**
 * Generate a deterministic N-day queue.
 * Cadence: X/Bluesky/Mastodon 4x/week, LinkedIn 2x/week, Arabic 1x/week.
 */
export function generateQueue({ startDate = "2026-11-02", days = 90 } = {}) {
  const items = [];
  let featureIdx = 0;
  let painIdx = 0;
  let ossIdx = 0;
  let useCaseIdx = 0;
  let fridayUseCaseIdx = 0;
  let commercialIdx = 0;
  let tipIdx = 0;
  let arabicIdx = 0;
  let hookIdx = 0;
  let counter = 0;

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(startDate, offset);
    const dow = dayOfWeek(date);
    const idBase = date.replaceAll("-", "");
    counter += 1;

    if (dow === 1 || dow === 3 || dow === 5 || dow === 0) {
      // English short-form: X, Bluesky, Mastodon
      let body = "";
      let pillar = "product";
      let time = "10:00";

      if (dow === 1) {
        const f = features[featureIdx++ % features.length];
        body = `${f.title}\n\n${f.detail}`;
        pillar = "product";
      } else if (dow === 3) {
        body = oss[ossIdx++ % oss.length];
        pillar = "open-source";
      } else if (dow === 5) {
        if (commercialIdx % 2 === 0) {
          body = commercial[commercialIdx % commercial.length];
          pillar = "commercial";
        } else {
          const u = useCases[fridayUseCaseIdx++ % useCases.length];
          body = `Built for ${u.title.toLowerCase()}\n\n${u.body}`;
          pillar = "use-case";
        }
        commercialIdx += 1;
      } else {
        body = tips[tipIdx++ % tips.length];
        pillar = "tip";
        time = "18:00";
      }

      const cta = pickCta(counter);
      const text = fit(compose(body, cta), LIMITS.x);
      items.push({
        id: `${idBase}-x-01`,
        date,
        time,
        channels: ["x", "bluesky", "mastodon"],
        pillar,
        lang: "en",
        text,
        utm: { campaign: "oss-launch", content: `${idBase}-x` },
      });
    }

    if (dow === 2 || dow === 4) {
      // LinkedIn long-form
      let text = "";
      let pillar = "insight";
      if (dow === 2) {
        const pain = pains[painIdx % pains.length];
        const f = features[painFixes[painIdx % painFixes.length] % features.length];
        painIdx += 1;
        const hook = hooks.en[hookIdx++ % hooks.en.length];
        text = `${hook}\n\n${pain}\n\nHow Fatortak handles it: ${f.detail}\n\nFatortak is open source (AGPL-3.0), bilingual Arabic/English, and self-hostable. If you want the long version, the code and docs are here: {{repo}}`;
        pillar = "insight";
      } else {
        const u = useCases[useCaseIdx % useCases.length];
        const f = features[useCaseFixes[useCaseIdx % useCaseFixes.length] % features.length];
        useCaseIdx += 1;
        text = `Built for ${u.title.toLowerCase()}.\n\n${u.body}\n\nOne feature that matters here: ${f.title.toLowerCase()} — ${f.detail}\n\nOpen source, self-hostable, Arabic-first: {{repo}}`;
        pillar = "use-case";
      }
      items.push({
        id: `${idBase}-li-01`,
        date,
        time: "09:30",
        channels: ["linkedin"],
        pillar,
        lang: "en",
        text: fit(text, LIMITS.linkedin),
        utm: { campaign: "oss-launch", content: `${idBase}-li` },
      });
    }

    if (dow === 6) {
      const ar = arabic[arabicIdx++ % arabic.length];
      const text = fit(compose(ar, arabicIdx % 2 === 0 ? "{{site}}" : ""), LIMITS.x);
      items.push({
        id: `${idBase}-ar-01`,
        date,
        time: "20:00",
        channels: ["x", "bluesky"],
        pillar: "arabic",
        lang: "ar",
        text,
        utm: { campaign: "oss-launch-ar", content: `${idBase}-ar` },
      });
    }
  }

  return {
    version: 1,
    timezone: "Africa/Cairo",
    generatedAt: new Date().toISOString(),
    startDate,
    endDate: addDays(startDate, days - 1),
    cadence: "X/Bluesky/Mastodon 4x/week · LinkedIn 2x/week · Arabic 1x/week",
    items,
  };
}
