// Sourcing Candidates — full page (not a modal). Searches public profile
// pages only (via the "search_candidates" Edge Function action, which must
// be added to clever-action server-side first — see
// edge-function-search_candidates-snippet.ts) and lets the admin export the
// resulting shortlist as a PDF or Excel report.
//
// This does NOT scrape LinkedIn/Bayt/Indeed or log in anywhere — it only
// surfaces the public title/snippet/link a search engine already indexes.
// Treat every result as a lead to manually review, not a verified candidate.

const SC_SOURCES = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "bayt", label: "Bayt" },
  { key: "indeed", label: "Indeed" },
  { key: "akhtaboot", label: "Akhtaboot" },
  { key: "general", label: "General Web" },
];

let SC_LAST_RESULTS = [];
let SC_LAST_CRITERIA = null;
let SC_SEARCH_TOKEN = 0; // bumped on every new search or cancel, to ignore stale in-flight responses

function scEscapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function scSetSearching(isSearching) {
  const btn = document.getElementById("scSearchBtn");
  const cancelBtn = document.getElementById("scCancelSearchBtn");
  btn.disabled = isSearching;
  btn.innerHTML = isSearching ? `<span class="sc-spinner"></span> Searching…` : "Search";
  cancelBtn.style.display = isSearching ? "" : "none";
}

// The Supabase client's functions.invoke() doesn't expose a way to actually
// abort an in-flight request, so this is a "soft cancel": bump the token
// right away so the UI resets instantly, and have scRunSearch() check the
// token again once its request resolves — if it's stale (a cancel or a
// newer search happened meanwhile), its result is just discarded silently.
function scCancelSearch() {
  SC_SEARCH_TOKEN++;
  scSetSearching(false);
  document.getElementById("scResultsBody").innerHTML = `<div class="sc-empty">Search cancelled.</div>`;
}

async function scRunSearch() {
  const role = document.getElementById("scRole").value.trim();
  const skills = document.getElementById("scSkills").value
    .split(",").map(s => s.trim()).filter(Boolean);
  const location = document.getElementById("scLocation").value.trim() || "Jordan";
  const sources = Array.from(document.querySelectorAll("#scSources input:checked")).map(i => i.value);

  const resultsPanel = document.getElementById("scResultsPanel");
  const resultsBody = document.getElementById("scResultsBody");
  const exportPdfBtn = document.getElementById("scExportPdfBtn");
  const exportExcelBtn = document.getElementById("scExportExcelBtn");

  if (!role && skills.length === 0) {
    resultsPanel.style.display = "block";
    resultsBody.innerHTML = `<div class="sc-error">Enter a role or at least one required skill.</div>`;
    exportPdfBtn.style.display = "none";
    exportExcelBtn.style.display = "none";
    return;
  }
  if (sources.length === 0) {
    resultsPanel.style.display = "block";
    resultsBody.innerHTML = `<div class="sc-error">Select at least one source.</div>`;
    exportPdfBtn.style.display = "none";
    exportExcelBtn.style.display = "none";
    return;
  }

  const myToken = ++SC_SEARCH_TOKEN;
  scSetSearching(true);
  resultsPanel.style.display = "block";
  resultsBody.innerHTML = `<div class="sc-empty">Searching public profiles…</div>`;
  exportPdfBtn.style.display = "none";
  exportExcelBtn.style.display = "none";

  try {
    const { data, error } = await db.functions.invoke("clever-action", {
      body: { action: "search_candidates", role, skills, location, sources }
    });

    if (myToken !== SC_SEARCH_TOKEN) return; // cancelled, or a newer search took over — ignore this response

    if (error || (data && data.error)) {
      resultsBody.innerHTML = `<div class="sc-error">${scEscapeHtml((data && data.error) || "Search failed. Please try again.")}</div>`;
      return;
    }

    const results = (data && data.results) || [];
    SC_LAST_RESULTS = results;
    SC_LAST_CRITERIA = { role, skills, location, sources, date: new Date().toISOString().slice(0, 10) };

    document.getElementById("scResultsTitle").textContent = `Results (${results.length})`;

    if (results.length === 0) {
      resultsBody.innerHTML = `<div class="sc-empty">No public matches found. Try broadening the role or skills.</div>`;
      return;
    }

    resultsBody.innerHTML = results.map(r => `
      <div class="sc-result">
        <div class="sc-result-top">
          <span class="sc-badge">${scEscapeHtml((SC_SOURCES.find(s => s.key === r.source) || { label: r.source }).label)}</span>
          <span class="sc-score">Match score: ${r.score}</span>
        </div>
        <div class="sc-name">${scEscapeHtml(r.name || r.title || "Unknown")}</div>
        <div class="sc-experience">${scEscapeHtml(r.experience || "")}</div>
        <div class="sc-contact ${r.contact ? "" : "sc-no-contact"}">${r.contact ? scEscapeHtml(r.contact) : "Contact not public"}</div>
        <div style="margin-top:6px"><a href="${scEscapeHtml(r.link)}" target="_blank" rel="noopener noreferrer">View public profile ↗</a></div>
        ${r.matchedSkills && r.matchedSkills.length ? `<div class="sc-matched">Matched: ${r.matchedSkills.map(scEscapeHtml).join(", ")}</div>` : ""}
      </div>
    `).join("") + (data.errors ? `<div class="sc-error">${data.errors.map(scEscapeHtml).join("<br>")}</div>` : "");

    exportPdfBtn.style.display = "";
    exportExcelBtn.style.display = "";
  } catch (e) {
    if (myToken !== SC_SEARCH_TOKEN) return; // cancelled — don't show an error over the "cancelled" message
    resultsBody.innerHTML = `<div class="sc-error">Something went wrong reaching the search service.</div>`;
  } finally {
    if (myToken === SC_SEARCH_TOKEN) scSetSearching(false);
  }
}

function scExportPdf() {
  if (!SC_LAST_RESULTS.length || !window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const marginMm = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Candidate Sourcing Report", marginMm, y);
  y += 8;

  doc.setFontSize(10.5);
  doc.setFont(undefined, "normal");
  doc.setTextColor(90, 100, 114);
  const c = SC_LAST_CRITERIA;
  const criteriaLines = doc.splitTextToSize(
    `Role: ${c.role || "—"}   |   Skills: ${c.skills.join(", ") || "—"}   |   Location: ${c.location}   |   Sources: ${c.sources.join(", ")}   |   Date: ${c.date}`,
    pageWidth - marginMm * 2
  );
  criteriaLines.forEach(line => { doc.text(line, marginMm, y); y += 5; });
  y += 4;

  doc.setTextColor(27, 36, 48);
  SC_LAST_RESULTS.forEach((r) => {
    const blockLines = 5 + Math.ceil((r.experience || "").length / 100);
    if (y + blockLines * 5 > pageHeight - 15) { doc.addPage(); y = 20; }

    doc.setFontSize(11.5);
    doc.setFont(undefined, "bold");
    doc.text(r.name || r.title || "Unknown", marginMm, y);
    y += 5;

    doc.setFontSize(9.5);
    doc.setFont(undefined, "normal");
    doc.setTextColor(90, 100, 114);
    doc.text(`Source: ${r.source}   |   Match score: ${r.score}`, marginMm, y);
    y += 5;

    if (r.experience) {
      const expLines = doc.splitTextToSize(`Experience: ${r.experience}`, pageWidth - marginMm * 2);
      expLines.forEach(line => {
        if (y > pageHeight - 15) { doc.addPage(); y = 20; }
        doc.text(line, marginMm, y);
        y += 5;
      });
    }

    doc.setTextColor(r.contact ? 27 : 138, r.contact ? 36 : 146, r.contact ? 48 : 156);
    doc.text(`Contact: ${r.contact || "not public"}`, marginMm, y);
    y += 5;

    doc.setTextColor(90, 100, 114);
    doc.textWithLink("View public profile", marginMm, y, { url: r.link });
    y += 5;

    if (r.matchedSkills && r.matchedSkills.length) {
      doc.setTextColor(26, 127, 77);
      doc.text(`Matched: ${r.matchedSkills.join(", ")}`, marginMm, y);
      y += 5;
    }

    doc.setDrawColor(230, 233, 237);
    doc.line(marginMm, y, pageWidth - marginMm, y);
    y += 7;
    doc.setTextColor(27, 36, 48);
  });

  doc.save(`Candidate-Sourcing-Report-${c.date}.pdf`);
}

function scExportExcel() {
  if (!SC_LAST_RESULTS.length || !window.XLSX) return;
  const rows = SC_LAST_RESULTS.map(r => ({
    Name: r.name || r.title || "Unknown",
    Experience: r.experience || "",
    Contact: r.contact || "not public",
    Source: r.source,
    "Match Score": r.score,
    Link: r.link,
    "Matched Skills": (r.matchedSkills || []).join(", "),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Candidates");
  const date = (SC_LAST_CRITERIA && SC_LAST_CRITERIA.date) || new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Candidate-Sourcing-Report-${date}.xlsx`);
}

// Gate the whole page behind the same "admin"-only session check every other
// admin-only page uses (see admin.js: `ME = await requireSession("admin")`).
// This isn't just hiding the nav link — requireSession() actually verifies
// the logged-in user's role and handles redirecting anyone else away, so a
// supervisor or employee can't reach this page's functionality even by
// typing the URL directly.
(async () => {
  const me = await requireSession("admin");
  if (!me) return; // requireSession() has already redirected/blocked; stop here.

  document.getElementById("whoami").textContent = `${me.full_name} · #${me.file_number}`;

  document.getElementById("scSearchBtn").addEventListener("click", scRunSearch);
  document.getElementById("scCancelSearchBtn").addEventListener("click", scCancelSearch);
  document.getElementById("scExportPdfBtn").addEventListener("click", scExportPdf);
  document.getElementById("scExportExcelBtn").addEventListener("click", scExportExcel);
})();
