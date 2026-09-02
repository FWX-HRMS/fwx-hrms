let ME = null;

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

document.getElementById("nameForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("nameError");
  const okBox = document.getElementById("nameSuccess");
  errBox.classList.remove("show");
  okBox.classList.remove("show");

  const full_name = document.getElementById("fullName").value.trim();
  if (!full_name) return;

  const { error } = await db.from("employees").update({ full_name }).eq("id", ME.id);

  if (error) {
    errBox.textContent = t("somethingWrongUpdatingName");
    errBox.classList.add("show");
    return;
  }

  okBox.classList.add("show");
  document.getElementById("whoami").textContent = `${full_name} · #${ME.file_number}`;
  showToast(t("nameUpdatedMsg"));
});

document.getElementById("emailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("emailError");
  const okBox = document.getElementById("emailSuccess");
  errBox.classList.remove("show");
  okBox.classList.remove("show");

  const newEmail = document.getElementById("newEmail").value.trim();
  if (!newEmail) return;

  // This sends a confirmation link to the new address via Supabase Auth.
  const { error: authError } = await db.auth.updateUser({ email: newEmail });
  if (authError) {
    errBox.textContent = authError.message || "Could not start the email change.";
    errBox.classList.add("show");
    return;
  }

  // Keep our own employees table in sync right away so logins/lookups
  // work with the new address once it's confirmed.
  await db.from("employees").update({ email: newEmail }).eq("id", ME.id);

  okBox.classList.add("show");
  okBox.textContent = t("emailChangeConfirmMsg");
  document.getElementById("emailForm").reset();
  document.getElementById("currentEmail").textContent = newEmail;
});

document.getElementById("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("pwError");
  errBox.classList.remove("show");

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword !== confirmPassword) {
    errBox.textContent = t("passwordsDontMatch");
    errBox.classList.add("show");
    return;
  }

  const { error } = await db.auth.updateUser({ password: newPassword });

  if (error) {
    errBox.textContent = t("somethingWrongUpdatingPassword");
    errBox.classList.add("show");
    return;
  }

  document.getElementById("passwordForm").reset();
  showToast(t("passwordUpdatedToast"));
});

(async () => {
  ME = await requireSession();
  if (!ME) return;
  document.getElementById("whoami").textContent = `${ME.full_name} · #${ME.file_number}`;
  document.getElementById("fullName").value = ME.full_name;
  document.getElementById("currentEmail").textContent = ME.email || "—";
  document.getElementById("backLink").href = (ME.role === "staff") ? "staff.html" : "supervisor.html";
})();
