/**
 * End-to-end auth smoke test against the live Supabase project + local dev server.
 * Run AFTER: (1) applying supabase/migrations/001_initial.sql and
 *            (2) disabling "Confirm email" in Supabase Auth settings.
 *
 * Usage: node scripts/test-auth-e2e.mjs [http://localhost:3001]
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

// Minimal .env.local loader
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
const BASE = process.argv[2] || "http://localhost:3001";

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `spinflow-e2e-${Date.now()}@gmail.com`;
const password = "TestPass123!";
const fullName = "E2E Test";
let ok = true;
const log = (pass, msg) => {
  if (!pass) ok = false;
  console.log(`${pass ? "✓" : "✗"} ${msg}`);
};

console.log(`\nSupabase: ${SUPABASE_URL}\nApp: ${BASE}\nUser: ${email}\n`);

// 1. SIGNUP -> must return a session (email confirmation OFF)
const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: fullName } },
});
log(!signUpErr, `signup succeeded ${signUpErr ? "(" + signUpErr.message + ")" : ""}`);
log(!!signUp?.session, "signup returned a session (email confirmation is OFF)");

// 2. PROFILE row auto-created by trigger
if (signUp?.user) {
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, plan")
    .eq("id", signUp.user.id)
    .single();
  log(!profErr && !!profile, `profile row auto-created by trigger ${profErr ? "(" + profErr.message + ")" : ""}`);
  log(profile?.plan === "free", `profile defaults plan='free' (got '${profile?.plan}')`);
}

// 3. SIGN OUT then SIGN IN
await supabase.auth.signOut();
const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  email,
  password,
});
log(!signInErr && !!signIn?.session, `login succeeds & returns session ${signInErr ? "(" + signInErr.message + ")" : ""}`);

// 4. Protected route via middleware (unauthenticated -> redirect to /login)
const res = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
const loc = res.headers.get("location") || "";
log(res.status === 307 && loc.endsWith("/login"), `GET /dashboard unauth -> 307 ${loc}`);

// 5. Authenticated browser flow: encode the REAL @supabase/ssr auth cookies
//    using the library's own encoder, then replay them to the running app.
const captured = [];
const ssr = createServerClient(SUPABASE_URL, KEY, {
  cookies: { getAll: () => [], setAll: (cs) => captured.push(...cs) },
});
await ssr.auth.setSession({
  access_token: signIn.session.access_token,
  refresh_token: signIn.session.refresh_token,
});
const cookieHeader = captured.map((c) => `${c.name}=${c.value}`).join("; ");
log(captured.length > 0, `auth cookies generated (${captured.length})`);

// 5a. Authenticated GET /dashboard -> 200 and shows the user's email
const dash = await fetch(`${BASE}/dashboard`, {
  headers: { cookie: cookieHeader },
  redirect: "manual",
});
const dashHtml = await dash.text();
log(dash.status === 200, `GET /dashboard authed -> ${dash.status}`);
log(dashHtml.includes(email), "dashboard renders the logged-in user's email");
log(dashHtml.includes("Benvenuto in SpinFlow"), 'dashboard shows "Benvenuto in SpinFlow"');

// 5b. Authenticated GET /login -> 307 redirect to /dashboard
const loginRedir = await fetch(`${BASE}/login`, {
  headers: { cookie: cookieHeader },
  redirect: "manual",
});
const loginLoc = loginRedir.headers.get("location") || "";
log(
  loginRedir.status === 307 && loginLoc.endsWith("/dashboard"),
  `GET /login authed -> 307 ${loginLoc}`
);

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME CHECKS FAILED ✗"}\n`);
process.exit(ok ? 0 : 1);
