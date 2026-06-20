// Tests Spotify OAuth wiring that doesn't need the client secret / a real
// authorization: the authorize redirect, CSRF state rejection, refresh/search
// behavior when not connected, settings + header badge render.
// Run: node scripts/test-spotify-oauth.mjs http://localhost:3000
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
const APP_URL = env.NEXT_PUBLIC_APP_URL;
const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
const BASE = process.argv[2] || "http://localhost:3000";

let ok = true;
const check = (pass, msg) => { if (!pass) ok = false; console.log(`${pass ? "✓" : "✗"} ${msg}`); };

// Auth cookies (middleware guards /api/*)
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: su } = await supabase.auth.signUp({ email: `spinflow-oauth-${Date.now()}@gmail.com`, password: "TestPass123!" });
if (!su.session) { console.log("✗ no session"); process.exit(1); }
const captured = [];
const ssr = createServerClient(SUPABASE_URL, KEY, { cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) } });
await ssr.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const cookie = captured.map((c) => `${c.name}=${c.value}`).join("; ");
const headers = { cookie };

// 1. /api/spotify/auth -> redirect to Spotify authorize with correct params
const authRes = await fetch(`${BASE}/api/spotify/auth`, { headers, redirect: "manual" });
check(authRes.status === 307 || authRes.status === 302, `/api/spotify/auth -> ${authRes.status} (redirect)`);
const loc = authRes.headers.get("location") || "";
check(loc.startsWith("https://accounts.spotify.com/authorize"), "redirects to accounts.spotify.com/authorize");
const u = new URL(loc);
check(u.searchParams.get("client_id") === CLIENT_ID, "client_id matches env");
check(u.searchParams.get("response_type") === "code", "response_type=code");
check(u.searchParams.get("redirect_uri") === `${APP_URL}/api/spotify/auth/callback`, "redirect_uri correct");
const scope = u.searchParams.get("scope") || "";
const wantScopes = ["user-read-private","user-read-email","playlist-modify-public","playlist-modify-private","streaming","user-read-playback-state","user-modify-playback-state"];
check(wantScopes.every((s) => scope.includes(s)), `all ${wantScopes.length} scopes present`);
check(!!u.searchParams.get("state"), "state param present");
const setCookie = authRes.headers.get("set-cookie") || "";
check(/spotify_oauth_state=/.test(setCookie), "state cookie set (CSRF)");

// 2. callback with mismatched/absent state -> redirect to settings?spotify=error
const cbRes = await fetch(`${BASE}/api/spotify/auth/callback?code=fake&state=mismatch`, { headers, redirect: "manual" });
const cbLoc = cbRes.headers.get("location") || "";
check(cbLoc.includes("/settings?spotify=error"), `callback bad state -> ${cbLoc}`);

// 3. refresh route when not connected -> 400
const refRes = await fetch(`${BASE}/api/spotify/refresh`, { method: "POST", headers });
const refJson = await refRes.json().catch(() => ({}));
check(refRes.status === 400, `refresh not-connected -> ${refRes.status} (${refJson.error || ""})`);

// 4. search still works (not connected -> AI passthrough), no spotify_token in body
const sRes = await fetch(`${BASE}/api/spotify/search`, {
  method: "POST", headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ candidate: { title: "Strobe", artist: "deadmau5", bpm_target: 128, song_structure: "build", structure_reason: "x", energy: "medium", block_type: "Warm-up", block_index: 2 } }),
});
const song = await sRes.json();
check(sRes.status === 200 && song.title === "Strobe", `search -> ${sRes.status}`);
check(song.structure_validated === false && !song.spotify_track_id, "not connected -> AI passthrough (no Spotify data)");
check(song.block_index === 2, "passthrough preserves block_index");

// 5. settings page render (not connected)
const setRes = await fetch(`${BASE}/settings`, { headers });
const setHtml = await setRes.text();
check(setRes.status === 200, `/settings -> ${setRes.status}`);
check(setHtml.includes("Connessione Spotify"), "settings: 'Connessione Spotify' section");
check(setHtml.includes("Connetti Spotify"), "settings: 'Connetti Spotify' button (not connected)");
check(setHtml.includes("/api/spotify/auth"), "settings: connect button links to /api/spotify/auth");

// 6. header badge (in (app) layout) shows 'Connetti Spotify' when not connected
check(setHtml.includes("Connetti Spotify"), "header badge present (not-connected state)");

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
