/* assets/js/modules/nav.js
   - Year injection: [data-year]
   - Mobile nav toggle: [data-nav-toggle] + .site-header.is-open
*/

const $ = (sel, el = document) => el.querySelector(sel);

export function initNav() {
  // Year
  const yearEl = $("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Mobile nav
  const header = $(".site-header");
  const toggle = $("[data-nav-toggle]");
  if (!header || !toggle) return;

  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}
