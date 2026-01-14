(function () {
  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  };

  ready(() => {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    // -----------------------------
    // Mobile menu
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
      window.addEventListener("keydown", (e) => e.key === "Escape" && closeMenu());

      document.addEventListener("click", (e) => {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        if (!isOpen) return;
        if (toggle.contains(e.target) || panel.contains(e.target)) return;
        closeMenu();
      });
    }

    // -----------------------------
    // Active nav
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
    // Hyatt slider
    // -----------------------------
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const sliderRoot = $("[data-hyatt-slider]");
    const tabsWrap = $("[data-hyatt-tabs]");
    if (!sliderRoot) return;

    const viewport = $("[data-hyatt-viewport]", sliderRoot);
    const track = $("[data-hyatt-track]", sliderRoot);
    const allSlides = $$("[data-hyatt-slide]", sliderRoot);

    const prevBtns = $$("[data-hyatt-prev]", sliderRoot);
    const nextBtns = $$("[data-hyatt-next]", sliderRoot);

    const label = $("[data-hyatt-label]", sliderRoot);
    const count = $("[data-hyatt-count]", sliderRoot);

    if (!viewport || !track || allSlides.length === 0) return;

    let page = 0;
    let pages = 1;
    let animating = false;
    let activeCat = "stages";

    const visibleSlides = () => allSlides.filter((s) => !s.hasAttribute("hidden"));

    const readMeta = (slide) => {
      const kicker = slide?.querySelector(".slide-kicker")?.textContent?.trim() || "Signature";
      const title = slide?.querySelector(".slide-title")?.textContent?.trim() || "Reveal";
      return { kicker, title };
    };

    const slidesPerView = () => {
      const slide = visibleSlides()[0];
      if (!slide) return 1;
      const vw = viewport.getBoundingClientRect().width;
      const sw = slide.getBoundingClientRect().width;
      const gap = 16;
      return Math.max(1, Math.floor((vw + gap) / (sw + gap)));
    };

    const computePages = () => {
      const n = visibleSlides().length;
      const per = slidesPerView();
      // Hyatt-style paging: advance by a "panel" (per-view group), not just "if overflow"
      pages = Math.max(1, Math.ceil(n / per));
      if (page > pages - 1) page = pages - 1;
      return { per, n };
    };

    const updateUI = () => {
      const vs = visibleSlides();
      const first = vs[page * slidesPerView()] || vs[0];
      const { kicker, title } = readMeta(first);
      if (label) label.textContent = `${kicker} · ${title}`;
      if (count) count.textContent = `${page + 1} / ${pages}`;
    };

    const apply = (immediate = false) => {
      const per = slidesPerView();
      const slide = visibleSlides()[0];
      if (!slide) return;

      const sw = slide.getBoundingClientRect().width;
      const gap = 16;
      const x = -(page * per * (sw + gap));

      if (prefersReduced || immediate) {
        track.style.transition = "none";
        track.style.transform = `translate3d(${x}px,0,0)`;
        requestAnimationFrame(() => (track.style.transition = ""));
      } else {
        track.style.transition = "transform 920ms cubic-bezier(.22,.9,.2,1)";
        track.style.transform = `translate3d(${x}px,0,0)`;
      }
    };

    const go = (dir) => {
      if (animating) return;
      animating = true;

      computePages();
      page += dir;
      if (page < 0) page = pages - 1;
      if (page > pages - 1) page = 0;

      updateUI();
      apply(false);

      const done = () => {
        animating = false;
        track.removeEventListener("transitionend", done);
      };
      track.addEventListener("transitionend", done, { once: true });
      window.setTimeout(() => (animating = false), 980);
    };

    const setCategory = (cat) => {
      activeCat = cat;
      page = 0;

      allSlides.forEach((s) => {
        const c = (s.getAttribute("data-cat") || "").toLowerCase();
        if (c === cat) s.removeAttribute("hidden");
        else s.setAttribute("hidden", "");
      });

      computePages();
      updateUI();
      apply(true);
    };

    prevBtns.forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); go(-1); }));
    nextBtns.forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); go(1); }));

    sliderRoot.setAttribute("tabindex", "0");
    sliderRoot.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    });

    if (tabsWrap) {
      const tabs = $$("button[data-tab]", tabsWrap);
      tabs.forEach((t) => {
        t.addEventListener("click", () => {
          const cat = (t.getAttribute("data-tab") || "").toLowerCase();
          tabs.forEach((x) => x.setAttribute("aria-selected", x === t ? "true" : "false"));
          setCategory(cat);
        });
      });
    }

    window.addEventListener("resize", () => {
      computePages();
      updateUI();
      apply(true);
    }, { passive: true });

    setCategory(activeCat);
  });
})();
