```js
/* assets/js/modules/inquiry.js
   Inquiry helpers for contact.html

   Schedule Builder:
   - Multi-date rows (date + start + duration + optional label)
   - Min date = tomorrow (no past/today)
   - Builds a hidden summary string for form submission/email
   - Page-safe: does nothing if the builder wrapper isn't present

   Required HTML hooks:
   - [data-schedule-builder] wrapper
   - [data-sch-list] list container
   - [data-sch-add] add button
   - [data-sch-out] hidden textarea output
*/

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function pad2(n) {
  return String(n).padStart(2, "0");
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeTrim(v) {
  return String(v ?? "").trim();
}

function formatRow(row) {
  const date = safeTrim($("[data-sch-date]", row)?.value);
  const time = safeTrim($("[data-sch-time]", row)?.value);
  const dur = safeTrim($("[data-sch-dur]", row)?.value);
  const label = safeTrim($("[data-sch-label]", row)?.value);

  if (!date && !time && !dur && !label) return "";

  const bits = [];
  if (label) bits.push(label);
  if (date) bits.push(date);
  if (time) bits.push(time);
  if (dur) bits.push(`${dur}h`);
  return bits.join(" • ");
}

function buildScheduleSummary(root) {
  const rows = $$("[data-sch-row]", root);
  const lines = rows
    .map(formatRow)
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`);
  return lines.length ? lines.join("\n") : "";
}

function setMinDates(root) {
  const min = tomorrowISO();
  $$('input[type="date"][data-sch-date]', root).forEach((inp) => {
    inp.setAttribute("min", min);
  });
}

function newRowHTML(minDate) {
  return `
    <div class="sch-row" data-sch-row>
      <div class="grid-4">
        <label class="field">
          <span class="label">Date</span>
          <input type="date" data-sch-date min="${minDate}">
        </label>

        <label class="field">
          <span class="label">Start</span>
          <input type="time" data-sch-time>
        </label>

        <label class="field">
          <span class="label">Duration (hrs)</span>
          <input type="number" inputmode="decimal" min="0.5" step="0.5" placeholder="4" data-sch-dur>
        </label>

        <label class="field">
          <span class="label">Label (optional)</span>
          <input type="text" placeholder="Mehndi / Setup" data-sch-label>
        </label>
      </div>

      <div class="sch-row-actions">
        <button type="button" class="btn small ghost" data-sch-remove aria-label="Remove date">
          Remove
        </button>
      </div>
    </div>
  `;
}

function wireSchedule(root) {
  const addBtn = $("[data-sch-add]", root);
  const list = $("[data-sch-list]", root);
  const out = $("[data-sch-out]", root);

  // Guard: don't run if the page doesn't have the required builder nodes
  if (!addBtn || !list || !out) return;

  const min = tomorrowISO();

  const ensureOneRow = () => {
    if (!list.querySelector("[data-sch-row]")) {
      list.insertAdjacentHTML("beforeend", newRowHTML(min));
    }
  };

  const sync = () => {
    out.value = buildScheduleSummary(root);
  };

  // Initial render
  ensureOneRow();
  setMinDates(root);
  sync();

  // Input → sync (delegated)
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.matches("[data-sch-date],[data-sch-time],[data-sch-dur],[data-sch-label]")) {
      sync();
    }
  });

  // Add row
  addBtn.addEventListener("click", () => {
    list.insertAdjacentHTML("beforeend", newRowHTML(min));
    setMinDates(root);
    sync();
  });

  // Remove row (delegated) — always keep at least one row
  root.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-sch-remove]");
    if (!btn) return;

    const row = btn.closest("[data-sch-row]");
    if (!row) return;

    const rows = $$("[data-sch-row]", list);
    if (rows.length <= 1) {
      // Clear values if it's the last row
      $$("input", row).forEach((i) => (i.value = ""));
    } else {
      row.remove();
    }

    setMinDates(root);
    sync();
  });
}

export function initInquiry() {
  // Only run on pages that contain the schedule builder wrapper
  const root = $("[data-schedule-builder]");
  if (!root) return;

  wireSchedule(root);
}
```
