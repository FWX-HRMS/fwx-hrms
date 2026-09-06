// Candidate Sourcing panel — X-ray search for public candidate profiles.
//
// IMPORTANT — what this does and doesn't do:
//   - It searches PUBLIC web pages only (via a Google Custom Search API call
//     made server-side in the "search_candidates" Edge Function action).
//   - It does NOT scrape LinkedIn/Bayt/Indeed, does NOT log in as anyone,
//     and does NOT extract full CVs — only the public title/snippet/link
//     that already appears in ordinary search results.
//   - Treat every result as a LEAD to manually review, not a verified
//     candidate. Get consent before contacting someone found this way, and
//     don't store more personal data than you need for screening.
//
// SETUP: this file is self-contained. Just add one line to admin.html:
//   <script src="candidate-sourcing.js"></script>
// It injects its own floating button, modal, and styles — no other markup
// changes needed. It calls the "search_candidates" action on clever-action,
// which must be added server-side first (see
// edge-function-search_candidates-snippet.ts).

(function () {
  const SOURCES = [
    { key: "linkedin", label: "LinkedIn" },
    { key: "bayt", label: "Bayt" },
    { key: "indeed", label: "Indeed" },
    { key: "akhtaboot", label: "Akhtaboot" },
  ];

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .fwx-cs-fab {
        position: fixed; bottom: 24px; inset-inline-end: 24px; z-index: 9500;
        background: #1b2430; color: #fff; border: none; border-radius: 999px;
        padding: 12px 18px; font-size: 14px; font-weight: 600; cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 8px;
      }
      .fwx-cs-fab:hover { background: #2a3648; }
      .fwx-cs-overlay {
        display: none; position: fixed; inset: 0; background: rgba(20,24,30,0.55);
        z-index: 10000; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto;
      }
      .fwx-cs-overlay.open { display: flex; }
      .fwx-cs-modal {
        background: #fff; border-radius: 12px; width: 100%; max-width: 720px;
        padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      }
      .fwx-cs-modal h2 { margin: 0 0 4px; font-size: 20px; color: #1b2430; }
      .fwx-cs-note {
        font-size: 12.5px; color: #5a6472; background: #f4f6f8; border-radius: 8px;
        padding: 10px 12px; margin: 10px 0 18px; line-height: 1.5;
      }
      .fwx-cs-field { margin-bottom: 12px; }
      .fwx-cs-field label { display: block; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 4px; }
      .fwx-cs-field input[type="text"] {
        width: 100%; box-sizing: border-box; padding: 9px 11px; border: 1px solid #d7dbe0;
        border-radius: 8px; font-size: 14px;
      }
      .fwx-cs-sources { display: flex; flex-wrap: wrap; gap: 12px; }
      .fwx-cs-sources label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #333; }
      .fwx-cs-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
      .fwx-cs-btn {
        border: none; border-radius: 8px; padding: 9px 16px; font-size: 14px; font-weight: 600; cursor: pointer;
      }
      .fwx-cs-btn.primary { background: #1b2430; color: #fff; display: flex; align-items: center; gap: 8px; }
      .fwx-cs-btn.primary:disabled { opacity: 0.6; cursor: default; }
      .fwx-cs-btn.secondary { background: #eceff2; color: #1b2430; }
      .fwx-cs-spinner {
        width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4);
        border-top-color: #fff; animation: fwx-cs-spin 0.7s linear infinite;
      }
      @keyframes fwx-cs-spin { to { transform: rotate(360deg); } }
      .fwx-cs-results { margin-top: 18px; border-top: 1px solid #eceff2; padding-top: 14px; }
      .fwx-cs-result {
        border: 1px solid #eceff2; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
      }
      .fwx-cs-result-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .fwx-cs-badge {
        font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;
        background: #eef2ff; color: #3346a8; border-radius: 999px; padding: 2px 9px;
      }
      .fwx-cs-score { font-size: 12px; color: #5a6472; }
      .fwx-cs-result a { font-weight: 600; color: #1b2430; text-decoration: none; font-size: 14px; }
      .fwx-cs-result a:hover { text-decoration: underline; }
      .fwx-cs-snippet { font-size: 13px; color: #4a5260; margin-top: 6px; line-height: 1.5; }
      .fwx-cs-matched { font-size: 12px; color: #1a7f4d; margin-top: 6px; }
      .fwx-cs-empty, .fwx-cs-error { font-size: 13.5px; color: #5a6472; text-align: center; padding: 18px 0; }
      .fwx-cs-error { color: #a83232; }
      .fwx-cs-close { background: none; border: none; font-size: 20px; line-height: 1; cursor: pointer; color: #8a929c; }
    `;
    document.head.appendChild(style);
  }

  function buildModal() {
    const overlay = document.createElement("div");
    overlay.className = "fwx-cs-overlay";
    overlay.id = "fwxCsOverlay";
    overlay.innerHTML = `
      <div class="fwx-cs-modal">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <h2>Source Candidates</h2>
          <button type="button" class="fwx-cs-close" id="fwxCsCloseBtn">&times;</button>
        </div>
        <div class="fwx-cs-note">
          This searches public profile pages only (via search engine indexing) — it does not scrape
          private CV databases or log in to any site. Review every result manually before contacting
          anyone, and don't store personal data beyond what screening actually needs.
        </div>
        <div class="fwx-cs-field">
          <label for="fwxCsRole">Job title / role</label>
          <input type="text" id="fwxCsRole" placeholder="e.g. Sales Representative" />
        </div>
        <div class="fwx-cs-field">
          <label for="fwxCsSkills">Required skills / experience (comma-separated)</label>
          <input type="text" id="fwxCsSkills" placeholder="e.g. B2B sales, CRM, Arabic, English" />
        </div>
        <div class="fwx-cs-field">
          <label for="fwxCsLocation">Location</label>
          <input type="text" id="fwxCsLocation" value="Jordan" />
        </div>
        <div class="fwx-cs-field">
          <label>Sources</label>
          <div class="fwx-cs-sources" id="fwxCsSources">
            ${SOURCES.map(s => `
              <label><input type="checkbox" value="${s.key}" checked /> ${s.label}</label>
            `).join("")}
          </div>
        </div>
        <div class="fwx-cs-actions">
          <button type="button" class="fwx-cs-btn secondary" id="fwxCsCancelBtn">Cancel</button>
          <button type="button" class="fwx-cs-btn primary" id="fwxCsSearchBtn">Search</button>
        </div>
        <div class="fwx-cs-results" id="fwxCsResults" style="display:none;"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const fab = document.createElement("button");
    fab.className = "fwx-cs-fab";
    fab.type = "button";
    fab.textContent = "🔍 Source Candidates";
    fab.addEventListener("click", () => { overlay.classList.add("open"); });
    document.body.appendChild(fab);

    overlay.querySelector("#fwxCsCloseBtn").addEventListener("click", () => overlay.classList.remove("open"));
    overlay.querySelector("#fwxCsCancelBtn").addEventListener("click", () => overlay.classList.remove("open"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });

    overlay.querySelector("#fwxCsSearchBtn").addEventListener("click", runSearch);

    // Exposed so a sidebar/nav link can open the panel too, not just the
    // floating button (e.g. onclick="openCandidateSourcing()").
    window.openCandidateSourcing = () => overlay.classList.add("open");
  }

  function setSearching(isSearching) {
    const btn = document.getElementById("fwxCsSearchBtn");
    btn.disabled = isSearching;
    btn.innerHTML = isSearching
      ? `<span class="fwx-cs-spinner"></span> Searching…`
      : "Search";
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  async function runSearch() {
    const role = document.getElementById("fwxCsRole").value.trim();
    const skills = document.getElementById("fwxCsSkills").value
      .split(",").map(s => s.trim()).filter(Boolean);
    const location = document.getElementById("fwxCsLocation").value.trim() || "Jordan";
    const sources = Array.from(document.querySelectorAll("#fwxCsSources input:checked")).map(i => i.value);

    const resultsBox = document.getElementById("fwxCsResults");
    if (!role && skills.length === 0) {
      resultsBox.style.display = "block";
      resultsBox.innerHTML = `<div class="fwx-cs-error">Enter a role or at least one required skill.</div>`;
      return;
    }
    if (sources.length === 0) {
      resultsBox.style.display = "block";
      resultsBox.innerHTML = `<div class="fwx-cs-error">Select at least one source.</div>`;
      return;
    }

    setSearching(true);
    resultsBox.style.display = "block";
    resultsBox.innerHTML = `<div class="fwx-cs-empty">Searching public profiles…</div>`;

    try {
      const { data, error } = await db.functions.invoke("clever-action", {
        body: { action: "search_candidates", role, skills, location, sources }
      });

      if (error || (data && data.error)) {
        resultsBox.innerHTML = `<div class="fwx-cs-error">${escapeHtml((data && data.error) || "Search failed. Please try again.")}</div>`;
        return;
      }

      const results = (data && data.results) || [];
      if (results.length === 0) {
        resultsBox.innerHTML = `<div class="fwx-cs-empty">No public matches found. Try broadening the role or skills.</div>`;
        return;
      }

      resultsBox.innerHTML = results.map(r => `
        <div class="fwx-cs-result">
          <div class="fwx-cs-result-top">
            <span class="fwx-cs-badge">${escapeHtml((SOURCES.find(s => s.key === r.source) || { label: r.source }).label)}</span>
            <span class="fwx-cs-score">Match score: ${r.score}</span>
          </div>
          <div><a href="${escapeHtml(r.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title || r.link)}</a></div>
          <div class="fwx-cs-snippet">${escapeHtml(r.snippet || "")}</div>
          ${r.matchedSkills && r.matchedSkills.length ? `<div class="fwx-cs-matched">Matched: ${r.matchedSkills.map(escapeHtml).join(", ")}</div>` : ""}
        </div>
      `).join("") + (data.errors ? `<div class="fwx-cs-error">${data.errors.map(escapeHtml).join("<br>")}</div>` : "");
    } catch (e) {
      resultsBox.innerHTML = `<div class="fwx-cs-error">Something went wrong reaching the search service.</div>`;
    } finally {
      setSearching(false);
    }
  }

  function init() {
    injectStyles();
    buildModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
