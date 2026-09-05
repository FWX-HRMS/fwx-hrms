/* ============================================================
   Year-First Date Picker
   ------------------------------------------------------------
   Drop this script into any page (after css/style.css is
   loaded) and it automatically finds every <input type="date">
   on the page — including ones added later by JavaScript, like
   modal forms and wizard steps — and turns it into a picker
   that opens in this order: Year grid -> Month grid -> Day grid.

   No other code changes are needed anywhere: the enhanced input
   still has the same id/name and still holds a plain "YYYY-MM-DD"
   string in .value, and still fires real "input"/"change" events,
   so any existing code that reads or listens to these fields
   keeps working exactly as before.
   ============================================================ */
(function () {
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const WEEKDAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  let popupEl = null;
  let activeInput = null;
  let viewYear = null;
  let viewMonth = null; // 0-11
  let decadeStart = null;

  function injectStyles() {
    if (document.getElementById("yfdp-styles")) return;
    const style = document.createElement("style");
    style.id = "yfdp-styles";
    style.textContent = `
      input.yfdp-input { cursor: pointer; background: #fff; }
      .yfdp-popup {
        position: absolute;
        z-index: 10002;
        background: #fff;
        border: 1px solid var(--border, #d8dde3);
        border-radius: var(--radius, 8px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        padding: 12px;
        width: 280px;
        font-size: 13.5px;
        display: none;
      }
      .yfdp-popup.open { display: block; }
      .yfdp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
        font-weight: 600;
      }
      .yfdp-nav-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 2px 8px;
        border-radius: 6px;
        color: var(--ink, #1c2530);
      }
      .yfdp-nav-btn:hover { background: #f0f2f5; }
      .yfdp-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
      }
      .yfdp-grid.yfdp-days { grid-template-columns: repeat(7, 1fr); gap: 2px; }
      .yfdp-cell {
        text-align: center;
        padding: 8px 0;
        border-radius: 6px;
        cursor: pointer;
        background: #f7f8fa;
      }
      .yfdp-grid.yfdp-days .yfdp-cell { padding: 6px 0; }
      .yfdp-cell:hover { background: var(--accent, #2f7d5f); color: #fff; }
      .yfdp-cell.yfdp-muted { color: #b7bec7; background: none; cursor: default; }
      .yfdp-cell.yfdp-muted:hover { background: none; color: #b7bec7; }
      .yfdp-cell.yfdp-selected { background: var(--accent, #2f7d5f); color: #fff; font-weight: 700; }
      .yfdp-weekday-label { text-align: center; font-size: 11px; color: var(--ink-soft, #6b7684); padding-bottom: 4px; }
    `;
    document.head.appendChild(style);
  }

  function ensurePopup() {
    if (popupEl) return popupEl;
    popupEl = document.createElement("div");
    popupEl.className = "yfdp-popup";
    document.body.appendChild(popupEl);
    document.addEventListener("mousedown", (e) => {
      if (popupEl.classList.contains("open") && !popupEl.contains(e.target) && e.target !== activeInput) {
        closePopup();
      }
    });
    window.addEventListener("resize", () => { if (popupEl.classList.contains("open")) positionPopup(); });
    return popupEl;
  }

  function positionPopup() {
    const rect = activeInput.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 4;
    let left = rect.left + window.scrollX;
    const popupWidth = 280;
    if (left + popupWidth > window.scrollX + document.documentElement.clientWidth - 8) {
      left = window.scrollX + document.documentElement.clientWidth - popupWidth - 8;
    }
    popupEl.style.top = `${top}px`;
    popupEl.style.left = `${left}px`;
  }

  function parseValue(input) {
    const v = input.value;
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-").map(Number);
      return { y, m: m - 1, d };
    }
    return null;
  }

  function openPopup(input) {
    activeInput = input;
    ensurePopup();
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    decadeStart = Math.floor(viewYear / 12) * 12;
    // Always starts at year view, regardless of any existing value.
    renderYearView();
    popupEl.classList.add("open");
    positionPopup();
  }

  function closePopup() {
    if (popupEl) popupEl.classList.remove("open");
    activeInput = null;
  }

  function setValueAndClose(y, m, d) {
    const iso = `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const input = activeInput;
    input.value = iso;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    closePopup();
  }

  function renderYearView() {
    const existing = parseValue(activeInput);
    const years = [];
    for (let i = 0; i < 12; i++) years.push(decadeStart + i);

    popupEl.innerHTML = `
      <div class="yfdp-header">
        <button type="button" class="yfdp-nav-btn" data-yfdp-prev-decade>‹</button>
        <span>${years[0]} – ${years[years.length - 1]}</span>
        <button type="button" class="yfdp-nav-btn" data-yfdp-next-decade>›</button>
      </div>
      <div class="yfdp-grid">
        ${years.map(y => `<div class="yfdp-cell ${existing && existing.y === y ? "yfdp-selected" : ""}" data-yfdp-year="${y}">${y}</div>`).join("")}
      </div>
    `;
    popupEl.querySelector("[data-yfdp-prev-decade]").addEventListener("click", () => { decadeStart -= 12; renderYearView(); });
    popupEl.querySelector("[data-yfdp-next-decade]").addEventListener("click", () => { decadeStart += 12; renderYearView(); });
    popupEl.querySelectorAll("[data-yfdp-year]").forEach(cell => {
      cell.addEventListener("click", () => {
        viewYear = Number(cell.dataset.yfdpYear);
        renderMonthView();
      });
    });
  }

  function renderMonthView() {
    const existing = parseValue(activeInput);
    popupEl.innerHTML = `
      <div class="yfdp-header">
        <button type="button" class="yfdp-nav-btn" data-yfdp-back-year>‹ ${viewYear}</button>
        <span></span>
        <span></span>
      </div>
      <div class="yfdp-grid">
        ${MONTH_NAMES.map((name, i) => `<div class="yfdp-cell ${existing && existing.y === viewYear && existing.m === i ? "yfdp-selected" : ""}" data-yfdp-month="${i}">${name.slice(0, 3)}</div>`).join("")}
      </div>
    `;
    popupEl.querySelector("[data-yfdp-back-year]").addEventListener("click", () => {
      decadeStart = Math.floor(viewYear / 12) * 12;
      renderYearView();
    });
    popupEl.querySelectorAll("[data-yfdp-month]").forEach(cell => {
      cell.addEventListener("click", () => {
        viewMonth = Number(cell.dataset.yfdpMonth);
        renderDayView();
      });
    });
  }

  function renderDayView() {
    const existing = parseValue(activeInput);
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push(`<div class="yfdp-cell yfdp-muted">${daysInPrevMonth - startWeekday + i + 1}</div>`);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = existing && existing.y === viewYear && existing.m === viewMonth && existing.d === d;
      cells.push(`<div class="yfdp-cell ${isSelected ? "yfdp-selected" : ""}" data-yfdp-day="${d}">${d}</div>`);
    }
    const remainder = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remainder; i++) {
      cells.push(`<div class="yfdp-cell yfdp-muted">${i}</div>`);
    }

    popupEl.innerHTML = `
      <div class="yfdp-header">
        <button type="button" class="yfdp-nav-btn" data-yfdp-back-month>‹ ${MONTH_NAMES[viewMonth]} ${viewYear}</button>
        <span></span>
        <span></span>
      </div>
      <div class="yfdp-grid yfdp-days">
        ${WEEKDAY_NAMES.map(w => `<div class="yfdp-weekday-label">${w}</div>`).join("")}
        ${cells.join("")}
      </div>
    `;
    popupEl.querySelector("[data-yfdp-back-month]").addEventListener("click", renderMonthView);
    popupEl.querySelectorAll("[data-yfdp-day]").forEach(cell => {
      cell.addEventListener("click", () => setValueAndClose(viewYear, viewMonth, Number(cell.dataset.yfdpDay)));
    });
  }

  function enhance(input) {
    if (input.dataset.yfdpEnhanced) return;
    input.dataset.yfdpEnhanced = "1";
    input.type = "text";
    input.classList.add("yfdp-input");
    input.readOnly = true;
    if (!input.placeholder) input.placeholder = "yyyy-mm-dd";
    input.addEventListener("click", () => openPopup(input));
    input.addEventListener("focus", () => openPopup(input));
  }

  function scan(root) {
    injectStyles();
    (root || document).querySelectorAll('input[type="date"]').forEach(enhance);
  }

  document.addEventListener("DOMContentLoaded", () => scan(document));

  // Catches date inputs created later by JS (modals, wizard steps, etc.)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('input[type="date"]')) enhance(node);
        if (node.querySelectorAll) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
