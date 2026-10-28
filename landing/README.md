# Landing page

A dependency-free, bilingual landing page for Fatortak. It is designed to be deployed to GitHub Pages from this folder without a build step.

## Preview locally

```bash
cd marketing/landing
python -m http.server 4173
```

Open <http://localhost:4173>. On Windows, `py -m http.server 4173` works if `python` is not on the PATH.

You can also open `index.html` directly, but a local server is better for testing the manifest and relative paths.

## What is included

| File | Purpose |
| --- | --- |
| `index.html` | The page. English first, Arabic content embedded. |
| `styles.css` | All styling, responsive layout and RTL rules. |
| `app.js` | Language toggle, pricing toggle, mobile nav, reveal animation. |
| `assets/logo-mark.svg` | Compact logo mark used in the header and footer. |
| `assets/logo-mark.png` | 180×180 fallback icon. |
| `assets/og.png` | 1200×630 social preview image. |
| `assets/banner.svg` | Wide banner, useful for README or GitHub social preview. |
| `site.webmanifest`, `robots.txt`, `sitemap.xml` | Basic PWA/SEO files. |

No fonts, analytics, trackers or third-party scripts are loaded. The page works offline after the first load.

## Language behavior

- The page starts in English unless the browser language is Arabic, the URL has `?lang=ar`, or the visitor previously chose Arabic.
- The toggle updates `lang`, `dir`, the document title, the meta description, the Open Graph tags and the URL.
- The choice is stored in `localStorage` under `fatortak-lang`.
- Arabic uses RTL layout through logical CSS properties; the terminal block stays LTR because commands are LTR.

## Pricing

The page mirrors the in-app plans:

| Plan | Monthly | Yearly (10 months) |
| --- | ---: | ---: |
| Community (self-host) | 0 | 0 |
| Starter | 300 EGP | 2,700 EGP |
| Professional | 600 EGP | 5,400 EGP |
| Enterprise | 900 EGP | 8,100 EGP |

If the app pricing changes, update both the visible amounts and the `data-monthly` / `data-yearly` attributes in `index.html`, plus the `SoftwareApplication` JSON-LD block.

## Deploy to GitHub Pages

The included workflow `.github/workflows/pages.yml` publishes this folder on every push to `main` that changes `marketing/landing/**`.

One-time setup:

1. Repository → **Settings → Pages**.
2. Source: **GitHub Actions**.
3. Push (or run the workflow manually).

The default URL is:

```
https://fatortak.github.io/Fatortak_Software/
```

### Custom domain (recommended)

A GitHub Pages subpath is fine for the open-source project, but a custom domain is better for a commercial site, email trust and brand searches. If you use `fatortak.net`:

1. Add a `CNAME` file in this folder containing `fatortak.net` (or `www.fatortak.net`).
2. Configure the DNS records GitHub documents for Pages.
3. Update canonical, `hreflang`, Open Graph URLs, `robots.txt`, `sitemap.xml` and the automation config to the custom domain.
4. Enable HTTPS in Pages settings.

Do not publish the page on a domain you do not control with a valid certificate.

## Regenerate the social image

`assets/og.png` is a 1200×630 screenshot of `.og-card.html`, rendered with headless Edge/Chrome. If you change the copy or logo:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --run-all-compositor-stages-before-draw --virtual-time-budget=5000 `
  --window-size=1200,630 `
  --screenshot="assets/og.png" `
  "file:///$((Resolve-Path .og-card.html).Path -replace '\\','/')"
```

Keep the source card in `.og-card.html` for future edits. It is hidden by the leading dot; remove it before deploying if you prefer a clean folder (the page does not reference it).

## Before publishing

- [ ] Replace the placeholder GitHub Pages URLs if a custom domain is used.
- [ ] Verify every claim: no ETA/ZATCA compliance, no "production-ready", no customer logos or testimonials.
- [ ] Check the Arabic copy with a native finance/accounting reviewer.
- [ ] Test at 360px, 768px and 1440px widths.
- [ ] Test the language toggle, pricing toggle and mobile menu with a keyboard.
- [ ] Run Lighthouse; the page should score well because it has no external dependencies.
- [ ] Confirm `info@fatortak.net` receives demo and license requests.
- [ ] If adding Plausible/Umami, add it to the privacy policy and disclose it. Do not add a tracker silently.
- [ ] Make sure the pricing links and mailto subjects are correct.

## Honest-claims policy

The page deliberately says:

- Public alpha.
- No independent security audit yet.
- ETA/ZATCA e-invoicing is not implemented.
- Community self-hosting is free; managed cloud is paid.
- The commercial license is for companies that cannot use AGPL.

Do not remove those lines to make the page look more mature. The trust cost is higher than the conversion gain.
