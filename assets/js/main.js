/* assets/js/main.js
   Robust ES Module boot/orchestrator
   - Attempts multiple import paths (modules/ or same folder)
   - Fault isolation: missing module won't kill the rest
*/

async function importFirst(paths) {
  for (const p of paths) {
    try {
      return await import(p);
    } catch (_) {
      // keep trying
    }
  }
  return null;
}

function safeCall(name, fn) {
  try {
    if (typeof fn === "function") fn();
  } catch (err) {
    console.warn(`[boot] ${name} failed:`, err);
  }
}

async function boot() {
  // Try both structures:
  // 1) assets/js/modules/*.js
  // 2) assets/js/*.js
  const navMod = await importFirst(["./modules/nav.js", "./nav.js"]);
  const galMod = await importFirst(["./modules/gallery.js", "./gallery.js"]);
  const inqMod = await importFirst(["./modules/inquiry.js", "./inquiry.js"]);
  const wxMod  = await importFirst(["./modules/weather.js", "./weather.js"]);

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
