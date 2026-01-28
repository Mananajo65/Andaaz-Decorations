/* assets/js/main.js
   Deterministic ES Module boot/orchestrator (modules-only)

   Why:
   - Your repo uses: assets/js/modules/*
   - Removing fallback paths eliminates 404 noise and ambiguity
   - Fault isolation remains: one module failing won't kill the rest
*/

function safeCall(name, fn) {
  try {
    if (typeof fn === "function") fn();
  } catch (err) {
    console.warn(`[boot] ${name} failed:`, err);
  }
}

async function boot() {
  // Modules-only: keep structure deterministic
  const results = await Promise.allSettled([
    import("./modules/nav.js"),
    import("./modules/gallery.js"),
    import("./modules/inquiry.js"),
    import("./modules/weather.js"),
  ]);

  const [navRes, galRes, inqRes, wxRes] = results;

  const navMod = navRes.status === "fulfilled" ? navRes.value : null;
  const galMod = galRes.status === "fulfilled" ? galRes.value : null;
  const inqMod = inqRes.status === "fulfilled" ? inqRes.value : null;
  const wxMod  = wxRes.status === "fulfilled" ? wxRes.value : null;

  // Optional visibility into failures without breaking the page
  if (navRes.status === "rejected") console.warn("[boot] nav import failed:", navRes.reason);
  if (galRes.status === "rejected") console.warn("[boot] gallery import failed:", galRes.reason);
  if (inqRes.status === "rejected") console.warn("[boot] inquiry import failed:", inqRes.reason);
  if (wxRes.status === "rejected") console.warn("[boot] weather import failed:", wxRes.reason);

  safeCall("nav", navMod?.initNav);
  safeCall("gallery", galMod?.initGallery);
  safeCall("inquiry", inqMod?.initInquiry);
  safeCall("weather", wxMod?.initWeather);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
