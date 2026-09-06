let ME = null;
let CONTRACTS_LIST = [];
let CONTRACT = null;
let CONTRACT_ALT_TEXT = "";
let CONTRACT_LANG = "ar";
let signaturePad = null;
let sigMode = "draw"; // "draw" | "upload"
let suppressNextContractPopup = false;

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
    .neq("status", "signed")
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
      <td>${ME.full_name}</td>
      <td>${ME.file_number}</td>
      <td>${ME.client_company || "—"}</td>
      <td><span class="badge ${badge}">${contractStatusLabel(c.status)}</span></td>
      <td>${fmtDate(c.created_at ? c.created_at.slice(0,10) : null)}</td>
      <td>${c.contract_period_months ? `${c.contract_period_months} ${t("monthsLabel")}` : "—"}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-contract="${c.id}">View Contract</button></td>
    `;
    body.appendChild(tr);
  }
  body.querySelectorAll("button[data-view-contract]").forEach(btn => {
    btn.addEventListener("click", () => openContractView(btn.dataset.viewContract));
  });

  // Popup once per new contract awaiting the employee's review.
  const awaitingOnes = data.filter(c => c.status === "shared");
  if (awaitingOnes.length > 0) {
    if (suppressNextContractPopup) {
      suppressNextContractPopup = false;
    } else {
      checkNewContractNotice(awaitingOnes[0]);
    }
  }
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
  CONTRACT_LANG = detectDominantScript(c.contract_text);
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
    // After the employee has commented, the entire action area (comment box
    // and sign section) is hidden — only the contract text and Close button
    // remain — until admin re-shares the contract.
    const isWaiting = c.status === "commented";
    actionArea.style.display = isWaiting ? "none" : "block";
    waitingBox.style.display = isWaiting ? "block" : "none";
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

function containsArabic(text) {
  return /[\u0600-\u06FF]/.test(text || "");
}

// More robust than containsArabic() for deciding overall text direction —
// see admin.js for the same fix and rationale.
function detectDominantScript(text) {
  const s = text || "";
  const arabicCount = (s.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (s.match(/[A-Za-z]/g) || []).length;
  return arabicCount > latinCount ? "ar" : "en";
}

// jsPDF's built-in fonts have no Arabic glyphs and don't apply Arabic text
// shaping/RTL layout — rendering Arabic via doc.text() produces mojibake.
// Draw it onto a canvas instead (the browser shapes Arabic correctly) and
// place that image into the PDF, page by page.
function renderArabicPagesToPdf(doc, text, startYOverride) {
  const pageWidthMm = doc.internal.pageSize.getWidth();
  const pageHeightMm = doc.internal.pageSize.getHeight();
  const marginMm = 14;
  const contentWidthMm = pageWidthMm - marginMm * 2;

  const scale = 3;
  const pxPerMm = 3.7795 * scale;
  const canvasWidthPx = Math.round(contentWidthMm * pxPerMm);
  const lineHeightPx = Math.round(7 * pxPerMm);
  const fontSizePx = Math.round(4.2 * pxPerMm);
  const titleFontSizePx = Math.round(5.6 * pxPerMm);

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");

  const paragraphs = text.split("\n");
  const allLines = []; // { text, style: "normal" | "bold" | "title" }
  paragraphs.forEach((para, pIdx) => {
    const trimmed = para.trim();
    if (trimmed === "") { allLines.push({ text: "", style: "normal" }); return; }
    const style = trimmed === "عقد مصادر خارجية محدد المدة" ? "title" : /^مادة\s*\(/.test(trimmed) ? "bold" : "normal";
    mctx.font = style === "title" ? `bold ${titleFontSizePx}px Tahoma, Arial, sans-serif` : style === "bold" ? `bold ${fontSizePx}px Tahoma, Arial, sans-serif` : `${fontSizePx}px Tahoma, Arial, sans-serif`;
    mctx.direction = "rtl";
    const words = para.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (mctx.measureText(test).width > canvasWidthPx && current) {
        allLines.push({ text: current, style });
        current = word;
      } else {
        current = test;
      }
    }
    if (current) allLines.push({ text: current, style });
  });

  const firstPageTopMm = startYOverride != null ? startYOverride : marginMm;
  const firstPageLines = Math.max(1, Math.floor(((pageHeightMm - firstPageTopMm - marginMm) * pxPerMm) / lineHeightPx));
  const laterPageLines = Math.floor(((pageHeightMm - marginMm * 2) * pxPerMm) / lineHeightPx);
  let i = 0;
  let pageIndex = 0;
  let lastContentBottomMm = firstPageTopMm;
  while (i < allLines.length || pageIndex === 0) {
    const linesThisPage = pageIndex === 0 ? firstPageLines : laterPageLines;
    const pageLines = allLines.slice(i, i + linesThisPage);
    i += linesThisPage;
    if (pageIndex > 0) doc.addPage();
    const yStartMm = pageIndex === 0 ? firstPageTopMm : marginMm;

    if (pageLines.length > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidthPx;
      canvas.height = pageLines.length * lineHeightPx;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1b2430";
      ctx.direction = "rtl";
      ctx.textBaseline = "top";
      pageLines.forEach((line, idx) => {
        if (line.style === "title") {
          ctx.font = `bold ${titleFontSizePx}px Tahoma, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(line.text, canvas.width / 2, idx * lineHeightPx);
        } else if (line.style === "bold") {
          ctx.font = `bold ${fontSizePx}px Tahoma, Arial, sans-serif`;
          ctx.textAlign = "right";
          ctx.fillText(line.text, canvas.width, idx * lineHeightPx);
        } else {
          ctx.font = `${fontSizePx}px Tahoma, Arial, sans-serif`;
          ctx.textAlign = "right";
          ctx.fillText(line.text, canvas.width, idx * lineHeightPx);
        }
      });

      const imgHeightMm = canvas.height / pxPerMm;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", marginMm, yStartMm, contentWidthMm, imgHeightMm);
      lastContentBottomMm = yStartMm + imgHeightMm;
    }
    pageIndex++;
    if (allLines.length === 0) return lastContentBottomMm;
  }
  return lastContentBottomMm;
}

// jsPDF's plain doc.text() cannot shape Arabic glyphs, so any Arabic string
// drawn with it (even a short table label) comes out as corrupted/mojibake
// characters. This renders a single line of Arabic text onto a canvas
// (correct shaping + RTL) and returns it as an image sized in mm, so short
// strings like table titles/labels/values can be placed precisely without
// going through the paragraph-flow renderer.
function arabicTextToImageMm(text, { bold = false, sizeMm = 4.2, color = "#1b2430" } = {}) {
  const scale = 3;
  const pxPerMm = 3.7795 * scale;
  const fontSizePx = Math.round(sizeMm * pxPerMm);
  const font = `${bold ? "bold " : ""}${fontSizePx}px Tahoma, Arial, sans-serif`;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = font;
  mctx.direction = "rtl";
  const textWidthPx = Math.max(1, Math.ceil(mctx.measureText(text || "").width) + 6);
  const heightPx = Math.ceil(fontSizePx * 1.4);

  const canvas = document.createElement("canvas");
  canvas.width = textWidthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.direction = "rtl";
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillText(text || "", textWidthPx - 3, heightPx / 2);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: textWidthPx / pxPerMm,
    heightMm: heightPx / pxPerMm
  };
}

// Draws a line of Arabic text into the PDF at (xMm, yMm), where yMm is the
// vertical center of the line and xMm is the anchor edge given by `align`
// ("right" = xMm is the right edge, "center" = xMm is the horizontal center).
function drawArabicLine(doc, text, { xMm, yMm, align = "right", bold = false, sizeMm = 4.2, color = "#1b2430" } = {}) {
  const img = arabicTextToImageMm(text, { bold, sizeMm, color });
  let left = xMm;
  if (align === "right") left = xMm - img.widthMm;
  else if (align === "center") left = xMm - img.widthMm / 2;
  doc.addImage(img.dataUrl, "PNG", left, yMm - img.heightMm / 2, img.widthMm, img.heightMm);
}

// An "English" document (or an English body line) can still embed an
// employee's name written in Arabic (e.g. "Second Party: <arabic name>",
// or "Employee Name: <arabic name>" in the signature block). jsPDF's plain
// doc.text() has no Arabic glyphs at all, so those names come out as
// corrupted characters even though the surrounding line is plain LTR text.
// This draws such a line onto a canvas — the browser's own text engine
// correctly shapes the embedded Arabic run and keeps the English portion
// left-to-right — and places it as an image, left-anchored at (xMm, yMm)
// where yMm matches jsPDF's usual text-baseline convention.
function drawMixedLine(doc, text, { xMm, yMm, bold = false, sizeMm = 3.8, color = "#1b2430" } = {}) {
  const scale = 3;
  const pxPerMm = 3.7795 * scale;
  const fontSizePx = Math.round(sizeMm * pxPerMm);
  const font = `${bold ? "bold " : ""}${fontSizePx}px Tahoma, Arial, sans-serif`;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = font;
  const textWidthPx = Math.max(1, Math.ceil(mctx.measureText(text || "").width) + 6);
  const ascentPx = Math.round(fontSizePx * 0.82);
  const heightPx = Math.round(fontSizePx * 1.3);

  const canvas = document.createElement("canvas");
  canvas.width = textWidthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(text || "", 2, ascentPx);

  const widthMm = textWidthPx / pxPerMm;
  const heightMm = heightPx / pxPerMm;
  const topMm = yMm - ascentPx / pxPerMm;
  doc.addImage(canvas.toDataURL("image/png"), "PNG", xMm, topMm, widthMm, heightMm);
}

async function generateAndDownloadContract() {
  const text = document.getElementById("contractTextDisplay").textContent;
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { showToast("PDF library not loaded"); return; }
  const doc = new jsPDF();
  let lastY;
  // Use dominant-script detection rather than "does this text contain any
  // Arabic characters at all": an English contract still embeds the
  // employee's name, which is very often written in Arabic, so a naive
  // Arabic-character check would misclassify English contracts as Arabic
  // and send them through the RTL rendering path (wrong alignment/direction
  // for an otherwise-English document).
  const isArabicDoc = detectDominantScript(text) === "ar";

  if (isArabicDoc) {
    const tableMatch = text.match(/\n([^\n]*الجدولة الماليه[^\n]*)\n([\s\S]*?)\n\n(الفريق الأول[\s\S]*)$/);
    if (tableMatch) {
      const beforeTable = text.slice(0, tableMatch.index);
      const tableRows = tableMatch[2].split("\n").map(line => {
        const parts = line.split(":");
        return { label: (parts[0] || "").trim(), value: (parts.slice(1).join(":") || "").trim() };
      }).filter(r => r.label);
      const signatureSection = tableMatch[3];

      lastY = renderArabicPagesToPdf(doc, beforeTable);

      const marginMm = 14;
      const pageWidthMm = doc.internal.pageSize.getWidth();
      const pageHeightMm = doc.internal.pageSize.getHeight();
      const tableWidthMm = pageWidthMm - marginMm * 2;
      const rowHeightMm = 9;
      const tableHeightNeeded = 9 + tableRows.length * rowHeightMm + 10;

      let tableTopMm = lastY + 10;
      if (tableTopMm + tableHeightNeeded > pageHeightMm - marginMm) {
        doc.addPage();
        tableTopMm = marginMm + 10;
      }

      drawArabicLine(doc, "الجدولة الماليه", {
        xMm: pageWidthMm - marginMm, yMm: tableTopMm, align: "right", bold: true, sizeMm: 4.4
      });

      let rowY = tableTopMm + 6;
      const colSplitMm = marginMm + tableWidthMm * 0.62;
      doc.setDrawColor(200, 205, 212);
      doc.setLineWidth(0.3);
      doc.rect(marginMm, rowY, tableWidthMm, tableRows.length * rowHeightMm);
      doc.line(colSplitMm, rowY, colSplitMm, rowY + tableRows.length * rowHeightMm);
      for (let r = 1; r < tableRows.length; r++) {
        doc.line(marginMm, rowY + r * rowHeightMm, marginMm + tableWidthMm, rowY + r * rowHeightMm);
      }

      tableRows.forEach((row, idx) => {
        const cellY = rowY + idx * rowHeightMm + rowHeightMm / 2;
        drawArabicLine(doc, row.label, { xMm: marginMm + tableWidthMm - 3, yMm: cellY, align: "right", sizeMm: 3.7 });
        drawArabicLine(doc, row.value, { xMm: colSplitMm - 3, yMm: cellY, align: "right", sizeMm: 3.7 });
      });

      lastY = rowY + tableRows.length * rowHeightMm;
      lastY = renderArabicPagesToPdf(doc, "\n" + signatureSection, lastY);
    } else {
      lastY = renderArabicPagesToPdf(doc, text);
    }
  } else {
    const marginMm = 14;
    doc.setTextColor(27, 36, 48);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginMm * 2;
    let y = 20;
    const paragraphs = text.split("\n");
    paragraphs.forEach((para) => {
      const trimmed = para.trim();
      if (trimmed === "") { y += 6; return; }
      // The very first line of the English contract is its title — give it
      // the same bold, centered treatment the Arabic contract's title gets,
      // instead of flowing it in as plain left-aligned body text.
      const isTitle = trimmed === "FIXED-TERM OUTSOURCING (EXTERNAL RESOURCES) AGREEMENT";
      doc.setFont(undefined, isTitle ? "bold" : "normal");
      doc.setFontSize(isTitle ? 14 : 11);
      const lines = doc.splitTextToSize(para, contentWidth);
      for (const line of lines) {
        if (y > pageHeight - 15) { doc.addPage(); y = 20; }
        if (isTitle) {
          doc.text(line, pageWidth / 2, y, { align: "center" });
        } else if (containsArabic(line)) {
          drawMixedLine(doc, line, { xMm: marginMm, yMm: y, sizeMm: 3.8 });
        } else {
          doc.text(line, marginMm, y);
        }
        y += isTitle ? 8 : 6;
      }
    });
    doc.setFont(undefined, "normal");
    doc.setFontSize(11);
    lastY = y;
  }

  if (CONTRACT && CONTRACT.signature_image) {
    const marginMm = 14;
    const pageHeight = doc.internal.pageSize.getHeight();
    let imgWidth = 60, imgHeight = 20;
    let imageOk = true;
    try {
      const imgProps = doc.getImageProperties(CONTRACT.signature_image);
      const maxWidth = 80;
      imgWidth = Math.min(maxWidth, imgProps.width);
      imgHeight = (imgProps.height / imgProps.width) * imgWidth;
    } catch (e) {
      imageOk = false;
    }

    // Arabic contracts already end with their own proper signature line,
    // rendered correctly via the canvas-based Arabic text flow — adding
    // separate plain-text English labels here would duplicate that line
    // and risk garbling the employee's name, since jsPDF's plain text()
    // doesn't shape Arabic. Only add labels for non-Arabic contracts.
    const labelHeight = isArabicDoc ? 0 : 8;
    const nameLineHeight = isArabicDoc ? 0 : 8;
    const gapBeforeBlock = 10;
    const blockHeight = nameLineHeight + labelHeight + imgHeight + 5;

    let sigY = lastY + gapBeforeBlock;
    if (sigY + blockHeight > pageHeight - marginMm) {
      doc.addPage();
      sigY = marginMm + 10;
    }

    if (!isArabicDoc) {
      doc.setFontSize(11);
      doc.setTextColor(27, 36, 48);
      const nameLine = `Employee Name: ${ME.full_name || "—"}`;
      if (containsArabic(nameLine)) {
        drawMixedLine(doc, nameLine, { xMm: marginMm, yMm: sigY, sizeMm: 3.8 });
      } else {
        doc.text(nameLine, marginMm, sigY);
      }
      sigY += nameLineHeight;
      doc.text("Employee Signature:", marginMm, sigY);
      sigY += 4;
    }

    if (imageOk) {
      try {
        doc.addImage(CONTRACT.signature_image, marginMm, sigY, imgWidth, imgHeight);
      } catch (e) {
        doc.setFontSize(9);
        doc.text("(Signature image could not be embedded)", marginMm, sigY + 6);
      }
    } else {
      doc.setFontSize(9);
      doc.text("(Signature image could not be embedded)", marginMm, sigY + 6);
    }
  }

  const safeName = (ME.full_name || "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const safeFileNumber = (ME.file_number || "").replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`Contract-${safeFileNumber}-${safeName}.pdf`);
}

document.getElementById("downloadContractBtn").addEventListener("click", () => {
  const btn = document.getElementById("downloadContractBtn");
  setBtnLoading(btn, true, t("preparing"));
  // Yield one frame so the spinner actually paints before the (synchronous,
  // potentially slow) PDF rendering work blocks the main thread.
  setTimeout(async () => {
    try {
      await generateAndDownloadContract();
    } finally {
      setBtnLoading(btn, false);
    }
  }, 30);
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
  CONTRACT_LANG = detectDominantScript(display.textContent);
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
  suppressNextContractPopup = true;
  document.getElementById("contractViewOverlay").style.display = "none";
  await loadContracts();
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
