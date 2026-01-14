// assets/js/main.js
// Andaaz Decorations — mobile toggle + active nav + footer year + gallery filter + inquiry form + Hyatt-style paged slider
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

      const first =
        buttons.find((b) => (b.getAttribute("data-filter") || "").toLowerCase() === "all") || buttons[0];
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
    // Hyatt-style slider (paged)
    // Why this fixes it:
    // - Instead of moving 1 card, we move a full "page" (cards visible in viewport)
    // - Movement is computed from actual DOM measurements -> zoom-proof
    // -----------------------------
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const sliders = $$("[data-slider]");

    const getGapPx = (el) => {
      const cs = getComputedStyle(el);
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

      const capTitle = $(".slider-caption-title", root);
      const capSub = $(".slider-caption-sub", root);

      if (!track || !viewport || slides.length === 0) return;

      let page = 0;
      let animating = false;
      let perPage = 1;
      let pages = 1;

      const readMeta = (i) => {
        const slide = slides[i];
        const kicker = slide?.querySelector(".slide-kicker")?.textContent?.trim() || "Showcase";
        const title = slide?.querySelector(".slide-title")?.textContent?.trim() || "Signature reveal";
        return { kicker, title };
      };

      const measure = () => {
        const gap = getGapPx(track);

        // Slide width from the first slide card (includes responsive/zoom scaling)
        const r = slides[0].getBoundingClientRect();
        const step = r.width + gap;

        // Viewport width (what’s actually visible)
        const vw = viewport.getBoundingClientRect().width;

        // How many slides fit fully in viewport (at this zoom)
        // +gap gives a stable threshold.
        perPage = Math.max(1, Math.floor((vw + gap) / step));

        // Total pages
        pages = Math.max(1, Math.ceil(slides.length / perPage));

        // Clamp page if resizing changed page count
        page = clamp(page, 0, pages - 1);

        return { step, vw, gap };
      };

      const activeIndex = () => clamp(page * perPage, 0, slides.length - 1);

      const setOutputs = () => {
        if (outTotal) outTotal.textContent = String(slides.length);

        const idx = activeIndex();
        if (outIndex) outIndex.textContent = String(idx + 1);

        if (capTitle && capSub) {
          const m = readMeta(idx);
          capTitle.textContent = m.kicker;
          capSub.textContent = m.title;
        }
      };

      const applyTransform = (immediate = false) => {
        const { step } = measure();
        const idx = activeIndex();
        const x = -(idx * step);

        if (prefersReduced || immediate) {
          track.style.transition = "none";
          track.style.transform = `translate3d(${x}px,0,0)`;
          requestAnimationFrame(() => {
            track.style.transition = "";
          });
          return;
        }

        // Hyatt-like smooth, weighty glide
        track.style.transition = "transform 900ms cubic-bezier(.22,.9,.2,1)";
        track.style.transform = `translate3d(${x}px,0,0)`;
      };

      const go = (dir) => {
        if (animating) return;
        animating = true;

        // Re-measure before moving so perPage stays correct at any zoom
        measure();

        if (dir === 1) page += 1;
        else page -= 1;

        // Loop pages
        if (page < 0) page = pages - 1;
        if (page > pages - 1) page = 0;

        setOutputs();
        applyTransform(false);

        const done = () => {
          animating = false;
          track.removeEventListener("transitionend", done);
        };
        track.addEventListener("transitionend", done, { once: true });

        window.setTimeout(() => {
          animating = false;
        }, 980);
      };

      // Buttons
      prevBtns.forEach((b) =>
        b.addEventListener("click", (e) => {
          e.preventDefault();
          go(-1);
        })
      );
      nextBtns.forEach((b) =>
        b.addEventListener("click", (e) => {
          e.preventDefault();
          go(1);
        })
      );

      // Keyboard focus + controls
      root.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      });
      root.setAttribute("tabindex", "0");

      // Resize/zoom recalibration
      const onResize = () => {
        measure();
        setOutputs();
        applyTransform(true);
      };
      window.addEventListener("resize", onResize, { passive: true });

      // Init
      measure();
      setOutputs();
      applyTransform(true);
    });
  });
})();
