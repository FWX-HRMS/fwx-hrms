// ============================================================
// FILL THESE IN after you create your Supabase project:
// Supabase Dashboard → Project Settings → API
// ============================================================
const SUPABASE_URL = "https://jmnjnqggsvamnywjpwwq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-iryb9o5jfBkm3erwgR4vQ_qZyUxx1s";

// Employees log in with just their file number. Their real email is only
// used behind the scenes (to sign in, and to send password reset links) —
// looked up via the get_login_email() database function.
async function lookupEmailForFileNumber(fileNumber) {
  const { data, error } = await db.rpc("get_login_email", { p_file_number: fileNumber.trim() });
  if (error || !data) return null;
  return data;
}

// Note: the CDN library itself uses the global name "supabase", so our
// connected client is called "db" instead, to avoid a name clash.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
