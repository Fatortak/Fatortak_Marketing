# Fatortak landing page

A static, bilingual landing page for Fatortak with an interactive 3D product showcase. It uses real screenshots of the running application, not mockups.

The page is plain HTML, CSS and JavaScript. There is no build step. Google Fonts is the only external request; the page falls back to system fonts if it is unavailable.

## Preview locally

```powershell
cd marketing/landing
py -m http.server 4173
```

Open <http://localhost:4173>.

You can also open `index.html` directly, but a local server is better for testing the manifest and relative paths.

## What is included

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, English/Arabic copy and metadata. |
| `styles.css` | Dark 3D design, responsive layout, RTL rules, reduced-motion support. |
| `app.js` | Language toggle, 3D screen tour, showcase tabs, AI/OCR demos, lightbox, reveal animations. |
| `demo.mp4`, `demo-poster.jpg` | 20-second product tour cut from the real screenshots, with a poster frame. |
| `privacy.html` | Privacy policy used by LinkedIn, X and the footer. |
| `analytics.js`, `track.php`, `stats.php` | Cookie-less first-party pageview counter and its aggregate JSON endpoint. |
| `assets/fatortak-logo-white.png` | Real Fatortak wordmark for dark surfaces. |
| `assets/fatortak-logo.png` | Real Fatortak wordmark on transparent background. |
| `assets/favicon.png` | Square real F mark on brand purple. |
| `assets/og.png` | 1200×630 social preview image. |
| `assets/screenshots/` | Real application screenshots captured from the local demo tenant. |
| `site.webmanifest`, `robots.txt`, `sitemap.xml` | Basic PWA/SEO files. |

## Interaction

- **Hero screen**: a 3D browser frame that tilts with the pointer, supports drag-to-rotate, and switches between Dashboard, AI chat, OCR invoice and Sales invoices. The tour auto-advances every 7 seconds and pauses on hover or interaction.
- **Product tour**: six real screens with clickable tabs, previous/next buttons and keyboard navigation.
- **AI section**: example prompt chips switch between real AI chat screenshots and captions.
- **OCR section**: a four-step selector explains upload, extraction, review and invoice creation.
- **Screen gallery**: every screenshot opens in a full-size dialog with keyboard navigation.
- **Language**: English/Arabic toggle with full RTL layout. The choice is stored in `localStorage` under `fatortak-lang`, and `?lang=ar` opens Arabic directly.
- **Accessibility**: skip link, focus styles, keyboard-operable tabs and lightbox, and `prefers-reduced-motion` support.

## Screenshot provenance

The screenshots were captured from the running application against the local `FatortakDemo` SQL Server database. They use demo data only. Production credentials and customer data were not used.

To refresh a screenshot:

1. Start the local backend on `http://localhost:5002` against `FatortakDemo`.
2. Start the frontend on `http://localhost:8081` with `VITE_API_URL=http://localhost:5002`.
3. Log in with the demo tenant.
4. Capture the page at 1440×900 with a 1.5× device scale factor.
5. Save over the matching file in `assets/screenshots/`.

The AI chat scenes were seeded with a local-only SQL script (`marketing/scripts/seed-demo-chat.sql`) so the conversation shows accurate demo figures. The OCR screenshot uses a generated demo supplier invoice, not a real customer document.

## Pricing

The page uses the current in-app monthly pricing:

| Plan | Monthly |
| --- | ---: |
| Community (self-hosted) | 0 EGP |
| Starter | 300 EGP |
| Professional | 600 EGP |
| Enterprise | 900 EGP |

If the app pricing changes, update the visible amounts and the `SoftwareApplication` JSON-LD block in `index.html`.

## Deploy to InterServer Plesk

The production target is the new subdomain:

```text
https://fatortak.rabbeh.com
```

The Plesk reference is in [`../deploy/INTERSERVER-PLESK.md`](../deploy/INTERSERVER-PLESK.md). For automatic deployment through GitHub Actions, see [`../deploy/INTERSERVER-AUTODEPLOY.md`](../deploy/INTERSERVER-AUTODEPLOY.md).

Deployment is a static file upload:

```text
index.html
styles.css
app.js
assets/
site.webmanifest
robots.txt
sitemap.xml
```

Do not upload `.og-card.html`, README files or local scripts. The page has no client-side routes, so no SPA rewrite is required.

### GitHub Pages (optional)

The existing `.github/workflows/pages.yml` can still publish this folder to GitHub Pages. If GitHub Pages remains in use, update the canonical, `hreflang`, Open Graph, `robots.txt` and `sitemap.xml` URLs to the actual public hostname.

## Regenerate the social image

The source card is `.og-card.html`. Render it at 1200×630 with headless Chrome or Edge:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --run-all-compositor-stages-before-draw --virtual-time-budget=5000 `
  --window-size=1200,630 `
  --screenshot="assets/og.png" `
  "file:///$((Resolve-Path .og-card.html).Path -replace '\\','/')"
```

Adjust the browser path if Chrome is not installed there.

## Before publishing

- [ ] Verify the new screenshots and the Arabic copy.
- [ ] Test at 390px, 768px, 1024px and 1440px widths.
- [ ] Test the language toggle, hero tabs, product tour, AI chips, OCR steps and lightbox with a keyboard.
- [ ] Confirm the page has no horizontal overflow in English or Arabic.
- [ ] Run Lighthouse and check accessibility.
- [ ] Confirm `info@fatortak.net` receives demo and license requests.
- [ ] The first-party analytics counter is disclosed in the privacy policy; do not add third-party trackers without updating it.
- [ ] Keep the honest claims: no ETA/ZATCA certification, no customer logos, no testimonials.

## Honest-claims policy

The page deliberately avoids claiming:

- ETA or ZATCA e-invoicing certification.
- 100% OCR accuracy.
- Customer logos, testimonials or usage numbers that do not exist.
- Independent security certification.

The open-source, AGPL-3.0, self-hosting, pricing and product-screen claims are verifiable. Keep them that way.
