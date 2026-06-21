// E2E for session save/list/get/favorite/delete + library render.
// Run: node scripts/test-sessions-e2e.mjs http://127.0.0.1:3000
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.argv[2] || "http://127.0.0.1:3000";

let ok = true;
const check = (pass, msg) => { if (!pass) ok = false; console.log(`${pass ? "✓" : "✗"} ${msg}`); };

const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: su } = await supabase.auth.signUp({ email: `spinflow-sess-${Date.now()}@gmail.com`, password: "TestPass123!" });
if (!su.session) { console.log("✗ no session"); process.exit(1); }
const captured = [];
const ssr = createServerClient(SUPABASE_URL, KEY, { cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) } });
await ssr.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const cookie = captured.map((c) => `${c.name}=${c.value}`).join("; ");
const H = { "Content-Type": "application/json", cookie };

// unauthenticated POST is blocked by middleware/route
const noAuth = await fetch(`${BASE}/api/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", redirect: "manual" });
check(noAuth.status === 307 || noAuth.status === 401, `unauth POST blocked -> ${noAuth.status}`);

// 1. SAVE
const payload = {
  name: "Test RPM", discipline: "spinning", total_duration: 30,
  intensity_level: "intermediate", genre_preference: "pop",
  blocks: [{ id: "b0", type: "Warm-up", bpm: 128, duration_minutes: 5, energy: "low", song_structure: "build", music_description: "", reference_artist: "" }],
  playlist: [{ block_index: 0, title: "Strobe", artist: "deadmau5", bpm_target: 128, energy: "low", block_type: "Warm-up", song_structure: "build" }],
};
const saveRes = await fetch(`${BASE}/api/sessions`, { method: "POST", headers: H, body: JSON.stringify(payload) });
check(saveRes.status === 201, `POST save -> ${saveRes.status}`);
const saved = await saveRes.json();
check(!!saved.id, "saved session has id");
check(saved.name === "Test RPM", "name persisted");
check(saved.is_favorite === false, "defaults is_favorite=false");
const id = saved.id;

// 2. LIST
const listRes = await fetch(`${BASE}/api/sessions`, { headers: H });
const list = await listRes.json();
check(Array.isArray(list) && list.some((s) => s.id === id), "GET list includes saved session");

// 3. GET single (reopen data)
const oneRes = await fetch(`${BASE}/api/sessions/${id}`, { headers: H });
const one = await oneRes.json();
check(oneRes.status === 200, `GET /[id] -> ${oneRes.status}`);
check(one.blocks?.length === 1 && one.playlist?.length === 1, "single returns blocks + playlist (reopen)");

// 4. TOGGLE favorite
const putRes = await fetch(`${BASE}/api/sessions/${id}`, { method: "PUT", headers: H, body: JSON.stringify({ is_favorite: true }) });
const put = await putRes.json();
check(putRes.status === 200 && put.is_favorite === true, "PUT toggle favorite -> true");

// 5. Library page render contains the session
const lib = await fetch(`${BASE}/library`, { headers: { cookie } });
const libHtml = await lib.text();
check(lib.status === 200, `/library -> ${lib.status}`);
check(libHtml.includes("Test RPM"), "library page shows the saved session");

// 6. DELETE
const delRes = await fetch(`${BASE}/api/sessions/${id}`, { method: "DELETE", headers: H });
check(delRes.status === 200, `DELETE -> ${delRes.status}`);
const after = await (await fetch(`${BASE}/api/sessions`, { headers: H })).json();
check(!after.some((s) => s.id === id), "session gone after delete");

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
