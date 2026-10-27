const API = "http://localhost:5002";
const login = await fetch(`${API}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "layla@nilecrescent.example", password: "Demo123!" }),
}).then((r) => r.json());
const headers = { Authorization: `Bearer ${login.data.token}` };

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { status: res.status, text }; }
}

const sells = await get("/api/invoices?pageNumber=1&pageSize=100&invoiceType=Sell");
const buys = await get("/api/invoices?pageNumber=1&pageSize=100&invoiceType=Buy");
const projects = await get("/api/projects?pageNumber=1&pageSize=100");
const dashboard = await get("/api/dashboard");
const accounts = await get("/api/accounting/accounts?pageNumber=1&pageSize=50");
const bank = accounts.data?.data?.find((a) => a.accountCode === "1100");
const bankBalance = bank ? await get(`/api/accounting/accounts/${bank.id}/balance`) : null;

console.log(JSON.stringify({
  sells: sells.data?.data?.map((i) => ({ number: i.invoiceNumber, customer: i.customerName, total: i.total, status: i.status, paid: i.amountPaid, date: i.issueDate, project: i.projectName })),
  buys: buys.data?.data?.map((i) => ({ number: i.invoiceNumber, supplier: i.customerName, total: i.total, status: i.status })),
  projects: projects.data?.data?.map((p) => ({ name: p.name, status: p.status, contract: p.contractValue, invoiced: p.totalInvoiced, expenses: p.totalExpenses, collected: p.totalCollected, net: p.netProfit })),
  dashboard: dashboard.data,
  bankBalance: bankBalance?.data,
}, null, 2));
