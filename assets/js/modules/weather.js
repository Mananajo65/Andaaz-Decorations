```js
/* assets/js/modules/weather.js
   WeatherApp (Open-Meteo) — SPEC IMPLEMENTATION (updated to your choices)

   Your locked decisions:
   - Location: Option C (geolocation if allowed; otherwise fallback to Freehold, NJ)
   - Refresh: A (attempt refresh on every page load; cache-first, quiet)
   - Units default: Fahrenheit
   - Failure: show last cached data + “updated earlier” (STALE badge when old)

   - Discovers panels: [data-weather-panel]
   - Injects required markup hooks (data-wx-*)
   - Caches in localStorage:
       wx_unit_v1: "c" | "f"
       wx_cache_v2: { "lat,lon": data }
       wx_last_refresh_v1: { "lat,lon": epochMs }
   - Quiet refresh + cooldown (cooldown set to 0 to allow every load refresh attempt)
   - Unit toggle + forced refresh
   - Visibilitychange stale refresh
*/

import {
  lsGetObj,
  lsSetObj,
  minutesSince,
  round0,
  cToF,
  formatDateLine,
  formatHourLabel,
  dayNameShort,
  formatUpdated,
} from "./utils.js";

const LS_UNIT = "wx_unit_v1";
const LS_CACHE = "wx_cache_v2";
const LS_LAST_REFRESH = "wx_last_refresh_v1";

// You selected refresh on every page load.
// Keep cooldown at 0 so each load can attempt a quiet refresh (cache-first render still happens).
const AUTO_REFRESH_COOLDOWN_MIN = 0;

// Consider data stale after 30 minutes (shows STALE badge + visibility refresh triggers)
const STALE_MINUTES = 30;

const OM_BASE = "https://api.open-meteo.com/v1/forecast";

// Freehold, NJ fallback (Borough-ish). If you want Township instead, tell me and I’ll swap coords.
const FREEHOLD_FALLBACK = {
  lat: 40.2601,
  lon: -74.2735,
  tz: "auto",
  city: "Freehold",
  admin1: "NJ",
  displayName: "Freehold, NJ",
};

function cacheKey(place) {
  return `${Number(place.lat).toFixed(4)},${Number(place.lon).toFixed(4)}`;
}

function getUnit() {
  const v = String(localStorage.getItem(LS_UNIT) || "").toLowerCase();
  // Default to Fahrenheit unless explicitly stored as "c"
  return v === "c" ? "c" : "f";
}

function setUnit(u) {
  localStorage.setItem(LS_UNIT, u === "c" ? "c" : "f");
}

export function getCachedForecast(key) {
  const all = lsGetObj(LS_CACHE, {});
  const v = all[key];
  if (!v || typeof v !== "object") return null;
  return v;
}

export function setCachedForecast(key, data) {
  const all = lsGetObj(LS_CACHE, {});
  data.__cachedAt = new Date().toISOString();
  all[key] = data;
  lsSetObj(LS_CACHE, all);
}

function getLastRefresh(key) {
  const all = lsGetObj(LS_LAST_REFRESH, {});
  const t = all[key];
  return Number.isFinite(Number(t)) ? Number(t) : 0;
}

function setLastRefresh(key, epochMs) {
  const all = lsGetObj(LS_LAST_REFRESH, {});
  all[key] = epochMs;
  lsSetObj(LS_LAST_REFRESH, all);
}

/* =========================
   B) MARKUP INJECTION
========================= */
export function ensureWeatherMarkup(panel) {
  if (panel.__wxMarkupReady) return;
  panel.__wxMarkupReady = true;

  panel.innerHTML = `
    <div class="wx-wrap">
      <div class="wx-header">
        <div>
          <div class="wx-dateLine" data-wx-date>—</div>
          <div class="wx-locLine" data-wx-location>—</div>
        </div>
        <div class="wx-chips">
          <span class="wx-chip wx-badge" data-wx-stale hidden>STALE</span>
          <span class="wx-chip">
            <span class="wx-spin" aria-hidden="true"></span>
            <span data-wx-updated>Updated: —</span>
          </span>
        </div>
      </div>

      <div class="wx-hero" aria-label="Current conditions">
        <div>
          <div class="wx-tempBig">
            <span data-wx-temp>—</span>
            <button class="wx-unitBtn" type="button" data-wx-unitbtn aria-label="Toggle units">°F</button>
          </div>
          <div class="wx-feels" data-wx-feels>Feels like —</div>
          <div class="wx-feels" data-wx-cond>—</div>
        </div>

        <div style="text-align:right">
          <div class="wx-iconBig" data-wx-icon aria-hidden="true"></div>
        </div>
      </div>

      <div class="wx-metrics" aria-label="Weather metrics">
        <div class="wx-metric">
          <div class="wx-mLabel">Humidity</div>
          <div class="wx-mValue" data-wx-humidity>—</div>
        </div>
        <div class="wx-metric">
          <div class="wx-mLabel">Wind</div>
          <div class="wx-mValue" data-wx-wind>—</div>
        </div>
        <div class="wx-metric">
          <div class="wx-mLabel">Hi / Lo</div>
          <div class="wx-mValue" data-wx-hilo>—</div>
        </div>
      </div>

      <div class="wx-subhead">
        <div class="wx-updated">Next hours</div>
        <div class="wx-updated" aria-live="polite"></div>
      </div>

      <div class="wx-hourly" data-wx-hourly aria-label="Hourly forecast"></div>

      <div class="wx-subhead">
        <div class="wx-updated">Next days</div>
        <div class="wx-updated"></div>
      </div>

      <div class="wx-daily" data-wx-daily aria-label="Daily forecast"></div>

      <div class="wx-error" data-wx-error role="status" aria-live="polite">
        Weather unavailable right now.
      </div>
    </div>
  `;
}

/* =========================
   C) UI BINDING
========================= */
export function ui(panel) {
  return {
    date: panel.querySelector("[data-wx-date]"),
    location: panel.querySelector("[data-wx-location]"),
    temp: panel.querySelector("[data-wx-temp]"),
    unitBtn: panel.querySelector("[data-wx-unitbtn]"),
    feels: panel.querySelector("[data-wx-feels]"),
    cond: panel.querySelector("[data-wx-cond]"),
    icon: panel.querySelector("[data-wx-icon]"),
    humidity: panel.querySelector("[data-wx-humidity]"),
    wind: panel.querySelector("[data-wx-wind]"),
    hiLo: panel.querySelector("[data-wx-hilo]"),
    updated: panel.querySelector("[data-wx-updated]"),
    spin: panel.querySelector(".wx-spin"),
    stale: panel.querySelector("[data-wx-stale]"),
    hourly: panel.querySelector("[data-wx-hourly]"),
    daily: panel.querySelector("[data-wx-daily]"),
    error: panel.querySelector("[data-wx-error]"),
  };
}

/* =========================
   D) FETCH OPEN-METEO
========================= */
export async function fetchForecast({ lat, lon, tz }) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz ? String(tz) : "auto",
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code,apparent_temperature",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    forecast_days: "7",
  });

  const url = `${OM_BASE}?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return await res.json();
}

/* =========================
   ICON + LABEL MAP
========================= */
function wxLabel(code) {
  const c = Number(code);
  if ([0].includes(c)) return "Clear";
  if ([1, 2, 3].includes(c)) return "Partly cloudy";
  if ([45, 48].includes(c)) return "Fog";
  if ([51, 53, 55].includes(c)) return "Drizzle";
  if ([56, 57].includes(c)) return "Freezing drizzle";
  if ([61, 63, 65].includes(c)) return "Rain";
  if ([66, 67].includes(c)) return "Freezing rain";
  if ([71, 73, 75].includes(c)) return "Snow";
  if ([77].includes(c)) return "Snow grains";
  if ([80, 81, 82].includes(c)) return "Rain showers";
  if ([85, 86].includes(c)) return "Snow showers";
  if ([95].includes(c)) return "Thunderstorm";
  if ([96, 99].includes(c)) return "Thunderstorm (hail)";
  return "Weather";
}

function wxSvg(code) {
  const c = Number(code);

  const sun = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v2M12 19v2M4.22 4.22l1.41 1.41M18.36 18.36l1.41 1.41M3 12h2M19 12h2M4.22 19.78l1.41-1.41M18.36 5.64l1.41-1.41"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>`;

  const cloud = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.8A3.5 3.5 0 0 0 7 18z"/>
  </svg>`;

  const rain = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.8A3.5 3.5 0 0 0 7 15z"/>
    <path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3"/>
  </svg>`;

  const snow = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.8A3.5 3.5 0 0 0 7 15z"/>
    <path d="M9 18h.01M12 19h.01M15 18h.01"/>
  </svg>`;

  const fog = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 10h16M6 14h12M5 18h14"/>
    <path d="M7 9h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.8"/>
  </svg>`;

  const storm = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.8A3.5 3.5 0 0 0 7 14z"/>
    <path d="M13 14l-2 4h3l-2 4"/>
  </svg>`;

  if (c === 0) return sun;
  if ([1, 2, 3].includes(c)) return cloud;
  if ([45, 48].includes(c)) return fog;
  if ([51, 53, 55, 56, 57].includes(c)) return rain;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return rain;
  if ([71, 73, 75, 77, 85, 86].includes(c)) return snow;
  if ([95, 96, 99].includes(c)) return storm;
  return cloud;
}

/* =========================
   E+F) RENDER (CORE)
========================= */
export function render(panel, data, place, unit) {
  const $ = panel.__wx || ui(panel);
  panel.__wx = $;

  // Reset error display (cache render should still be "clean")
  panel.setAttribute("data-wx-error", "false");

  const currentTime = data?.current?.time;
  $.date.textContent = formatDateLine(currentTime);

  $.location.textContent = place.displayName || "Local area";

  const cTemp = Number(data?.current?.temperature_2m);
  const shownTemp = unit === "f" ? cToF(cTemp) : cTemp;
  $.temp.textContent = `${round0(shownTemp)}°`;

  $.unitBtn.textContent = unit === "f" ? "°F" : "°C";

  const feelsC = Number(data?.hourly?.apparent_temperature?.[0]);
  const feelsShown = unit === "f" ? cToF(feelsC) : feelsC;
  $.feels.textContent = `Feels like ${round0(feelsShown)}°`;

  const code = Number(data?.current?.weather_code);
  $.cond.textContent = wxLabel(code);
  $.icon.innerHTML = wxSvg(code);

  const hum = Number(data?.current?.relative_humidity_2m);
  $.humidity.textContent = Number.isFinite(hum) ? `${round0(hum)}%` : "—";

  // Spec: wind_speed_10m * 3.6 to km/h
  const windMs = Number(data?.current?.wind_speed_10m);
  const windKmh = Number.isFinite(windMs) ? windMs * 3.6 : NaN;
  $.wind.textContent = Number.isFinite(windKmh) ? `${round0(windKmh)} km/h` : "—";

  const hiC = Number(data?.daily?.temperature_2m_max?.[0]);
  const loC = Number(data?.daily?.temperature_2m_min?.[0]);
  const hiShown = unit === "f" ? cToF(hiC) : hiC;
  const loShown = unit === "f" ? cToF(loC) : loC;
  $.hiLo.textContent =
    Number.isFinite(hiShown) && Number.isFinite(loShown)
      ? `${round0(hiShown)}° / ${round0(loShown)}°`
      : "—";

  const hTimes = data?.hourly?.time || [];
  const hTempsC = data?.hourly?.temperature_2m || [];
  const hCodes = data?.hourly?.weather_code || [];

  const hourCount = Math.min(12, hTimes.length, hTempsC.length, hCodes.length);
  $.hourly.innerHTML = "";
  for (let i = 0; i < hourCount; i++) {
    const t = hTimes[i];
    const tc = Number(hTempsC[i]);
    const th = unit === "f" ? cToF(tc) : tc;
    const hc = Number(hCodes[i]);

    const el = document.createElement("div");
    el.className = "wx-hour";
    el.innerHTML = `
      <div class="wx-hourTime">${formatHourLabel(t)}</div>
      <div class="wx-hourIcon" aria-hidden="true">${wxSvg(hc)}</div>
      <div class="wx-hourTemp">${round0(th)}°</div>
    `;
    $.hourly.appendChild(el);
  }

  const dTimes = data?.daily?.time || [];
  const dMaxC = data?.daily?.temperature_2m_max || [];
  const dMinC = data?.daily?.temperature_2m_min || [];
  const dCodes = data?.daily?.weather_code || [];

  $.daily.innerHTML = "";
  const start = 1;
  const end = Math.min(start + 5, dTimes.length, dMaxC.length, dMinC.length, dCodes.length);

  for (let i = start; i < end; i++) {
    const dt = dTimes[i];
    const maxShown = unit === "f" ? cToF(Number(dMaxC[i])) : Number(dMaxC[i]);
    const minShown = unit === "f" ? cToF(Number(dMinC[i])) : Number(dMinC[i]);
    const dc = Number(dCodes[i]);

    const row = document.createElement("div");
    row.className = "wx-dayRow";
    row.innerHTML = `
      <div class="wx-day">${dayNameShort(dt)}</div>
      <div class="wx-desc">${wxLabel(dc)}</div>
      <div class="wx-lo">${round0(minShown)}°</div>
      <div class="wx-hi">${round0(maxShown)}°</div>
    `;
    $.daily.appendChild(row);
  }

  const cachedAt = data.__cachedAt || new Date().toISOString();
  $.updated.textContent = formatUpdated(cachedAt);

  const stale = minutesSince(cachedAt) >= STALE_MINUTES;
  $.stale.hidden = !stale;
}

/* =========================
   G) QUIET REFRESH WORKFLOW
========================= */
export async function refresh(panel, place, { force = false } = {}) {
  const key = cacheKey(place);

  // If offline, don't even try.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const last = getLastRefresh(key);
  const now = Date.now();
  const sinceMin = (now - last) / 60000;

  if (!force && last && sinceMin < AUTO_REFRESH_COOLDOWN_MIN) return;

  panel.setAttribute("data-wx-spin", "true");

  try {
    const data = await fetchForecast(place);
    setCachedForecast(key, data);
    setLastRefresh(key, Date.now());

    render(panel, data, place, getUnit());
    panel.setAttribute("data-wx-spin", "false");
  } catch {
    panel.setAttribute("data-wx-spin", "false");

    const cached = getCachedForecast(key);
    if (cached) {
      // Your choice: keep cached UI (including "updated earlier"/STALE)
      render(panel, cached, place, getUnit());
      return;
    }

    panel.setAttribute("data-wx-error", "true");
  }
}

/* =========================
   LOCATION RESOLUTION (Option C)
========================= */
async function getGeoPlaceFallback() {
  // Try geolocation; on deny/timeout/error -> Freehold, NJ
  if (!("geolocation" in navigator)) return { ...FREEHOLD_FALLBACK };

  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000,
      });
    });

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    return {
      lat,
      lon,
      tz: "auto",
      city: "Local area",
      admin1: "",
      displayName: "Local area",
    };
  } catch {
    return { ...FREEHOLD_FALLBACK };
  }
}

async function initPanel(panel) {
  const latAttr = panel.getAttribute("data-weather-lat");
  const lonAttr = panel.getAttribute("data-weather-lon");

  const hasCoords =
    latAttr !== null &&
    lonAttr !== null &&
    Number.isFinite(Number(latAttr)) &&
    Number.isFinite(Number(lonAttr));

  // If panel is configured with explicit coords, use them.
  // Otherwise: Option C (geo -> fallback to Freehold, NJ)
  if (!hasCoords) {
    const geo = await getGeoPlaceFallback();
    panel.__wxPlace = geo;
    return geo;
  }

  const city = panel.getAttribute("data-weather-city") || "Local area";
  const admin1 = panel.getAttribute("data-weather-admin1") || "";
  const tz = panel.getAttribute("data-weather-tz") || "auto";
  const displayName = admin1 ? `${city}, ${admin1}` : city;

  const place = {
    lat: Number(latAttr),
    lon: Number(lonAttr),
    tz,
    city,
    admin1,
    displayName,
  };

  panel.__wxPlace = place;
  return place;
}

/* =========================
   A) BOOT + DISCOVERY
========================= */
export function initWeather() {
  const panels = Array.from(document.querySelectorAll("[data-weather-panel]"));
  if (!panels.length) return;

  panels.forEach(async (panel) => {
    ensureWeatherMarkup(panel);
    panel.__wx = ui(panel);

    const place = await initPanel(panel);
    const key = cacheKey(place);

    // Cache-first render for instant UI
    const cached = getCachedForecast(key);
    if (cached) render(panel, cached, place, getUnit());

    // Quiet refresh on every page load (your choice), unless offline
    refresh(panel, place, { force: false }).catch(() => {});

    // Unit toggle
    panel.__wx.unitBtn.addEventListener("click", () => {
      const next = getUnit() === "f" ? "c" : "f";
      setUnit(next);

      const cachedAgain = getCachedForecast(key);
      if (cachedAgain) render(panel, cachedAgain, place, next);

      refresh(panel, place, { force: true }).catch(() => {});
    });
  });

  // Refresh when tab returns if cached is stale
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;

    panels.forEach((panel) => {
      const place = panel.__wxPlace;
      if (!place) return;

      const key = cacheKey(place);
      const cached = getCachedForecast(key);
      if (!cached) return;

      const stale = minutesSince(cached.__cachedAt) >= STALE_MINUTES;
      if (stale) refresh(panel, place, { force: false }).catch(() => {});
    });
  });
}
```
