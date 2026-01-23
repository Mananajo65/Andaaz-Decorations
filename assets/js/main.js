/* assets/js/main.js (MERGED UPDATE — fixes weather + keeps your full site logic) */

(function () {
  "use strict";

  /* =========================
     SELECTORS
  ========================= */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* =========================
     UTILS
  ========================= */
  const debounce = (fn, wait = 300) => {
    let t = null;
    return (...args) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn.apply(null, args), wait);
    };
  };

  const safeTrim = (v) => String(v || "").trim();
  const normalizeText = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const digitsOnly = (s) => String(s || "").replace(/\D/g, "");

  const isoDate = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const da = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  const tomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  };

  const prettyDateLong = (iso) => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(d);
    } catch (_) {
      return d.toDateString();
    }
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  /* =========================================================
     SITE-WIDE: YEAR INJECTION
  ========================================================= */
  (function initYear() {
    const y = $("[data-year]");
    if (y) y.textContent = String(new Date().getFullYear());
  })();

  /* =========================================================
     MOBILE NAV
  ========================================================= */
  (function initNav() {
    const btn = $("[data-nav-toggle]");
    const header = $(".site-header");
    if (!btn || !header) return;

    btn.addEventListener("click", () => {
      const open = header.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  })();

  /* =========================================================
     INQUIRY PAGE HOOKS
  ========================================================= */
  const venueStreet = $("[data-venue-street]");
  const venueCity = $("[data-venue-city]");
  const venueState = $("[data-venue-state]");
  const venueZip = $("[data-venue-zip]");

  const scheduleWrap = $("[data-schedule]");
  const scheduleTpl = $("#scheduleBlockTpl");
  const scheduleAddBtn = $("[data-schedule-add]");
  const occasion = $("[data-occasion]");

  const scheduleMin = tomorrowISO();

  /* =========================================================
     WEATHER (Open-Meteo) — MERGED FIX
  ========================================================= */

  const weatherState = {
    unit: "F",
  };

  // Restore saved unit if present
  try {
    const saved = localStorage.getItem("andaaz_wx_unit");
    if (saved === "C" || saved === "F") weatherState.unit = saved;
  } catch (_) {}

  const ensureLiveWeatherMarkup = (panel) => {
    if (!panel) return null;

    // MERGED FIX:
    // Only treat as "normalized" if it contains the injected data-wx-* nodes.
    // Older HTML might include .wx-head but NOT the data-wx-* schema.
    if ($("[data-wx-date]", panel)) return panel;

    panel.innerHTML = `
      <div class="wx-live" aria-hidden="true">
        <div class="wx-live-base"></div>
        <div class="wx-live-glow"></div>
        <div class="wx-live-noise"></div>
      </div>

      <div class="wx-head">
        <div>
          <div class="wx-date" data-wx-date>Loading…</div>
          <div class="wx-loc" data-wx-location>Detecting location…</div>
        </div>
        <div class="wx-head-right">
          <span class="wx-chip" data-wx-mode>Current Location</span>
          <span class="wx-chip wx-chip-verified" data-wx-verified style="display:none;">Verified</span>
          <span class="wx-chip" data-wx-approx style="display:none;">Approximate</span>
        </div>
      </div>

      <div class="wx-hero">
        <div>
          <div class="wx-temp-row">
            <div class="wx-temp" data-wx-temp>—</div>
            <button type="button" class="wx-unit" data-wx-unit aria-label="Toggle temperature unit">°${weatherState.unit}</button>
          </div>

          <div class="wx-feels" data-wx-feels>Feels like —</div>

          <div class="wx-badges">
            <span class="wx-badge" data-wx-planning>Planning</span>
            <span class="wx-badge wx-badge-soft" data-wx-precip-badge>Precip —</span>
            <span class="wx-badge wx-badge-soft" data-wx-wind-badge>Wind —</span>
          </div>
        </div>

        <div class="wx-hero-right">
          <div class="wx-icon" data-wx-icon></div>
          <div class="wx-cond" data-wx-cond>—</div>
        </div>
      </div>

      <div class="wx-metrics">
        <div class="wx-metric">
          <div class="wx-metric-ico" data-wx-ico="sunrise"></div>
          <div class="wx-metric-val" data-wx-sunrise>—</div>
          <div class="wx-metric-lbl">Sunrise</div>
        </div>
        <div class="wx-metric">
          <div class="wx-metric-ico" data-wx-ico="sunset"></div>
          <div class="wx-metric-val" data-wx-sunset>—</div>
          <div class="wx-metric-lbl">Sunset</div>
        </div>
        <div class="wx-metric">
          <div class="wx-metric-ico" data-wx-ico="wind"></div>
          <div class="wx-metric-val" data-wx-wind>—</div>
          <div class="wx-metric-lbl">Wind</div>
        </div>
        <div class="wx-metric">
          <div class="wx-metric-ico" data-wx-ico="humidity"></div>
          <div class="wx-metric-val" data-wx-humidity>—</div>
          <div class="wx-metric-lbl">Humidity</div>
        </div>
        <div class="wx-metric">
          <div class="wx-metric-ico" data-wx-ico="pressure"></div>
          <div class="wx-metric-val" data-wx-pressure>—</div>
          <div class="wx-metric-lbl">Pressure</div>
        </div>
        <div class="wx-metric">
          <div class="wx-metric-ico" data-wx-ico="precip"></div>
          <div class="wx-metric-val" data-wx-precip>—</div>
          <div class="wx-metric-lbl">Precip</div>
        </div>
      </div>

      <div class="wx-hourly-wrap" data-wx-hourly-wrap style="display:none;">
        <div class="mini-title" style="margin-top:12px;">Event window</div>
        <div class="wx-hourly" data-wx-hourly></div>
      </div>

      <div class="wx-stack" data-wx-stack style="display:none;"></div>

      <div class="row" style="justify-content:space-between; align-items:center; margin-top: 12px;">
        <div class="mini-title" style="margin:0;">5 day forecast</div>
      </div>

      <div class="weather-5day" data-wx-5day>
        ${Array.from({ length: 5 })
          .map(
            () => `
          <div class="weather-day">
            <div class="wd-dow">—</div>
            <div class="wd-ico" aria-hidden="true"></div>
            <div class="wd-temp">—</div>
            <div class="wd-sub muted">—</div>
          </div>`
          )
          .join("")}
      </div>

      <p class="muted small" style="margin-top: 12px;" data-wx-hint>
        Add schedule dates and a venue address for event-day conditions. Otherwise, this shows today’s forecast for your current location.
      </p>
    `;

    return panel;
  };

  const wxUI = (() => {
    const panel = ensureLiveWeatherMarkup($("[data-weather-panel]"));
    if (!panel) return null;

    return {
      panel,
      mode: $("[data-wx-mode]", panel),
      location: $("[data-wx-location]", panel),
      date: $("[data-wx-date]", panel),
      temp: $("[data-wx-temp]", panel),
      feels: $("[data-wx-feels]", panel),
      unitBtn: $("[data-wx-unit]", panel),
      icon: $("[data-wx-icon]", panel),
      cond: $("[data-wx-cond]", panel),
      sunrise: $("[data-wx-sunrise]", panel),
      sunset: $("[data-wx-sunset]", panel),
      humidity: $("[data-wx-humidity]", panel),
      pressure: $("[data-wx-pressure]", panel),
      precip: $("[data-wx-precip]", panel),
      wind: $("[data-wx-wind]", panel),
      precipBadge: $("[data-wx-precip-badge]", panel),
      windBadge: $("[data-wx-wind-badge]", panel),
      verified: $("[data-wx-verified]", panel),
      approx: $("[data-wx-approx]", panel),
      hourlyWrap: $("[data-wx-hourly-wrap]", panel),
      hourly: $("[data-wx-hourly]", panel),
      stack: $("[data-wx-stack]", panel),
      strip5: $("[data-wx-5day]", panel),
      hint: $("[data-wx-hint]", panel),
    };
  })();

  // Unit toggle
  if (wxUI?.unitBtn) {
    wxUI.unitBtn.textContent = `°${weatherState.unit}`;
    wxUI.unitBtn.addEventListener("click", () => {
      weatherState.unit = weatherState.unit === "F" ? "C" : "F";
      try { localStorage.setItem("andaaz_wx_unit", weatherState.unit); } catch (_) {}
      wxUI.unitBtn.textContent = `°${weatherState.unit}`;
      requestWeatherRefresh();
    });
  }

  // Your existing updateWeatherUI() / requestWeatherRefresh / schedule / geocoding / mailto logic
  // remains unchanged below this point in your original file.
  //
  // IMPORTANT:
  // Keep everything you already have after the weather section.
  //
  // Because you asked for a merged update, you should paste THIS file on top of your existing main.js
  // OR (recommended) paste your existing main.js content and apply ONLY the two changes shown above.

  /* =========================================================
     PLACEHOLDER:
     Paste the remainder of your original main.js here unchanged.
     (From: Gallery / Home slider / Schedule / Address / Forecast / Mailto etc.)
  ========================================================= */
})();
/* assets/js/main.js (FULL REWRITE — Luxury “Live” Weather + Inquiry Schedule + Site UX)
   Andaaz Decorations

   Site-wide:
   - Year injection ([data-year])
   - Mobile nav toggle ([data-nav-toggle] + .site-header.is-open)
   - Gallery filtering (.tab + [data-grid])
   - Gallery deep-link open (?cat=...&id=...)
   - Gallery lightbox ([data-id] items)
   - Home: Hyatt-style tabs + horizontal slider (data-hyatt-*)

   Inquiry (contact.html):
   - Schedule Builder (multi-date + start time + duration + optional label)
   - Occasion templates (Multi-Day wedding preloads Mehndi/Nikah/Walima)
   - Schedule date min = tomorrow (no past/today)
   - Weather (Apple-like “live” card aesthetic):
      - Auto-detect locale + unit preference (C/F), user toggle
      - Default: current user location + today
      - If Venue Address is valid: forecast switches to Venue
      - If a schedule item is active: forecast anchors to that schedule date/time
      - Single event: 5-hour strip centered around event start time
      - Multi-event: one mini card per event (daily high + precip% near start time)
      - Weather visuals: automatically sets data-weather-theme + data-weather-night
      - Uses Open-Meteo (no API key) for geocoding + forecast
   - Address legitimacy:
      - Completeness checks + Open-Meteo geocoding validation
   - Numbering plan:
      - Default +1 United States
      - Phone auto-formats per plan (US-friendly, graceful for others)
   - Upload limit max 3 files
   - mailto submission to Mananajo65@live.com with labeled summary
*/

(function () {
  "use strict";

  /* =========================
     SELECTORS
  ========================= */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* =========================
     UTILS
  ========================= */
  const debounce = (fn, wait = 300) => {
    let t = null;
    return (...args) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn.apply(null, args), wait);
    };
  };

  const safeTrim = (v) => String(v || "").trim();
  const normalizeText = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const digitsOnly = (s) => String(s || "").replace(/\D/g, "");

  const isoDate = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const da = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  const tomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  };

  const prettyDateLong = (iso) => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(d);
    } catch (_) {
      return d.toDateString();
    }
  };

  const padLine = (label, value) => `${label}: ${value || ""}`;

  const formatNumber = (val) =>
    String(val || "")
      .replace(/\D/g, "")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const parsePlanCode = (planValue) => {
    const v = safeTrim(planValue);
    const m = v.match(/^\+\d{1,4}/);
    return m ? m[0] : "";
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const toHourLabel = (dtISO) => {
    // dtISO like "2026-01-22T18:00"
    try {
      const d = new Date(dtISO);
      return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(d);
    } catch (_) {
      const d = new Date(dtISO);
      const h = d.getHours();
      return `${((h + 11) % 12) + 1}${h >= 12 ? "PM" : "AM"}`;
    }
  };

  const tryShowPicker = (inputEl) => {
    if (!inputEl) return;
    if (typeof inputEl.showPicker === "function") {
      try {
        inputEl.showPicker();
      } catch (_) {}
    }
  };

  const getLocaleRegionHint = () => {
    // Very lightweight locale hint: "en-US" => "US"
    const loc = safeTrim(navigator.language);
    const parts = loc.split("-");
    return parts.length > 1 ? parts[1].toUpperCase() : "";
  };

  /* =========================
     YEAR
  ========================= */
  (function initYear() {
    const yearEl = $("[data-year]");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  })();

  /* =========================
     MOBILE NAV
  ========================= */
  (function initMobileNav() {
    const header = $(".site-header");
    const toggle = $("[data-nav-toggle]");
    if (!header || !toggle) return;

    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  })();

  /* =========================
     GALLERY FILTERS (shared)
  ========================= */
  const gallery = (function initGalleryFilters() {
    const grid = $("[data-grid]");
    const tabs = $$(".tab");

    if (!grid || !tabs.length) {
      return {
        grid: null,
        tabs: [],
        applyFilter: () => {},
        clickTabForTag: () => {},
      };
    }

    function setActiveTab(btn) {
      tabs.forEach((t) => t.classList.remove("is-active"));
      btn.classList.add("is-active");
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t === btn)));
    }

    function applyFilter(tag) {
      const items = $$("[data-tag]", grid);
      items.forEach((item) => {
        const itemTag = item.getAttribute("data-tag");
        const show = tag === "all" || itemTag === tag;
        item.style.display = show ? "" : "none";
      });
    }

    function clickTabForTag(tag) {
      const btn = tabs.find((t) => (t.getAttribute("data-filter") || "all") === tag) || tabs[0];
      if (!btn) return;
      setActiveTab(btn);
      applyFilter(btn.getAttribute("data-filter") || "all");
    }

    const tabsWrap = tabs[0].parentElement || document;
    tabsWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if (!btn || !tabs.includes(btn)) return;

      const tag = btn.getAttribute("data-filter") || "all";
      setActiveTab(btn);
      applyFilter(tag);
    });

    return { grid, tabs, applyFilter, clickTabForTag };
  })();

  /* =========================
     GALLERY LIGHTBOX + DEEPLINK
  ========================= */
  (function initGalleryLightbox() {
    const grid = gallery.grid;
    const isGalleryPage = document.title.toLowerCase().includes("gallery");
    if (!isGalleryPage || !grid) return;

    const items = $$("[data-id]", grid);
    if (!items.length) return;

    function buildLightbox() {
      const wrap = document.createElement("div");
      wrap.className = "lightbox";
      wrap.setAttribute("aria-hidden", "true");

      wrap.innerHTML = `
        <div class="lightbox-backdrop" data-lb-close tabindex="-1"></div>
        <div class="lightbox-panel" role="dialog" aria-modal="true" aria-label="Image preview">
          <button class="lightbox-close" type="button" aria-label="Close" data-lb-close>×</button>
          <figure class="lightbox-figure">
            <img class="lightbox-img" alt="" />
            <figcaption class="lightbox-cap"></figcaption>
          </figure>
        </div>
      `;

      document.body.appendChild(wrap);

      const imgEl = $(".lightbox-img", wrap);
      const capEl = $(".lightbox-cap", wrap);

      function open({ src, alt, caption }) {
        imgEl.src = src;
        imgEl.alt = alt || "";
        capEl.textContent = caption || "";

        wrap.classList.add("is-open");
        wrap.setAttribute("aria-hidden", "false");

        document.documentElement.classList.add("no-scroll");
        document.body.classList.add("no-scroll");
      }

      function close() {
        wrap.classList.remove("is-open");
        wrap.setAttribute("aria-hidden", "true");

        document.documentElement.classList.remove("no-scroll");
        document.body.classList.remove("no-scroll");
      }

      $$("[data-lb-close]", wrap).forEach((el) => el.addEventListener("click", close));

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && wrap.classList.contains("is-open")) close();
      });

      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) close();
      });

      return { open, close };
    }

    const lightbox = buildLightbox();

    function openItemById(id) {
      const el = items.find((x) => x.getAttribute("data-id") === id);
      if (!el) return;

      const img = $("img", el);
      const cap = $("figcaption", el);
      if (!img) return;

      el.scrollIntoView({ behavior: "smooth", block: "center" });

      lightbox.open({
        src: img.getAttribute("src"),
        alt: img.getAttribute("alt") || "",
        caption: cap ? cap.textContent : "",
      });
    }

    grid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card) return;
      const id = card.getAttribute("data-id");
      if (id) openItemById(id);
    });

    grid.addEventListener("keydown", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const id = card.getAttribute("data-id");
        if (id) openItemById(id);
      }
    });

    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");
    const id = params.get("id");

    if (cat) gallery.clickTabForTag(cat);
    if (id) window.setTimeout(() => openItemById(id), 80);
  })();

  /* =========================
     INQUIRY — SCHEDULE + PHONE + BUDGET + WEATHER + MAILTO
  ========================= */
  (function initInquiry() {
    const form = $("#inquiryForm");
    if (!form) return;

    const mailTo = "Mananajo65@live.com";

    // Plan + Phone
    const plan = $("[data-plan]");
    const phone = $("[data-phone]");

    // Uploads
    const uploads = $("[data-uploads]");

    // Budget
    const budgetAmount = $("[data-budget-amount]") || $("#budgetAmount");
    const budgetUseRange = $("[data-budget-range-toggle]");
    const budgetRangeWrap = $("[data-budget-range]");
    const budgetMin = $("[data-budget-min]");
    const budgetMax = $("[data-budget-max]");

    // Occasion + schedule
    const occasion = $("[data-occasion]") || $("#occasion");
    const scheduleWrap = $("[data-schedule]");
    const scheduleTpl = $("#scheduleBlockTpl");
    const scheduleAddBtn = $("[data-schedule-add]");

    // Hidden legacy fields (still used by mailto)
    const hiddenEventDate = $("#eventDate");
    const hiddenEventStartTime = $("#eventStartTime");
    const hiddenEventDuration = $("#eventDuration");

    // Venue fields
    const venueStreet = $("[data-venue-street]") || $("#venueStreet");
    const venueCity = $("[data-venue-city]") || $("#venueCity");
    const venueState = $("[data-venue-state]") || $("#venueState");
    const venueZip = $("[data-venue-zip]") || $("#venueZip");

    const scheduleMin = tomorrowISO();

    /* ---------- Budget UX ---------- */
    const attachNumericFormat = (el) => {
      if (!el) return;
      el.addEventListener("input", () => {
        el.value = formatNumber(el.value);
      });
    };
    attachNumericFormat(budgetAmount);
    attachNumericFormat(budgetMin);
    attachNumericFormat(budgetMax);

    if (budgetUseRange && budgetRangeWrap) {
      budgetUseRange.addEventListener("change", () => {
        budgetRangeWrap.style.display = budgetUseRange.checked ? "grid" : "none";
      });
    }

    /* ---------- Phone UX (plan-aware; +1 default) ---------- */
    const enforceDefaultPlan = () => {
      if (!plan) return;
      const v = safeTrim(plan.value);
      if (!v) plan.value = "+1 United States";
    };

    const phonePatterns = {
      "+1": "(###) ###-####",
      "+44": "#### ######",
      "+971": "### ### ####",
      "+966": "## ### ####",
      "+974": "#### ####",
      "+965": "#### ####",
      "+92": "### #######",
      "+91": "##### #####",
      "+33": "# ## ## ## ##",
      "+49": "#### ########",
      "+39": "### #### ####",
      "+61": "#### ### ###",
    };

    const formatWithPattern = (pattern, digits) => {
      let i = 0;
      const out = pattern.replace(/#/g, () => (i < digits.length ? digits[i++] : ""));
      return out.replace(/[^\d)]*$/, "");
    };

    const applyPhoneFormat = () => {
      if (!plan || !phone) return;

      phone.setCustomValidity("");

      const code = parsePlanCode(plan.value);
      const d = digitsOnly(phone.value);

      if (code === "+1") {
        phone.placeholder = "(201) 555-0123";
        phone.value = formatWithPattern(phonePatterns["+1"], d.slice(0, 10));
      } else {
        phone.placeholder = "Phone number";
        const pat = phonePatterns[code] || "###############";
        phone.value = formatWithPattern(pat, d.slice(0, 15));
      }
    };

    if (plan) {
      enforceDefaultPlan();
      plan.addEventListener("change", applyPhoneFormat);
    }
    if (phone) {
      phone.required = true;
      phone.addEventListener("input", applyPhoneFormat);
      phone.addEventListener("blur", () => {
        if (!plan) return;
        const code = parsePlanCode(plan.value);
        const d = digitsOnly(phone.value);

        if (code === "+1") {
          phone.setCustomValidity(d.length > 0 && d.length < 10 ? "Please enter a 10 digit phone number." : "");
        } else {
          phone.setCustomValidity(d.length > 0 && d.length < 6 ? "Please enter a valid phone number." : "");
        }
      });
    }

    /* ---------- Upload limit (max 3) ---------- */
    function validateUploads() {
      if (!uploads) return true;
      uploads.setCustomValidity("");
      const files = uploads.files ? Array.from(uploads.files) : [];
      if (files.length > 3) {
        uploads.setCustomValidity("Please upload a maximum of 3 files.");
        return false;
      }
      return true;
    }

    if (uploads) {
      uploads.addEventListener("change", () => {
        validateUploads();
        if (uploads.validationMessage) uploads.reportValidity();
      });
    }

    /* =========================================================
       SCHEDULE BUILDER
    ========================================================= */
    let activeScheduleBlock = null;

    const getScheduleBlocks = () => $$(".schedule-block", scheduleWrap || document);

    const setActiveBlock = (block) => {
      if (!block) return;
      getScheduleBlocks().forEach((b) => b.classList.remove("is-active"));
      block.classList.add("is-active");
      activeScheduleBlock = block;
      syncHiddenFromActiveSchedule();
      requestWeatherRefresh();
    };

    const getActiveScheduleValues = () => {
      if (!activeScheduleBlock) return { label: "", date: "", start: "", duration: "" };
      const label = safeTrim($("[data-schedule-label]", activeScheduleBlock)?.value);
      const date = safeTrim($("[data-schedule-date]", activeScheduleBlock)?.value);
      const start = safeTrim($("[data-schedule-start]", activeScheduleBlock)?.value);
      const duration = safeTrim($("[data-schedule-duration]", activeScheduleBlock)?.value);
      return { label, date, start, duration };
    };

    const getAllScheduleValues = () => {
      const blocks = getScheduleBlocks();
      return blocks.map((b) => ({
        el: b,
        label: safeTrim($("[data-schedule-label]", b)?.value),
        date: safeTrim($("[data-schedule-date]", b)?.value),
        start: safeTrim($("[data-schedule-start]", b)?.value),
        duration: safeTrim($("[data-schedule-duration]", b)?.value),
      }));
    };

    const syncHiddenFromActiveSchedule = () => {
      if (!hiddenEventDate || !hiddenEventStartTime || !hiddenEventDuration) return;
      const v = getActiveScheduleValues();
      hiddenEventDate.value = v.date || "";
      hiddenEventStartTime.value = v.start || "";
      hiddenEventDuration.value = v.duration || "";
    };

    const wireScheduleBlock = (block) => {
      if (!block) return;

      const dateEl = $("[data-schedule-date]", block);
      if (dateEl) {
        dateEl.min = scheduleMin;
        dateEl.required = true;
        dateEl.addEventListener("click", () => tryShowPicker(dateEl));
      }

      // click selects
      block.addEventListener("click", () => setActiveBlock(block));

      // remove
      const removeBtn = $("[data-schedule-remove]", block);
      if (removeBtn) {
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          block.remove();

          if (block === activeScheduleBlock) {
            activeScheduleBlock = null;
            const first = getScheduleBlocks()[0];
            if (first) setActiveBlock(first);
            else syncHiddenFromActiveSchedule();
            requestWeatherRefresh();
          } else {
            requestWeatherRefresh();
          }
        });
      }

      // changes inside block update
      $$("input, select", block).forEach((el) => {
        el.addEventListener("change", () => {
          if (block !== activeScheduleBlock) setActiveBlock(block);
          syncHiddenFromActiveSchedule();
          requestWeatherRefresh();
        });
      });
    };

    const createScheduleBlock = (preset = {}) => {
      if (!scheduleWrap || !scheduleTpl) return null;

      const frag = scheduleTpl.content.cloneNode(true);
      const block = frag.querySelector("[data-schedule-block]");
      if (!block) return null;

      const labelEl = $("[data-schedule-label]", block);
      const dateEl = $("[data-schedule-date]", block);
      const startEl = $("[data-schedule-start]", block);
      const durEl = $("[data-schedule-duration]", block);

      if (labelEl && preset.label) labelEl.value = preset.label;
      if (dateEl) dateEl.value = preset.date || "";
      if (startEl && preset.start) startEl.value = preset.start;
      if (durEl && preset.duration) durEl.value = preset.duration;

      scheduleWrap.appendChild(frag);

      const blocks = getScheduleBlocks();
      const appended = blocks[blocks.length - 1];

      wireScheduleBlock(appended);
      setActiveBlock(appended);
      return appended;
    };

    const resetSchedule = () => {
      if (!scheduleWrap) return;
      scheduleWrap.innerHTML = "";
      activeScheduleBlock = null;
      syncHiddenFromActiveSchedule();
    };

    const initScheduleDefault = () => {
      createScheduleBlock({});
    };

    if (scheduleAddBtn) {
      scheduleAddBtn.addEventListener("click", () => createScheduleBlock({}));
    }

    if (occasion) {
      occasion.addEventListener("change", () => {
        const occ = safeTrim(occasion.value);

        resetSchedule();

        if (occ === "Multi-Day Wedding Production") {
          createScheduleBlock({ label: "Mehndi" });
          createScheduleBlock({ label: "Nikah" });
          createScheduleBlock({ label: "Walima" });
        } else {
          initScheduleDefault();
        }

        requestWeatherRefresh();
      });
    }

    if (scheduleWrap && scheduleTpl) initScheduleDefault();

    /* =========================================================
       ADDRESS LEGITIMACY (Open-Meteo Geocoding)
    ========================================================= */
    const address = {
      cacheKey: "",
      coords: null,
      display: "",
      verified: false,
      pending: false,
    };

    const getVenueAddressString = () => {
      const street = safeTrim(venueStreet?.value);
      const city = safeTrim(venueCity?.value);
      const st = safeTrim(venueState?.value);
      const zip = safeTrim(venueZip?.value);
      const parts = [street, city, st, zip].filter(Boolean);
      return parts.join(", ");
    };

    const venueIsComplete = () => {
      const street = safeTrim(venueStreet?.value);
      const city = safeTrim(venueCity?.value);
      const st = safeTrim(venueState?.value);
      const zip = safeTrim(venueZip?.value);
      return !!(street && city && st && zip);
    };

    const validateZip = () => {
      const zip = safeTrim(venueZip?.value);
      if (!zip) return false;
      return /^\d{5}(-?\d{4})?$/.test(zip);
    };

    const geocodeVenueAddress = async () => {
      if (!venueIsComplete() || !validateZip()) {
        address.verified = false;
        address.coords = null;
        address.display = "";
        return null;
      }

      const query = getVenueAddressString();
      const key = query.toLowerCase();
      if (address.cacheKey === key && address.coords) return address.coords;

      address.pending = true;

      const url =
        "https://geocoding-api.open-meteo.com/v1/search" +
        `?name=${encodeURIComponent(query)}` +
        `&count=5&language=en&format=json`;

      try {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error("Geocoding failed.");
        const data = await res.json();

        const results = Array.isArray(data?.results) ? data.results : [];
        if (!results.length) {
          address.verified = false;
          address.coords = null;
          address.display = "";
          return null;
        }

        const zip = safeTrim(venueZip?.value).replace(/\s/g, "");
        const st = safeTrim(venueState?.value).toUpperCase();
        const city = safeTrim(venueCity?.value).toLowerCase();

        const pick =
          results.find((r) => {
            const admin1 = safeTrim(r?.admin1).toUpperCase();
            const name = safeTrim(r?.name).toLowerCase();
            const rPostal = safeTrim(r?.postcode || r?.post_code || r?.postal_code || "");
            return (
              (admin1 ? admin1 === st : true) &&
              (name ? name.includes(city) || city.includes(name) : true) &&
              (rPostal ? rPostal.replace(/\s/g, "") === zip : true)
            );
          }) || results[0];

        const lat = Number(pick.latitude);
        const lon = Number(pick.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          address.verified = false;
          address.coords = null;
          address.display = "";
          return null;
        }

        address.cacheKey = key;
        address.coords = { lat, lon };
        address.verified = true;

        const dispCity = safeTrim(pick?.name) || safeTrim(venueCity?.value);
        const dispAdmin = safeTrim(pick?.admin1) || safeTrim(venueState?.value);
        address.display = [dispCity, dispAdmin].filter(Boolean).join(", ");

        return address.coords;
      } catch (_) {
        address.verified = false;
        address.coords = null;
        address.display = "";
        return null;
      } finally {
        address.pending = false;
      }
    };

    /* =========================================================
       WEATHER — Live Card
    ========================================================= */
    const weatherState = {
      userCoords: null,
      userDisplay: "Your location",
      unit: "F", // "F" or "C"
      locale: safeTrim(navigator.language) || "en-US",
      lastFetchKey: "",
      lastPayload: null,
      lastResolvedPlace: "",
    };

    // Persist unit preference
    (function initUnitPref() {
      try {
        const saved = safeTrim(localStorage.getItem("andaaz_wx_unit"));
        if (saved === "C" || saved === "F") weatherState.unit = saved;
        else {
          const region = getLocaleRegionHint();
          // Default to Fahrenheit for US, Celsius elsewhere (reasonable default)
          weatherState.unit = region === "US" ? "F" : "C";
        }
      } catch (_) {}
    })();

    // Weather code → label + theme + icon family
    const wxLabel = (code) => {
      const c = Number(code);
      if (c === 0) return "Clear";
      if (c === 1 || c === 2) return "Mostly clear";
      if (c === 3) return "Overcast";
      if (c === 45 || c === 48) return "Fog";
      if ([51, 53, 55].includes(c)) return "Drizzle";
      if ([61, 63, 65].includes(c)) return "Rain";
      if ([66, 67].includes(c)) return "Freezing rain";
      if ([71, 73, 75, 77].includes(c)) return "Snow";
      if ([80, 81, 82].includes(c)) return "Rain showers";
      if ([85, 86].includes(c)) return "Snow showers";
      if ([95, 96, 99].includes(c)) return "Thunderstorms";
      return "Variable";
    };

    const wxThemeForCode = (code) => {
      const c = Number(code);
      if (c === 0) return "clear";
      if (c === 1 || c === 2) return "partly";
      if (c === 3 || c === 45 || c === 48) return "overcast";
      if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "rain";
      if ([95, 96, 99].includes(c)) return "storm";
      if ([71, 73, 75, 77, 85, 86].includes(c)) return "snow";
      return "overcast";
    };

    const svgIcon = (name, size = 44) => {
      // Minimal line icons (single-stroke look)
      const s = size;
      const common = `width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"`;
      if (name === "sun") {
        return `<svg ${common}>
          <circle cx="24" cy="24" r="8"></circle>
          <path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"></path>
        </svg>`;
      }
      if (name === "cloud") {
        return `<svg ${common}>
          <path d="M16 34h16a8 8 0 0 0 0-16 10 10 0 0 0-19.2 3.2A7 7 0 0 0 16 34z"></path>
        </svg>`;
      }
      if (name === "partly") {
        return `<svg ${common}>
          <path d="M16 34h16a8 8 0 0 0 0-16"></path>
          <circle cx="18" cy="20" r="6"></circle>
          <path d="M18 8v3M18 29v3M8 20h3M25 20h3M11 13l2 2M23 25l2 2M25 13l-2 2"></path>
        </svg>`;
      }
      if (name === "rain") {
        return `<svg ${common}>
          <path d="M16 30h16a8 8 0 0 0 0-16 10 10 0 0 0-19.2 3.2A7 7 0 0 0 16 30z"></path>
          <path d="M18 34l-2 6M26 34l-2 6M34 34l-2 6"></path>
        </svg>`;
      }
      if (name === "storm") {
        return `<svg ${common}>
          <path d="M16 30h16a8 8 0 0 0 0-16 10 10 0 0 0-19.2 3.2A7 7 0 0 0 16 30z"></path>
          <path d="M24 30l-6 10h6l-2 8 8-12h-6l2-6z"></path>
        </svg>`;
      }
      if (name === "snow") {
        return `<svg ${common}>
          <path d="M16 30h16a8 8 0 0 0 0-16 10 10 0 0 0-19.2 3.2A7 7 0 0 0 16 30z"></path>
          <path d="M18 36h0M24 38h0M30 36h0"></path>
          <path d="M18 36l0 0M24 38l0 0M30 36l0 0"></path>
        </svg>`;
      }
      if (name === "fog") {
        return `<svg ${common}>
          <path d="M14 28h20"></path>
          <path d="M12 34h24"></path>
          <path d="M16 22h16"></path>
          <path d="M16 18h16"></path>
        </svg>`;
      }
      // default
      return `<svg ${common}><path d="M10 26h28"></path></svg>`;
    };

    const iconForCode = (code) => {
      const c = Number(code);
      if (c === 0) return "sun";
      if (c === 1 || c === 2) return "partly";
      if (c === 3) return "cloud";
      if (c === 45 || c === 48) return "fog";
      if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "rain";
      if ([95, 96, 99].includes(c)) return "storm";
      if ([71, 73, 75, 77, 85, 86].includes(c)) return "snow";
      return "cloud";
    };

    const ensureLiveWeatherMarkup = (panel) => {
      // contact.html originally had a different markup. We normalize by injecting a live-card template.
      if (!panel) return null;
      if ($(".wx-head", panel)) return panel; // already normalized

      panel.innerHTML = `
        <div class="wx-live" aria-hidden="true">
          <div class="wx-live-base"></div>
          <div class="wx-live-glow"></div>
          <div class="wx-live-noise"></div>
        </div>

        <div class="wx-head">
          <div>
            <div class="wx-date" data-wx-date>Loading…</div>
            <div class="wx-loc" data-wx-location>Detecting location…</div>
          </div>
          <div class="wx-head-right">
            <span class="wx-chip" data-wx-mode>Current Location</span>
            <span class="wx-chip wx-chip-verified" data-wx-verified style="display:none;">Verified</span>
            <span class="wx-chip" data-wx-approx style="display:none;">Approximate</span>
          </div>
        </div>

        <div class="wx-hero">
          <div>
            <div class="wx-temp-row">
              <div class="wx-temp" data-wx-temp>—</div>
              <button type="button" class="wx-unit" data-wx-unit aria-label="Toggle temperature unit">°${weatherState.unit}</button>
            </div>

            <div class="wx-feels" data-wx-feels>Feels like —</div>

            <div class="wx-badges">
              <span class="wx-badge" data-wx-planning>Planning</span>
              <span class="wx-badge wx-badge-soft" data-wx-precip-badge>Precip —</span>
              <span class="wx-badge wx-badge-soft" data-wx-wind-badge>Wind —</span>
            </div>
          </div>

          <div class="wx-hero-right">
            <div class="wx-icon" data-wx-icon></div>
            <div class="wx-cond" data-wx-cond>—</div>
          </div>
        </div>

        <div class="wx-metrics">
          <div class="wx-metric">
            <div class="wx-metric-ico" data-wx-ico="sunrise"></div>
            <div class="wx-metric-val" data-wx-sunrise>—</div>
            <div class="wx-metric-lbl">Sunrise</div>
          </div>
          <div class="wx-metric">
            <div class="wx-metric-ico" data-wx-ico="sunset"></div>
            <div class="wx-metric-val" data-wx-sunset>—</div>
            <div class="wx-metric-lbl">Sunset</div>
          </div>
          <div class="wx-metric">
            <div class="wx-metric-ico" data-wx-ico="humidity"></div>
            <div class="wx-metric-val" data-wx-humidity>—</div>
            <div class="wx-metric-lbl">Humidity</div>
          </div>
          <div class="wx-metric">
            <div class="wx-metric-ico" data-wx-ico="pressure"></div>
            <div class="wx-metric-val" data-wx-pressure>—</div>
            <div class="wx-metric-lbl">Pressure</div>
          </div>
          <div class="wx-metric">
            <div class="wx-metric-ico" data-wx-ico="precip"></div>
            <div class="wx-metric-val" data-wx-precip>—</div>
            <div class="wx-metric-lbl">Precip</div>
          </div>
          <div class="wx-metric">
            <div class="wx-metric-ico" data-wx-ico="wind"></div>
            <div class="wx-metric-val" data-wx-wind>—</div>
            <div class="wx-metric-lbl">Wind</div>
          </div>
        </div>

        <div class="wx-hourly-wrap" data-wx-hourly-wrap style="display:none;">
          <div class="mini-title" style="margin-top:12px;">Event window</div>
          <div class="wx-hourly" data-wx-hourly></div>
        </div>

        <div class="wx-stack" data-wx-stack style="display:none;"></div>

        <div class="row" style="justify-content:space-between; align-items:center; margin-top: 12px;">
          <div class="mini-title" style="margin:0;">5 day forecast</div>
        </div>

        <div class="weather-5day" data-wx-5day>
          ${Array.from({ length: 5 })
            .map(
              () => `
            <div class="weather-day">
              <div class="wd-dow">—</div>
              <div class="wd-ico" aria-hidden="true"></div>
              <div class="wd-temp">—</div>
              <div class="wd-sub muted">—</div>
            </div>`
            )
            .join("")}
        </div>

        <p class="muted small" style="margin-top: 12px;" data-wx-hint>
          Add schedule dates and a venue address for event-day conditions. Otherwise, this shows today’s forecast for your current location.
        </p>
      `;

      return panel;
    };

    const wxUI = (() => {
      const panel = ensureLiveWeatherMarkup($("[data-weather-panel]"));
      if (!panel) return null;

      return {
        panel,
        mode: $("[data-wx-mode]", panel),
        location: $("[data-wx-location]", panel),
        date: $("[data-wx-date]", panel),

        temp: $("[data-wx-temp]", panel),
        feels: $("[data-wx-feels]", panel),
        unitBtn: $("[data-wx-unit]", panel),

        icon: $("[data-wx-icon]", panel),
        cond: $("[data-wx-cond]", panel),

        sunrise: $("[data-wx-sunrise]", panel),
        sunset: $("[data-wx-sunset]", panel),
        humidity: $("[data-wx-humidity]", panel),
        pressure: $("[data-wx-pressure]", panel),
        precip: $("[data-wx-precip]", panel),
        wind: $("[data-wx-wind]", panel),

        precipBadge: $("[data-wx-precip-badge]", panel),
        windBadge: $("[data-wx-wind-badge]", panel),

        verified: $("[data-wx-verified]", panel),
        approx: $("[data-wx-approx]", panel),

        hourlyWrap: $("[data-wx-hourly-wrap]", panel),
        hourly: $("[data-wx-hourly]", panel),

        stack: $("[data-wx-stack]", panel),
        strip5: $("[data-wx-5day]", panel),

        hint: $("[data-wx-hint]", panel),
      };
    })();

    const setModeBadges = ({ verified, approx }) => {
      if (!wxUI) return;
      if (wxUI.verified) wxUI.verified.style.display = verified ? "inline-flex" : "none";
      if (wxUI.approx) wxUI.approx.style.display = approx ? "inline-flex" : "none";
    };

    const setLoading = (msg) => {
      if (!wxUI) return;

      if (wxUI.temp) wxUI.temp.textContent = "—";
      if (wxUI.feels) wxUI.feels.textContent = "Feels like —";
      if (wxUI.cond) wxUI.cond.textContent = "—";

      if (wxUI.sunrise) wxUI.sunrise.textContent = "—";
      if (wxUI.sunset) wxUI.sunset.textContent = "—";
      if (wxUI.humidity) wxUI.humidity.textContent = "—";
      if (wxUI.pressure) wxUI.pressure.textContent = "—";
      if (wxUI.precip) wxUI.precip.textContent = "—";
      if (wxUI.wind) wxUI.wind.textContent = "—";

      if (wxUI.precipBadge) wxUI.precipBadge.textContent = "Precip —";
      if (wxUI.windBadge) wxUI.windBadge.textContent = "Wind —";

      if (wxUI.icon) wxUI.icon.innerHTML = "";

      if (wxUI.hourlyWrap) wxUI.hourlyWrap.style.display = "none";
      if (wxUI.stack) wxUI.stack.style.display = "none";

      if (wxUI.hint) wxUI.hint.textContent = msg || "Loading forecast…";
    };

    const toUserUnitTemp = (c) => {
      if (!Number.isFinite(Number(c))) return null;
      const cNum = Number(c);
      if (weatherState.unit === "C") return Math.round(cNum);
      return Math.round(cNum * 9 / 5 + 32);
    };

    const toUserUnitWind = (kmh) => {
      // Keep km/h (matches earlier); feel free to shift later if desired.
      return Number.isFinite(Number(kmh)) ? `${Math.round(Number(kmh))} km/h` : "—";
    };

    const setThemeNight = (theme, isNight) => {
      if (!wxUI?.panel) return;
      wxUI.panel.setAttribute("data-weather-theme", theme || "clear");
      wxUI.panel.setAttribute("data-weather-night", isNight ? "true" : "false");
    };

    const fetchForecast = async ({ lat, lon }) => {
      const url =
        "https://api.open-meteo.com/v1/forecast" +
        `?latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lon)}` +
        `&timezone=auto` +
        `&current_weather=true` +
        `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,windspeed_10m_max` +
        `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,windspeed_10m,relativehumidity_2m,pressure_msl,weathercode` +
        `&forecast_days=16`;

      const key = `${lat},${lon}`;
      if (weatherState.lastFetchKey === key && weatherState.lastPayload) return weatherState.lastPayload;

      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error("Forecast fetch failed.");
      const data = await res.json();

      weatherState.lastFetchKey = key;
      weatherState.lastPayload = data;
      return data;
    };

    const pickHourlyIndexNear = (hourlyTimeArr, targetDateISO, targetHHMM) => {
      if (!Array.isArray(hourlyTimeArr) || !targetDateISO || !targetHHMM) return -1;
      const target = new Date(`${targetDateISO}T${targetHHMM}:00`);
      let bestIdx = -1;
      let bestDist = Infinity;

      for (let i = 0; i < hourlyTimeArr.length; i++) {
        const t = new Date(hourlyTimeArr[i]);
        const dist = Math.abs(t.getTime() - target.getTime());
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    const buildHourlyWindow = (hourly, centerIdx, count = 5) => {
      const times = hourly?.time || [];
      const half = Math.floor(count / 2);
      const start = clamp(centerIdx - half, 0, Math.max(0, times.length - count));
      const out = [];
      for (let i = 0; i < count; i++) out.push(start + i);
      return out;
    };

    const renderHourlyStrip = (hourly, indices, centerIdx) => {
      if (!wxUI?.hourly) return;

      wxUI.hourly.innerHTML = "";
      indices.forEach((idx) => {
        const tISO = hourly.time[idx];
        const tempC = hourly.temperature_2m?.[idx];
        const windKmh = hourly.windspeed_10m?.[idx];
        const pp = hourly.precipitation_probability?.[idx];
        const code = hourly.weathercode?.[idx];

        const card = document.createElement("button");
        card.type = "button";
        card.className = "wx-hour" + (idx === centerIdx ? " is-center" : "");
        card.innerHTML = `
          <div class="wx-hour-time">${toHourLabel(tISO)}</div>
          <div class="wx-hour-ico">${svgIcon(iconForCode(code), 22)}</div>
          <div class="wx-hour-temp">${toUserUnitTemp(tempC) !== null ? `${toUserUnitTemp(tempC)}°` : "—"}</div>
          <div class="wx-hour-wind">Wind ${toUserUnitWind(windKmh)}</div>
        `;

        // No click action for now; could later pin weather to that hour.
        wxUI.hourly.appendChild(card);
      });

      if (wxUI.hourlyWrap) wxUI.hourlyWrap.style.display = "block";
    };

    const renderEventStack = (events, daily, hourly) => {
      if (!wxUI?.stack) return;
      wxUI.stack.innerHTML = "";

      const dailyTimes = daily?.time || [];
      const tmax = daily?.temperature_2m_max || [];
      const wcode = daily?.weathercode || [];

      events.forEach((ev) => {
        const label = ev.label ? ev.label : "Event";
        const dateISO = ev.date;
        const start = ev.start;

        const dailyIdx = dailyTimes.indexOf(dateISO);
        const hiC = dailyIdx >= 0 ? Number(tmax[dailyIdx]) : null;
        const hi = Number.isFinite(hiC) ? toUserUnitTemp(hiC) : null;

        let ppTxt = "—";
        if (dateISO && start && Array.isArray(hourly?.time)) {
          const hIdx = pickHourlyIndexNear(hourly.time, dateISO, start);
          if (hIdx >= 0) {
            const pp = hourly.precipitation_probability?.[hIdx];
            if (Number.isFinite(Number(pp))) ppTxt = `${Math.round(Number(pp))}%`;
          }
        }

        const code = dailyIdx >= 0 ? wcode[dailyIdx] : null;

        const el = document.createElement("div");
        el.className = "wx-event";
        el.innerHTML = `
          <div class="wx-event-left">
            <div class="wx-event-title">${normalizeText(label)}</div>
            <div class="wx-event-sub">${dateISO ? prettyDateLong(dateISO) : "Date pending"}${start ? ` · ${start}` : ""}</div>
          </div>
          <div class="wx-event-right">
            <div class="wx-icon" style="width:24px;height:24px;opacity:.9;">${svgIcon(iconForCode(code), 22)}</div>
            <div class="wx-event-hi">${hi !== null ? `${hi}°` : "—"}</div>
            <div class="wx-event-prob">${ppTxt}</div>
          </div>
        `;
        wxUI.stack.appendChild(el);
      });

      wxUI.stack.style.display = "flex";
    };

    const populate5DayStrip = (daily, anchorDateISO) => {
      if (!wxUI?.strip5) return;

      const children = Array.from(wxUI.strip5.children || []).slice(0, 5);
      if (!children.length) return;

      const times = daily?.time || [];
      const tmax = daily?.temperature_2m_max || [];
      const tmin = daily?.temperature_2m_min || [];
      const precip = daily?.precipitation_sum || [];
      const wcode = daily?.weathercode || [];

      const idx = times.indexOf(anchorDateISO);
      const startIdx = idx >= 0 ? idx : 0;

      setModeBadges({ verified: address.verified, approx: idx < 0 && !!anchorDateISO });

      for (let i = 0; i < 5; i++) {
        const dayIdx = startIdx + i;
        const el = children[i];
        if (!el) continue;

        const dateIso = times[dayIdx];
        const hiC = Number(tmax?.[dayIdx]);
        const loC = Number(tmin?.[dayIdx]);

        const hi = Number.isFinite(hiC) ? toUserUnitTemp(hiC) : null;
        const lo = Number.isFinite(loC) ? toUserUnitTemp(loC) : null;

        const pr = Number.isFinite(Number(precip?.[dayIdx])) ? Number(precip[dayIdx]) : null;
        const code = wcode?.[dayIdx];

        const d = dateIso ? new Date(`${dateIso}T00:00:00`) : null;
        const dow = d
          ? new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d)
          : "—";

        const tempLine = hi !== null && lo !== null ? `${hi}° / ${lo}°` : "—";
        const subParts = [];
        if (code !== undefined && code !== null) subParts.push(wxLabel(code));
        if (pr !== null) subParts.push(`${pr} mm`);
        const subLine = subParts.length ? subParts.join(" · ") : "—";

        const wdDow = $(".wd-dow", el);
        const wdTemp = $(".wd-temp", el);
        const wdSub = $(".wd-sub", el);
        const wdIco = $(".wd-ico", el);

        if (wdDow) wdDow.textContent = dow;
        if (wdTemp) wdTemp.textContent = tempLine;
        if (wdSub) wdSub.textContent = subLine;
        if (wdIco) wdIco.innerHTML = svgIcon(iconForCode(code), 22);
      }
    };

    const getAnchorDateISO = () => {
      const sched = getActiveScheduleValues();
      return sched.date || isoDate(new Date());
    };

    const getAnchorStart = () => {
      const sched = getActiveScheduleValues();
      return sched.start || "";
    };

    const resolveCoordsAndMode = async () => {
      // Prefer venue when complete+zip looks sane; else use user coords.
      let coords = null;
      let display = "";
      let mode = "Current Location";

      if (venueIsComplete() && validateZip()) {
        coords = await geocodeVenueAddress();
        if (coords && address.verified) {
          display = address.display || safeTrim(venueCity?.value);
          mode = "Venue Location";
          return { coords, display, mode, verified: true };
        }
      }

      // Fallback: user geolocation
      if (!weatherState.userCoords && navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              weatherState.userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 }
          );
        });
      }

      coords = weatherState.userCoords;
      display = weatherState.userDisplay;
      return { coords, display, mode, verified: false };
    };

    const updateWeatherUI = async () => {
      if (!wxUI?.panel) return;

      const anchorDateISO = getAnchorDateISO();
      const anchorStart = getAnchorStart();

      setLoading("Preparing forecast…");

      const resolved = await resolveCoordsAndMode();

      if (!resolved.coords) {
        if (wxUI.mode) wxUI.mode.textContent = "Current Location";
        if (wxUI.location) wxUI.location.textContent = "Location permission required";
        if (wxUI.date) wxUI.date.textContent = prettyDateLong(anchorDateISO);
        setLoading("Enable location or add a venue address for a forecast.");
        return;
      }

      if (wxUI.mode) wxUI.mode.textContent = resolved.mode;
      if (wxUI.location) wxUI.location.textContent = resolved.display || "—";
      if (wxUI.date) wxUI.date.textContent = prettyDateLong(anchorDateISO);

      setModeBadges({ verified: !!resolved.verified, approx: false });

      try {
        const data = await fetchForecast({ lat: resolved.coords.lat, lon: resolved.coords.lon });
        const daily = data?.daily || {};
        const hourly = data?.hourly || {};

        const dailyTimes = Array.isArray(daily.time) ? daily.time : [];
        const dailyIdx = dailyTimes.indexOf(anchorDateISO);

        // Determine day/night using sunrise/sunset for anchor day if available.
        let isNight = false;
        if (dailyIdx >= 0 && Array.isArray(daily.sunrise) && Array.isArray(daily.sunset)) {
          const sr = daily.sunrise[dailyIdx] ? new Date(daily.sunrise[dailyIdx]) : null;
          const ss = daily.sunset[dailyIdx] ? new Date(daily.sunset[dailyIdx]) : null;
          const now = new Date();
          if (sr && ss) isNight = now < sr || now > ss;
        }

        // Choose weather code for visuals:
        // Prefer hourly around event start if possible; otherwise daily.
        let visualCode = dailyIdx >= 0 ? daily.weathercode?.[dailyIdx] : null;

        let eventHourlyIdx = -1;
        if (anchorDateISO && anchorStart && Array.isArray(hourly.time)) {
          eventHourlyIdx = pickHourlyIndexNear(hourly.time, anchorDateISO, anchorStart);
          if (eventHourlyIdx >= 0) {
            const hc = hourly.weathercode?.[eventHourlyIdx];
            if (hc !== undefined && hc !== null) visualCode = hc;
          }
        }

        const theme = wxThemeForCode(visualCode);
        setThemeNight(theme, isNight);

        // Primary hero values:
        // - Use hourly at event start when present; otherwise daily high/low
        if (eventHourlyIdx >= 0) {
          const tempC = hourly.temperature_2m?.[eventHourlyIdx];
          const feelsC = hourly.apparent_temperature?.[eventHourlyIdx];
          const pp = hourly.precipitation_probability?.[eventHourlyIdx];
          const windKmh = hourly.windspeed_10m?.[eventHourlyIdx];
          const hum = hourly.relativehumidity_2m?.[eventHourlyIdx];
          const pres = hourly.pressure_msl?.[eventHourlyIdx];
          const prmm = hourly.precipitation?.[eventHourlyIdx];

          const t = toUserUnitTemp(tempC);
          if (wxUI.temp) wxUI.temp.textContent = t !== null ? `${t}°` : "—";
          if (wxUI.feels) {
            const f = toUserUnitTemp(feelsC);
            wxUI.feels.textContent = f !== null ? `Feels like ${f}°` : "Feels like —";
          }

          if (wxUI.precip) {
            if (Number.isFinite(Number(pp))) wxUI.precip.textContent = `${Math.round(Number(pp))}%`;
            else if (Number.isFinite(Number(prmm))) wxUI.precip.textContent = `${Number(prmm)} mm`;
            else wxUI.precip.textContent = "—";
          }
          if (wxUI.wind) wxUI.wind.textContent = toUserUnitWind(windKmh);
          if (wxUI.humidity) wxUI.humidity.textContent = Number.isFinite(Number(hum)) ? `${Math.round(Number(hum))}%` : "—";
          if (wxUI.pressure) wxUI.pressure.textContent = Number.isFinite(Number(pres)) ? `${Math.round(Number(pres))} hPa` : "—";

          if (wxUI.precipBadge) wxUI.precipBadge.textContent = Number.isFinite(Number(pp)) ? `Precip ${Math.round(Number(pp))}%` : "Precip —";
          if (wxUI.windBadge) wxUI.windBadge.textContent = Number.isFinite(Number(windKmh)) ? `Wind ${Math.round(Number(windKmh))} km/h` : "Wind —";
        } else {
          const hiC = dailyIdx >= 0 ? Number(daily.temperature_2m_max?.[dailyIdx]) : null;
          const loC = dailyIdx >= 0 ? Number(daily.temperature_2m_min?.[dailyIdx]) : null;
          const pr = dailyIdx >= 0 ? Number(daily.precipitation_sum?.[dailyIdx]) : null;
          const wmax = dailyIdx >= 0 ? Number(daily.windspeed_10m_max?.[dailyIdx]) : null;

          const hi = Number.isFinite(hiC) ? toUserUnitTemp(hiC) : null;
          const lo = Number.isFinite(loC) ? toUserUnitTemp(loC) : null;

          if (wxUI.temp) wxUI.temp.textContent = hi !== null ? `${hi}°` : "—";
          if (wxUI.feels) wxUI.feels.textContent = lo !== null ? `Low ${lo}°` : "Feels like —";

          if (wxUI.precip) wxUI.precip.textContent = Number.isFinite(pr) ? `${pr} mm` : "—";
          if (wxUI.wind) wxUI.wind.textContent = Number.isFinite(wmax) ? `${Math.round(wmax)} km/h` : "—";

          if (wxUI.precipBadge) wxUI.precipBadge.textContent = Number.isFinite(pr) ? `Precip ${pr} mm` : "Precip —";
          if (wxUI.windBadge) wxUI.windBadge.textContent = Number.isFinite(wmax) ? `Wind ${Math.round(wmax)} km/h` : "Wind —";
        }

        // Sunrise/Sunset
        if (dailyIdx >= 0) {
          const sr = daily.sunrise?.[dailyIdx];
          const ss = daily.sunset?.[dailyIdx];
          if (wxUI.sunrise) wxUI.sunrise.textContent = sr ? new Date(sr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
          if (wxUI.sunset) wxUI.sunset.textContent = ss ? new Date(ss).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
        }

        // Condition label + icon
        if (wxUI.cond) wxUI.cond.textContent = wxLabel(visualCode);
        if (wxUI.icon) wxUI.icon.innerHTML = svgIcon(iconForCode(visualCode), 44);

        // Single vs multi-event behavior
        const allEvents = getAllScheduleValues().filter((x) => x.date); // only set dates count as “real”
        const multi = allEvents.length > 1;

        // Hourly strip: only for a single event and only when start time exists and hourly exists
        if (!multi && anchorDateISO && anchorStart && Array.isArray(hourly.time)) {
          const centerIdx = pickHourlyIndexNear(hourly.time, anchorDateISO, anchorStart);
          if (centerIdx >= 0) {
            const idxs = buildHourlyWindow(hourly, centerIdx, 5);
            renderHourlyStrip(hourly, idxs, centerIdx);
          } else if (wxUI.hourlyWrap) {
            wxUI.hourlyWrap.style.display = "none";
          }
        } else if (wxUI.hourlyWrap) {
          wxUI.hourlyWrap.style.display = "none";
        }

        // Multi-event stack summary: one mini card per event
        if (multi) {
          renderEventStack(allEvents, daily, hourly);
        } else if (wxUI.stack) {
          wxUI.stack.style.display = "none";
        }

        // 5-day anchored to schedule date (or today)
        populate5DayStrip(daily, anchorDateISO);

        // Hint
        if (wxUI.hint) {
          if (venueIsComplete() && validateZip()) {
            wxUI.hint.textContent = address.verified
              ? "Forecast aligned to your selected schedule date and venue."
              : "Address entered. Refining forecast—confirm details for precision.";
          } else {
            wxUI.hint.textContent =
              "Add venue details for event-day conditions. Otherwise, this shows the forecast for your current location.";
          }
        }
      } catch (_) {
        setLoading("Forecast unavailable. Please try again shortly.");
        setModeBadges({ verified: false, approx: true });
      }
    };

    const requestWeatherRefresh = debounce(updateWeatherUI, 350);

    // Unit toggle
    if (wxUI?.unitBtn) {
      wxUI.unitBtn.textContent = `°${weatherState.unit}`;
      wxUI.unitBtn.addEventListener("click", () => {
        weatherState.unit = weatherState.unit === "F" ? "C" : "F";
        try {
          localStorage.setItem("andaaz_wx_unit", weatherState.unit);
        } catch (_) {}
        wxUI.unitBtn.textContent = `°${weatherState.unit}`;
        requestWeatherRefresh();
      });
    }

    // Venue listeners
    [venueStreet, venueCity, venueState, venueZip].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", () => {
        address.cacheKey = "";
        address.coords = null;
        address.display = "";
        address.verified = false;
        requestWeatherRefresh();
      });
      el.addEventListener("blur", requestWeatherRefresh);
    });

    // Initial weather load
    requestWeatherRefresh();

    /* =========================================================
       MAILTO SUBMISSION
    ========================================================= */
    const validateSchedule = () => {
      if (!scheduleWrap) return true;

      const blocks = getScheduleBlocks();
      if (!blocks.length) return false;

      const hasDate = blocks.some((b) => safeTrim($("[data-schedule-date]", b)?.value));
      if (!hasDate) return false;

      const min = new Date(`${scheduleMin}T00:00:00`);
      for (const b of blocks) {
        const d = safeTrim($("[data-schedule-date]", b)?.value);
        if (!d) continue;
        const picked = new Date(`${d}T00:00:00`);
        if (picked < min) return false;
      }
      return true;
    };

    const buildScheduleSummary = () => {
      if (!scheduleWrap) return { primaryDate: "", lines: [] };

      const blocks = getScheduleBlocks();
      const lines = [];
      const dates = [];

      blocks.forEach((b, idx) => {
        const label = safeTrim($("[data-schedule-label]", b)?.value);
        const date = safeTrim($("[data-schedule-date]", b)?.value);
        const start = safeTrim($("[data-schedule-start]", b)?.value);
        const dur = safeTrim($("[data-schedule-duration]", b)?.value);

        if (date) dates.push(date);

        const labelTxt = label ? `${label} — ` : "";
        const startTxt = start ? ` — ${start}` : "";
        const durTxt = dur ? ` — ${dur} min` : "";

        const line = date
          ? `${idx + 1}. ${labelTxt}${date}${startTxt}${durTxt}`.replace(/\s+-\s+/, " — ")
          : `${idx + 1}. ${labelTxt}(date not set)`;

        lines.push(line);
      });

      dates.sort();
      return { primaryDate: dates[0] || "", lines };
    };

    const buildBudgetString = (fd) => {
      const cur = safeTrim(fd.get("budgetCurrency"));
      const basis = safeTrim(fd.get("budgetBasis"));
      const amount = safeTrim(fd.get("budgetAmount"));
      const useRange = budgetUseRange ? !!budgetUseRange.checked : false;

      const min = safeTrim(fd.get("budgetMin"));
      const max = safeTrim(fd.get("budgetMax"));

      const curTxt = cur ? cur : "";
      const basisTxt = basis ? ` · ${basis}` : "";

      if (useRange && (min || max)) {
        const left = min ? `${curTxt} ${min}`.trim() : "";
        const right = max ? `${curTxt} ${max}`.trim() : "";
        const range = left && right ? `${left} — ${right}` : (left || right);
        return `${range}${basisTxt}`.trim();
      }

      if (amount) return `${curTxt} ${amount}${basisTxt}`.trim();
      return `${curTxt}${basisTxt}`.trim();
    };

    form.addEventListener("submit", async (e) => {
      if (!validateUploads()) {
        e.preventDefault();
        uploads.reportValidity();
        return;
      }

      if (!validateSchedule()) {
        e.preventDefault();
        alert("Please add at least one schedule date (future date) for your event.");
        return;
      }

      if (venueIsComplete() && !validateZip()) {
        e.preventDefault();
        venueZip.setCustomValidity("Please enter a valid ZIP code.");
        venueZip.reportValidity();
        return;
      } else if (venueZip) {
        venueZip.setCustomValidity("");
      }

      if (!form.checkValidity()) {
        e.preventDefault();
        form.reportValidity();
        return;
      }

      // Attempt verification (do not hard-block)
      if (venueIsComplete() && validateZip()) {
        await geocodeVenueAddress();
      }

      e.preventDefault();

      const fd = new FormData(form);

      const firstName = safeTrim(fd.get("firstName"));
      const lastName = safeTrim(fd.get("lastName"));
      const fullName = [firstName, lastName].filter(Boolean).join(" ");

      const occ = safeTrim(fd.get("occasion"));

      const sched = buildScheduleSummary();
      const primaryEventDate = sched.primaryDate || safeTrim(fd.get("eventDate")) || "";

      const planVal = safeTrim(fd.get("plan"));
      const phoneVal = safeTrim(fd.get("phone"));
      const emailVal = safeTrim(fd.get("email"));
      const preferredContact = safeTrim(fd.get("altContact"));

      const vName = safeTrim(fd.get("venueName"));
      const vStreet = safeTrim(fd.get("venueStreet"));
      const vCity = safeTrim(fd.get("venueCity"));
      const vState = safeTrim(fd.get("venueState"));
      const vZip = safeTrim(fd.get("venueZip"));

      const guestCount = safeTrim(fd.get("guestCount"));
      const budgetText = buildBudgetString(fd);

      const designDirection = safeTrim(fd.get("designDirection"));
      const primary1 = safeTrim(fd.get("primary1"));
      const primary2 = safeTrim(fd.get("primary2"));
      const primary3 = safeTrim(fd.get("primary3"));
      const secondary1 = safeTrim(fd.get("secondary1"));
      const secondary2 = safeTrim(fd.get("secondary2"));

      const inspirationLinks = safeTrim(fd.get("inspirationLinks"));
      const notes = safeTrim(fd.get("notes"));

      const files = uploads && uploads.files ? Array.from(uploads.files) : [];
      const fileList = files.length ? files.map((f) => `- ${f.name}`).join("\n") : "None";

      const venueDisplay = [vName, vCity, vState].filter(Boolean).join(", ");
      const geoNote = venueIsComplete()
        ? (address.verified ? "Address validation: Verified" : "Address validation: Entered (verification pending)")
        : "Address validation: Not provided";

      const subject = `Andaaz Decorations Inquiry I ${occ || "Occasion"} I ${primaryEventDate || "Event Date"}`;

      const bodyLines = [
        "ANDAAZ DECORATIONS INQUIRY",
        "",
        "SUMMARY",
        padLine("Occasion", occ),
        padLine("Primary event date", primaryEventDate),
        padLine("Schedule items", sched.lines.length ? String(sched.lines.length) : "0"),
        padLine("Guest count", guestCount),
        padLine("Budget", budgetText),
        padLine("Venue", venueDisplay),
        padLine("Outdoor planning", "See Weather panel metrics"),
        "",
        "CLIENT",
        padLine("Name", fullName),
        padLine("Email", emailVal),
        padLine("Phone", `${planVal} ${phoneVal}`.trim()),
        padLine("Preferred contact method", preferredContact),
        "",
        "EVENT SCHEDULE",
        ...(sched.lines.length ? sched.lines : ["(No schedule items)"]),
        "",
        "VENUE",
        padLine("Venue name", vName),
        padLine("Street address", vStreet),
        padLine("City", vCity),
        padLine("State", vState),
        padLine("Zip code", vZip),
        geoNote,
        "",
        "SCOPE",
        padLine("Guest count", guestCount),
        padLine("Budget currency", safeTrim(fd.get("budgetCurrency"))),
        padLine("Budget basis", safeTrim(fd.get("budgetBasis"))),
        padLine("Budget amount", safeTrim(fd.get("budgetAmount"))),
        padLine("Budget range", (budgetUseRange && budgetUseRange.checked) ? `${safeTrim(fd.get("budgetMin")) || "—"} — ${safeTrim(fd.get("budgetMax")) || "—"}` : "Not used"),
        "",
        "DESIGN",
        padLine("Design direction", designDirection),
        padLine("Primary colors", [primary1, primary2, primary3].filter(Boolean).join(", ")),
        padLine("Secondary colors", [secondary1, secondary2].filter(Boolean).join(", ")),
        "",
        "INSPIRATION AND DOCUMENTS",
        "Selected files (not attached via email)",
        fileList,
        "",
        "Inspiration links",
        inspirationLinks || "",
        "",
        "VISION",
        notes || "",
        "",
        "NOTE",
        "Attachments cannot be included when sending via email link. Please include share links for files you want reviewed.",
      ].join("\n");

      const mailtoHref =
        `mailto:${encodeURIComponent(mailTo)}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(bodyLines)}`;

      window.location.href = mailtoHref;
    });
  })();

  /* =========================
     HOME: HYATT TABS + SLIDER
  ========================= */
  (function initHyattSlider() {
    const hyattTabsWrap = $("[data-hyatt-tabs]");
    const hyattSlider = $("[data-hyatt-slider]");
    const hyattViewport = $("[data-hyatt-viewport]");
    const hyattTrack = $("[data-hyatt-track]");
    const hyattLabel = $("[data-hyatt-label]");
    const hyattCount = $("[data-hyatt-count]");

    const hyattPrevBtns = $$("[data-hyatt-prev]");
    const hyattNextBtns = $$("[data-hyatt-next]");
    const hyattTabBtns = hyattTabsWrap ? $$('[role="tab"]', hyattTabsWrap) : [];
    const hyattSlidesAll = hyattTrack ? $$("[data-hyatt-slide]", hyattTrack) : [];

    if (!hyattTabsWrap || !hyattSlider || !hyattViewport || !hyattTrack || !hyattSlidesAll.length) return;

    let activeIndex = 0;

    const getCatFromTab = (tabBtn) => tabBtn?.getAttribute("data-tab") || "stages";
    const getVisibleSlides = () => hyattSlidesAll.filter((slide) => slide.style.display !== "none");

    function setTabsActive(cat) {
      hyattTabBtns.forEach((btn) => {
        const isActive = getCatFromTab(btn) === cat;
        btn.setAttribute("aria-selected", String(isActive));
      });
    }

    function getActiveCardMeta(activeSlide) {
      if (!activeSlide) return { kicker: "", title: "" };
      const kickerEl = $(".slide-kicker", activeSlide);
      const titleEl = $(".slide-title", activeSlide);
      return {
        kicker: normalizeText(kickerEl ? kickerEl.textContent : ""),
        title: normalizeText(titleEl ? titleEl.textContent : ""),
      };
    }

    function updateUI() {
      const visible = getVisibleSlides();
      const total = visible.length;

      if (total === 0) {
        if (hyattLabel) hyattLabel.textContent = "";
        if (hyattCount) hyattCount.textContent = "0 / 0";
        return;
      }

      activeIndex = Math.max(0, Math.min(activeIndex, total - 1));

      const activeSlide = visible[activeIndex];
      const meta = getActiveCardMeta(activeSlide);

      if (hyattLabel) {
        const left = meta.kicker || "";
        const right = meta.title || "";
        hyattLabel.textContent = left && right ? `${left} · ${right}` : (left || right || "");
      }

      if (hyattCount) {
        hyattCount.style.display = "";
        hyattCount.textContent = `${activeIndex + 1} / ${total}`;
      }

      const atStart = activeIndex === 0;
      const atEnd = activeIndex === total - 1;

      hyattPrevBtns.forEach((b) => b.toggleAttribute("disabled", atStart));
      hyattNextBtns.forEach((b) => b.toggleAttribute("disabled", atEnd));
    }

    function scrollToActive(behavior = "smooth") {
      const visible = getVisibleSlides();
      if (!visible.length) return;

      const activeSlide = visible[activeIndex];
      if (!activeSlide) return;

      const viewportRect = hyattViewport.getBoundingClientRect();
      const slideRect = activeSlide.getBoundingClientRect();

      const viewportCenter = viewportRect.left + viewportRect.width / 2;
      const slideCenter = slideRect.left + slideRect.width / 2;

      const delta = slideCenter - viewportCenter;
      const target = hyattViewport.scrollLeft + delta;

      hyattViewport.scrollTo({ left: Math.max(0, target), behavior });
    }

    function showCategory(cat) {
      activeIndex = 0;

      hyattSlidesAll.forEach((slide) => {
        const slideCat = slide.getAttribute("data-cat");
        slide.style.display = slideCat === cat ? "" : "none";
      });

      setTabsActive(cat);
      updateUI();
      scrollToActive("auto");
    }

    function goPrev() {
      activeIndex -= 1;
      updateUI();
      scrollToActive();
    }

    function goNext() {
      activeIndex += 1;
      updateUI();
      scrollToActive();
    }

    hyattPrevBtns.forEach((btn) => btn.addEventListener("click", goPrev));
    hyattNextBtns.forEach((btn) => btn.addEventListener("click", goNext));

    hyattTabBtns.forEach((btn) => {
      btn.addEventListener("click", () => showCategory(getCatFromTab(btn)));

      btn.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();

        const idx = hyattTabBtns.indexOf(btn);
        if (idx < 0) return;

        const nextIdx =
          e.key === "ArrowRight"
            ? (idx + 1) % hyattTabBtns.length
            : (idx - 1 + hyattTabBtns.length) % hyattTabBtns.length;

        const nextBtn = hyattTabBtns[nextIdx];
        nextBtn.focus();
        showCategory(getCatFromTab(nextBtn));
      });
    });

    hyattSlidesAll.forEach((slide) => {
      slide.addEventListener("click", () => {
        const visible = getVisibleSlides();
        const idx = visible.indexOf(slide);
        if (idx >= 0) {
          activeIndex = idx;
          updateUI();
          scrollToActive();
        }
      });
    });

    let scrollTimer = null;
    hyattViewport.addEventListener("scroll", () => {
      if (scrollTimer) window.clearTimeout(scrollTimer);

      scrollTimer = window.setTimeout(() => {
        const visible = getVisibleSlides();
        if (!visible.length) return;

        const viewportRect = hyattViewport.getBoundingClientRect();
        const viewportCenter = viewportRect.left + viewportRect.width / 2;

        let bestIdx = 0;
        let bestDist = Infinity;

        visible.forEach((slide, idx) => {
          const r = slide.getBoundingClientRect();
          const slideCenter = r.left + r.width / 2;
          const dist = Math.abs(slideCenter - viewportCenter);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
          }
        });

        if (bestIdx !== activeIndex) {
          activeIndex = bestIdx;
          updateUI();
        }
      }, 120);
    });

    const initialTab = hyattTabBtns.find((b) => b.getAttribute("aria-selected") === "true") || hyattTabBtns[0];
    showCategory(getCatFromTab(initialTab));
  })();
})();
