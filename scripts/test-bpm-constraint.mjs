// Verifies the AI now respects each block's BPM as a hard constraint.
// Loads RPM Classic 45min, generates, and compares every candidate's
// bpm_target to the template block's bpm.
// Run: node scripts/test-bpm-constraint.mjs http://localhost:3000
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import { SUGGESTED_TEMPLATES } from "../lib/suggested-templates.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.argv[2] || "http://localhost:3000";

let ok = true;
const check = (pass, msg) => { if (!pass) ok = false; console.log(`${pass ? "✓" : "✗"} ${msg}`); };

// Auth cookies
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: su } = await supabase.auth.signUp({ email: `spinflow-bpm-${Date.now()}@gmail.com`, password: "TestPass123!" });
if (!su.session) { console.log("✗ no session"); process.exit(1); }
const captured = [];
const ssr = createServerClient(SUPABASE_URL, KEY, { cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) } });
await ssr.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const cookie = captured.map((c) => `${c.name}=${c.value}`).join("; ");
const headers = { "Content-Type": "application/json", cookie };

const tpl = SUGGESTED_TEMPLATES.find((t) => t.name === "RPM Classic 45min");
const session = {
  name: tpl.name, discipline: tpl.discipline, total_duration: tpl.total_duration,
  intensity_level: tpl.intensity_level, genre_preference: tpl.genre_preference,
  blocks: tpl.blocks.map((b, i) => ({ ...b, id: `b${i}` })),
};

const res = await fetch(`${BASE}/api/generate-playlist`, { method: "POST", headers, body: JSON.stringify({ session }) });
check(res.status === 200, `generate-playlist -> ${res.status}`);
const { candidates } = await res.json();
const ordered = [...candidates].sort((a, b) => a.block_index - b.block_index);

// Match rule: exact, or ±10, or half/double (per the mandated bpm_required rule).
const matches = (got, req) =>
  Math.abs(got - req) <= 10 || Math.abs(got * 2 - req) <= 10 || Math.abs(got / 2 - req) <= 10;

console.log("\nblock_index | required | cand1 | cand2 | match");
let exact = 0, total = 0, allWithinRule = true;
for (const item of ordered) {
  const required = tpl.blocks[item.block_index].bpm;
  const c1 = item.candidates[0]?.bpm_target;
  const c2 = item.candidates[1]?.bpm_target;
  const inRule = matches(c1, required) && (c2 === undefined || matches(c2, required));
  if (!inRule) allWithinRule = false;
  if (c1 === required) exact++;
  total++;
  const exactMark = c1 === required ? "EXACT" : inRule ? "in-rule" : "❌ OFF";
  console.log(
    `${String(item.block_index).padStart(11)} | ${String(required).padStart(8)} | ${String(c1).padStart(5)} | ${String(c2 ?? "-").padStart(5)} | ${exactMark}`
  );
}

check(allWithinRule, "every candidate bpm_target respects bpm_required (±10 or half/double)");
check(exact >= Math.ceil(total * 0.7), `majority exactly equal to required (${exact}/${total} exact)`);

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
