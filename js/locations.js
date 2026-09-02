let ME = null;
let MAP = null;
let MARKERS = {};
const REFRESH_INTERVAL_MS = 20000;

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
  const query = db.from("employees").select("id, full_name, client_company").order("full_name");
  const { data, error } = ME.role === "admin"
    ? await query.neq("role", "admin")
    : await query.eq("supervisor_id", ME.id);
  if (error || !data) return {};
  return Object.fromEntries(data.map(e => [e.id, e]));
}

async function refreshLocations() {
  const teamById = await loadTeamById();
  const ids = Object.keys(teamById);

  const body = document.getElementById("locationsBody");
  const empty = document.getElementById("noLocations");
  body.innerHTML = "";

  if (ids.length === 0) {
    empty.style.display = "block";
    return;
  }

  const { data, error } = await db.from("employee_locations").select("*").in("employee_id", ids);
  if (error) { showToast(t("couldNotLoadLocations")); return; }

  empty.style.display = (data && data.length) ? "none" : "block";

  const seen = new Set();
  for (const loc of data || []) {
    const emp = teamById[loc.employee_id];
    if (!emp) continue;
    seen.add(loc.employee_id);

    if (!MARKERS[loc.employee_id]) {
      MARKERS[loc.employee_id] = L.marker([loc.latitude, loc.longitude]).addTo(MAP);
    } else {
      MARKERS[loc.employee_id].setLatLng([loc.latitude, loc.longitude]);
    }
    MARKERS[loc.employee_id].bindPopup(`<strong>${emp.full_name}</strong><br>${timeAgo(loc.updated_at)}`);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp.full_name}</td>
      <td>${emp.client_company || "—"}</td>
      <td>${timeAgo(loc.updated_at)}</td>
      <td><button type="button" class="btn btn-blue btn-sm" data-center="${loc.employee_id}">${t("view")}</button></td>
    `;
    body.appendChild(tr);
  }

  // Drop markers for anyone who left the team or has no location on file.
  for (const id of Object.keys(MARKERS)) {
    if (!seen.has(id)) {
      MAP.removeLayer(MARKERS[id]);
      delete MARKERS[id];
    }
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
