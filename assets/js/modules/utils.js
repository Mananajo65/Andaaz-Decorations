/* assets/js/modules/utils.js
   Shared utilities (used by modules/weather.js)
*/

export function safeJsonParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(obj, fallback = "{}") {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
}

export function lsGetObj(key, fallback = {}) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = safeJsonParse(raw, null);
  if (!parsed || typeof parsed !== "object") return fallback;
  return parsed;
}

export function lsSetObj(key, obj) {
  localStorage.setItem(key, safeJsonStringify(obj));
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

export function round0(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x);
}

export function cToF(c) {
  const x = Number(c);
  if (!Number.isFinite(x)) return 0;
  return (x * 9) / 5 + 32;
}

export function minutesSince(isoString) {
  if (!isoString) return Infinity;
  const t = new Date(isoString).getTime();
  if (!Number.isFinite(t)) return Infinity;
  const diffMs = Date.now() - t;
  return diffMs / 60000;
}

export function formatUpdated(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "Updated: —";
  // Compact, locale-friendly
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `Updated: ${time}`;
}

export function formatDateLine(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  // Example: Tue, Jan 27
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatHourLabel(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  // Example: 3 PM
  return d.toLocaleTimeString([], { hour: "numeric" });
}

export function dayNameShort(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  // Example: Wed
  return d.toLocaleDateString([], { weekday: "short" });
}
