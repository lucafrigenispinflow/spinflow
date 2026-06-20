import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForToken } from "@/lib/spotify";

export async function GET(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("spotify_oauth_state")?.value;

  const fail = () =>
    NextResponse.redirect(`${appUrl}/settings?spotify=error`);

  if (oauthError || !code) return fail();
  // CSRF: state must match the cookie set when starting the flow.
  if (!state || !savedState || state !== savedState) return fail();

  // 1. Exchange code for tokens.
  const redirectUri = `${appUrl}/api/spotify/auth/callback`;
  const token = await exchangeCodeForToken(code, redirectUri);
  if (!token?.access_token) return fail();

  // Identify the logged-in SpinFlow user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  // 2. Persist tokens (service-role if available, else authenticated client).
  const expiresAt = new Date(
    Date.now() + token.expires_in * 1000
  ).toISOString();
  const db = createAdminClient() ?? supabase;
  const { error } = await db
    .from("profiles")
    .update({
      spotify_access_token: token.access_token,
      spotify_refresh_token: token.refresh_token ?? null,
      spotify_token_expires_at: expiresAt,
    })
    .eq("id", user.id);
  if (error) {
    console.error("[spotify/callback] failed to save tokens:", error.message);
    return fail();
  }

  // 3. Redirect back to settings, clearing the state cookie.
  const res = NextResponse.redirect(`${appUrl}/settings?spotify=connected`);
  res.cookies.delete("spotify_oauth_state");
  return res;
}
