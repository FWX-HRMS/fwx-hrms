// Redirects to the right portal (or back to login) based on
// who is signed in and what role they have.
async function requireSession(requiredRole) {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  const { data: me, error } = await db
    .from("employees")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error || !me) {
    await db.auth.signOut();
    window.location.href = "index.html";
    return null;
  }

  if (requiredRole === "supervisor" && me.role === "staff") {
    window.location.href = "staff.html";
    return null;
  }

  if (requiredRole === "admin" && me.role !== "admin") {
    window.location.href = (me.role === "staff") ? "staff.html" : "supervisor.html";
    return null;
  }

  return me;
}

async function logout() {
  await db.auth.signOut();
  window.location.href = "index.html";
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

function fmtMoney(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
