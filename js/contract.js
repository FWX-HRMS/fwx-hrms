let ME = null;
let CONTRACT = null;

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
  const badge = document.getElementById("contractStatusBadge");
  badge.textContent = contractStatusLabel(data.status);
  badge.className = `badge ${contractStatusClass(data.status)}`;

  const signedBox = document.getElementById("signedBox");
  const actionArea = document.getElementById("actionArea");
  if (data.status === "signed") {
    signedBox.style.display = "block";
    signedBox.textContent = `${t("signedOnLabel")} ${fmtDate(data.signed_at ? data.signed_at.slice(0,10) : null)} — ${data.signature_name || ""}`;
    actionArea.style.display = "none";
  } else {
    signedBox.style.display = "none";
    actionArea.style.display = "block";
  }
}

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
  btn.disabled = true;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "comment_contract", contract_id: CONTRACT.id, employee_comments }
  });

  btn.disabled = false;

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
  const signature_name = document.getElementById("signatureName").value.trim();
  if (!signature_name) {
    errBox.textContent = t("pleaseTypeFullName");
    errBox.classList.add("show");
    return;
  }
  if (signature_name.toLowerCase() !== (ME.full_name || "").trim().toLowerCase()) {
    errBox.textContent = t("signatureNameMismatch");
    errBox.classList.add("show");
    return;
  }

  const btn = document.getElementById("signContractBtn");
  btn.disabled = true;

  const { data, error } = await db.functions.invoke("clever-action", {
    body: { action: "sign_contract", contract_id: CONTRACT.id, signature_name }
  });

  btn.disabled = false;

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
  await loadContract();
})();
