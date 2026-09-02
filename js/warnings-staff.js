let ME = null;

async function loadWarnings() {
  const { data, error } = await db
    .from("warnings")
    .select("*")
    .eq("employee_id", ME.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  const list = document.getElementById("warningsList");
  const empty = document.getElementById("noWarningsMsg");
  list.innerHTML = "";

  if (error || !data || data.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const w of data) {
    const box = document.createElement("div");
    box.style.cssText = "border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:14px;";
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
        <strong>${fmtDate(w.sent_at ? w.sent_at.slice(0,10) : null)}</strong>
      </div>
      <div dir="rtl" style="white-space:pre-wrap; font-family:inherit; font-size:14px; text-align:right; line-height:1.8;">${w.warning_text || w.reason}</div>
    `;
    list.appendChild(box);
  }
}

(async () => {
  ME = await requireSession("staff");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  document.getElementById("warningsSub").textContent = ME.department ? `${ME.department}` : "";
  await loadWarnings();
})();
