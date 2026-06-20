import { NextResponse } from "next/server";

const SCOPES = [
  "user-read-private",
  "user-read-email",
  "playlist-modify-public",
  "playlist-modify-private",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

export async function GET() {
  const state = crypto.randomUUID();
  const redirectUri =
    process.env.NEXT_PUBLIC_APP_URL + "/api/spotify/auth/callback";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params}`
  );
  // Persist state for CSRF validation in the callback.
  res.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
