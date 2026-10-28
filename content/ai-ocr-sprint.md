# AI + OCR launch sprint

Ten ready-to-post items for the first two weeks of the launch. Treat each item as the post for its channel and date: if `content/queue.json` already has a post for the same channel and date, replace it; otherwise add it. Never publish both.

**Landing page sections:** `https://fatortak.rabbeh.com/#ai` and `https://fatortak.rabbeh.com/#ocr` (once deployed).

> **Prerequisite:** do not publish the `{{site}}` items until `fatortak.rabbeh.com` is live. If hosting is still pending, hold them or use the GitHub repository link. Never send traffic to a dead page.

**Rules:** demo data only; show the OCR review step; no "100% accurate" claims; Arabic posts reviewed by an Arabic-speaking finance reviewer.

For manual posting, tag the landing page link with:

```text
?utm_source=<channel>&utm_medium=social&utm_campaign=ai-ocr-sprint&utm_content=<date>-ai-ocr
```

| # | Date | Channel | Format | Asset |
| --- | --- | --- | --- | --- |
| 1 | Nov 2 | X, Bluesky | Text + 15s screen recording | OCR upload → preview → review → create |
| 2 | Nov 2 | LinkedIn | Text + screenshot | AI chat KPI cards |
| 3 | Nov 4 | X, Bluesky | Text + screenshot | AI chat KPI cards |
| 4 | Nov 6 | LinkedIn | 5-slide carousel | OCR four-step flow |
| 5 | Nov 8 | X Arabic | Text + screenshot | OCR invoice preview |
| 6 | Nov 10 | LinkedIn | Text + screenshot | OCR invoice preview |
| 7 | Nov 11 | X, Bluesky | Text + document preview | OCR review step |
| 8 | Nov 13 | Instagram, TikTok | 20s vertical video | OCR workflow |
| 9 | Nov 15 | X Arabic | Text + chart | AI receivables chart |
| 10 | Nov 15 | LinkedIn | Text + screenshot | AI chat + project chart |

---

## 1. X / Bluesky — OCR flow

```text
Upload a supplier invoice. Preview it. Review the extracted fields. Create the purchase invoice.

OCR invoice capture is built into Fatortak. No copy-paste into a second system.

{{site}}
```

## 2. LinkedIn — AI chat

```text
Most "AI for accounting" demos stop at a chat bubble. The useful part is the number after it.

Ask Fatortak: "How did October compare with September?"

The assistant answers with revenue, expenses, net profit and a margin — backed by KPI cards and charts from the same ledger your reports use.

You can check the answer instead of trusting a black box.

See the AI chat: {{site}}
```

## 3. X / Bluesky — AI chat

```text
Ask your ledger: "How did October compare with September?"

The assistant answers with the numbers and KPI cards from your own data.

AI chat, not a generic chatbot.

{{site}}
```

## 4. LinkedIn — OCR carousel

```text
From supplier PDF to purchase invoice in four steps:

1. Upload the document.
2. Preview the original.
3. Review the extracted supplier, dates, items and VAT.
4. Create the purchase invoice.

Nothing is saved until you approve the fields.

See the OCR flow: {{site}}
```

## 5. X Arabic — OCR

```text
ارفع فاتورة المورد، عاين المستند، راجع الحقول، ثم أنشئ فاتورة الشراء.

استخراج الفواتير OCR داخل فاتورتك — بدون نسخ ولصق بين نظامين.

{{site}}
```

## 6. LinkedIn — AI chat / Arabic

```text
المساعد الذكي لا يكتفي بالدردشة.

اسأله: «كيف كان أكتوبر مقارنة بسبتمبر؟» ويعيد لك الأرقام وبطاقات المؤشرات من بيانات شركتك.

راجع الإجابة، ثم اتخذ القرار.

جرّبه: {{site}}
```

## 7. X / Bluesky — honest OCR

```text
OCR is not magic. The model can misread a date or a tax line.

That is why Fatortak shows the document next to the extracted fields and waits for your review before saving.

Review every field. Then create the invoice.
```

## 8. Instagram / TikTok — OCR script

```text
Hook (0–2s): "Your accountant should not retype this PDF."
Screen (2–6s): Upload a supplier invoice.
Screen (6–10s): Preview the document.
Screen (10–16s): Review supplier, dates, items and VAT.
Screen (16–20s): Create the purchase invoice.
CTA: "See the OCR flow at fatortak.rabbeh.com."
```

## 9. X Arabic — AI chat

```text
اسأل دفترك بلغتك: «من عليه أكبر مبلغ مستحق؟»

المساعد الذكي يجيب بأرقام من بياناتك، مع بطاقات مؤشرات ورسوم.

جرّب فاتورتك: {{site}}
```

## 10. LinkedIn — AI chat, proof-first

```text
A chat answer without a number is entertainment.

Fatortak's assistant returns revenue, expenses, profit and margin — with KPI cards and charts from your invoices, expenses and projects.

The point is not to talk to your books. The point is to close the month with fewer surprises.

See the AI chat: {{site}}
```

---

## Asset notes

- Crop screenshots to the relevant area; do not show the full browser chrome on every post.
- Add alt text to every image. Example: "Fatortak OCR screen showing an uploaded supplier invoice and the extracted field review."
- For the OCR video, show the review step for at least 4 seconds. It is the trust moment.
- For the AI video, show the question, the answer and the KPI cards. Do not show a generic chatbot.
- Arabic captions should be written natively, not machine-translated.

## Claims to keep

- "OCR extracts invoice fields for review." Not "OCR is always correct."
- "AI answers from your business data." Not "AI is always right."
- "VAT-ready invoices." Not "ETA/ZATCA certified."
- "Open source under AGPL-3.0." Accurate.
- "Demo data" on every screenshot that shows numbers.
