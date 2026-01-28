/* assets/js/modules/gallery.js
   Gallery:
   - Filters: .tab[data-filter] + [data-grid] items (data-tag)
   - Lightbox: click/Enter opens, ESC closes, arrows navigate
   - Deep-link: ?cat=stages&id=stages-2 (applies filter + opens)
*/

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function setActiveTab(tabsEl, filter) {
  const tabs = $$(".tab[data-filter]", tabsEl);
  tabs.forEach((btn) => {
    const on = btn.getAttribute("data-filter") === filter;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function applyFilter(gridEl, filter) {
  const items = $$("[data-tag][data-id]", gridEl);
  items.forEach((item) => {
    const tag = item.getAttribute("data-tag");
    const show = filter === "all" || tag === filter;
    item.style.display = show ? "" : "none";
    item.setAttribute("aria-hidden", show ? "false" : "true");
  });
}

function visibleItems(gridEl) {
  return $$("[data-tag][data-id]", gridEl).filter((el) => el.style.display !== "none");
}

function ensureLightbox() {
  let lb = $("#wx-lightbox");
  if (lb) return lb;

  lb = document.createElement("div");
  lb.id = "wx-lightbox";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-hidden", "true");
  lb.style.cssText = `
    position:fixed; inset:0; z-index:9999; display:none;
    background:rgba(0,0,0,.72); backdrop-filter: blur(10px);
  `;

  lb.innerHTML = `
    <div data-lb-backdrop style="position:absolute; inset:0;"></div>
    <div style="
      position:relative; height:100%;
      display:grid; place-items:center;
      padding:24px;">
      <div style="
        width:min(980px, 92vw);
        border-radius: 22px;
        border:1px solid rgba(255,255,255,.14);
        background: rgba(14,14,16,.78);
        box-shadow: 0 30px 90px rgba(0,0,0,.6);
        overflow:hidden;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.10);">
          <div data-lb-cap style="color:rgba(233,229,222,.92); font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
          <div style="display:flex; gap:8px;">
            <button type="button" data-lb-prev aria-label="Previous" style="height:34px; padding:0 12px; border-radius:999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:rgba(233,229,222,.92); cursor:pointer;">‹</button>
            <button type="button" data-lb-next aria-label="Next" style="height:34px; padding:0 12px; border-radius:999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:rgba(233,229,222,.92); cursor:pointer;">›</button>
            <button type="button" data-lb-close aria-label="Close" style="height:34px; padding:0 12px; border-radius:999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:rgba(233,229,222,.92); cursor:pointer;">Close</button>
          </div>
        </div>

        <div style="display:grid; place-items:center; background:rgba(0,0,0,.25);">
          <img data-lb-img alt="" style="width:100%; height:auto; display:block; max-height: 72vh; object-fit: contain;" />
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(lb);
  return lb;
}

function openLightbox(lb, item, list, index) {
  const img = $("img", item);
  const cap = $("figcaption", item);

  const lbImg = lb.querySelector("[data-lb-img]");
  const lbCap = lb.querySelector("[data-lb-cap]");

  lbImg.src = img?.getAttribute("src") || "";
  lbImg.alt = img?.getAttribute("alt") || "";
  lbCap.textContent = cap?.textContent || "";

  lb.dataset.index = String(index);
  lb.style.display = "block";
  lb.setAttribute("aria-hidden", "false");

  // For keyboard users: focus close button
  const closeBtn = lb.querySelector("[data-lb-close]");
  closeBtn && closeBtn.focus();

  // Update URL (non-destructive)
  const tag = item.getAttribute("data-tag");
  const id = item.getAttribute("data-id");
  const url = new URL(window.location.href);
  url.searchParams.set("cat", tag || "all");
  url.searchParams.set("id", id || "");
  window.history.replaceState({}, "", url.toString());

  // Wire nav
  const showIndex = (nextIdx) => {
    const safe = Math.max(0, Math.min(list.length - 1, nextIdx));
    const nextItem = list[safe];
    if (!nextItem) return;
    openLightbox(lb, nextItem, list, safe);
  };

  lb.__showIndex = showIndex;
}

function closeLightbox(lb) {
  lb.style.display = "none";
  lb.setAttribute("aria-hidden", "true");

  // Remove id param (keep cat if present)
  const url = new URL(window.location.href);
  url.searchParams.delete("id");
  window.history.replaceState({}, "", url.toString());
}

export function initGallery() {
  const tabsEl = $("[data-gallery-tabs]");
  const gridEl = $("[data-grid]");
  if (!tabsEl || !gridEl) return;

  // Default filter
  let activeFilter = "all";

  const setFilter = (filter) => {
    activeFilter = filter || "all";
    setActiveTab(tabsEl, activeFilter);
    applyFilter(gridEl, activeFilter);
  };

  // Tabs click
  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab[data-filter]");
    if (!btn) return;
    setFilter(btn.getAttribute("data-filter") || "all");
  });

  // Keyboard support on tabs
  tabsEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const btn = e.target.closest(".tab[data-filter]");
    if (!btn) return;
    e.preventDefault();
    setFilter(btn.getAttribute("data-filter") || "all");
  });

  // Lightbox
  const lb = ensureLightbox();

  const openFromItem = (item) => {
    const list = visibleItems(gridEl);
    const idx = list.indexOf(item);
    if (idx < 0) return;
    openLightbox(lb, item, list, idx);
  };

  gridEl.addEventListener("click", (e) => {
    const item = e.target.closest(".masonry-item[data-id]");
    if (!item) return;
    openFromItem(item);
  });

  gridEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const item = e.target.closest(".masonry-item[data-id]");
    if (!item) return;
    e.preventDefault();
    openFromItem(item);
  });

  // Lightbox controls
  lb.addEventListener("click", (e) => {
    if (e.target.closest("[data-lb-close]") || e.target.closest("[data-lb-backdrop]")) {
      closeLightbox(lb);
      return;
    }
    if (e.target.closest("[data-lb-prev]")) {
      const idx = Number(lb.dataset.index || "0");
      lb.__showIndex && lb.__showIndex(idx - 1);
      return;
    }
    if (e.target.closest("[data-lb-next]")) {
      const idx = Number(lb.dataset.index || "0");
      lb.__showIndex && lb.__showIndex(idx + 1);
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (lb.getAttribute("aria-hidden") === "true") return;

    if (e.key === "Escape") {
      closeLightbox(lb);
      return;
    }
    if (e.key === "ArrowLeft") {
      const idx = Number(lb.dataset.index || "0");
      lb.__showIndex && lb.__showIndex(idx - 1);
      return;
    }
    if (e.key === "ArrowRight") {
      const idx = Number(lb.dataset.index || "0");
      lb.__showIndex && lb.__showIndex(idx + 1);
      return;
    }
  });

  // Deep-link support: ?cat=...&id=...
  const url = new URL(window.location.href);
  const cat = url.searchParams.get("cat");
  const id = url.searchParams.get("id");

  if (cat) setFilter(cat);
  else setFilter("all");

  if (id) {
    const target = gridEl.querySelector(`.masonry-item[data-id="${CSS.escape(id)}"]`);
    if (target) {
      // Ensure it is visible under current filter
      const tag = target.getAttribute("data-tag");
      if (cat && cat !== "all" && tag !== cat) setFilter(tag || "all");
      // Open
      openFromItem(target);
    }
  }
}
