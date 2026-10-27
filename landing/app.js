(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var STORAGE_KEY = "fatortak-lang";
  var META = {
    en: {
      title: "Fatortak — Open-source accounting and invoicing for MENA",
      description:
        "Arabic-first invoicing, double-entry accounting, projects, inventory, HR and payroll. Self-host with Docker under AGPL-3.0, or use managed cloud.",
      ogTitle: "Fatortak — Open-source accounting and invoicing for MENA",
      ogDescription:
        "One Arabic-first ledger for invoicing, projects, inventory, HR and payroll. Open source, self-hostable, built for MENA SMBs.",
      toggle: "Switch to Arabic"
    },
    ar: {
      title: "فاتورتك — نظام محاسبة وفواتير مفتوح المصدر للشرق الأوسط",
      description:
        "فواتير عربية، محاسبة بالقيد المزدوج، مشروعات ومخزون ورواتب في نظام واحد. استضافة ذاتية عبر Docker أو سحابة مُدارة.",
      ogTitle: "فاتورتك — نظام محاسبة وفواتير مفتوح المصدر للشرق الأوسط",
      ogDescription:
        "دفتر واحد للفواتير والمشروعات والمخزون والرواتب. مفتوح المصدر، قابل للاستضافة الذاتية، ومبني لشركات الشرق الأوسط.",
      toggle: "Switch to English"
    }
  };

  function setMeta(selector, value) {
    var node = document.querySelector(selector);
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
    var html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";

    document.title = META[lang].title;
    setMeta('meta[name="description"]', META[lang].description);
    setMeta('meta[property="og:title"]', META[lang].ogTitle);
    setMeta('meta[property="og:description"]', META[lang].ogDescription);
    setMeta('meta[name="twitter:title"]', META[lang].ogTitle);
    setMeta('meta[name="twitter:description"]', META[lang].ogDescription);

    var toggle = document.querySelector("[data-lang-toggle]");
    if (toggle) {
      toggle.setAttribute("aria-label", META[lang].toggle);
      toggle.setAttribute("title", META[lang].toggle);
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

  var currentLang = document.documentElement.lang === "ar" ? "ar" : "en";
  applyLanguage(currentLang, false);

  var langToggle = document.querySelector("[data-lang-toggle]");
  if (langToggle) {
    langToggle.addEventListener("click", function () {
      var next = document.documentElement.lang === "ar" ? "en" : "ar";
      applyLanguage(next, true);
    });
  }

  /* Mobile navigation */
  var menuToggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (menuToggle && nav) {
    menuToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        nav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.focus();
      }
    });
  }

  /* Pricing toggle */
  var billingButtons = document.querySelectorAll("[data-billing]");
  var pricingGrid = document.querySelector(".pricing-grid");
  if (billingButtons.length && pricingGrid) {
    billingButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var yearly = button.getAttribute("data-billing") === "yearly";
        billingButtons.forEach(function (other) {
          var active = other === button;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", active ? "true" : "false");
        });
        pricingGrid.classList.toggle("is-yearly", yearly);
        pricingGrid.querySelectorAll(".amount").forEach(function (amount) {
          var value = Number(amount.getAttribute(yearly ? "data-yearly" : "data-monthly"));
          amount.textContent = Number.isFinite(value)
            ? value.toLocaleString("en-US")
            : amount.textContent;
        });
      });
    });
  }

  /* Current year */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  /* Reveal on scroll; content is visible if this never runs. */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    reveals.forEach(function (node) {
      observer.observe(node);
    });
  } else {
    reveals.forEach(function (node) {
      node.classList.add("visible");
    });
  }
})();
