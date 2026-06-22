// Regression smoke test: app must not crash with Stripe unconfigured.
// Run: node scripts/test-stripe-smoke.mjs http://127.0.0.1:3000
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

const sb = createClient(SUPA, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: su } = await sb.auth.signUp({ email: `spinflow-stripe-${Date.now()}@gmail.com`, password: "TestPass123!" });
await sb.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const captured = [];
const ssr = createServerClient(SUPA, KEY, { cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) } });
await ssr.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });
const cookie = captured.map((c) => `${c.name}=${c.value}`).join("; ");
const H = { "Content-Type": "application/json", cookie };

// settings page renders (imports lib/stripe.ts) with the Piano section
const set = await fetch(`${BASE}/settings`, { headers: { cookie } });
const html = await set.text();
check(set.status === 200, `/settings -> ${set.status} (no crash)`);
check(html.includes("Piano"), "settings shows Piano section");
check(html.includes("Pro") && html.includes("Studio"), "shows Pro + Studio plans");
check(html.includes("Piano attuale"), "highlights current plan (Free) badge");

// stripe routes return a guarded error, not a module crash
const co = await fetch(`${BASE}/api/stripe/checkout`, { method: "POST", headers: H, body: JSON.stringify({ plan: "pro" }) });
const coj = await co.json().catch(() => ({}));
check(co.status === 500 && /not configured/i.test(coj.error || ""), `checkout unconfigured -> ${co.status} "${coj.error}"`);

const po = await fetch(`${BASE}/api/stripe/portal`, { method: "POST", headers: H });
check(po.status === 500 || po.status === 400, `portal unconfigured -> ${po.status} (guarded)`);

// webhook: excluded from middleware (no redirect), guarded on missing config
const wh = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: "{}", redirect: "manual" });
check(wh.status === 500 || wh.status === 400, `webhook reachable (no auth redirect) -> ${wh.status}`);

console.log(`\n${ok ? "NO REGRESSIONS ✓" : "REGRESSION ✗"}\n`);
process.exitCode = ok ? 0 : 1;
