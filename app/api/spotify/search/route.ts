import { NextResponse } from "next/server";
import type { AICandidate, Song } from "@/types";
import { validateStructure, type Section } from "../structure";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyToken } from "@/lib/spotify";
import { getRealBPM } from "@/lib/bpm";

type IncomingCandidate = AICandidate & { block_index?: number };

type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  external_urls?: { spotify?: string };
};

export async function POST(req: Request) {
  let body: { candidate?: IncomingCandidate };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const candidate = body?.candidate;
  if (!candidate) {
    return NextResponse.json({ error: "Missing candidate" }, { status: 400 });
  }

  // Optional Spotify token (for track id/uri/url + best-effort structure).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const token = user ? await getSpotifyToken(user.id) : null;

  let spotifyTrackId: string | undefined;
  let spotifyUri: string | undefined;
  let spotifyUrl: string | undefined;
  let structureValidated = false;

  if (token) {
    try {
      const q = encodeURIComponent(`${candidate.title} ${candidate.artist}`);
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const tracks: SpotifyTrack[] = searchData?.tracks?.items ?? [];
        if (tracks.length > 0) {
          const wanted = candidate.title.toLowerCase();
          const best =
            tracks.find((t) => {
              const name = t.name.toLowerCase();
              return name.includes(wanted) || wanted.includes(name);
            }) ?? tracks[0];
          spotifyTrackId = best.id;
          spotifyUri = best.uri;
          spotifyUrl = best.external_urls?.spotify;

          // Best-effort structure validation. Spotify deprecated
          // audio-analysis for newer apps -> usually 403, handled gracefully.
          try {
            const analysisRes = await fetch(
              `https://api.spotify.com/v1/audio-analysis/${best.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (analysisRes.ok) {
              const analysis = await analysisRes.json();
              const sections: Section[] = analysis?.sections ?? [];
              const duration: number =
                analysis?.track?.duration ?? best.duration_ms / 1000;
              structureValidated = validateStructure(
                sections,
                candidate.song_structure,
                duration
              );
            }
          } catch {
            /* ignore analysis errors */
          }
        }
      }
    } catch (err) {
      console.error("[spotify/search] Spotify lookup failed:", err);
    }
  }

  // Real BPM via GetSongBPM (independent of Spotify; null if no key / not found).
  const bpmReal = await getRealBPM(candidate.title, candidate.artist);

  const song: Song = {
    block_index: candidate.block_index ?? 0,
    title: candidate.title,
    artist: candidate.artist,
    bpm_target: candidate.bpm_target,
    bpm_real: bpmReal ?? undefined,
    spotify_track_id: spotifyTrackId,
    spotify_uri: spotifyUri,
    spotify_url: spotifyUrl,
    structure_validated: structureValidated,
    // Only surface a structure "warning" when we actually had Spotify data.
    structure_warning: !!spotifyTrackId && !structureValidated,
    energy: candidate.energy,
    block_type: candidate.block_type,
    song_structure: candidate.song_structure,
    structure_reason: candidate.structure_reason,
  };

  return NextResponse.json(song);
}
