// assets/js/main.js
// Andaaz Decorations — reliable mobile toggle + active nav + footer year + gallery filter + inquiry form (front-end only)
(function () {
  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  ready(() => {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    // -----------------------------
    // Mobile menu (aria-based)
    // -----------------------------
    const toggle = $("[data-mobile-toggle]") || $(".mobile-toggle");
    const panel = $("[data-mobile-panel]") || $(".mobile-panel");

    const closeMenu = () => {
      if (!toggle || !panel) return;
      toggle.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
    };

    const openMenu = () => {
      if (!toggle || !panel) return;
      toggle.setAttribute("aria-expanded", "true");
      panel.setAttribute("aria-hidden", "false");
    };

    if (toggle && panel) {
      // Normalize initial state (prevents “stuck open” between refreshes)
      if (!toggle.hasAttribute("aria-expanded")) toggle.setAttribute("aria-expanded", "false");
      if (!panel.hasAttribute("aria-hidden")) panel.setAttribute("aria-hidden", "true");

      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        isOpen ? closeMenu() : openMenu();
      });

      // Close after tapping any link in mobile panel
      $$("a", panel).forEach((a) => a.addEventListener("click", closeMenu));

      // Close on Escape
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeMenu();
      });

      // Close if clicking outside when open
      document.addEventListener("click", (e) => {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        if (!isOpen) return;
        if (toggle.contains(e.target) || panel.contains(e.target)) return;
        closeMenu();
      });
    } else {
      // Not fatal; keeps pages usable even if markup changes
      console.warn("Mobile menu not wired: missing toggle or panel.", { toggle, panel });
    }

    // -----------------------------
    // Active nav highlighting
    // -----------------------------
    const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    $$("[data-nav] a[href]").forEach((a) => {
      const href = (a.getAttribute("href") || "").trim().toLowerCase();
      if (!href || href.startsWith("#")) return;

      const isHome = current === "" || current === "index.html";
      if (href === current || (isHome && href === "index.html")) a.classList.add("active");
    });

    // -----------------------------
    // Footer year
    // -----------------------------
    const y = $("[data-year]");
    if (y) y.textContent = String(new Date().getFullYear());

    // -----------------------------
    // Gallery filter (optional)
    // -----------------------------
    const filterWrap = $("[data-gallery-filters]");
    const grid = $("[data-gallery-grid]");
    if (filterWrap && grid) {
      const buttons = $$("button[data-filter]", filterWrap);
      const items = $$("[data-category]", grid);

      const setActive = (btn) => {
        buttons.forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
      };

      const applyFilter = (value) => {
        const v = (value || "all").toLowerCase();
        items.forEach((it) => {
          const cat = (it.getAttribute("data-category") || "").toLowerCase();
          const show = v === "all" ? true : cat.split(" ").includes(v);
          it.hidden = !show;
        });
      };

      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          setActive(btn);
          applyFilter(btn.getAttribute("data-filter"));
        });
      });

      // Default state
      const first = buttons.find((b) => (b.getAttribute("data-filter") || "").toLowerCase() === "all") || buttons[0];
      if (first) {
        setActive(first);
        applyFilter(first.getAttribute("data-filter"));
      }
    }

    // -----------------------------
    // Inquiry form (front-end only)
    // -----------------------------
    const form = $("[data-inquiry-form]");
    const notice = $("[data-form-notice]");

    const setNotice = (type, msg) => {
      if (!notice) return;
      notice.classList.remove("is-success", "is-error");
      if (type === "success") notice.classList.add("is-success");
      if (type === "error") notice.classList.add("is-error");
      notice.textContent = msg;
      notice.hidden = false;
      notice.focus?.();
    };

    const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = String(form.elements["name"]?.value || "").trim();
        const email = String(form.elements["email"]?.value || "").trim();
        const phone = String(form.elements["phone"]?.value || "").trim();
        const date = String(form.elements["eventDate"]?.value || "").trim();
        const city = String(form.elements["venueCity"]?.value || "").trim();

        // Basic validation (required fields)
        const missing = [];
        if (!name) missing.push("Name");
        if (!email) missing.push("Email");
        if (email && !isEmail(email)) missing.push("Valid email");
        if (!phone) missing.push("Phone");
        if (!date) missing.push("Event date");
        if (!city) missing.push("Venue/City");

        if (missing.length) {
          setNotice("error", `Please provide: ${missing.join(", ")}.`);
          return;
        }

        // Simulate success (no network)
        form.reset();
        setNotice(
          "success",
          "Thank you. Your inquiry is received. We will respond within 1–2 business days with next steps."
        );
      });
    }
  });
})();
