// Tests the AI pipeline routes that don't need a GROQ key:
//  - /api/spotify/search passthrough (spotify_token null)
//  - /api/generate-playlist body validation + no-key behavior
// Run: node scripts/test-ai-routes.mjs http://localhost:3000
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.argv[2] || "http://localhost:3000";
const hasGroqKey = !!env.GROQ_API_KEY;

let ok = true;
const check = (pass, msg) => { if (!pass) ok = false; console.log(`${pass ? "✓" : "✗"} ${msg}`); };

// Mint auth cookies (middleware guards /api/*).
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: su } = await supabase.auth.signUp({ email: `spinflow-ai-${Date.now()}@gmail.com`, password: "TestPass123!" });
if (!su.session) { console.log("✗ no session (email confirmation must be OFF)"); process.exit(1); }
const captured = [];
const ssr = createServerClient(SUPABASE_URL, KEY, { cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) } });
await ssr.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const cookie = captured.map((c) => `${c.name}=${c.value}`).join("; ");
const headers = { "Content-Type": "application/json", cookie };

// 1. spotify/search passthrough (token null)
const candidate = {
  title: "Strobe", artist: "deadmau5", bpm_target: 128,
  song_structure: "build", structure_reason: "long progressive build",
  energy: "medium", block_type: "Warm-up",
};
const sRes = await fetch(`${BASE}/api/spotify/search`, {
  method: "POST", headers,
  body: JSON.stringify({ candidate: { ...candidate, block_index: 3 }, spotify_token: null }),
});
check(sRes.status === 200, `spotify/search -> ${sRes.status}`);
const song = await sRes.json();
check(song.title === "Strobe" && song.artist === "deadmau5", "passthrough keeps title/artist");
check(song.block_index === 3, "passthrough preserves block_index");
check(song.structure_validated === false, "passthrough structure_validated=false");
check(song.structure_warning === false, "passthrough structure_warning=false");
check(song.bpm_real === undefined || song.bpm_real === null, "passthrough bpm_real undefined");
check(!song.spotify_track_id, "passthrough has no spotify_track_id");
check(song.structure_reason === "long progressive build", "passthrough keeps structure_reason");

// 2. generate-playlist body validation
const badRes = await fetch(`${BASE}/api/generate-playlist`, { method: "POST", headers, body: JSON.stringify({}) });
check(badRes.status === 400, `generate-playlist no session -> ${badRes.status} (expect 400)`);

const emptyBlocks = await fetch(`${BASE}/api/generate-playlist`, {
  method: "POST", headers, body: JSON.stringify({ session: { blocks: [] } }),
});
check(emptyBlocks.status === 400, `generate-playlist empty blocks -> ${emptyBlocks.status} (expect 400)`);

// 3. generate-playlist with a valid session
const session = {
  name: "Test", discipline: "spinning", total_duration: 10, intensity_level: "intermediate",
  genre_preference: "pop", blocks: [
    { id: "x", type: "Warm-up", bpm: 128, duration_minutes: 5, energy: "low", song_structure: "build", music_description: "", reference_artist: "" },
  ],
};
const genRes = await fetch(`${BASE}/api/generate-playlist`, { method: "POST", headers, body: JSON.stringify({ session }) });
if (!hasGroqKey) {
  const j = await genRes.json();
  check(genRes.status === 500 && /GROQ_API_KEY/i.test(j.error || ""), `no-key -> 500 "${j.error}"`);
  console.log("\nℹ️  GROQ_API_KEY empty — skipping live generation. Add the key + restart dev to run it.");
} else {
  const j = await genRes.json();
  check(genRes.status === 200 && Array.isArray(j.candidates), `live generation -> ${genRes.status}, candidates: ${Array.isArray(j.candidates) ? j.candidates.length : "n/a"}`);
  if (Array.isArray(j.candidates) && j.candidates[0]) {
    const c0 = j.candidates[0];
    check(typeof c0.block_index === "number" && Array.isArray(c0.candidates), "candidate item has block_index + candidates[]");
    check(c0.candidates.length >= 1 && !!c0.candidates[0].title, "first candidate has a title");
  }
}

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
