// Authenticated SSR render check for /builder.
// Run: node scripts/test-builder-render.mjs http://localhost:3000
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
const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ok = true;
const has = (html, needle, msg) => {
  const pass = html.includes(needle);
  if (!pass) ok = false;
  console.log(`${pass ? "✓" : "✗"} ${msg || needle}`);
};

// Auth a throwaway user and mint @supabase/ssr cookies.
const email = `spinflow-render-${Date.now()}@gmail.com`;
const { data: su } = await supabase.auth.signUp({
  email,
  password: "TestPass123!",
});
const session = su.session;
if (!session) {
  console.log("✗ no session (is email confirmation OFF?)");
  process.exit(1);
}
const captured = [];
const ssr = createServerClient(SUPABASE_URL, KEY, {
  cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) },
});
await ssr.auth.setSession({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
});
const cookie = captured.map((c) => `${c.name}=${c.value}`).join("; ");

const res = await fetch(`${BASE}/builder`, { headers: { cookie } });
console.log(`GET /builder authed -> ${res.status}\n`);
const html = await res.text();
ok = res.status === 200 && ok;

has(html, "Session Builder", "page title");
has(html, "Nome sessione", "session name field");
has(html, "Durata totale", "total duration field");
has(html, "Preferenze genere globali", "genre preference field");
has(html, "Struttura canzone", "song structure label");
has(html, "Descrivi la canzone che vuoi", "music description textarea");
has(html, "Artista di riferimento", "reference artist field");
has(html, "+ Aggiungi blocco", "add block button");
has(html, "🎵 Genera Playlist", "generate button");
// all 15 block types present in the type <select>
const blockTypes = ["Warm-up","Jog","Fast Jog","Jump","Climb","Hill","Sprint","Final Sprint","Weight Track","Soul Song","Stretching","Flow","Hold","Restore","Breathwork"];
has(html, "value=\"5\"", "default block duration 5 min");
const missingTypes = blockTypes.filter((t) => !html.includes(`>${t}<`));
console.log(`${missingTypes.length === 0 ? "✓" : "✗"} all 15 block types in select${missingTypes.length ? " (missing: " + missingTypes.join(", ") + ")" : ""}`);
if (missingTypes.length) ok = false;
// all 11 structure labels present
const structs = ["⚡ Energia costante","📈 Crescendo graduale","💥 Climax finale (ultimi 30s)","🎯 Climax a metà","🔊 Build + Drop EDM","🐢💨 Intro lenta + esplosione","🚀 Parte a manetta subito","⛰️⛰️ Due picchi","📉 Scende progressivamente","〰️ Alternanza alto/basso","💓 Burst ripetuti ogni 16 beat"];
const missingStructs = structs.filter((s) => !html.includes(s));
console.log(`${missingStructs.length === 0 ? "✓" : "✗"} all 11 song structures in select${missingStructs.length ? " (missing: " + missingStructs.join(" | ") + ")" : ""}`);
if (missingStructs.length) ok = false;

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exit(ok ? 0 : 1);
