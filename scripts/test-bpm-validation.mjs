// Tests server-side BPM validation + Groq re-prompt loop in /api/spotify/search.
// Run: node scripts/test-bpm-validation.mjs http://127.0.0.1:3000
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.argv[2] || "http://127.0.0.1:3000";

let ok = true;
const check = (p, m) => { if (!p) ok = false; console.log(`${p ? "✓" : "✗"} ${m}`); };
const dist = (real, t) => Math.min(Math.abs(real - t), Math.abs(real * 2 - t), Math.abs(real / 2 - t));
const matches = (real, t) => dist(real, t) <= 15;

const sb = createClient(SUPA, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: su } = await sb.auth.signUp({ email: `spinflow-bpmv-${Date.now()}@gmail.com`, password: "TestPass123!" });
await sb.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const captured = [];
const ssr = createServerClient(SUPA, KEY, { cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) } });
await ssr.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const H = { "Content-Type": "application/json", cookie: captured.map((c) => `${c.name}=${c.value}`).join("; ") };

const cand = (title, artist, target) => ({ title, artist, bpm_target: target, song_structure: "constant", structure_reason: "x", energy: "medium", block_type: "Jog", block_index: 2 });
const block = (target) => ({ id: "b", type: "Jog", bpm: target, duration_minutes: 5, energy: "medium", song_structure: "constant", music_description: "upbeat pop", reference_artist: "" });

async function run(label, candidates, target) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/spotify/search`, { method: "POST", headers: H, body: JSON.stringify({ candidates, block: block(target), genre_preference: "pop" }) });
  const s = await res.json();
  const m = s.bpm_real != null ? (matches(s.bpm_real, target) ? "✓ MATCH" : "✗ mismatch") : "no bpm";
  console.log(`\n[${label}] target=${target} (${Date.now() - t0}ms)`);
  console.log(`   → "${s.title}" by ${s.artist} | bpm_real=${s.bpm_real ?? "null"} | ${m}`);
  return s;
}

// A) Immediate match: Uptown Funk has real ~115 == target 115
const a = await run("immediate-match", [cand("Happy", "Pharrell Williams", 115), cand("Uptown Funk", "Mark Ronson", 115)], 115);
check(a.title === "Uptown Funk" && a.bpm_real != null && matches(a.bpm_real, 115), "A: returns matching candidate (green)");
check(a.block_index === 2, "A: preserves block_index");

// B) No match -> Groq re-prompt. Both originals are ~60 BPM, target 128.
const b = await run("retry-reprompt", [cand("Weightless", "Marconi Union", 128), cand("River Flows in You", "Yiruma", 128)], 128);
check(!!b.title && typeof b.block_index === "number", "B: returns a valid Song after retries");
if (b.bpm_real != null && matches(b.bpm_real, 128)) {
  console.log("   → re-prompt FOUND a matching song (green) ✓");
} else {
  console.log("   → re-prompt did not reach a match; using best available (yellow). Real BPM:", b.bpm_real);
}
check(b.bpm_real == null || b.bpm_real !== 60, "B: did not just keep the far-off ~60 BPM original");

console.log(`\n${ok ? "ALL STRUCTURAL CHECKS PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
