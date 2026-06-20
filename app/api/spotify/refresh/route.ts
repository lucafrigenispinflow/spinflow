import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshSpotifyToken } from "@/lib/spotify";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createAdminClient() ?? supabase;
  const { data: profile } = await db
    .from("profiles")
    .select("spotify_refresh_token")
    .eq("id", user.id)
    .single();

  if (!profile?.spotify_refresh_token) {
    return NextResponse.json(
      { error: "Spotify not connected" },
      { status: 400 }
    );
  }

  const refreshed = await refreshSpotifyToken(profile.spotify_refresh_token);
  if (!refreshed?.access_token) {
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }

  const expiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();
  await db
    .from("profiles")
    .update({
      spotify_access_token: refreshed.access_token,
      spotify_token_expires_at: expiresAt,
      ...(refreshed.refresh_token
        ? { spotify_refresh_token: refreshed.refresh_token }
        : {}),
    })
    .eq("id", user.id);

  return NextResponse.json({ access_token: refreshed.access_token });
}
