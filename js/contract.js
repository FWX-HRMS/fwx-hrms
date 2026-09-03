let ME = null;
let CONTRACTS_LIST = [];
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
  const btn = document.getElementById("contractConvertBtn");
  btn.style.display = CONTRACT_ALT_TEXT ? "" : "none";
  btn.textContent = CONTRACT_LANG === "ar" ? t("convertToEnglishBtn") : t("convertToArabicBtn");
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

async function loadContracts() {
  const { data, error } = await db
    .from("contracts")
    .select("*")
    .eq("employee_id", ME.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  const body = document.getElementById("contractsBody");
  const empty = document.getElementById("noContractPanel");
  body.innerHTML = "";

  if (error || !data || data.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  CONTRACTS_LIST = data;

  for (const c of data) {
    const badge = contractStatusClass(c.status);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(c.created_at ? c.created_at.slice(0,10) : null)}</td>
      <td><span class="badge ${badge}">${contractStatusLabel(c.status)}</span></td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-contract="${c.id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }
  body.querySelectorAll("button[data-view-contract]").forEach(btn => {
    btn.addEventListener("click", () => openContractView(btn.dataset.viewContract));
  });

  // Popup once per session for a signed, unexpired contract.
  const activeOne = data.find(c => c.status === "signed");
  if (activeOne) checkActiveContractNotice(activeOne);

  // Popup once per new contract awaiting the employee's review.
  const awaitingOnes = data.filter(c => c.status === "shared" || c.status === "commented");
  if (awaitingOnes.length > 0) checkNewContractNotice(awaitingOnes[0]);
}

function checkNewContractNotice(contract) {
  const seenKey = `fwx_seenNewContract_${ME.id}_${contract.id}_${contract.updated_at || ""}`;
  if (sessionStorage.getItem(seenKey)) return;
  document.getElementById("activeContractTitle").textContent = t("newContractPopupTitle");
  document.getElementById("activeContractText").textContent = t("newContractPopupMsg");
  document.getElementById("activeContractOverlay").style.display = "flex";
  sessionStorage.setItem(seenKey, "1");
}

function openContractView(id) {
  const c = CONTRACTS_LIST.find(x => x.id === id);
  if (!c) return;
  CONTRACT = c;

  const display = document.getElementById("contractTextDisplay");
  display.textContent = c.contract_text || "";
  CONTRACT_ALT_TEXT = c.contract_text_alt || "";
  CONTRACT_LANG = c.language === "en" ? "en" : "ar";
  display.dir = CONTRACT_LANG === "ar" ? "rtl" : "ltr";
  display.style.textAlign = CONTRACT_LANG === "ar" ? "right" : "left";
  updateContractConvertBtnLabel();

  const badge = document.getElementById("contractStatusBadge");
  badge.textContent = contractStatusLabel(c.status);
  badge.className = `badge ${contractStatusClass(c.status)}`;

  const signedBox = document.getElementById("signedBox");
  const sigImg = document.getElementById("signatureDisplay");
  const downloadBtn = document.getElementById("downloadContractBtn");
  const actionArea = document.getElementById("actionArea");
  const waitingBox = document.getElementById("waitingOnAdminBox");
  if (c.status === "signed") {
    signedBox.style.display = "block";
    signedBox.textContent = `${t("signedOnLabel")} ${fmtDate(c.signed_at ? c.signed_at.slice(0,10) : null)}`;
    if (c.signature_image) {
      sigImg.src = c.signature_image;
      sigImg.style.display = "block";
    } else {
      sigImg.style.display = "none";
    }
    downloadBtn.style.display = "";
    actionArea.style.display = "none";
    waitingBox.style.display = "none";
  } else {
    signedBox.style.display = "none";
    sigImg.style.display = "none";
    downloadBtn.style.display = "none";
    actionArea.style.display = "block";
    // After the employee has commented, everything in the action area is
    // disabled (except Convert/Close) until admin responds — prevents
    // double-submitting comments or signing while feedback is pending.
    const isWaiting = c.status === "commented";
    waitingBox.style.display = isWaiting ? "block" : "none";
    document.getElementById("commentText").disabled = isWaiting;
    document.getElementById("submitCommentBtn").disabled = isWaiting;
    document.getElementById("sigModeDrawBtn").disabled = isWaiting;
    document.getElementById("sigModeUploadBtn").disabled = isWaiting;
    document.getElementById("clearSignatureBtn").disabled = isWaiting;
    document.getElementById("signatureFileInput").disabled = isWaiting;
    document.getElementById("signContractBtn").disabled = isWaiting;
    document.getElementById("signatureCanvas").style.pointerEvents = isWaiting ? "none" : "";
    document.getElementById("signatureCanvas").style.opacity = isWaiting ? "0.5" : "1";
  }

  document.getElementById("commentText").value = "";
  document.getElementById("commentError").classList.remove("show");
  document.getElementById("signError").classList.remove("show");
  if (signaturePad) signaturePad.clear();
  document.getElementById("signaturePreview").style.display = "none";
  document.getElementById("signatureFileInput").value = "";
  setSigMode("draw");

  document.getElementById("contractViewOverlay").style.display = "flex";
}
document.getElementById("closeContractViewBtn").addEventListener("click", () => {
  document.getElementById("contractViewOverlay").style.display = "none";
});

document.getElementById("downloadContractBtn").addEventListener("click", () => {
  const text = document.getElementById("contractTextDisplay").textContent;
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { showToast("PDF library not loaded"); return; }
  const doc = new jsPDF();
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, 180);
  let y = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const line of lines) {
    if (y > pageHeight - 15) { doc.addPage(); y = 20; }
    doc.text(line, 14, y);
    y += 6;
  }
  doc.save("my_contract.pdf");
});

function checkActiveContractNotice(contract) {
  const seenKey = `fwx_seenActiveContract_${ME.id}_${contract.id}`;
  if (sessionStorage.getItem(seenKey)) return;
  const today = new Date().toISOString().slice(0, 10);
  if (contract.end_date && contract.end_date < today) return; // expired, don't show

  document.getElementById("activeContractTitle").textContent = t("activeContractTitle");
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

  showToast(t("commentsSentToast"));
  await loadContracts();
  openContractView(CONTRACT.id);
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
  document.getElementById("contractViewOverlay").style.display = "none";
  await loadContracts();
});

(async () => {
  ME = await requireSession("staff");
  if (!ME) return;
  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  document.getElementById("contractSub").textContent = `${ME.full_name} · ${ME.client_company || ""}`;
  signaturePad = initSignaturePad(document.getElementById("signatureCanvas"));
  await loadContracts();
})();
