// Verifies: (1) /builder entry screen renders authed, (2) user-template
// DB round-trip (insert -> select -> delete) under RLS.
// Run: node scripts/test-templates-e2e.mjs http://localhost:3000
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.argv[2] || "http://localhost:3000";

let ok = true;
const check = (pass, msg) => { if (!pass) ok = false; console.log(`${pass ? "✓" : "✗"} ${msg}`); };

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Auth a throwaway user
const email = `spinflow-tpl-${Date.now()}@gmail.com`;
const { data: su } = await supabase.auth.signUp({ email, password: "TestPass123!" });
if (!su.session) { console.log("✗ no session (email confirmation must be OFF)"); process.exit(1); }
const userId = su.user.id;

// (1) SSR entry screen
const captured = [];
const ssr = createServerClient(SUPABASE_URL, KEY, {
  cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) },
});
await ssr.auth.setSession({
  access_token: su.session.access_token,
  refresh_token: su.session.refresh_token,
});
const cookie = captured.map((c) => `${c.name}=${c.value}`).join("; ");
const res = await fetch(`${BASE}/builder`, { headers: { cookie } });
const html = await res.text();
check(res.status === 200, `GET /builder authed -> ${res.status}`);
check(html.includes("Scegli un template"), 'entry screen: "Scegli un template" option');
check(html.includes("Inizia da zero"), 'entry screen: "Inizia da zero" option');

// (2) DB round-trip for user templates (STEP 4/5 backend)
const tpl = {
  user_id: userId,
  name: "Test Template",
  description: "round-trip",
  discipline: "spinning",
  total_duration: 30,
  intensity_level: "intermediate",
  genre_preference: "pop",
  blocks: [
    { type: "Warm-up", bpm: 128, duration_minutes: 5, energy: "low", song_structure: "build" },
    { type: "Sprint", bpm: 140, duration_minutes: 3, energy: "high", song_structure: "instant_peak" },
  ],
  emoji: "🔥",
};
const { data: inserted, error: insErr } = await supabase
  .from("session_templates")
  .insert(tpl)
  .select()
  .single();

if (insErr && /does not exist|schema cache|relation/i.test(insErr.message)) {
  console.log(`\n⚠️  TABLE NOT APPLIED YET: ${insErr.message}`);
  console.log("   Apply supabase/migrations/002_templates.sql in the Supabase SQL Editor, then re-run.\n");
  process.exit(2);
}
check(!insErr && !!inserted, `insert template (RLS WITH CHECK) ${insErr ? "(" + insErr.message + ")" : ""}`);
check(inserted?.blocks?.length === 2, "blocks persisted as jsonb (2 blocks)");
check(inserted?.emoji === "🔥", "emoji persisted");

const { data: list } = await supabase
  .from("session_templates")
  .select("*")
  .order("created_at", { ascending: false });
check(!!list?.find((t) => t.id === inserted.id), 'select returns own template (tab "I miei template")');

const { error: delErr } = await supabase
  .from("session_templates")
  .delete()
  .eq("id", inserted.id);
check(!delErr, `delete template ${delErr ? "(" + delErr.message + ")" : ""}`);

const { data: after } = await supabase
  .from("session_templates")
  .select("id")
  .eq("id", inserted.id);
check(after?.length === 0, "template gone after delete");

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
