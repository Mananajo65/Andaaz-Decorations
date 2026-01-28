/* assets/js/modules/weather.js
   WeatherApp (Open-Meteo) — SELF-CONTAINED REFACTOR
   
   Features:
   - Pure JS injection (all UI comes from JS)
   - CSS scoped to [data-weather-panel] with matching class names
   - Theme + night attributes for Apple-like styling
   - Open-Meteo forecast data source
   - Offline caching with stale indicator
   - Quiet refresh (cooldown + TTL)
   - Persistent unit toggle (°C/°F)
   - Tab refocus stale-aware refresh
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

const AUTO_REFRESH_COOLDOWN_MIN = 15;
const STALE_MINUTES = 30;

const OM_BASE = "https://api.open-meteo.com/v1/forecast";

function cacheKey(place) {
  return `${Number(place.lat).toFixed(4)},${Number(place.lon).toFixed(4)}`;
}

function getUnit() {
  const v = String(localStorage.getItem(LS_UNIT) || "").toLowerCase();
  return v === "f" ? "f" : "c";
}

function setUnit(u) {
  localStorage.setItem(LS_UNIT, u === "f" ? "f" : "c");
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
   THEME MAPPING (Open-Meteo codes → CSS theme)
========================= */
function getTheme(code) {
  const c = Number(code);
  // clear
  if ([0].includes(c)) return "clear";
  // partly cloudy
  if ([1, 2, 3].includes(c)) return "partly";
  // overcast
  if ([45, 48].includes(c)) return "overcast";
  // rain / drizzle
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "rain";
  // storm
  if ([95, 96, 99].includes(c)) return "storm";
  // snow
  if ([71, 73, 75, 77, 85, 86].includes(c)) return "snow";
  return "clear";
}

function isNight(currentTime, sunriseStr, sunsetStr) {
  // Simple comparison: if currentTime hour is before sunrise hour or after sunset hour
  // For now, use a heuristic: if hour between 18:00 and 06:00 (approx)
  if (!currentTime) return false;
  const hourStr = currentTime.split("T")[1];
  if (!hourStr) return false;
  const hour = parseInt(hourStr.split(":")[0], 10);
  return hour >= 20 || hour < 6;
}

/* =========================
   B) MARKUP INJECTION (CSS-aligned)
========================= */
export function ensureWeatherMarkup(panel) {
  if (panel.__wxMarkupReady) return;
  panel.__wxMarkupReady = true;

  // All classes MUST match weather.css selector names (kebab-case)
  panel.innerHTML = `
    <div class="wx-shell">
      <div class="wx-live">
        <div class="wx-live-base"></div>
        <div class="wx-live-glow"></div>
        <div class="wx-live-noise"></div>
      </div>

      <div class="wx-head" data-wx-head>
        <div>
          <div class="wx-date" data-wx-date>—</div>
          <div class="wx-loc" data-wx-location>—</div>
        </div>
        <div class="wx-head-right">
          <span class="wx-chip" data-wx-stale hidden>STALE</span>
          <span class="wx-chip">
            <span class="wx-spin" aria-hidden="true"></span>
            <span data-wx-updated>Updated: —</span>
          </span>
        </div>
      </div>

      <div class="wx-hero" aria-label="Current conditions">
        <div>
          <div class="wx-temp-row">
            <div class="wx-temp" data-wx-temp>—</div>
            <button class="wx-unit" type="button" data-wx-unitbtn aria-label="Toggle units">°C</button>
          </div>
          <div class="wx-feels" data-wx-feels>Feels like —</div>
          <div class="wx-cond" data-wx-cond>—</div>
        </div>
        <div class="wx-hero-right">
          <div class="wx-icon" data-wx-icon aria-hidden="true"></div>
        </div>
      </div>

      <div class="wx-metrics" aria-label="Weather metrics">
        <div class="wx-metric">
          <div class="wx-metric-val" data-wx-humidity>—</div>
          <div class="wx-metric-lbl">Humidity</div>
        </div>
        <div class="wx-metric">
          <div class="wx-metric-val" data-wx-wind>—</div>
          <div class="wx-metric-lbl">Wind</div>
        </div>
        <div class="wx-metric">
          <div class="wx-metric-val" data-wx-hilo>—</div>
          <div class="wx-metric-lbl">Hi / Lo</div>
        </div>
      </div>

      <div class="wx-subhead">
        <div class="wx-updated">Next hours</div>
      </div>

      <div class="wx-hourly-wrap">
        <div class="wx-hourly" data-wx-hourly aria-label="Hourly forecast"></div>
      </div>

      <div class="wx-subhead">
        <div class="wx-updated">Next days</div>
      </div>

      <div class="wx-stack">
        <div class="wx-daily" data-wx-daily aria-label="Daily forecast"></div>
      </div>

      <div class="wx-error" data-wx-error role="status" aria-live="polite" hidden>
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
    head: panel.querySelector("[data-wx-head]"),
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
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,weather_code,apparent_temperature",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    forecast_days: "7",
  });

  const url = `${OM_BASE}?${params.toString()}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();
  return data;
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
   E) RENDER (CORE) + THEME SETTING
========================= */
export function render(panel, data, place, unit) {
  const $ = panel.__wx || ui(panel);
  panel.__wx = $;

  // Reset error display
  panel.setAttribute("data-wx-error", "false");

  // 1) Set theme + night attributes
  const code = Number(data?.current?.weather_code);
  const theme = getTheme(code);
  const isDay = data?.current?.is_day;
  const night = isDay !== undefined ? !isDay : isNight(data?.current?.time);
  
  panel.setAttribute("data-weather-theme", theme);
  panel.setAttribute("data-weather-night", night ? "true" : "false");

  // 2) Date line
  const currentTime = data?.current?.time;
  $.date.textContent = formatDateLine(currentTime);

  // 3) Location
  $.location.textContent = place.displayName || "Local area";

  // 4) Current temp in unit
  const cTemp = Number(data?.current?.temperature_2m);
  const shownTemp = unit === "f" ? cToF(cTemp) : cTemp;
  $.temp.textContent = `${round0(shownTemp)}°`;

  // 5) Unit button label
  $.unitBtn.textContent = unit === "f" ? "°F" : "°C";

  // 6) Feels like
  const feelsC = Number(data?.hourly?.apparent_temperature?.[0]);
  const feelsShown = unit === "f" ? cToF(feelsC) : feelsC;
  $.feels.textContent = `Feels like ${round0(feelsShown)}°`;

  // 7) Condition label + icon
  $.cond.textContent = wxLabel(code);
  $.icon.innerHTML = wxSvg(code);

  // 8) Metrics
  const hum = Number(data?.current?.relative_humidity_2m);
  $.humidity.textContent = Number.isFinite(hum) ? `${round0(hum)}%` : "—";

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

  // 9) Hourly strip (first 12 hours)
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
      <div class="wx-hour-time">${formatHourLabel(t)}</div>
      <div class="wx-hour-ico" aria-hidden="true">${wxSvg(hc)}</div>
      <div class="wx-hour-temp">${round0(th)}°</div>
    `;
    $.hourly.appendChild(el);
  }

  // 10) Daily list (next 5 days, skip today)
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
    row.className = "wx-event";
    row.innerHTML = `
      <div class="wx-event-left">
        <div class="wx-event-title">${dayNameShort(dt)}</div>
        <div class="wx-event-sub">${wxLabel(dc)}</div>
      </div>
      <div class="wx-event-right">
        <div class="wx-event-hi">${round0(maxShown)}° / ${round0(minShown)}°</div>
      </div>
    `;
    $.daily.appendChild(row);
  }

  // 11) Updated timestamp
  const cachedAt = data.__cachedAt || new Date().toISOString();
  $.updated.textContent = formatUpdated(cachedAt);

  // 12) Stale badge
  const stale = minutesSince(cachedAt) >= STALE_MINUTES;
  $.stale.hidden = !stale;
}

/* =========================
   F) QUIET REFRESH WORKFLOW
========================= */
export async function refresh(panel, place, { force = false } = {}) {
  const key = cacheKey(place);

  // Cooldown check
  const last = getLastRefresh(key);
  const now = Date.now();
  const sinceMin = (now - last) / 60000;

  if (!force && last && sinceMin < AUTO_REFRESH_COOLDOWN_MIN) return;

  // Show spinner
  const spinner = panel.querySelector(".wx-spin");
  if (spinner) spinner.style.display = "inline-block";

  try {
    const data = await fetchForecast(place);
    setCachedForecast(key, data);
    setLastRefresh(key, Date.now());

    render(panel, data, place, getUnit());

    // Hide spinner
    if (spinner) spinner.style.display = "none";
  } catch (err) {
    if (spinner) spinner.style.display = "none";

    // Try cached data on error
    const cached = getCachedForecast(key);
    if (cached) {
      render(panel, cached, place, getUnit());
      return;
    }

    // No cache: show error
    const errorEl = panel.querySelector("[data-wx-error]");
    if (errorEl) {
      errorEl.hidden = false;
    }
  }
}

/* =========================
   G) LOCATION: GEOLOCATION + FALLBACK
========================= */
async function getGeoPlaceFallback() {
  // Fallback: Freehold, NJ (consistent default for business area)
  const fallback = {
    lat: 40.2314,
    lon: -74.2781,
    tz: "auto",
    city: "Freehold",
    admin1: "NJ",
    displayName: "Freehold, NJ",
  };

  if (!("geolocation" in navigator)) return fallback;

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
    return fallback;
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
   H) BOOT + DISCOVERY + EVENT LISTENERS
========================= */
export function initWeather() {
  const panels = Array.from(document.querySelectorAll("[data-weather-panel]"));
  if (!panels.length) return;

  panels.forEach(async (panel) => {
    // 1) Inject markup
    ensureWeatherMarkup(panel);

    // 2) Bind UI refs
    panel.__wx = ui(panel);

    // 3) Resolve place (geolocation or fallback)
    const place = await initPanel(panel);

    // 4) Render cached data if available
    const key = cacheKey(place);
    const cached = getCachedForecast(key);
    if (cached) render(panel, cached, place, getUnit());

    // 5) Quiet refresh (respects cooldown)
    refresh(panel, place, { force: false }).catch(() => {});

    // 6) Unit toggle listener
    panel.__wx.unitBtn.addEventListener("click", () => {
      const next = getUnit() === "f" ? "c" : "f";
      setUnit(next);

      const cachedAgain = getCachedForecast(key);
      if (cachedAgain) render(panel, cachedAgain, place, next);

      refresh(panel, place, { force: true }).catch(() => {});
    });
  });

  // 7) Refresh on tab refocus (if data is stale)
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