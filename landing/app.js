(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var STORAGE_KEY = "fatortak-lang";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var META = {
    en: {
      title: "Fatortak — Arabic-first business management, open source",
      description:
        "Invoicing, accounting, projects, inventory, payroll, AI chat and OCR invoice capture. Arabic-first, bilingual, open source under AGPL-3.0.",
      ogTitle: "Fatortak — Arabic-first business management, open source",
      ogDescription:
        "One Arabic-first ledger for invoices, accounting, projects, inventory, payroll, AI chat and OCR. Open source under AGPL-3.0.",
      toggle: "Switch to Arabic"
    },
    ar: {
      title: "فاتورتك — إدارة أعمال عربية أولاً، مفتوحة المصدر",
      description:
        "فواتير ومحاسبة ومشروعات ومخزون ورواتب ومساعد ذكي واستخراج فواتير OCR. عربي أولاً، ثنائي اللغة، مفتوح المصدر تحت AGPL-3.0.",
      ogTitle: "فاتورتك — إدارة أعمال عربية أولاً، مفتوحة المصدر",
      ogDescription:
        "دفتر واحد للفواتير والمحاسبة والمشروعات والمخزون والرواتب والذكاء الاصطناعي وOCR. مفتوح المصدر تحت AGPL-3.0.",
      toggle: "Switch to English"
    }
  };

  var SCREENS = {
    dashboard: {
      image: "assets/screenshots/dashboard.png",
      url: { en: "fatortak / dashboard", ar: "فاتورتك / لوحة التحكم" },
      alt: {
        en: "Fatortak dashboard showing revenue, expenses, bank balance and profit chart",
        ar: "لوحة تحكم فاتورتك تعرض الإيرادات والمصروفات والرصيد البنكي ورسوم الأرباح"
      },
      title: { en: "Your whole business, on one screen.", ar: "كل أعمالك في شاشة واحدة." },
      desc: {
        en: "Revenue, expenses, bank balance, receivables and payables update together.",
        ar: "الإيرادات والمصروفات والرصيد البنكي والمستحقات والمدفوعات تتحدث معاً."
      },
      bullets: {
        en: [
          "Live KPIs for revenue, expenses and cash",
          "Receivables and payables by client",
          "Profit and growth chart with monthly trends"
        ],
        ar: [
          "مؤشرات مباشرة للإيرادات والمصروفات والنقد",
          "المستحقات والمدفوعات حسب العميل",
          "رسم للأرباح والنمو مع اتجاهات شهرية"
        ]
      }
    },
    "ai-chat": {
      image: "assets/screenshots/ai-chat.png",
      url: { en: "fatortak / ai-chat", ar: "فاتورتك / المساعد الذكي" },
      alt: {
        en: "Fatortak AI chat answering a question about October revenue with KPI cards",
        ar: "محادثة فاتورتك الذكية تجيب عن سؤال حول إيرادات أكتوبر مع بطاقات مؤشرات"
      },
      title: { en: "Ask your ledger a question.", ar: "اسأل دفترك سؤالاً." },
      desc: {
        en: "The assistant answers with real figures and charts from your data.",
        ar: "يجيب المساعد بأرقام ورسوم حقيقية من بياناتك."
      },
      bullets: {
        en: ["Natural-language questions", "KPI cards and charts in the answer", "Session history and export"],
        ar: ["أسئلة بلغة طبيعية", "بطاقات مؤشرات ورسوم في الإجابة", "سجل المحادثات والتصدير"]
      }
    },
    "ocr-invoice": {
      image: "assets/screenshots/ocr-invoice.png",
      url: { en: "fatortak / ocr-invoice", ar: "فاتورتك / فاتورة OCR" },
      alt: {
        en: "Fatortak OCR invoice page with an uploaded supplier invoice preview",
        ar: "صفحة OCR لفاتورة المورد مع معاينة الفاتورة المرفوعة"
      },
      title: { en: "Upload a supplier invoice. Review the fields.", ar: "ارفع فاتورة مورد. راجع الحقول." },
      desc: {
        en: "Preview the document, extract invoice data, correct it, then create the purchase invoice.",
        ar: "عاين المستند، استخرج البيانات، صحّحها، ثم أنشئ فاتورة الشراء."
      },
      bullets: {
        en: ["PDF and image upload", "Side-by-side document preview", "Review before saving"],
        ar: ["رفع PDF وصور", "معاينة المستند جنباً إلى جنب", "المراجعة قبل الحفظ"]
      }
    },
    "sell-invoices": {
      image: "assets/screenshots/sell-invoices.png",
      url: { en: "fatortak / sell-invoices", ar: "فاتورتك / فواتير البيع" },
      alt: {
        en: "Fatortak sales invoices list with VAT, paid and remaining amounts",
        ar: "قائمة فواتير البيع في فاتورتك مع الضريبة والمدفوع والمتبقي"
      },
      title: { en: "Invoices that speak Arabic and English.", ar: "فواتير بالعربية والإنجليزية." },
      desc: {
        en: "VAT, discounts, installments, partial payments and bilingual PDFs.",
        ar: "ضريبة القيمة المضافة والخصومات والأقساط والمدفوعات الجزئية وملفات PDF ثنائية اللغة."
      },
      bullets: {
        en: ["VAT, discounts and partial payments", "Installments and due dates", "Bilingual invoice templates"],
        ar: ["ضريبة القيمة المضافة والخصومات والمدفوعات الجزئية", "الأقساط وتواريخ الاستحقاق", "قوالب فواتير ثنائية اللغة"]
      }
    },
    projects: {
      image: "assets/screenshots/projects.png",
      url: { en: "fatortak / projects", ar: "فاتورتك / المشروعات" },
      alt: {
        en: "Fatortak projects list with contract value and status",
        ar: "قائمة مشروعات فاتورتك مع قيمة العقد والحالة"
      },
      title: { en: "Know which projects make money.", ar: "اعرف أي مشروع يحقق ربحاً." },
      desc: {
        en: "Contract value, invoicing, costs and collections in one view.",
        ar: "قيمة العقد والفوترة والتكاليف والتحصيل في عرض واحد."
      },
      bullets: {
        en: ["Contract value, invoiced and collected", "Project expenses and net profit", "Profitability by project"],
        ar: ["قيمة العقد والفوترة والتحصيل", "مصروفات المشروع وصافي الربح", "الربحية حسب المشروع"]
      }
    },
    "income-statement": {
      image: "assets/screenshots/income-statement.png",
      url: { en: "fatortak / reports / income-statement", ar: "فاتورتك / التقارير / قائمة الدخل" },
      alt: {
        en: "Fatortak income statement showing revenue, expenses and net income",
        ar: "قائمة الدخل في فاتورتك تعرض الإيرادات والمصروفات وصافي الدخل"
      },
      title: { en: "Close the month with confidence.", ar: "أغلق الشهر بثقة." },
      desc: {
        en: "Income statement, trial balance, balance sheet, cash flow and project reports.",
        ar: "قائمة الدخل وميزان المراجعة والميزانية والتدفقات النقدية وتقارير المشروعات."
      },
      bullets: {
        en: ["Revenue and expense breakdown", "Date-range reporting", "Export for your accountant"],
        ar: ["تفصيل الإيرادات والمصروفات", "تقارير حسب الفترة", "تصدير لمحاسبك"]
      }
    }
  };

  var HERO_IDS = ["dashboard", "ai-chat", "ocr-invoice", "sell-invoices"];
  var SHOWCASE_IDS = ["dashboard", "ai-chat", "ocr-invoice", "sell-invoices", "projects", "income-statement"];

  var GALLERY = [
    {
      id: "dashboard",
      image: "assets/screenshots/dashboard.png",
      title: { en: "Dashboard", ar: "لوحة التحكم" },
      desc: {
        en: "Revenue, expenses, bank balance, receivables and profit in one view.",
        ar: "الإيرادات والمصروفات والرصيد البنكي والمستحقات والأرباح في عرض واحد."
      },
      alt: {
        en: "Fatortak dashboard showing revenue, expenses, bank balance and profit chart",
        ar: "لوحة تحكم فاتورتك تعرض الإيرادات والمصروفات والرصيد البنكي ورسوم الأرباح"
      }
    },
    {
      id: "ai-chat",
      image: "assets/screenshots/ai-chat.png",
      title: { en: "AI chat", ar: "المساعد الذكي" },
      desc: {
        en: "A real conversation with real demo figures and charts.",
        ar: "محادثة حقيقية بأرقام ورسوم تجريبية."
      },
      alt: {
        en: "Fatortak AI chat answering a question about October revenue with KPI cards",
        ar: "محادثة فاتورتك الذكية تجيب عن سؤال حول إيرادات أكتوبر مع بطاقات مؤشرات"
      }
    },
    {
      id: "ocr-invoice",
      image: "assets/screenshots/ocr-invoice.png",
      title: { en: "OCR invoice", ar: "فاتورة OCR" },
      desc: {
        en: "Upload, preview and review before creating the invoice.",
        ar: "ارفع وعاين وراجع قبل إنشاء الفاتورة."
      },
      alt: {
        en: "Fatortak OCR invoice page with an uploaded supplier invoice preview",
        ar: "صفحة OCR لفاتورة المورد مع معاينة الفاتورة المرفوعة"
      }
    },
    {
      id: "sell-invoices",
      image: "assets/screenshots/sell-invoices.png",
      title: { en: "Sales invoices", ar: "فواتير البيع" },
      desc: {
        en: "VAT, paid and remaining amounts, statuses and dates.",
        ar: "ضريبة القيمة المضافة والمدفوع والمتبقي والحالات والتواريخ."
      },
      alt: {
        en: "Fatortak sales invoices list with VAT, paid and remaining amounts",
        ar: "قائمة فواتير البيع في فاتورتك مع الضريبة والمدفوع والمتبقي"
      }
    },
    {
      id: "clients",
      image: "assets/screenshots/clients.png",
      title: { en: "Clients", ar: "العملاء" },
      desc: {
        en: "Contacts, tax numbers, balances and activity.",
        ar: "جهات الاتصال والأرقام الضريبية والأرصدة والنشاط."
      },
      alt: {
        en: "Fatortak clients list with contacts, tax numbers and status",
        ar: "قائمة عملاء فاتورتك مع جهات الاتصال والأرقام الضريبية والحالة"
      }
    },
    {
      id: "projects",
      image: "assets/screenshots/projects.png",
      title: { en: "Projects", ar: "المشروعات" },
      desc: {
        en: "Contract value, invoicing and collections.",
        ar: "قيمة العقد والفوترة والتحصيل."
      },
      alt: {
        en: "Fatortak projects list with contract value and status",
        ar: "قائمة مشروعات فاتورتك مع قيمة العقد والحالة"
      }
    },
    {
      id: "project-profitability",
      image: "assets/screenshots/project-profitability.png",
      title: { en: "Project profitability", ar: "ربحية المشروعات" },
      desc: {
        en: "See which projects actually make money.",
        ar: "اعرف أي المشروعات تحقق ربحاً فعلياً."
      },
      alt: {
        en: "Fatortak project profitability report showing invoiced, expenses and net profit",
        ar: "تقرير ربحية المشروعات في فاتورتك يعرض الفوترة والمصروفات وصافي الربح"
      }
    },
    {
      id: "income-statement",
      image: "assets/screenshots/income-statement.png",
      title: { en: "Income statement", ar: "قائمة الدخل" },
      desc: {
        en: "Revenue, expenses and net income for any period.",
        ar: "الإيرادات والمصروفات وصافي الدخل لأي فترة."
      },
      alt: {
        en: "Fatortak income statement showing revenue, expenses and net income",
        ar: "قائمة الدخل في فاتورتك تعرض الإيرادات والمصروفات وصافي الدخل"
      }
    }
  ];

  var AI_PROMPTS = {
    october: {
      image: "assets/screenshots/ai-chat.png",
      alt: {
        en: "Fatortak AI chat with an answer comparing October and September",
        ar: "محادثة فاتورتك الذكية مع إجابة تقارن أكتوبر وسبتمبر"
      },
      caption: {
        en: "October revenue was EGP 667,185 and net profit was EGP 635,785. Real demo answer.",
        ar: "بلغت إيرادات أكتوبر 667,185 جنيهاً وصافي الربح 635,785 جنيهاً. إجابة تجريبية حقيقية."
      }
    },
    projects: {
      image: "assets/screenshots/ai-chat-chart.png",
      alt: {
        en: "Fatortak AI chat showing a net profit by project chart",
        ar: "محادثة فاتورتك الذكية تعرض رسماً لصافي الربح حسب المشروع"
      },
      caption: {
        en: "Zed Retail leads project profit at EGP 595,100, followed by Delta Care at EGP 516,900.",
        ar: "يتصدر مشروع Zed Retail أرباح المشروعات بـ 595,100 جنيه، يليه Delta Care بـ 516,900 جنيه."
      }
    },
    receivables: {
      image: "assets/screenshots/ai-chat-receivables.png",
      alt: {
        en: "Fatortak AI chat showing open receivables by client",
        ar: "محادثة فاتورتك الذكية تعرض المستحقات المفتوحة حسب العميل"
      },
      caption: {
        en: "Open receivables total EGP 1,692,745. Delta Health leads with EGP 524,400.",
        ar: "إجمالي المستحقات المفتوحة 1,692,745 جنيهاً. تتصدر Delta Health بـ 524,400 جنيه."
      }
    }
  };

  var OCR_STEPS = {
    upload: {
      en: "Drop a PDF or image and preview it before extraction.",
      ar: "ارفع ملف PDF أو صورة وعاينه قبل الاستخراج."
    },
    extract: {
      en: "The configured AI model reads the supplier, dates, items and VAT.",
      ar: "يقرأ نموذج الذكاء المُعد المورد والتواريخ والأصناف والضريبة."
    },
    review: {
      en: "Correct any field side by side with the document. Nothing is saved yet.",
      ar: "صحّح أي حقل جنباً إلى جنب مع المستند. لا يُحفظ شيء بعد."
    },
    create: {
      en: "Create the purchase invoice when the reviewed data is ready.",
      ar: "أنشئ فاتورة الشراء عندما تصبح البيانات المراجعة جاهزة."
    }
  };

  var currentLang = document.documentElement.lang === "ar" ? "ar" : "en";
  var heroIndex = 0;
  var showcaseIndex = 0;
  var aiPromptKey = "october";
  var ocrStepKey = "upload";
  var lightboxIndex = 0;
  var tourTimer = null;
  var tourPlaying = false;
  var tourPausedByUser = false;

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function setText(node, value) {
    if (node) node.textContent = value;
  }

  function setMeta(selector, value) {
    var node = qs(selector);
    if (node) node.setAttribute("content", value);
  }

  function updateUrl(lang) {
    try {
      var url = new URL(window.location.href);
      if (lang === "ar") {
        url.searchParams.set("lang", "ar");
      } else {
        url.searchParams.delete("lang");
      }
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (e) {
      /* ignore */
    }
  }

  function applyLanguage(lang, persist) {
    lang = lang === "ar" ? "ar" : "en";
    currentLang = lang;
    var html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";

    document.title = META[lang].title;
    setMeta('meta[name="description"]', META[lang].description);
    setMeta('meta[property="og:title"]', META[lang].ogTitle);
    setMeta('meta[property="og:description"]', META[lang].ogDescription);
    setMeta('meta[name="twitter:title"]', META[lang].ogTitle);
    setMeta('meta[name="twitter:description"]', META[lang].ogDescription);

    var toggle = qs("[data-lang-toggle]");
    if (toggle) {
      var toggleLabel = (lang === "en" ? "العربية" : "English") + " — " + META[lang].toggle;
      toggle.setAttribute("aria-label", toggleLabel);
      toggle.setAttribute("title", toggleLabel);
    }

    qsa("img[data-alt-en]").forEach(function (img) {
      img.alt = img.getAttribute("data-alt-" + lang) || img.alt;
    });

    qsa(".shot-card [data-open-gallery]").forEach(function (button) {
      var id = button.getAttribute("data-open-gallery");
      var item = GALLERY.find(function (entry) { return entry.id === id; });
      if (item) {
        button.setAttribute("aria-label", lang === "ar" ? "عرض شاشة " + item.title.ar : "View " + item.title.en + " screenshot");
      }
    });
    var closeButton = qs("[data-lightbox-close]");
    if (closeButton) closeButton.setAttribute("aria-label", lang === "ar" ? "إغلاق" : "Close");
    var prevButton = qs("[data-showcase-prev]");
    var nextButton = qs("[data-showcase-next]");
    if (prevButton) prevButton.setAttribute("aria-label", lang === "ar" ? "الشاشة السابقة" : "Previous screen");
    if (nextButton) nextButton.setAttribute("aria-label", lang === "ar" ? "الشاشة التالية" : "Next screen");

    renderHero(HERO_IDS[heroIndex], false);
    renderShowcase(showcaseIndex, false);
    renderAiPrompt(aiPromptKey, false);
    renderOcrStep(ocrStepKey, false);
    if (qs("#lightbox") && qs("#lightbox").open) {
      renderLightbox(lightboxIndex);
    }

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {
        /* ignore */
      }
      updateUrl(lang);
    }
  }

  function renderHero(screenId, animate) {
    var screen = SCREENS[screenId];
    if (!screen) return;
    heroIndex = Math.max(0, HERO_IDS.indexOf(screenId));

    var screenWrap = qs(".hero-visual .browser-screen");
    var image = qs("[data-hero-screen]");
    var url = qs("[data-hero-url]");
    if (image) {
      if (animate && !reduceMotion) {
        image.style.opacity = "0";
        image.style.transform = "scale(1.015)";
        window.setTimeout(function () {
          image.src = screen.image;
          image.alt = screen.alt[currentLang];
          image.style.opacity = "";
          image.style.transform = "";
        }, 110);
      } else {
        image.src = screen.image;
        image.alt = screen.alt[currentLang];
        image.style.opacity = "";
        image.style.transform = "";
      }
    }
    if (url) url.textContent = screen.url[currentLang];
    if (screenWrap) {
      screenWrap.classList.add("is-switching");
      window.setTimeout(function () {
        screenWrap.classList.remove("is-switching");
      }, 380);
    }

    qsa(".screen-tab").forEach(function (tab) {
      var active = tab.getAttribute("data-screen") === screenId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    if (tourPlaying && animate) restartTourProgress();
  }

  function renderShowcase(index, animate) {
    showcaseIndex = (index + SHOWCASE_IDS.length) % SHOWCASE_IDS.length;
    var screenId = SHOWCASE_IDS[showcaseIndex];
    var screen = SCREENS[screenId];
    if (!screen) return;

    var image = qs("[data-showcase-screen]");
    var url = qs("[data-showcase-url]");
    var title = qs("[data-showcase-title]");
    var desc = qs("[data-showcase-desc]");
    var bullets = qs("[data-showcase-bullets]");
    var counter = qs("[data-showcase-counter]");
    var screenWrap = qs(".showcase-screen");

    if (image) {
      if (animate && !reduceMotion) {
        image.style.opacity = "0";
        image.style.transform = "scale(1.01) translateY(4px)";
        window.setTimeout(function () {
          image.src = screen.image;
          image.alt = screen.alt[currentLang];
          image.style.opacity = "";
          image.style.transform = "";
        }, 110);
      } else {
        image.src = screen.image;
        image.alt = screen.alt[currentLang];
        image.style.opacity = "";
        image.style.transform = "";
      }
    }
    if (url) url.textContent = screen.url[currentLang];
    if (title) title.textContent = screen.title[currentLang];
    if (desc) desc.textContent = screen.desc[currentLang];
    if (counter) counter.textContent = String(showcaseIndex + 1).padStart(2, "0") + " / " + String(SHOWCASE_IDS.length).padStart(2, "0");
    if (bullets) {
      bullets.textContent = "";
      (screen.bullets[currentLang] || []).forEach(function (item) {
        var li = document.createElement("li");
        li.textContent = item;
        bullets.appendChild(li);
      });
    }
    if (screenWrap) {
      screenWrap.classList.add("is-switching");
      window.setTimeout(function () {
        screenWrap.classList.remove("is-switching");
      }, 360);
    }

    qsa(".showcase-tab").forEach(function (tab) {
      var active = tab.getAttribute("data-screen") === screenId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    var openButton = qs("[data-open-gallery]", qs(".showcase-caption"));
    if (openButton) openButton.setAttribute("data-open-gallery", screenId);
  }

  function renderAiPrompt(key, animate) {
    var prompt = AI_PROMPTS[key] || AI_PROMPTS.october;
    aiPromptKey = AI_PROMPTS[key] ? key : "october";
    var image = qs("[data-ai-screen]");
    var caption = qs("[data-ai-caption]");
    if (image) {
      if (animate && !reduceMotion) {
        image.style.opacity = "0";
        window.setTimeout(function () {
          image.src = prompt.image;
          image.alt = prompt.alt[currentLang];
          image.style.opacity = "";
        }, 120);
      } else {
        image.src = prompt.image;
        image.alt = prompt.alt[currentLang];
        image.style.opacity = "";
      }
    }
    if (caption) caption.textContent = prompt.caption[currentLang];
    qsa("[data-ai-prompt]").forEach(function (button) {
      var active = button.getAttribute("data-ai-prompt") === aiPromptKey;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderOcrStep(key, animate) {
    var step = OCR_STEPS[key] || OCR_STEPS.upload;
    ocrStepKey = OCR_STEPS[key] ? key : "upload";
    var caption = qs("[data-ocr-caption]");
    if (caption) caption.textContent = step[currentLang];
    qsa("[data-ocr-step]").forEach(function (button) {
      var active = button.getAttribute("data-ocr-step") === ocrStepKey;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function renderLightbox(index) {
    lightboxIndex = (index + GALLERY.length) % GALLERY.length;
    var item = GALLERY[lightboxIndex];
    var image = qs("[data-lightbox-image]");
    var title = qs("[data-lightbox-title]");
    var desc = qs("[data-lightbox-desc]");
    var counter = qs("[data-lightbox-counter]");
    if (image) {
      image.src = item.image;
      image.alt = item.alt[currentLang];
    }
    if (title) title.textContent = item.title[currentLang];
    if (desc) desc.textContent = item.desc[currentLang];
    if (counter) counter.textContent = String(lightboxIndex + 1).padStart(2, "0") + " / " + String(GALLERY.length).padStart(2, "0");
  }

  function openLightbox(id) {
    var index = GALLERY.findIndex(function (item) {
      return item.id === id;
    });
    if (index < 0) index = 0;
    var dialog = qs("#lightbox");
    if (!dialog || typeof dialog.showModal !== "function") return;
    renderLightbox(index);
    dialog.showModal();
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    var dialog = qs("#lightbox");
    if (dialog && dialog.open) dialog.close();
  }

  function restartTourProgress() {
    var bar = qs("[data-tour-progress]");
    if (!bar) return;
    bar.classList.remove("is-running", "is-paused");
    void bar.offsetWidth;
    if (!reduceMotion) bar.classList.add("is-running");
    if (!tourPlaying) bar.classList.add("is-paused");
  }

  function setTour(playing, userAction) {
    tourPlaying = Boolean(playing);
    if (userAction) tourPausedByUser = !tourPlaying;
    if (tourTimer) {
      window.clearInterval(tourTimer);
      tourTimer = null;
    }
    var button = qs("[data-autoplay-toggle]");
    if (button) {
      button.setAttribute("aria-pressed", tourPlaying ? "false" : "true");
      var labelEn = button.querySelector(".lang-en");
      var labelAr = button.querySelector(".lang-ar");
      if (labelEn) labelEn.textContent = tourPlaying ? "Pause tour" : "Play tour";
      if (labelAr) labelAr.textContent = tourPlaying ? "إيقاف الجولة" : "تشغيل الجولة";
    }
    if (tourPlaying && !reduceMotion) {
      tourTimer = window.setInterval(function () {
        renderHero(HERO_IDS[(heroIndex + 1) % HERO_IDS.length], true);
      }, 7000);
      restartTourProgress();
    } else {
      var bar = qs("[data-tour-progress]");
      if (bar) bar.classList.add("is-paused");
    }
  }

  function initHero() {
    var stage = qs("[data-stage]");
    var browser = qs("[data-browser]");
    if (!stage) return;

    var targetRx = 3;
    var targetRy = -9;
    var currentRx = targetRx;
    var currentRy = targetRy;
    var dragging = false;
    var startX = 0;
    var startY = 0;
    var startRx = 0;
    var startRy = 0;
    var raf = null;

    function apply() {
      raf = null;
      stage.style.setProperty("--rx", currentRx + "deg");
      stage.style.setProperty("--ry", currentRy + "deg");
    }

    function schedule() {
      if (!raf) raf = window.requestAnimationFrame(apply);
    }

    function reset() {
      targetRx = 3;
      targetRy = -9;
      currentRx = targetRx;
      currentRy = targetRy;
      stage.classList.remove("is-dragging");
      schedule();
    }

    stage.addEventListener("pointermove", function (event) {
      if (reduceMotion || dragging || event.pointerType === "touch") return;
      var rect = stage.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      targetRy = -9 + x * 9;
      targetRx = 3 - y * 7;
      currentRx += (targetRx - currentRx) * 0.16;
      currentRy += (targetRy - currentRy) * 0.16;
      schedule();
    });

    stage.addEventListener("pointerleave", function () {
      if (!dragging) reset();
    });

    stage.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch" && event.target.closest("button, a, input, textarea")) return;
      if (event.button !== undefined && event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startRx = currentRx;
      startRy = currentRy;
      stage.classList.add("is-dragging");
      stage.setPointerCapture && stage.setPointerCapture(event.pointerId);
      setTour(false, true);
    });

    stage.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      currentRy = Math.max(-22, Math.min(22, startRy + dx * 0.16));
      currentRx = Math.max(-16, Math.min(16, startRx - dy * 0.16));
      schedule();
    });

    function endDrag() {
      dragging = false;
      stage.classList.remove("is-dragging");
    }

    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("dblclick", reset);

    qsa(".screen-tab").forEach(function (tab) {
      tab.setAttribute("aria-controls", "hero-screen-panel");
      tab.addEventListener("click", function () {
        setTour(false, true);
        renderHero(tab.getAttribute("data-screen"), true);
      });
    });

    var playToggle = qs("[data-autoplay-toggle]");
    if (playToggle) {
      playToggle.addEventListener("click", function () {
        setTour(!tourPlaying, true);
        if (tourPlaying) tourPausedByUser = false;
      });
    }

    stage.addEventListener("pointerenter", function () {
      if (tourPlaying && !tourPausedByUser) setTour(false, false);
    });

    stage.addEventListener("pointerleave", function () {
      if (!tourPausedByUser && !document.hidden && !dragging) setTour(true, false);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && tourPlaying) setTour(false, false);
    });

    setTour(!reduceMotion, false);
  }

  function initShowcase() {
    qsa(".showcase-tab").forEach(function (tab) {
      tab.setAttribute("aria-controls", "showcase-screen-panel");
      tab.addEventListener("click", function () {
        var id = tab.getAttribute("data-screen");
        var index = SHOWCASE_IDS.indexOf(id);
        if (index >= 0) renderShowcase(index, true);
      });
    });

    var prev = qs("[data-showcase-prev]");
    var next = qs("[data-showcase-next]");
    if (prev) prev.addEventListener("click", function () { renderShowcase(showcaseIndex - 1, true); });
    if (next) next.addEventListener("click", function () { renderShowcase(showcaseIndex + 1, true); });

    var nav = qs(".showcase-nav");
    if (nav) {
      nav.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          renderShowcase(showcaseIndex + 1, true);
          var active = qs(".showcase-tab.is-active");
          if (active) active.focus();
        } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          renderShowcase(showcaseIndex - 1, true);
          var activePrev = qs(".showcase-tab.is-active");
          if (activePrev) activePrev.focus();
        } else if (event.key === "Home") {
          event.preventDefault();
          renderShowcase(0, true);
        } else if (event.key === "End") {
          event.preventDefault();
          renderShowcase(SHOWCASE_IDS.length - 1, true);
        }
      });
    }
  }

  function initPrompts() {
    qsa("[data-ai-prompt]").forEach(function (button) {
      button.addEventListener("click", function () {
        renderAiPrompt(button.getAttribute("data-ai-prompt"), true);
      });
    });
    qsa("[data-ocr-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        renderOcrStep(button.getAttribute("data-ocr-step"), true);
      });
    });
  }

  function initLightbox() {
    qsa("[data-open-gallery]").forEach(function (button) {
      button.addEventListener("click", function () {
        openLightbox(button.getAttribute("data-open-gallery"));
      });
    });

    var dialog = qs("#lightbox");
    if (!dialog) return;

    var close = qs("[data-lightbox-close]");
    var prev = qs("[data-lightbox-prev]");
    var next = qs("[data-lightbox-next]");

    if (close) close.addEventListener("click", closeLightbox);
    if (prev) prev.addEventListener("click", function () { renderLightbox(lightboxIndex - 1); });
    if (next) next.addEventListener("click", function () { renderLightbox(lightboxIndex + 1); });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeLightbox();
    });

    dialog.addEventListener("close", function () {
      document.body.style.overflow = "";
    });

    dialog.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        renderLightbox(lightboxIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        renderLightbox(lightboxIndex + 1);
      }
    });
  }

  function initTilt() {
    if (reduceMotion) return;
    qsa("[data-tilt]").forEach(function (element) {
      var frame = null;

      element.addEventListener("pointermove", function (event) {
        if (event.pointerType === "touch") return;
        var rect = element.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        if (frame) window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(function () {
          element.style.transform =
            "perspective(1200px) rotateX(" + (-y * 5).toFixed(2) + "deg) rotateY(" + (x * 6).toFixed(2) + "deg) translateY(-4px)";
        });
      });

      element.addEventListener("pointerleave", function () {
        if (frame) window.cancelAnimationFrame(frame);
        element.style.transform = "";
      });
    });
  }

  function initCopyButtons() {
    qsa("[data-copy-command]").forEach(function (button) {
      button.addEventListener("click", function () {
        var text = button.getAttribute("data-copy-command") || "";
        var done = function () {
          var original = button.innerHTML;
          button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg><span class="lang-en">Copied</span><span class="lang-ar">تم النسخ</span>';
          window.setTimeout(function () {
            button.innerHTML = original;
          }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(done);
        } else {
          var area = document.createElement("textarea");
          area.value = text;
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.select();
          try { document.execCommand("copy"); } catch (e) { /* ignore */ }
          document.body.removeChild(area);
          done();
        }
      });
    });
  }

  function initHeader() {
    var header = qs("[data-header]");
    if (!header) return;
    var update = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function initNav() {
    var toggle = qs(".menu-toggle");
    var nav = qs("#site-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  function initReveal() {
    var reveals = qsa(".reveal");
    if (!("IntersectionObserver" in window) || !reveals.length) {
      reveals.forEach(function (node) { node.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    reveals.forEach(function (node) { observer.observe(node); });
  }

  function initYear() {
    qsa("[data-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });
  }

  function preloadImages() {
    HERO_IDS.forEach(function (id) {
      var img = new Image();
      img.src = SCREENS[id].image;
    });
    var receivable = new Image();
    receivable.src = "assets/screenshots/ai-chat-receivables.png";
  }

  function init() {
    preloadImages();
    applyLanguage(currentLang, false);
    initHero();
    initShowcase();
    initPrompts();
    initLightbox();
    initTilt();
    initCopyButtons();
    initHeader();
    initNav();
    initReveal();
    initYear();

    var langToggle = qs("[data-lang-toggle]");
    if (langToggle) {
      langToggle.addEventListener("click", function () {
        applyLanguage(currentLang === "ar" ? "en" : "ar", true);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
