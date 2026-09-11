let ME = null;
let EMPLOYEES_BY_ID = {};
let NOTIFICATIONS_LIST = [];
let NOTIFICATIONS_PAGE = 0;
const PAGE_SIZE = 10;

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function updatePaginationControls(prefix, page, totalCount) {
  const wrap = document.getElementById(`${prefix}Pagination`);
  const info = document.getElementById(`${prefix}PageInfo`);
  const prevBtn = document.getElementById(`${prefix}PrevBtn`);
  const nextBtn = document.getElementById(`${prefix}NextBtn`);
  if (!wrap) return;
  if (totalCount <= PAGE_SIZE) { wrap.style.display = "none"; return; }
  wrap.style.display = "flex";
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  info.textContent = `Page ${page + 1} of ${totalPages}`;
  prevBtn.disabled = page === 0;
  nextBtn.disabled = page >= totalPages - 1;
}

// Sidebar differs per role, and no shared nav template exists across
// admin.html/supervisor.html/staff.html to reuse — built dynamically here
// based on the logged-in user's own role instead.
function buildSidebarNav(role) {
  const nav = document.getElementById("navLinks");
  document.getElementById("brandLabel").textContent = role === "staff" ? "Staff Portal" : "Supervisor Portal";
  if (role === "admin") {
    nav.innerHTML = `
      <a href="supervisor.html">Team overview</a>
      <a href="admin.html">Users</a>
      <a href="clients.html">Client Companies</a>
      <a href="locations.html">Staff Locations</a>
      <a href="sourcing-candidates.html">🔍 Sourcing Candidates</a>
      <a href="notifications.html" class="active">🔔 Notifications</a>
    `;
  } else if (role === "supervisor") {
    nav.innerHTML = `
      <a href="supervisor.html">Team overview</a>
      <a href="locations.html">Staff Locations</a>
      <a href="notifications.html" class="active">🔔 Notifications</a>
    `;
  } else {
    nav.innerHTML = `
      <a href="staff.html">My leave</a>
      <a href="contract.html">My Contract</a>
      <a href="warnings.html">My Warnings</a>
      <a href="notifications.html" class="active">🔔 Notifications</a>
    `;
  }
}

async function loadNotifications() {
  // RLS on the notifications table already scopes this correctly per
  // role (admin sees all, supervisor sees their team's, employee sees
  // their own) — no manual filtering needed here.
  const { data, error } = await db.from("notifications").select("*").order("created_at", { ascending: false });
  NOTIFICATIONS_LIST = error || !data ? [] : data;

  // Separate lookup for employee names rather than an embedded-join
  // query — keeps this simple and doesn't depend on assuming exactly how
  // PostgREST resolves the notifications->employees relationship.
  const employeeIds = [...new Set(NOTIFICATIONS_LIST.map(n => n.employee_id).filter(Boolean))];
  EMPLOYEES_BY_ID = {};
  if (employeeIds.length > 0) {
    const { data: emps } = await db.from("employees").select("id, full_name, file_number").in("id", employeeIds);
    (emps || []).forEach(e => { EMPLOYEES_BY_ID[e.id] = e; });
  }

  NOTIFICATIONS_PAGE = 0;
  renderNotifications();
}

const TYPE_LABELS = {
  contract_expiring: "Contract Expiring",
  contract_not_renewing: "Contract Not Renewing",
  contract_shared: "Contract Shared",
  contract_signed: "Contract Signed",
  leave_submitted: "Leave Submitted",
  leave_decided: "Leave Decided",
  warning_issued: "Warning Issued",
  warning_acknowledged: "Warning Acknowledged",
  employee_frozen: "Account Frozen",
  employee_unfrozen: "Account Unfrozen",
  employee_deleted: "Employee Deleted",
  profile_edited: "Profile Edited",
  general: "General",
};

function renderNotifications() {
  const body = document.getElementById("notificationsBody");
  const empty = document.getElementById("noNotifications");
  body.innerHTML = "";

  const query = document.getElementById("notificationsSearchInput").value.trim().toLowerCase();
  const filtered = query
    ? NOTIFICATIONS_LIST.filter(n => {
        const emp = EMPLOYEES_BY_ID[n.employee_id];
        return (n.title || "").toLowerCase().includes(query) ||
          (emp && emp.full_name || "").toLowerCase().includes(query) ||
          String((emp && emp.file_number) || "").toLowerCase().includes(query);
      })
    : NOTIFICATIONS_LIST;
  empty.style.display = filtered.length ? "none" : "block";

  const start = NOTIFICATIONS_PAGE * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  for (const n of pageItems) {
    const tr = document.createElement("tr");
    const emp = EMPLOYEES_BY_ID[n.employee_id];
    const empName = emp ? emp.full_name : "—";
    const empId = emp ? emp.file_number : "—";
    const typeLabel = TYPE_LABELS[n.type] || n.type || "—";
    tr.innerHTML = `
      <td>${typeLabel}</td>
      <td>${empName}${n.read ? "" : ` <span class="badge badge-pending" style="margin-inline-start:6px">New</span>`}</td>
      <td>${empId}</td>
      <td>${fmtDate(n.created_at ? n.created_at.slice(0, 10) : null)}</td>
      <td>${n.status === "needs_action" ? `<span class="badge badge-pending">Needs Action</span>` : `<span class="badge badge-approved">Resolved</span>`}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-view-notification="${n.id}">View</button></td>
    `;
    body.appendChild(tr);
  }
  updatePaginationControls("notifications", NOTIFICATIONS_PAGE, filtered.length);

  body.querySelectorAll("button[data-view-notification]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const n = NOTIFICATIONS_LIST.find(x => x.id === btn.dataset.viewNotification);
      if (!n) return;
      document.getElementById("notificationDetailTitle").textContent = n.title;
      document.getElementById("notificationDetailDate").textContent = fmtDate(n.created_at ? n.created_at.slice(0, 10) : null);
      document.getElementById("notificationDetailMsg").textContent = n.message;
      document.getElementById("notificationDetailOverlay").style.display = "flex";

      if (!n.read) {
        n.read = true;
        renderNotifications();
        db.from("notifications").update({ read: true }).eq("id", n.id).then(() => {});
      }
    });
  });
}

document.getElementById("closeNotificationDetailBtn").addEventListener("click", () => {
  document.getElementById("notificationDetailOverlay").style.display = "none";
});

document.getElementById("notificationsSearchInput").addEventListener("input", () => {
  NOTIFICATIONS_PAGE = 0;
  renderNotifications();
});
document.getElementById("notificationsPrevBtn").addEventListener("click", () => {
  if (NOTIFICATIONS_PAGE > 0) { NOTIFICATIONS_PAGE--; renderNotifications(); }
});
document.getElementById("notificationsNextBtn").addEventListener("click", () => {
  NOTIFICATIONS_PAGE++;
  renderNotifications();
});

(async () => {
  // Direct Supabase Auth check rather than an assumed requireSession(role)
  // helper — this page needs to work for all three roles, and I don't
  // have confirmed visibility into auth-guard.js's exact signature for a
  // "any authenticated role" case, so this avoids guessing at it.
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = "index.html"; return; }

  const { data: me, error } = await db.from("employees").select("*").eq("id", session.user.id).maybeSingle();
  if (error || !me) { window.location.href = "index.html"; return; }
  if (me.frozen) { await db.auth.signOut(); window.location.href = "index.html?frozen=1"; return; }

  ME = me;
  document.getElementById("whoami").innerHTML = `${me.full_name} · #${me.file_number}${me.client_company ? "<br>" + me.client_company : ""}`;
  document.getElementById("pageSub").textContent = me.role === "staff" ? "Your notifications" : "System and contract notifications";
  buildSidebarNav(me.role);

  await loadNotifications();
})();
