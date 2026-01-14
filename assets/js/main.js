/* assets/js/main.js
   Minimal UX: mobile nav toggle + year + basic filtering for gallery/tabs
*/

(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // Year
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav
  const header = $(".site-header");
  const toggle = $("[data-nav-toggle]");
  if (header && toggle) {
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // Tabs / filters (shared)
  const grid = $("[data-grid]");
  const tabs = $$(".tab");

  function setActiveTab(btn) {
    tabs.forEach(t => t.classList.remove("is-active"));
    btn.classList.add("is-active");
    tabs.forEach(t => t.setAttribute("aria-selected", String(t === btn)));
  }

  function applyFilter(tag) {
    if (!grid) return;

    const items = $$("[data-tag]", grid);
    items.forEach(item => {
      const itemTag = item.getAttribute("data-tag");
      const show = tag === "all" || itemTag === tag;
      item.style.display = show ? "" : "none";
    });
  }

  if (tabs.length && grid) {
    tabs.forEach(btn => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-filter") || "all";
        setActiveTab(btn);
        applyFilter(tag);
      });
    });
  }
})();
