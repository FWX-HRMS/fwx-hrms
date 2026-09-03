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
    const initialLang = w.language === "en" ? "en" : "ar";
    const initialText = w.warning_text || w.reason;
    const altText = w.warning_text_alt || "";
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px; flex-wrap:wrap">
        <strong>${fmtDate(w.sent_at ? w.sent_at.slice(0,10) : null)}</strong>
        ${altText ? `<button type="button" class="btn btn-blue btn-sm" data-convert-warning style="width:auto; padding:0 14px;">${initialLang === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn")}</button>` : ""}
      </div>
      <div class="warning-text-block" dir="${initialLang === "ar" ? "rtl" : "ltr"}" style="white-space:pre-wrap; font-family:inherit; font-size:14px; text-align:${initialLang === "ar" ? "right" : "left"}; line-height:1.8;">${initialText}</div>
    `;
    list.appendChild(box);

    if (altText) {
      let currentLang = initialLang;
      let currentAlt = altText;
      const btn = box.querySelector("button[data-convert-warning]");
      const textBlock = box.querySelector(".warning-text-block");
      btn.addEventListener("click", () => {
        const shown = textBlock.textContent;
        textBlock.textContent = currentAlt;
        currentAlt = shown;
        currentLang = currentLang === "ar" ? "en" : "ar";
        textBlock.dir = currentLang === "ar" ? "rtl" : "ltr";
        textBlock.style.textAlign = currentLang === "ar" ? "right" : "left";
        btn.textContent = currentLang === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
      });
    }
  }
}

(async () => {
  ME = await requireSession("staff");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  document.getElementById("warningsSub").textContent = ME.department ? `${ME.department}` : "";
  await loadWarnings();
  localStorage.setItem(`fwx_lastSeenWarnings_${ME.id}`, new Date().toISOString());
})();
