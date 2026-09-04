let ME = null;
let MAP = null;
let MARKERS = {};
let ACCURACY_CIRCLES = {};
const REFRESH_INTERVAL_MS = 35000;

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return tv("minutesAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return tv("hoursAgo", { n: hrs });
  const days = Math.floor(hrs / 24);
  return tv("daysAgo", { n: days });
}

async function loadTeamById() {
  const query = db.from("employees").select("id, full_name, file_number, client_company, role, department").order("full_name");
  const { data, error } = ME.role === "admin"
    ? await query.neq("role", "admin")
    : await query.eq("supervisor_id", ME.id);
  if (error || !data) return {};
  return Object.fromEntries(data.map(e => [e.id, e]));
}

function matchesTableSearch(query, fileNumber, company, role, name, department) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (fileNumber || "").toLowerCase().includes(q) ||
         (company || "").toLowerCase().includes(q) ||
         (role || "").toLowerCase().includes(q) ||
         (name || "").toLowerCase().includes(q) ||
         (department || "").toLowerCase().includes(q);
}

function ensureLocationsSearch() {
  let input = document.getElementById("locationsSearchInput");
  if (input) return input;
  const tbody = document.getElementById("locationsBody");
  if (!tbody) return null;
  const table = tbody.closest("table");
  if (!table) return null;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative; max-width:480px; margin-bottom:14px";
  wrap.innerHTML = `
    <span style="position:absolute; inset-inline-start:12px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:.55">🔍</span>
    <input type="text" id="locationsSearchInput" placeholder="Name, file #, company, role, or department" style="width:100%; padding-inline-start:36px">
  `;
  table.parentNode.insertBefore(wrap, table);
  input = document.getElementById("locationsSearchInput");
  input.addEventListener("input", () => renderLocationsTable());
  return input;
}

let LOCATIONS_TEAM_BY_ID = {};
let LOCATIONS_ROWS = [];

async function refreshLocations() {
  const teamById = await loadTeamById();
  LOCATIONS_TEAM_BY_ID = teamById;
  const ids = Object.keys(teamById);

  if (ids.length === 0) {
    LOCATIONS_ROWS = [];
    renderLocationsTable();
    return;
  }

  const { data, error } = await db.from("employee_locations").select("*").in("employee_id", ids);
  if (error) { showToast(t("couldNotLoadLocations")); return; }
  LOCATIONS_ROWS = data || [];

  // Map markers always reflect everyone's actual live location, regardless
  // of the table search — this is a safety-tracking view, so search should
  // only help find someone in the list, not hide anyone's pin from the map.
  const seen = new Set();
  for (const loc of LOCATIONS_ROWS) {
    const emp = teamById[loc.employee_id];
    if (!emp) continue;
    seen.add(loc.employee_id);

    if (!MARKERS[loc.employee_id]) {
      MARKERS[loc.employee_id] = L.marker([loc.latitude, loc.longitude]).addTo(MAP);
    } else {
      MARKERS[loc.employee_id].setLatLng([loc.latitude, loc.longitude]);
    }
    MARKERS[loc.employee_id].bindPopup(`<strong>${emp.full_name}</strong><br>${timeAgo(loc.updated_at)}${loc.accuracy ? `<br>${tv("accuracyLabel", { n: Math.round(loc.accuracy) })}` : ""}`);

    if (loc.accuracy) {
      if (!ACCURACY_CIRCLES[loc.employee_id]) {
        ACCURACY_CIRCLES[loc.employee_id] = L.circle([loc.latitude, loc.longitude], {
          radius: loc.accuracy,
          color: "#2563eb",
          weight: 1,
          fillColor: "#2563eb",
          fillOpacity: 0.12
        }).addTo(MAP);
      } else {
        ACCURACY_CIRCLES[loc.employee_id].setLatLng([loc.latitude, loc.longitude]);
        ACCURACY_CIRCLES[loc.employee_id].setRadius(loc.accuracy);
      }
    }
  }

  // Drop markers for anyone who left the team or has no location on file.
  for (const id of Object.keys(MARKERS)) {
    if (!seen.has(id)) {
      MAP.removeLayer(MARKERS[id]);
      delete MARKERS[id];
      if (ACCURACY_CIRCLES[id]) { MAP.removeLayer(ACCURACY_CIRCLES[id]); delete ACCURACY_CIRCLES[id]; }
    }
  }

  renderLocationsTable();
}

function renderLocationsTable() {
  const body = document.getElementById("locationsBody");
  const empty = document.getElementById("noLocations");
  body.innerHTML = "";

  ensureLocationsSearch();
  const query = (document.getElementById("locationsSearchInput") || {}).value || "";
  const filteredRows = query
    ? LOCATIONS_ROWS.filter(loc => {
        const emp = LOCATIONS_TEAM_BY_ID[loc.employee_id];
        return emp && matchesTableSearch(query, emp.file_number, emp.client_company, emp.role, emp.full_name, emp.department);
      })
    : LOCATIONS_ROWS;

  empty.style.display = filteredRows.length ? "none" : "block";

  for (const loc of filteredRows) {
    const emp = LOCATIONS_TEAM_BY_ID[loc.employee_id];
    if (!emp) continue;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp.full_name}</td>
      <td>${emp.client_company || "—"}</td>
      <td>${timeAgo(loc.updated_at)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-center="${loc.employee_id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }

  body.querySelectorAll("button[data-center]").forEach(btn => {
    btn.addEventListener("click", () => {
      const marker = MARKERS[btn.dataset.center];
      if (marker) {
        MAP.setView(marker.getLatLng(), 15);
        marker.openPopup();
      }
    });
  });
}

(async () => {
  ME = await requireSession("supervisor");
  if (!ME) return;

  document.getElementById("whoami").innerHTML = `${ME.full_name} · #${ME.file_number}<br><span style="opacity:.7">${ME.client_company || ""}</span>`;
  if (ME.role === "admin") document.getElementById("adminLink").style.display = "";
  if (ME.role === "admin") document.getElementById("clientsLink").style.display = "";
  document.getElementById("locationsSub").textContent = ME.role === "admin"
    ? t("staffLocationsSubAdmin")
    : t("staffLocationsSubSupervisor");

  MAP = L.map("map").setView([31.9539, 35.9106], 8); // Amman, Jordan — sane default center

  const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(MAP);

  const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri",
    maxZoom: 19
  });

  L.control.layers({
    [t("mapStreetLabel")]: streetLayer,
    [t("mapSatelliteLabel")]: satelliteLayer
  }).addTo(MAP);

  await refreshLocations();
  setInterval(refreshLocations, REFRESH_INTERVAL_MS);
})();
