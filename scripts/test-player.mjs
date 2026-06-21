// Verifies token route, 2nd-candidate BPM fallback, and player SSR presence.
// Run: node scripts/test-player.mjs http://127.0.0.1:3000
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

async function mkUser() {
  const sb = createClient(SUPA, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: su } = await sb.auth.signUp({ email: `spinflow-player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@gmail.com`, password: "TestPass123!" });
  await sb.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
  const captured = [];
  const ssr = createServerClient(SUPA, KEY, { cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) } });
  await ssr.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
  return { sb, user: su.user, cookie: captured.map((c) => `${c.name}=${c.value}`).join("; ") };
}

// --- not-connected user ---
const a = await mkUser();
const Ha = { "Content-Type": "application/json", cookie: a.cookie };

// 1. token route when not connected -> 400
const tok0 = await fetch(`${BASE}/api/spotify/token`, { headers: { cookie: a.cookie } });
check(tok0.status === 400, `token route not-connected -> ${tok0.status} (expect 400)`);

// 2. 2nd-candidate BPM fallback: target 115; cand0=Happy(real~160, no match), cand1=Uptown Funk(real~115, match)
const mk = (title, artist) => ({ title, artist, bpm_target: 115, song_structure: "constant", structure_reason: "x", energy: "medium", block_type: "Jog", block_index: 1 });
const fb = await fetch(`${BASE}/api/spotify/search`, {
  method: "POST", headers: Ha,
  body: JSON.stringify({ candidates: [mk("Happy", "Pharrell Williams"), mk("Uptown Funk", "Mark Ronson")] }),
});
const song = await fb.json();
console.log(`   fallback picked: "${song.title}" bpm_real=${song.bpm_real}`);
check(song.title === "Uptown Funk", "fallback chose the closer-BPM 2nd candidate (Uptown Funk)");
check(song.block_index === 1, "fallback preserves block_index");

// 3. player NOT in SSR when not connected
const dashA = await (await fetch(`${BASE}/dashboard`, { headers: { cookie: a.cookie } })).text();
check(!dashA.includes('aria-label="Play/Pausa"'), "player absent when NOT connected");

// --- connected user (inject fake token) ---
const b = await mkUser();
await b.sb.from("profiles").update({ spotify_access_token: "fake-tok", spotify_token_expires_at: new Date(Date.now() + 3600e3).toISOString() }).eq("id", b.user.id);

// 4. token route returns the token
const tok1 = await fetch(`${BASE}/api/spotify/token`, { headers: { cookie: b.cookie } });
const tok1j = await tok1.json();
check(tok1.status === 200 && tok1j.access_token === "fake-tok", `token route connected -> ${tok1.status} access_token returned`);

// 5. player present in SSR when connected
const dashB = await (await fetch(`${BASE}/dashboard`, { headers: { cookie: b.cookie } })).text();
check(dashB.includes('aria-label="Play/Pausa"'), "player present when connected (controls in SSR)");
check(dashB.includes('aria-label="Volume"'), "player has volume control");

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
