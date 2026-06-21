import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyToken } from "@/lib/spotify";

// GET /api/spotify/token — returns a valid (auto-refreshed) Spotify access
// token for the current user, used client-side to init the Web Playback SDK.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = await getSpotifyToken(user.id);
  if (!token) {
    return NextResponse.json(
      { error: "Spotify not connected" },
      { status: 400 }
    );
  }
  return NextResponse.json({ access_token: token });
}
