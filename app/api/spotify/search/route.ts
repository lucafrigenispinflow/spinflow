import { NextResponse } from "next/server";
import type { AICandidate, Song } from "@/types";
import { validateStructure, type Section } from "../structure";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyToken } from "@/lib/spotify";
import { getRealBPM, bpmMatches, bpmDistance } from "@/lib/bpm";

type IncomingCandidate = AICandidate & { block_index?: number };

type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  external_urls?: { spotify?: string };
};

export async function POST(req: Request) {
  let body: { candidate?: IncomingCandidate; candidates?: IncomingCandidate[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept either a single candidate or an array (to try a fallback).
  const candidates =
    body.candidates ?? (body.candidate ? [body.candidate] : []);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "Missing candidate(s)" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const token = user ? await getSpotifyToken(user.id) : null;

  // Resolve the first candidate; if its BPM doesn't match, try the second and
  // keep whichever real BPM is closest to the target.
  const first = await resolveSong(candidates[0], token);
  if (first.bpm_real != null && bpmMatches(first.bpm_real, first.bpm_target)) {
    return NextResponse.json(first);
  }
  if (candidates[1]) {
    const second = await resolveSong(candidates[1], token);
    const fd =
      first.bpm_real != null
        ? bpmDistance(first.bpm_real, first.bpm_target)
        : Infinity;
    const sd =
      second.bpm_real != null
        ? bpmDistance(second.bpm_real, second.bpm_target)
        : Infinity;
    return NextResponse.json(sd < fd ? second : first);
  }
  return NextResponse.json(first);
}

// Resolve one AI candidate into a Song: Spotify lookup (id/uri/url + best-effort
// structure) when a token is present, plus real BPM via Tunebat (Worker).
async function resolveSong(
  candidate: IncomingCandidate,
  token: string | null
): Promise<Song> {
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

  const bpmReal = await getRealBPM(candidate.title, candidate.artist);

  return {
    block_index: candidate.block_index ?? 0,
    title: candidate.title,
    artist: candidate.artist,
    bpm_target: candidate.bpm_target,
    bpm_real: bpmReal ?? undefined,
    spotify_track_id: spotifyTrackId,
    spotify_uri: spotifyUri,
    spotify_url: spotifyUrl,
    structure_validated: structureValidated,
    structure_warning: !!spotifyTrackId && !structureValidated,
    energy: candidate.energy,
    block_type: candidate.block_type,
    song_structure: candidate.song_structure,
    structure_reason: candidate.structure_reason,
  };
}
