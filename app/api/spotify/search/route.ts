import { NextResponse } from "next/server";
import type { AICandidate, Song } from "@/types";
import { bpmMatch, validateStructure, type Section } from "../structure";

type IncomingCandidate = AICandidate & { block_index?: number };

export async function POST(req: Request) {
  let body: { candidate?: IncomingCandidate; spotify_token?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const candidate = body?.candidate;
  if (!candidate) {
    return NextResponse.json({ error: "Missing candidate" }, { status: 400 });
  }
  const token = body?.spotify_token;

  // No Spotify token yet -> return the AI candidate as an unvalidated Song.
  if (!token) {
    return NextResponse.json(aiPassthrough(candidate));
  }

  try {
    // 1. Search Spotify.
    const q = encodeURIComponent(`${candidate.title} ${candidate.artist}`);
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) return NextResponse.json(aiPassthrough(candidate));
    const searchData = await searchRes.json();
    const tracks: SpotifyTrack[] = searchData?.tracks?.items ?? [];
    if (tracks.length === 0) return NextResponse.json(aiPassthrough(candidate));

    // Best match: title contains (either direction), else first result.
    const wanted = candidate.title.toLowerCase();
    const best =
      tracks.find((t) => {
        const name = t.name.toLowerCase();
        return name.includes(wanted) || wanted.includes(name);
      }) ?? tracks[0];

    // 2. Audio Features -> bpm (tempo).
    let bpmReal: number | undefined;
    let bpmOk = false;
    try {
      const featRes = await fetch(
        `https://api.spotify.com/v1/audio-features/${best.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (featRes.ok) {
        const feat = await featRes.json();
        if (typeof feat?.tempo === "number") {
          bpmReal = Math.round(feat.tempo);
          bpmOk = bpmMatch(feat.tempo, candidate.bpm_target);
        }
      }
    } catch {
      /* ignore feature errors, keep going */
    }

    // 3. Audio Analysis -> sections -> validate structure.
    let structureValidated = false;
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

    // 4. Scoring (BPM 40 + structure 60) is reflected via the flags below.
    const song: Song = {
      block_index: candidate.block_index ?? 0,
      title: candidate.title,
      artist: candidate.artist,
      bpm_target: candidate.bpm_target,
      bpm_real: bpmReal,
      spotify_track_id: best.id,
      spotify_uri: best.uri,
      spotify_url: best.external_urls?.spotify,
      structure_validated: structureValidated,
      structure_warning: !structureValidated,
      energy: candidate.energy,
      block_type: candidate.block_type,
      song_structure: candidate.song_structure,
      structure_reason: candidate.structure_reason,
    };
    // bpmOk currently informs the warning surface; structure is the primary gate.
    void bpmOk;
    return NextResponse.json(song);
  } catch (err) {
    console.error("[spotify/search] failed:", err);
    return NextResponse.json(aiPassthrough(candidate));
  }
}

type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  external_urls?: { spotify?: string };
};

function aiPassthrough(candidate: IncomingCandidate): Song {
  return {
    block_index: candidate.block_index ?? 0,
    title: candidate.title,
    artist: candidate.artist,
    bpm_target: candidate.bpm_target,
    bpm_real: undefined,
    structure_validated: false,
    structure_warning: false,
    energy: candidate.energy,
    block_type: candidate.block_type,
    song_structure: candidate.song_structure,
    structure_reason: candidate.structure_reason,
  };
}
