// Full builder pipeline against a real template: RPM Classic 45min.
// generate-playlist -> per-block spotify/search passthrough -> playlist.
// Run: node scripts/test-ai-fullflow.mjs http://localhost:3000
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
const { data: su } = await supabase.auth.signUp({ email: `spinflow-flow-${Date.now()}@gmail.com`, password: "TestPass123!" });
if (!su.session) { console.log("✗ no session"); process.exit(1); }
const captured = [];
const ssr = createServerClient(SUPABASE_URL, KEY, { cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) } });
await ssr.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const cookie = captured.map((c) => `${c.name}=${c.value}`).join("; ");
const headers = { "Content-Type": "application/json", cookie };

// Load RPM Classic 45min as the builder would
const tpl = SUGGESTED_TEMPLATES.find((t) => t.name === "RPM Classic 45min");
const session = {
  name: tpl.name, discipline: tpl.discipline, total_duration: tpl.total_duration,
  intensity_level: tpl.intensity_level, genre_preference: tpl.genre_preference,
  blocks: tpl.blocks.map((b, i) => ({ ...b, id: `b${i}` })),
};
console.log(`\nTemplate: ${tpl.emoji} ${tpl.name} — ${session.blocks.length} blocks\n`);

// Step 1: AI candidates
const t0 = Date.now();
const genRes = await fetch(`${BASE}/api/generate-playlist`, { method: "POST", headers, body: JSON.stringify({ session }) });
check(genRes.status === 200, `generate-playlist -> ${genRes.status} (${Date.now() - t0}ms)`);
const { candidates } = await genRes.json();
check(Array.isArray(candidates) && candidates.length > 0, `AI returned ${candidates?.length} block candidate groups`);
check(candidates.every((c) => Array.isArray(c.candidates) && c.candidates.length >= 1), "every block has >=1 candidate");

// Step 2: per-block spotify/search passthrough (token null)
const ordered = [...candidates].sort((a, b) => a.block_index - b.block_index);
const songs = await Promise.all(ordered.map(async (item) => {
  const best = item.candidates[0];
  const r = await fetch(`${BASE}/api/spotify/search`, {
    method: "POST", headers,
    body: JSON.stringify({ candidate: { ...best, block_index: item.block_index }, spotify_token: null }),
  });
  return r.json();
}));

check(songs.length === candidates.length, `playlist has ${songs.length} songs (one per block group)`);
check(songs.every((s) => s.title && s.artist), "every song has title + artist");
check(songs.every((s) => typeof s.block_index === "number"), "every song has block_index");
check(songs.every((s) => s.structure_validated === false), "all AI-only (structure_validated=false, no Spotify token)");
check(songs.every((s) => !!s.structure_reason), "every song has a structure_reason");

// Show the real playlist
console.log("\n--- AI Playlist ---");
for (const s of songs) {
  console.log(`${String(s.block_index + 1).padStart(2)}. [${s.block_type}] ${s.artist} — ${s.title}  (${s.bpm_target} BPM, ${s.song_structure})`);
}

// Copy-list format check (used by "Copia lista brani")
const copyText = songs.map((s) => `${s.artist} - ${s.title}`).join("\n");
check(copyText.split("\n").length === songs.length, "copy-list format produces one line per song");

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
