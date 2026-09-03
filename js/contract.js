let ME = null;
let CONTRACT = null;
let CONTRACT_ALT_TEXT = "";
let CONTRACT_LANG = "ar";
let signaturePad = null;
let sigMode = "draw"; // "draw" | "upload"

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function contractStatusLabel(status) {
  return t("contractStatus" + status[0].toUpperCase() + status.slice(1));
}

function contractStatusClass(status) {
  return { draft: "badge-cancelled", shared: "badge-pending", commented: "badge-rejected", signed: "badge-approved" }[status] || "badge-cancelled";
}

function updateContractConvertBtnLabel() {
  document.getElementById("contractConvertBtn").textContent = CONTRACT_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
}

function initSignaturePad(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#1b2430";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let drawing = false;
  let hasDrawn = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  function start(e) {
    drawing = true;
    hasDrawn = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  }
  function move(e) {
    if (!drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  }
  function end() { drawing = false; }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);

  return {
    clear: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasDrawn = false; },
    isEmpty: () => !hasDrawn,
    toDataURL: () => canvas.toDataURL("image/png"),
  };
}

function setSigMode(mode) {
  sigMode = mode;
  document.getElementById("sigDrawArea").style.display = mode === "draw" ? "" : "none";
  document.getElementById("sigUploadArea").style.display = mode === "upload" ? "" : "none";
  document.getElementById("sigModeDrawBtn").classList.toggle("active", mode === "draw");
  document.getElementById("sigModeUploadBtn").classList.toggle("active", mode === "upload");
}
document.getElementById("sigModeDrawBtn").addEventListener("click", () => setSigMode("draw"));
document.getElementById("sigModeUploadBtn").addEventListener("click", () => setSigMode("upload"));
document.getElementById("clearSignatureBtn").addEventListener("click", () => signaturePad && signaturePad.clear());

document.getElementById("signatureFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const preview = document.getElementById("signaturePreview");
    preview.src = reader.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

async function loadContract() {
  const { data, error } = await db
    .from("contracts")
    .select("*")
    .eq("employee_id", ME.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    document.getElementById("noContractPanel").style.display = "block";
    document.getElementById("contractPanel").style.display = "none";
    return;
  }

  CONTRACT = data;
  document.getElementById("noContractPanel").style.display = "none";
  document.getElementById("contractPanel").style.display = "block";

  document.getElementById("contractTextDisplay").textContent = data.contract_text || "";
  CONTRACT_ALT_TEXT = data.contract_text_alt || "";
  CONTRACT_LANG = data.language === "en" ? "en" : "ar";
  const display = document.getElementById("contractTextDisplay");
  display.dir = CONTRACT_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = CONTRACT_LANG === "ar" ? "right" : "left";
  document.getElementById("contractConvertBtn").style.display = CONTRACT_ALT_TEXT ? "" : "none";
  updateContractConvertBtnLabel();

  const badge = document.getElementById("contractStatusBadge");
  badge.textContent = contractStatusLabel(data.status);
  badge.className = `badge ${contractStatusClass(data.status)}`;

  const signedBox = document.getElementById("signedBox");
  const sigImg = document.getElementById("signatureDisplay");
  const actionArea = document.getElementById("actionArea");
  if (data.status === "signed") {
    signedBox.style.display = "block";
    signedBox.textContent = `${t("signedOnLabel")} ${fmtDate(data.signed_at ? data.signed_at.slice(0,10) : null)}`;
    if (data.signature_image) {
      sigImg.src = data.signature_image;
      sigImg.style.display = "block";
    }
    actionArea.style.display = "none";
    checkActiveContractNotice(data);
  } else {
    signedBox.style.display = "none";
    sigImg.style.display = "none";
    actionArea.style.display = "block";
  }
}

function checkActiveContractNotice(contract) {
  const seenKey = `fwx_seenActiveContract_${ME.id}_${contract.id}`;
  if (sessionStorage.getItem(seenKey)) return;
  const today = new Date().toISOString().slice(0, 10);
  if (contract.end_date && contract.end_date < today) return; // expired, don't show

  document.getElementById("activeContractText").textContent =
    contract.end_date ? `${t("activeContractUntil")} ${fmtDate(contract.end_date)}` : t("activeContractGeneric");
  document.getElementById("activeContractOverlay").style.display = "flex";
  sessionStorage.setItem(seenKey, "1");
}
document.getElementById("closeActiveContractBtn").addEventListener("click", () => {
  document.getElementById("activeContractOverlay").style.display = "none";
});

document.getElementById("contractConvertBtn").addEventListener("click", () => {
  const display = document.getElementById("contractTextDisplay");
  const current = display.textContent;
  display.textContent = CONTRACT_ALT_TEXT;
  CONTRACT_ALT_TEXT = current;
  CONTRACT_LANG = CONTRACT_LANG === "ar" ? "en" : "ar";
  display.dir = CONTRACT_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = CONTRACT_LANG === "ar" ? "right" : "left";
  updateContractConvertBtnLabel();
});

document.getElementById("submitCommentBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("commentError");
  errBox.classList.remove("show");
  const employee_comments = document.getElementById("commentText").value.trim();
  if (!employee_comments) {
    errBox.textContent = t("pleaseEnterComment");
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("submitCommentBtn");
  setBtnLoading(btn, true);

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "comment_contract", contract_id: CONTRACT.id, employee_comments }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongSubmittingComment");
    errBox.classList.add("show");
    return;
  }

  document.getElementById("commentText").value = "";
  showToast(t("commentsSentToast"));
  await loadContract();
});

document.getElementById("signContractBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("signError");
  errBox.classList.remove("show");

  let signature_image = null;
  if (sigMode === "draw") {
    if (!signaturePad || signaturePad.isEmpty()) {
      errBox.textContent = t("pleaseProvideSignature");
      errBox.classList.add("show");
      return;
    }
    signature_image = signaturePad.toDataURL();
  } else {
    const preview = document.getElementById("signaturePreview");
    if (!preview.src || preview.style.display === "none") {
      errBox.textContent = t("pleaseProvideSignature");
      errBox.classList.add("show");
      return;
    }
    signature_image = preview.src;
  }

  const btn = document.getElementById("signContractBtn");
  setBtnLoading(btn, true);

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "sign_contract", contract_id: CONTRACT.id, signature_image }
  });

  setBtnLoading(btn, false);

  if (error || (data && data.error)) {
    errBox.textContent = (data && data.error) ? data.error : t("somethingWrongSigning");
    errBox.classList.add("show");
    return;
  }

  showToast(t("contractSignedToast"));
  await loadContract();
});

(async () => {
  ME = await requireSession("staff");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  document.getElementById("contractSub").textContent = ME.department ? `${ME.department}` : "";
  signaturePad = initSignaturePad(document.getElementById("signatureCanvas"));
  await loadContract();
})();
