// assets/js/main.js
// Andaaz Decorations — mobile toggle + active nav + footer year + gallery filter + inquiry form + Hyatt-style slider
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
      if (!toggle.hasAttribute("aria-expanded")) toggle.setAttribute("aria-expanded", "false");
      if (!panel.hasAttribute("aria-hidden")) panel.setAttribute("aria-hidden", "true");

      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        isOpen ? closeMenu() : openMenu();
      });

      $$("a", panel).forEach((a) => a.addEventListener("click", closeMenu));

      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeMenu();
      });

      document.addEventListener("click", (e) => {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        if (!isOpen) return;
        if (toggle.contains(e.target) || panel.contains(e.target)) return;
        closeMenu();
      });
    } else {
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

        form.reset();
        setNotice("success", "Thank you. Your inquiry is received. We will respond within 1–2 business days with next steps.");
      });
    }

    // -----------------------------
    // Hyatt-style slider
    // - Moves by measured slide width + gap (zoom-proof)
    // - Updates caption + counter
    // - Loops elegantly
    // -----------------------------
    const sliders = $$("[data-slider]");
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const getGapPx = (track) => {
      const cs = getComputedStyle(track);
      const g = cs.columnGap || cs.gap || "0px";
      const n = parseFloat(g);
      return Number.isFinite(n) ? n : 0;
    };

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    sliders.forEach((root) => {
      const track = $("[data-slider-track]", root);
      const viewport = $("[data-slider-viewport]", root);
      const slides = $$("[data-slide]", root);
      const prevBtns = $$("[data-slider-prev]", root);
      const nextBtns = $$("[data-slider-next]", root);

      const outIndex = $("[data-slider-index]", root);
      const outTotal = $("[data-slider-total]", root);

      const caption = $("[data-slider-caption]", root);
      const capTitle = $(".slider-caption-title", root);
      const capSub = $(".slider-caption-sub", root);

      if (!track || !viewport || slides.length === 0) return;

      let idx = 0;
      let animating = false;

      const readMeta = (i) => {
        const slide = slides[i];
        const kicker = slide?.querySelector(".slide-kicker")?.textContent?.trim() || "Showcase";
        const title = slide?.querySelector(".slide-title")?.textContent?.trim() || "Signature reveal";
        return { kicker, title };
      };

      const setOutputs = () => {
        if (outTotal) outTotal.textContent = String(slides.length);
        if (outIndex) outIndex.textContent = String(idx + 1);

        if (caption && capTitle && capSub) {
          const m = readMeta(idx);
          capTitle.textContent = m.kicker;
          capSub.textContent = m.title;
        }
      };

      const measureStep = () => {
        // The step is one slide width + computed gap.
        // Using getBoundingClientRect makes it resilient to browser zoom.
        const first = slides[0];
        const r = first.getBoundingClientRect();
        const gap = getGapPx(track);
        return r.width + gap;
      };

      const applyTransform = (immediate = false) => {
        const step = measureStep();
        const x = -(idx * step);

        if (prefersReduced || immediate) {
          track.style.transition = "none";
          track.style.transform = `translate3d(${x}px,0,0)`;
          // restore transitions for future clicks
          requestAnimationFrame(() => {
            track.style.transition = "";
          });
          return;
        }

        track.style.transition = "transform 820ms cubic-bezier(.22,.9,.2,1)";
        track.style.transform = `translate3d(${x}px,0,0)`;
      };

      const go = (dir) => {
        if (animating) return;
        animating = true;

        idx = (dir === 1) ? (idx + 1) : (idx - 1);
        if (idx < 0) idx = slides.length - 1;
        if (idx > slides.length - 1) idx = 0;

        setOutputs();
        applyTransform(false);

        // release after transition
        const done = () => {
          animating = false;
          track.removeEventListener("transitionend", done);
        };
        track.addEventListener("transitionend", done, { once: true });

        // safety release
        window.setTimeout(() => { animating = false; }, 900);
      };

      // Buttons
      prevBtns.forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); go(-1); }));
      nextBtns.forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); go(1); }));

      // Keyboard
      root.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      });
      root.setAttribute("tabindex", "0");

      // Resize (keep alignment perfect across zoom + responsive changes)
      const onResize = () => applyTransform(true);
      window.addEventListener("resize", onResize, { passive: true });

      // Init
      idx = clamp(idx, 0, slides.length - 1);
      setOutputs();
      applyTransform(true);
    });
  });
})();
