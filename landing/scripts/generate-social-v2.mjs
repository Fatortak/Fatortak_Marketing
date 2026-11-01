import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = "C:/Users/a.nasser/AppData/Local/Temp/opencode/fatortak-marketing-pr/marketing/landing";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT_DIR = path.join(ROOT, "assets/screenshots");
const TEMPLATE = "file:///" + path.join(ROOT, ".social-card-v2.html").replace(/\\/g, "/");
const cards = [
  ["vat", "Product", "VAT-ready invoices", "that post to the ledger.", "Line-level VAT, discounts and totals — not a spreadsheet formula.", "Invoices|VAT|Accounting|Arabic + English", "sell-invoices.png", "purple", "en"],
  ["ai-chat", "AI assistant", "Ask your business", "a real question.", "Arabic or English, with charts and the numbers behind them.", "AI|Arabic + English|Insights|Open source", "ai-chat.png", "cyan", "en"],
  ["ocr", "AI & OCR", "Snap a supplier invoice.", "Review the lines.", "OCR extraction with a review step — you approve what posts.", "OCR|Invoices|Review|Arabic", "ocr-invoice.png", "amber", "en"],
  ["dashboard", "Business OS", "Run the whole business.", "In one place.", "Invoices, accounting, projects, inventory and payroll.", "Invoices|Accounting|Projects|Payroll", "dashboard.png", "purple", "en"],
  ["profit", "Projects", "Know the margin", "per project.", "Link invoices, expenses, payroll and purchases to the project.", "Projects|Profitability|Reports|Clients", "project-profitability.png", "green", "en"],
  ["receivables", "Cash flow", "Who owes you?", "Know before it hurts.", "Reconcile receivables weekly, not after the cash gets tight.", "Receivables|Cash flow|AI|Reports", "ai-chat-receivables.png", "amber", "en"],
  ["clients", "Clients", "Every client.", "Every balance.", "Clients, invoices and outstanding balances in one view.", "Clients|Invoices|CRM|Arabic", "clients.png", "cyan", "en"],
  ["income", "Reports", "Statements that read", "from the ledger.", "Income statement, balance sheet and VAT reports from one source.", "Reports|Accounting|VAT|Audit-ready", "income-statement.png", "green", "en"],
  ["operations", "Operations", "One ledger for", "the whole operation.", "Payroll, inventory and cheques post to the same books.", "Payroll|Inventory|Cheques|Accounting", "dashboard.png", "purple", "en"],
  ["open", "Open source", "Read the code", "that touches your money.", "AGPL-3.0. Self-host it, audit it, fork it.", "AGPL-3.0|Self-host|Audit|GitHub", "dashboard.png", "green", "en"],
  ["arabic", "Arabic-first", "فواتير عربية", "من نفس النظام.", "فواتير وضريبة قيمة مضافة وتقارير محاسبية عربية من دفتر واحد.", "فواتير|ضريبة|تقارير|عربي", "dashboard.png", "purple", "ar"],
  ["pricing", "Pricing", "Starter 300.", "Professional 600.", "Enterprise 900 EGP/month. All prices per month; managed hosting included.", "Starter 300|Professional 600|Enterprise 900|EGP", "dashboard.png", "amber", "en"],
  ["agencies", "Use case", "Built for agencies.", "Know client profit.", "Retainers, project fees and freelance costs in one place.", "Agencies|Projects|Profitability|Retainers", "project-profitability.png", "cyan", "en"],
  ["retail", "Use case", "Built for retail.", "Daily clarity.", "Items, sales invoices, purchase costs and expenses together.", "Retail|Inventory|Invoices|VAT", "sell-invoices.png", "green", "en"],
  ["family", "Use case", "Roles and approvals", "for family teams.", "A shared ledger with approvals and a clear owner view.", "Approvals|Roles|Ledger|Team", "clients.png", "purple", "en"],
  ["monthend", "Insight", "Month-end close", "without the spreadsheet.", "Invoices, payments and expenses post to the ledger automatically.", "Month-end|Accounting|Reports|Automation", "income-statement.png", "amber", "en"],
  ["dataentry", "Insight", "The bottleneck is", "data entry.", "OCR and validation remove the copy-paste, not the accounting.", "OCR|Data entry|Invoices|Review", "ocr-invoice.png", "cyan", "en"],
  ["spreadsheet", "Insight", "Remove the spreadsheet.", "Keep the ledger.", "One database for invoicing, accounting, projects and payroll.", "Spreadsheet|Ledger|Accounting|Open source", "dashboard.png", "green", "en"],
  ["cashflow", "Insight", "Cash flow is", "a data problem.", "Receivables, cheques and payment dates in one view.", "Cash flow|Receivables|AI|Reports", "ai-chat-receivables.png", "amber", "en"],
  ["vatline", "Product", "VAT on every line.", "Not just the total.", "Line-level VAT that posts to the same ledger the reports read.", "VAT|Invoices|Accounting|Egypt", "sell-invoices.png", "purple", "en"],
  ["aichart", "AI assistant", "Ask for a chart.", "Get the number.", "Charts and answers from your own business data.", "AI|Charts|Insights|Arabic", "ai-chat-chart.png", "cyan", "en"],
  ["aibusiness", "AI assistant", "Your business,", "in a conversation.", "Ask about invoices, projects, clients and cash flow.", "AI|Clients|Invoices|Arabic", "ai-chat.png", "amber", "en"],
  ["projects", "Projects", "Every project.", "Every cost.", "Projects, invoices, expenses and margins in one place.", "Projects|Costs|Margin|Reports", "projects.png", "green", "en"],
  ["ocrreview", "AI & OCR", "OCR extracts.", "You review.", "A review step for every extracted supplier invoice.", "OCR|Review|Invoices|Arabic", "ocr-invoice.png", "purple", "en"],
  ["cloud", "Commercial", "Managed hosting.", "Backups and support.", "Fatortak Cloud from 300 EGP/month.", "Cloud|Backups|Updates|Support", "dashboard.png", "cyan", "en"],
  ["migration", "Commercial", "Migration included.", "Start with your data.", "Chart of accounts, customers and open invoices migrated.", "Migration|Onboarding|Data|Support", "clients.png", "amber", "en"],
  ["onprem", "Enterprise", "SSO, audit logs,", "on-prem.", "Enterprise deployment on the roadmap — tell us what you need.", "Enterprise|SSO|Audit|On-prem", "dashboard.png", "green", "en"],
  ["arabicreports", "Arabic-first", "تقارير عربية", "من نفس الدفتر.", "قائمة الدخل والميزانية وتقارير الضريبة من مصدر واحد.", "تقارير|محاسبة|ضريبة|عربي", "income-statement.png", "purple", "ar"],
  ["arabicprojects", "Arabic-first", "ربح كل مشروع", "بالأرقام.", "اربط الفواتير والمصروفات والرواتب بالمشروع.", "مشاريع|ربح|فواتير|عربي", "project-profitability.png", "amber", "ar"],
  ["arabicai", "Arabic-first", "اسأل نظامك", "بالعربي.", "مساعد ذكي يجيب من فواتيرك وتقاريرك مباشرة.", "ذكاء اصطناعي|عربي|فواتير|تقارير", "ai-chat.png", "cyan", "ar"]
];

function shot([id, badge, l1, l2, sub, chips, screen, theme, lang], index) {
  return new Promise((resolve) => {
    const out = path.join(OUT_DIR, `social-v2-${String(index + 1).padStart(2, "0")}-${id}.png`);
    if (fs.existsSync(out)) { resolve(out); return; }
    const params = new URLSearchParams({ badge, l1, l2, sub, chips, screen, theme, lang, url: `fatortak / ${screen.replace(/\.png$/, "")}` });
    const profile = path.join(os.tmpdir(), `fatortak-card-${process.pid}-${index}`);
    const args = [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
      "--window-size=1200,630", "--virtual-time-budget=2500",
      `--user-data-dir=${profile}`,
      `--screenshot=${out}`,
      `${TEMPLATE}?${params.toString()}`
    ];
    const child = spawn(CHROME, args, { windowsHide: true, stdio: "ignore" });
    const started = Date.now();
    const timer = setInterval(() => {
      if (fs.existsSync(out) && fs.statSync(out).size > 20000) {
        clearInterval(timer);
        setTimeout(() => { try { child.kill(); } catch {} resolve(out); }, 500);
      } else if (Date.now() - started > 20000) {
        clearInterval(timer);
        try { child.kill(); } catch {}
        resolve(null);
      }
    }, 500);
  });
}

const results = [];
for (let i = 0; i < cards.length; i++) {
  const file = await shot(cards[i], i);
  results.push({ file: file ? path.basename(file) : null, ok: Boolean(file) });
  console.log(`${i + 1}/${cards.length} ${results[i].ok ? "ok" : "failed"} ${results[i].file || ""}`);
}
console.log(JSON.stringify({ generated: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length }, null, 2));
