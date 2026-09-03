function warningStatusBadge(status) {
  const cls = { draft: "cancelled", sent: "approved" }[status] || "cancelled";
  return `<span class="badge badge-${cls}">${t("warningStatus" + status[0].toUpperCase() + status.slice(1))}</span>`;
}

let ME = null;
let WARNINGS_LIST = [];
let WARNING_ALT_TEXT = "";
let WARNING_LANG = "ar";

function updateWarningConvertBtnLabel() {
  const btn = document.getElementById("warningConvertBtn");
  btn.style.display = WARNING_ALT_TEXT ? "" : "none";
  btn.textContent = WARNING_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
}

async function loadWarnings() {
  const { data, error } = await db
    .from("warnings")
    .select("*")
    .eq("employee_id", ME.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  const body = document.getElementById("warningsBody");
  const empty = document.getElementById("noWarningsMsg");
  body.innerHTML = "";

  if (error || !data || data.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  WARNINGS_LIST = data;

  for (const w of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ME.full_name}</td>
      <td>${ME.file_number}</td>
      <td>${ME.client_company || "—"}</td>
      <td>${(w.reason || "").slice(0, 60)}${(w.reason || "").length > 60 ? "…" : ""}</td>
      <td>${warningStatusBadge(w.status)}</td>
      <td>${fmtDate(w.sent_at ? w.sent_at.slice(0,10) : null)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-warning="${w.id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }
  body.querySelectorAll("button[data-view-warning]").forEach(btn => {
    btn.addEventListener("click", () => openWarningView(btn.dataset.viewWarning));
  });
}

function openWarningView(id) {
  const w = WARNINGS_LIST.find(x => x.id === id);
  if (!w) return;
  const display = document.getElementById("warningTextDisplay");
  display.textContent = w.warning_text || w.reason;
  WARNING_ALT_TEXT = w.warning_text_alt || "";
  WARNING_LANG = w.language === "en" ? "en" : "ar";
  display.dir = WARNING_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = WARNING_LANG === "ar" ? "right" : "left";
  updateWarningConvertBtnLabel();
  document.getElementById("warningViewOverlay").style.display = "flex";
}
document.getElementById("closeWarningViewBtn").addEventListener("click", () => {
  document.getElementById("warningViewOverlay").style.display = "none";
});
document.getElementById("warningConvertBtn").addEventListener("click", () => {
  const display = document.getElementById("warningTextDisplay");
  const current = display.textContent;
  display.textContent = WARNING_ALT_TEXT;
  WARNING_ALT_TEXT = current;
  WARNING_LANG = WARNING_LANG === "ar" ? "en" : "ar";
  display.dir = WARNING_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = WARNING_LANG === "ar" ? "right" : "left";
  updateWarningConvertBtnLabel();
});

(async () => {
  ME = await requireSession("staff");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  document.getElementById("warningsSub").textContent = ME.department ? `${ME.department}` : "";
  await loadWarnings();
  localStorage.setItem(`fwx_lastSeenWarnings_${ME.id}`, new Date().toISOString());
})();
