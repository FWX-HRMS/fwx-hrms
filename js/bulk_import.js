// ============================================================
// One-time admin tool: bulk-create up to ~250 employee logins
// from a CSV file.
//
// Run this on your OWN computer (never in a browser / never
// committed to the website) because it uses the powerful
// "service_role" key which can bypass all security rules.
//
// Usage:
//   1. npm install
//   2. Copy .env.example to .env and fill in your values
//   3. node bulk_import.js employees.csv
// ============================================================
require("dotenv").config();
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node bulk_import.js <path-to-employees.csv>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const csvText = fs.readFileSync(csvPath, "utf8");
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`Found ${rows.length} rows. Starting import...\n`);

  // file_number -> auth user id, so we can resolve supervisor_file_number later
  const idByFileNumber = {};
  const created = [];

  // Pass 1: create the auth user + employee row (without supervisor yet)
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: row.password,
      email_confirm: true
    });

    if (authErr) {
      console.error(`✗ ${row.file_number} (${row.full_name}): ${authErr.message}`);
      continue;
    }

    idByFileNumber[row.file_number.trim()] = authUser.user.id;

    const { error: empErr } = await supabase.from("employees").insert({
      id: authUser.user.id,
      file_number: row.file_number.trim(),
      email,
      full_name: row.full_name,
      dob: row.dob || null,
      nationality: row.nationality || null,
      hiring_date: row.hiring_date || null,
      department: row.department || null,
      client_company: row.client_company || null,
      education: row.education || null,
      salary: row.salary || null,
      role: row.role || "staff",
      annual_entitlement: row.annual_entitlement || 30
    });

    if (empErr) {
      console.error(`✗ employee row for ${row.file_number}: ${empErr.message}`);
      continue;
    }

    created.push(row);
    console.log(`✓ ${row.file_number} — ${row.full_name}`);
  }

  // Pass 2: now that everyone has an id, link supervisor_id
  console.log(`\nLinking supervisors...`);
  for (const row of created) {
    const supFileNum = (row.supervisor_file_number || "").trim();
    if (!supFileNum) continue;
    const supId = idByFileNumber[supFileNum];
    if (!supId) {
      console.error(`✗ ${row.file_number}: supervisor file_number ${supFileNum} not found in this import`);
      continue;
    }
    const { error } = await supabase
      .from("employees")
      .update({ supervisor_id: supId })
      .eq("id", idByFileNumber[row.file_number.trim()]);
    if (error) console.error(`✗ linking ${row.file_number} → ${supFileNum}: ${error.message}`);
  }

  console.log(`\nDone. ${created.length}/${rows.length} employees created.`);
  console.log(`Tell each employee their file number and initial password (from the CSV) so they can log in.`);
}

main();
