import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

function basicAuthHeader() {
  const id = process.env.SPOTIFY_CLIENT_ID ?? "";
  const secret = process.env.SPOTIFY_CLIENT_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

/** Exchange an authorization code for tokens. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<SpotifyTokenResponse | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    console.error("[spotify] code exchange failed:", await res.text());
    return null;
  }
  return (await res.json()) as SpotifyTokenResponse;
}

/** Refresh an access token using a refresh token. */
export async function refreshSpotifyToken(
  refreshToken: string
): Promise<SpotifyTokenResponse | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    console.error("[spotify] token refresh failed:", await res.text());
    return null;
  }
  return (await res.json()) as SpotifyTokenResponse;
}

// Service-role client if available, else the authenticated cookie client
// (RLS already scopes a user to their own profile).
async function getDb() {
  return createAdminClient() ?? (await createServerSupabase());
}

/**
 * Returns a valid Spotify access token for the user, refreshing if needed.
 * Returns null if the user has not connected Spotify.
 */
export async function getSpotifyToken(userId: string): Promise<string | null> {
  const db = await getDb();
  const { data: profile } = await db
    .from("profiles")
    .select(
      "spotify_access_token, spotify_refresh_token, spotify_token_expires_at"
    )
    .eq("id", userId)
    .single();

  if (!profile?.spotify_access_token) return null;

  const expiresAt = profile.spotify_token_expires_at
    ? new Date(profile.spotify_token_expires_at).getTime()
    : 0;

  // Still valid (with a 60s safety margin).
  if (Date.now() < expiresAt - 60_000) {
    return profile.spotify_access_token;
  }

  // Expired: refresh.
  if (!profile.spotify_refresh_token) return profile.spotify_access_token;
  const refreshed = await refreshSpotifyToken(profile.spotify_refresh_token);
  if (!refreshed?.access_token) return null;

  const newExpiry = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();
  await db
    .from("profiles")
    .update({
      spotify_access_token: refreshed.access_token,
      spotify_token_expires_at: newExpiry,
      ...(refreshed.refresh_token
        ? { spotify_refresh_token: refreshed.refresh_token }
        : {}),
    })
    .eq("id", userId);

  return refreshed.access_token;
}
