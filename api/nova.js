(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const safe = (fn) => {
    try {
      return fn();
    } catch (error) {
      console.error("[VANTA]", error);
      return null;
    }
  };

  // لا توقف الموقع إذا لم تتوفر إعدادات Supabase
  const supabaseReady =
    typeof window.supabase !== "undefined" &&
    Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);

  let db = null;

  if (supabaseReady) {
    safe(() => {
      db = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
    });
  }

  // فتح وإغلاق القوائم
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, a, [data-action], [data-toggle]");
    if (!target) return;

    // زر القائمة
    if (
      target.matches("#menuBtn, .menu-btn, [data-toggle='menu'], [data-action='menu']")
    ) {
      const nav = $("#nav, .nav-links, .navigation, [data-navigation]");
      if (nav) {
        nav.classList.toggle("open");
        nav.classList.toggle("active");
        nav.classList.toggle("show");
      }
    }

    // تبديل المظهر
    if (
      target.matches("#themeBtn, [data-action='theme'], .theme-toggle")
    ) {
      document.body.classList.toggle("light");
      document.body.classList.toggle("light-mode");
      const light = document.body.classList.contains("light");
      safe(() => localStorage.setItem("vanta_theme", light ? "light" : "dark"));
    }

    // إغلاق النوافذ
    if (
      target.matches("[data-close], .modal-close, .dialog-close, [data-action='close']")
    ) {
      const modal = target.closest("dialog, .modal, [role='dialog']");
      if (modal?.tagName === "DIALOG") modal.close();
      else if (modal) modal.classList.remove("open", "active", "show");
    }

    // فتح نافذة مرتبطة بزر
    const openTarget =
      target.dataset.open ||
      target.dataset.modal ||
      target.dataset.target;

    if (openTarget && !target.matches("a")) {
      const element = $(openTarget.startsWith("#") ? openTarget : `#${openTarget}`);
      if (element?.tagName === "DIALOG") safe(() => element.showModal());
      else element?.classList.add("open", "active", "show");
    }

    // الرجوع للأعلى
    if (target.matches("#backToTop, [data-action='top']")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // إغلاق القائمة بعد اختيار رابط
    if (target.matches("nav a, .nav-links a")) {
      const nav = target.closest("nav, .nav-links");
      nav?.classList.remove("open", "active", "show");
    }
  });

  // استعادة المظهر
  safe(() => {
    const theme = localStorage.getItem("vanta_theme");
    if (theme === "light") {
      document.body.classList.add("light");
      document.body.classList.add("light-mode");
    }
  });

  // البحث في عناصر الصفحة
  document.addEventListener("input", (event) => {
    const input = event.target.closest(
      "#searchInput, [data-search-input], .search-input"
    );
    if (!input) return;

    const query = input.value.trim().toLowerCase();
    const items = $$(
      "[data-searchable], .course-card, .lesson-card, .search-item"
    );

    items.forEach((item) => {
      const text = (item.textContent || "").toLowerCase();
      item.hidden = query !== "" && !text.includes(query);
    });
  });

  // أزرار إظهار كلمة المرور
  document.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-toggle-password], .toggle-password, #togglePassword"
    );
    if (!button) return;

    const input = $(
      button.dataset.togglePassword
        ? `#${CSS.escape(button.dataset.togglePassword)}`
        : "input[type='password']",
      button.parentElement
    ) || $("input[type='password']");

    if (input) input.type = input.type === "password" ? "text" : "password";
  });

  // التمرير إلى القسم المطلوب
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scroll]");
    if (!button) return;

    const element = $(button.dataset.scroll);
    if (element) {
      event.preventDefault();
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // لا نغيّر تسجيل الدخول تلقائيًا ولا نمسح بيانات المستخدم.
  // Supabase متاح للوظائف التي تحتاجه فقط إذا كانت الإعدادات صحيحة.
  window.VANTA = window.VANTA || {};
  window.VANTA.db = db;
  window.VANTA.supabaseReady = Boolean(db);

  console.info("[VANTA] تم تحميل app.js");
})();
