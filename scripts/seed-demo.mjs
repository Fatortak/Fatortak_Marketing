/**
 * Local-only demo data seeder for Fatortak.
 *
 * It talks to a locally running Fatortak API and a dedicated demo database.
 * Never point this script at production.
 *
 * Usage:
 *   node marketing/scripts/seed-demo.mjs
 *
 * Required local demo tenant (created through /api/auth/register):
 *   owner@nilecrescent.example / Demo123!
 */

const API = process.env.DEMO_API_URL || "http://localhost:5002";
const EMAIL = process.env.DEMO_EMAIL || "layla@nilecrescent.example";
const PASSWORD = process.env.DEMO_PASSWORD || "Demo123!";

if (API.includes("fatortak.net") || API.includes("http")) {
  if (!API.startsWith("http://localhost") && !API.startsWith("http://127.0.0.1")) {
    throw new Error(`Refusing to seed a non-local API: ${API}`);
  }
}

let token = "";
let tenantId = "";
let userId = "";
let companyId = "";
let defaultPaymentAccountId = "";

const log = (message) => console.log(`[seed] ${message}`);

async function request(path, { method = "GET", body, form, expect = "json" } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text.slice(0, 600)}`);
  }

  if (expect === "service" && data && data.success === false) {
    throw new Error(`${method} ${path} -> ${data.errorMessage || JSON.stringify(data).slice(0, 500)}`);
  }

  return data;
}

const postJson = (path, body) => request(path, { method: "POST", body, expect: "service" });

function formData(fields, file) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    fd.append(key, String(value));
  }
  if (file) fd.append(file.field, file.blob, file.name);
  return fd;
}

async function login() {
  const response = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(`Login failed: ${data.errorMessage || response.status}`);
  }
  token = data.data.token;
  tenantId = data.data.tenant.id;
  userId = data.data.user.id;
  log(`signed in to tenant ${tenantId}`);
}

async function updateCompany() {
  const current = await request("/api/companies/current");
  companyId = current.data.id;
  await postJson(`/api/companies/update/${companyId}`, {
    name: "Nile Crescent Studio",
    address: "12 Al-Ahram St, Giza, Egypt",
    phone: "+20 100 555 0192",
    email: "hello@nilecrescent.example",
    taxNumber: "512-884-301",
    vatNumber: "512-884-301",
    currency: "EGP",
    defaultVatRate: 0.14,
    invoicePrefix: "NCS-",
    enableMultipleBranches: false,
  });
  log("company profile updated");
}

const cache = {
  items: null,
  customers: null,
  projects: null,
  expenses: null,
  employees: null,
  departments: null,
  sellInvoices: null,
  buyInvoices: null,
};

async function loadPaged(path, cacheKey) {
  if (!cache[cacheKey]) {
    const result = await request(path);
    cache[cacheKey] = result.data?.data || [];
  }
  return cache[cacheKey];
}

async function createItem(item) {
  const existing = await loadPaged("/api/items?pageNumber=1&pageSize=200&isActive=true", "items");
  const match = existing.find((row) => row.code === item.code);
  if (match) return match.id;

  const body = formData({
    code: item.code,
    name: item.name,
    description: item.description,
    type: "service",
    unitPrice: item.unitPrice,
    purchaseUnitPrice: item.purchaseUnitPrice ?? 0,
    unit: item.unit || "project",
    vatRate: 0.14,
    quantity: 0,
  });
  const result = await request("/api/items", { method: "POST", form: body, expect: "service" });
  cache.items.push(result.data);
  return result.data.id;
}

async function createCustomer(customer) {
  const existing = await loadPaged("/api/customers?pageNumber=1&pageSize=200", "customers");
  const match = existing.find((row) => row.name === customer.name);
  if (match) return match.id;

  const result = await postJson("/api/customers", {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    taxNumber: customer.taxNumber,
    VATNumber: customer.taxNumber,
    paymentTerms: customer.paymentTerms || "Net 30",
    isSupplier: Boolean(customer.isSupplier),
    notes: customer.notes,
  });
  cache.customers.push(result.data);
  return result.data.id;
}

async function createProject(project) {
  const existing = await loadPaged("/api/projects?pageNumber=1&pageSize=200", "projects");
  const match = existing.find((row) => row.name === project.name);
  if (match) return match.id;

  const result = await postJson("/api/projects", {
    name: project.name,
    description: project.description,
    customerId: project.customerId,
    status: "Active",
    contractValue: project.contractValue,
    discount: 0,
  });
  cache.projects.push(result.data);
  return result.data.id;
}

async function createExpense(expense) {
  const existing = await loadPaged("/api/expenses?pageNumber=1&pageSize=200", "expenses");
  const match = existing.find((row) => row.notes === expense.notes);
  if (match) return match.id;

  const fd = formData({
    date: expense.date,
    total: expense.total,
    notes: expense.notes,
    categoryId: expense.categoryId,
    projectId: expense.projectId,
    paymentAccountId: defaultPaymentAccountId,
  });
  const result = await request("/api/expenses", { method: "POST", form: fd, expect: "service" });
  cache.expenses.push(result.data);
  return result.data.id;
}

async function createInvoice(invoice) {
  const cacheKey = invoice.invoiceType === "Buy" ? "buyInvoices" : "sellInvoices";
  const existing = await loadPaged(
    `/api/invoices?pageNumber=1&pageSize=200&invoiceType=${invoice.invoiceType || "Sell"}`,
    cacheKey,
  );
  const match = existing.find((row) => (row.notes || "") === (invoice.notes || ""));
  if (match) return match;

  const fd = formData({
    customerId: invoice.customerId,
    projectId: invoice.projectId,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    invoiceType: invoice.invoiceType || "Sell",
    status: invoice.status,
    notes: invoice.notes || "",
    terms: invoice.terms || "Payment due within 30 days.",
    downPayment: invoice.downPayment || 0,
    numberOfInstallments: 0,
    items: JSON.stringify(
      invoice.items.map((item) => ({
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: 0.14,
        discount: 0,
      })),
    ),
  });
  const result = await request("/api/invoices", { method: "POST", form: fd, expect: "service" });
  cache[cacheKey].push(result.data);
  return result.data;
}

async function createDepartment(name, description) {
  const existing = await loadPaged("/api/departments?pageNumber=1&pageSize=200", "departments");
  const match = existing.find((row) => row.name === name);
  if (match) return match.id;

  const result = await postJson("/api/departments", { name, description });
  cache.departments.push(result.data);
  return result.data.id;
}

async function createEmployee(employee) {
  const existing = await loadPaged("/api/employees?pageNumber=1&pageSize=200", "employees");
  const match = existing.find((row) => row.email === employee.email);
  if (match) return match.id;

  const result = await postJson("/api/employees", {
    departmentId: employee.departmentId,
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone,
    position: employee.position,
    hireDate: employee.hireDate,
    salary: employee.salary,
  });
  cache.employees.push(result.data);
  return result.data.id;
}

async function main() {
  await login();
  await updateCompany();

  const categories = await request("/api/expensecategory");
  const categoryId = (name) => {
    const found = categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
    if (!found) throw new Error(`Missing expense category: ${name}`);
    return found.id;
  };

  const accounts = await request("/api/accounting/accounts?pageNumber=1&pageSize=100");
  const bankAccount = (accounts.data?.data || []).find((account) => account.accountCode === "1100");
  if (!bankAccount) throw new Error("Demo bank account 1100 was not found");
  defaultPaymentAccountId = bankAccount.id;
  log(`using bank account ${bankAccount.accountName || "1100"} for demo expenses`);

  const items = {};
  const itemSeeds = [
    {
      code: "SRV-101",
      name: "Brand Identity System",
      description: "Strategy, visual identity, guidelines and launch assets.",
      unitPrice: 145000,
      purchaseUnitPrice: 22000,
    },
    {
      code: "SRV-102",
      name: "UI/UX Product Sprint",
      description: "Discovery, journey mapping, wireframes and high-fidelity UI.",
      unitPrice: 92000,
      purchaseUnitPrice: 15000,
    },
    {
      code: "SRV-103",
      name: "Web Platform Build",
      description: "Responsive web platform, CMS integration and QA.",
      unitPrice: 240000,
      purchaseUnitPrice: 42000,
    },
    {
      code: "SRV-104",
      name: "Social Media Retainer",
      description: "Monthly content design, scheduling and reporting.",
      unitPrice: 35000,
      purchaseUnitPrice: 6000,
    },
    {
      code: "SRV-105",
      name: "Motion Design Package",
      description: "Campaign animation, edit and platform-ready exports.",
      unitPrice: 38250,
      purchaseUnitPrice: 4500,
    },
    {
      code: "SRV-106",
      name: "SEO & Content Audit",
      description: "Technical audit, keyword map and content recommendations.",
      unitPrice: 64000,
      purchaseUnitPrice: 9000,
    },
    {
      code: "SRV-107",
      name: "Product Photography Day",
      description: "Studio photography, retouching and usage-ready assets.",
      unitPrice: 18000,
      purchaseUnitPrice: 6500,
    },
    {
      code: "SRV-108",
      name: "Cloud Infrastructure Setup",
      description: "Cloud environment, CI/CD and observability baseline.",
      unitPrice: 42000,
      purchaseUnitPrice: 18000,
    },
    {
      code: "SRV-109",
      name: "Print Collateral Set",
      description: "Editorial layout, print production and delivery.",
      unitPrice: 12500,
      purchaseUnitPrice: 7200,
    },
  ];

  for (const item of itemSeeds) {
    items[item.code] = await createItem(item);
  }
  log(`created ${Object.keys(items).length} services`);

  const clients = {};
  const clientSeeds = [
    {
      key: "nileGate",
      name: "Nile Gate Developments",
      email: "projects@nilegate.example",
      phone: "+20 2 2735 4100",
      address: "Nile Corniche Tower, Cairo, Egypt",
      taxNumber: "310-552-881",
      notes: "Real-estate launch partner. Monthly steering committee.",
    },
    {
      key: "sahara",
      name: "Sahara Retail Group",
      email: "marketing@sahararetail.example",
      phone: "+20 2 2401 7788",
      address: "City Stars, Nasr City, Cairo, Egypt",
      taxNumber: "441-209-772",
      notes: "Retail group with 14 stores across Greater Cairo.",
    },
    {
      key: "levant",
      name: "Levant Hospitality Partners",
      email: "guest.experience@levant.example",
      phone: "+961 1 366 220",
      address: "Achrafieh, Beirut, Lebanon",
      taxNumber: "LB-882-041",
      notes: "Boutique hospitality group. Bilingual deliverables.",
    },
    {
      key: "delta",
      name: "Delta Health Systems",
      email: "digital@deltahealth.example",
      phone: "+20 3 486 1900",
      address: "Smouha, Alexandria, Egypt",
      taxNumber: "702-118-345",
      notes: "Patient experience programme. Security review required.",
    },
    {
      key: "riyadh",
      name: "Riyadh Creative District",
      email: "partnerships@riyadhcreative.example",
      phone: "+966 11 482 6600",
      address: "King Fahd Road, Riyadh, Saudi Arabia",
      taxNumber: "SA-310-882-004",
      notes: "Cultural district launch. Arabic-first identity work.",
    },
    {
      key: "beirut",
      name: "Beirut Design Collective",
      email: "studio@beirutdesign.example",
      phone: "+961 1 992 114",
      address: "Mar Mikhael, Beirut, Lebanon",
      taxNumber: "LB-501-227",
      notes: "Design-led retail concept.",
    },
    {
      key: "oasis",
      name: "Oasis Foods",
      email: "brand@oasisfoods.example",
      phone: "+20 2 2517 8800",
      address: "6th of October City, Giza, Egypt",
      taxNumber: "520-441-889",
      notes: "FMCG portfolio. Campaign work only.",
    },
    {
      key: "alex",
      name: "Alexandria Marine Logistics",
      email: "operations@alexmarine.example",
      phone: "+20 3 480 2201",
      address: "El Dekheila Port, Alexandria, Egypt",
      taxNumber: "804-220-187",
      notes: "Corporate website and content programme.",
    },
  ];

  for (const client of clientSeeds) {
    clients[client.key] = await createCustomer(client);
  }
  log(`created ${Object.keys(clients).length} clients`);

  const suppliers = {};
  const supplierSeeds = [
    {
      key: "printworks",
      name: "Printworks Cairo",
      email: "orders@printworks.example",
      phone: "+20 2 2685 4410",
      address: "Shubra, Cairo, Egypt",
      taxNumber: "611-442-009",
      notes: "Print production and finishing partner.",
    },
    {
      key: "cloud",
      name: "Gulf Cloud Hosting",
      email: "billing@gulfcloud.example",
      phone: "+971 4 552 1100",
      address: "Dubai Internet City, Dubai, UAE",
      taxNumber: "AE-100-442-881",
      notes: "Cloud and managed database services.",
    },
    {
      key: "supplies",
      name: "Studio Supplies Co.",
      email: "hello@studiosupplies.example",
      phone: "+20 2 2519 6612",
      address: "Zamalek, Cairo, Egypt",
      taxNumber: "720-991-203",
      notes: "Equipment and studio consumables.",
    },
  ];

  for (const supplier of supplierSeeds) {
    suppliers[supplier.key] = await createCustomer({ ...supplier, isSupplier: true });
  }
  log(`created ${Object.keys(suppliers).length} suppliers`);

  const projectSeeds = [
    {
      key: "aurora",
      name: "Aurora Residences — Brand Launch",
      description: "Full brand platform, launch website and sales gallery toolkit for a 320-unit residential launch.",
      customerId: clients.nileGate,
      contractValue: 480000,
    },
    {
      key: "zed",
      name: "Zed Retail — Commerce Platform",
      description: "Bilingual commerce experience, design system and store operations dashboard.",
      customerId: clients.sahara,
      contractValue: 720000,
    },
    {
      key: "marsa",
      name: "Marsa Hospitality — Digital Guest Journey",
      description: "Guest journey mapping, booking experience and property content system.",
      customerId: clients.levant,
      contractValue: 390000,
    },
    {
      key: "deltaCare",
      name: "Delta Care — Patient Portal",
      description: "Patient portal UX, appointment flows and accessibility review.",
      customerId: clients.delta,
      contractValue: 610000,
    },
  ];

  const projects = {};
  for (const project of projectSeeds) {
    projects[project.key] = await createProject(project);
  }
  log(`created ${Object.keys(projects).length} projects`);

  // Paid invoices first to fund the demo cash account.
  await createInvoice({
    customerId: clients.riyadh,
    issueDate: "2026-09-05",
    dueDate: "2026-10-05",
    status: "Paid",
    notes: "Arabic-first brand identity system. Phase 1 delivered.",
    items: [
      {
        itemId: items["SRV-101"],
        description: "Brand identity system — strategy, visual language and guidelines",
        quantity: 1,
        unitPrice: 145000,
      },
    ],
  });

  await createInvoice({
    customerId: clients.oasis,
    issueDate: "2026-08-18",
    dueDate: "2026-09-17",
    status: "Paid",
    notes: "Ramadan campaign motion package.",
    items: [
      {
        itemId: items["SRV-105"],
        description: "Motion design package — two campaign films",
        quantity: 2,
        unitPrice: 38250,
      },
    ],
  });

  await createInvoice({
    customerId: clients.nileGate,
    issueDate: "2026-05-12",
    dueDate: "2026-06-11",
    status: "Paid",
    notes: "Sales gallery UI sprint.",
    items: [
      {
        itemId: items["SRV-102"],
        description: "Sales gallery UI/UX sprint",
        quantity: 1,
        unitPrice: 120000,
      },
    ],
  });
  log("created opening paid invoices");

  const expenseSeeds = [
    { date: "2026-10-01", total: 18000, notes: "Studio rent — October", category: "Rent" },
    { date: "2026-09-30", total: 165000, notes: "September payroll", category: "Salaries" },
    { date: "2026-10-03", total: 4200, notes: "Electricity and internet", category: "Utilities" },
    { date: "2026-10-05", total: 6800, notes: "Workspace supplies and courier", category: "Office Expenses" },
    { date: "2026-10-08", total: 2400, notes: "Client visit — New Cairo", category: "Transportation" },
    { date: "2026-09-22", total: 12000, notes: "Prototype materials", category: "Raw Materials" },
    {
      date: "2026-07-12",
      total: 18000,
      notes: "Aurora launch — photography day",
      category: "Raw Materials",
      projectKey: "aurora",
    },
    {
      date: "2026-08-02",
      total: 32000,
      notes: "Aurora — sales gallery print production",
      category: "Raw Materials",
      projectKey: "aurora",
    },
    {
      date: "2026-08-20",
      total: 9500,
      notes: "Zed — staging cloud environment",
      category: "Utilities",
      projectKey: "zed",
    },
    {
      date: "2026-09-10",
      total: 11000,
      notes: "Zed — launch content production",
      category: "Raw Materials",
      projectKey: "zed",
    },
    {
      date: "2026-09-28",
      total: 7500,
      notes: "Delta Care — patient research incentives",
      category: "General",
      projectKey: "deltaCare",
    },
    {
      date: "2026-05-05",
      total: 15000,
      notes: "Marsa — property styling and set dressing",
      category: "General",
      projectKey: "marsa",
    },
    {
      date: "2026-06-18",
      total: 8600,
      notes: "Marsa — guest journey workshop venue",
      category: "Transportation",
      projectKey: "marsa",
    },
  ];

  for (const expense of expenseSeeds) {
    await createExpense({
      date: expense.date,
      total: expense.total,
      notes: expense.notes,
      categoryId: categoryId(expense.category),
      projectId: expense.projectKey ? projects[expense.projectKey] : undefined,
    });
  }
  log(`created ${expenseSeeds.length} expenses`);

  const projectInvoices = [
    {
      projectKey: "aurora",
      customerId: clients.nileGate,
      issueDate: "2026-07-01",
      dueDate: "2026-07-31",
      status: "Pending",
      notes: "Brand platform and launch website. 50% on signing, balance on launch.",
      items: [
        {
          itemId: items["SRV-103"],
          description: "Launch website and sales gallery platform",
          quantity: 1,
          unitPrice: 240000,
        },
        {
          itemId: items["SRV-101"],
          description: "Brand identity system for Aurora Residences",
          quantity: 1,
          unitPrice: 181052.63,
        },
      ],
    },
    {
      projectKey: "zed",
      customerId: clients.sahara,
      issueDate: "2026-08-10",
      dueDate: "2026-09-09",
      status: "PartialPaid",
      downPayment: 200000,
      notes: "Commerce platform phase 1. Mobilisation payment received.",
      items: [
        {
          itemId: items["SRV-103"],
          description: "Commerce platform build — phase 1",
          quantity: 1,
          unitPrice: 540000,
        },
      ],
    },
    {
      projectKey: "marsa",
      customerId: clients.levant,
      issueDate: "2026-04-15",
      dueDate: "2026-05-15",
      status: "Paid",
      notes: "Digital guest journey programme — completed and signed off.",
      items: [
        {
          itemId: items["SRV-103"],
          description: "Guest journey platform and booking experience",
          quantity: 1,
          unitPrice: 390000,
        },
      ],
    },
    {
      projectKey: "deltaCare",
      customerId: clients.delta,
      issueDate: "2026-09-20",
      dueDate: "2026-10-20",
      status: "Pending",
      notes: "Patient portal phase 1 — discovery and core flows.",
      items: [
        {
          itemId: items["SRV-102"],
          description: "Patient portal UX and core appointment flows",
          quantity: 1,
          unitPrice: 460000,
        },
      ],
    },
  ];

  for (const invoice of projectInvoices) {
    await createInvoice({
      ...invoice,
      projectId: projects[invoice.projectKey],
    });
  }
  log("created project invoices");

  await createInvoice({
    customerId: clients.beirut,
    issueDate: "2026-10-01",
    dueDate: "2026-10-31",
    status: "Pending",
    notes: "Design sprint for flagship store experience.",
    items: [
      {
        itemId: items["SRV-102"],
        description: "Store experience design sprint",
        quantity: 1,
        unitPrice: 92000,
      },
    ],
  });

  await createInvoice({
    customerId: clients.sahara,
    issueDate: "2026-06-01",
    dueDate: "2026-06-30",
    status: "Overdue",
    notes: "Q2 social retainer. Follow-up sent.",
    items: [
      {
        itemId: items["SRV-104"],
        description: "Social media retainer — Q2",
        quantity: 1,
        unitPrice: 38000,
      },
    ],
  });

  await createInvoice({
    customerId: clients.alex,
    issueDate: "2026-10-20",
    dueDate: "2026-11-19",
    status: "Draft",
    notes: "Draft scope pending client sign-off.",
    items: [
      {
        itemId: items["SRV-106"],
        description: "SEO and content audit",
        quantity: 1,
        unitPrice: 64000,
      },
    ],
  });

  await createInvoice({
    customerId: clients.levant,
    issueDate: "2026-10-10",
    dueDate: "2026-11-09",
    status: "Pending",
    notes: "October content retainer.",
    items: [
      {
        itemId: items["SRV-104"],
        description: "Social media retainer — October",
        quantity: 1,
        unitPrice: 35000,
      },
    ],
  });

  await createInvoice({
    customerId: clients.sahara,
    issueDate: "2026-10-15",
    dueDate: "2026-11-14",
    status: "Pending",
    notes: "Holiday campaign production.",
    items: [
      {
        itemId: items["SRV-105"],
        description: "Holiday campaign motion package",
        quantity: 1,
        unitPrice: 38250,
      },
    ],
  });

  await createInvoice({
    customerId: clients.nileGate,
    issueDate: "2026-09-25",
    dueDate: "2026-10-25",
    status: "Pending",
    notes: "Aurora sales gallery content refresh.",
    items: [
      {
        itemId: items["SRV-107"],
        description: "Sales gallery photography refresh",
        quantity: 2,
        unitPrice: 18000,
      },
    ],
  });
  log("created remaining sales invoices");

  await createInvoice({
    customerId: suppliers.printworks,
    invoiceType: "Buy",
    issueDate: "2026-08-01",
    dueDate: "2026-08-31",
    status: "Pending",
    notes: "Aurora sales gallery print production.",
    items: [
      {
        itemId: items["SRV-109"],
        description: "Print collateral production",
        quantity: 3,
        unitPrice: 12500,
      },
    ],
  });

  await createInvoice({
    customerId: suppliers.cloud,
    invoiceType: "Buy",
    issueDate: "2026-09-01",
    dueDate: "2026-09-30",
    status: "Pending",
    notes: "Managed cloud environment — September.",
    items: [
      {
        itemId: items["SRV-108"],
        description: "Managed cloud environment",
        quantity: 1,
        unitPrice: 18000,
      },
    ],
  });

  await createInvoice({
    customerId: suppliers.supplies,
    invoiceType: "Buy",
    issueDate: "2026-10-12",
    dueDate: "2026-11-11",
    status: "Draft",
    notes: "Studio equipment quote awaiting approval.",
    items: [
      {
        itemId: items["SRV-107"],
        description: "Lighting and studio equipment",
        quantity: 1,
        unitPrice: 27500,
      },
    ],
  });
  log("created purchase invoices");

  const departments = {};
  departments.creative = await createDepartment("Creative", "Brand, art direction and content");
  departments.technology = await createDepartment("Technology", "Product design and engineering");
  departments.strategy = await createDepartment("Strategy", "Client leadership, research and growth");
  log("created departments");

  const employeeSeeds = [
    {
      fullName: "Layla Hassan",
      email: "layla@nilecrescent.example",
      phone: "+20 100 555 0192",
      position: "Founder & Managing Director",
      hireDate: "2021-02-01",
      salary: 55000,
      departmentId: departments.strategy,
    },
    {
      fullName: "Omar El-Sayed",
      email: "omar@nilecrescent.example",
      phone: "+20 100 555 0114",
      position: "Creative Director",
      hireDate: "2021-06-14",
      salary: 42000,
      departmentId: departments.creative,
    },
    {
      fullName: "Mariam Fahmy",
      email: "mariam@nilecrescent.example",
      phone: "+20 100 555 0138",
      position: "Senior Brand Designer",
      hireDate: "2022-03-07",
      salary: 26000,
      departmentId: departments.creative,
    },
    {
      fullName: "Youssef Karim",
      email: "youssef@nilecrescent.example",
      phone: "+20 100 555 0171",
      position: "Motion Designer",
      hireDate: "2023-01-16",
      salary: 22000,
      departmentId: departments.creative,
    },
    {
      fullName: "Nour Abdelrahman",
      email: "nour@nilecrescent.example",
      phone: "+20 100 555 0142",
      position: "Lead Full-stack Engineer",
      hireDate: "2022-08-22",
      salary: 38000,
      departmentId: departments.technology,
    },
    {
      fullName: "Karim Fadel",
      email: "karim@nilecrescent.example",
      phone: "+20 100 555 0159",
      position: "QA & Accessibility Engineer",
      hireDate: "2024-04-02",
      salary: 21000,
      departmentId: departments.technology,
    },
    {
      fullName: "Salma Mansour",
      email: "salma@nilecrescent.example",
      phone: "+20 100 555 0186",
      position: "Account Director",
      hireDate: "2022-11-09",
      salary: 30000,
      departmentId: departments.strategy,
    },
    {
      fullName: "Hassan Raafat",
      email: "hassan@nilecrescent.example",
      phone: "+20 100 555 0127",
      position: "Content Strategist",
      hireDate: "2024-09-15",
      salary: 19000,
      departmentId: departments.strategy,
    },
  ];

  for (const employee of employeeSeeds) {
    await createEmployee(employee);
  }
  log(`created ${employeeSeeds.length} employees`);

  log("demo seed complete");
  log(`tenant: ${tenantId}`);
  log(`company: ${companyId}`);
  log(`user: ${userId}`);
}

main().catch((error) => {
  console.error(`[seed] FAILED: ${error.message}`);
  process.exitCode = 1;
});
