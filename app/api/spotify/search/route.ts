import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { AICandidate, Block, Song } from "@/types";
import { validateStructure, type Section } from "../structure";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyToken } from "@/lib/spotify";
import { getRealBPM, bpmMatches, bpmDistance } from "@/lib/bpm";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type IncomingCandidate = AICandidate & { block_index?: number };

type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  external_urls?: { spotify?: string };
};

// Block requirements used to re-prompt Groq for alternatives.
type BlockContext = {
  type: AICandidate["block_type"];
  energy: AICandidate["energy"];
  song_structure: AICandidate["song_structure"];
  music_description: string;
  reference_artist: string;
};

const MAX_RETRIES = 2;

export async function POST(req: Request) {
  let body: {
    candidate?: IncomingCandidate;
    candidates?: IncomingCandidate[];
    block?: Block;
    genre_preference?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const initial =
    body.candidates ?? (body.candidate ? [body.candidate] : []);
  if (initial.length === 0) {
    return NextResponse.json({ error: "Missing candidate(s)" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const token = user ? await getSpotifyToken(user.id) : null;

  const blockIndex = initial[0].block_index ?? 0;
  const target = initial[0].bpm_target;
  const genre = body.genre_preference ?? "";
  const ctx: BlockContext = {
    type: body.block?.type ?? initial[0].block_type,
    energy: body.block?.energy ?? initial[0].energy,
    song_structure: body.block?.song_structure ?? initial[0].song_structure,
    music_description: body.block?.music_description ?? "",
    reference_artist: body.block?.reference_artist ?? "",
  };

  let pool = initial;
  const tried: string[] = [];
  // Track the closest non-matching candidate as a fallback.
  let fallback: { candidate: IncomingCandidate; bpm: number | null } | null =
    null;

  for (let attempt = 0; ; attempt++) {
    // Resolve real BPM for the current pool (in parallel).
    const resolved = await Promise.all(
      pool.map(async (c) => ({ c, bpm: await getRealBPM(c.title, c.artist) }))
    );

    for (const r of resolved) {
      tried.push(`${r.c.title} - ${r.c.artist}`);
      if (r.bpm != null) {
        const d = bpmDistance(r.bpm, target);
        if (fallback == null || fallback.bpm == null || d < bpmDistance(fallback.bpm, target)) {
          fallback = { candidate: r.c, bpm: r.bpm };
        }
      } else if (fallback == null) {
        fallback = { candidate: r.c, bpm: null };
      }
    }

    // Matching candidates (within ±15 or half/double).
    const matches = resolved.filter(
      (r) => r.bpm != null && bpmMatches(r.bpm, target)
    );
    if (matches.length > 0) {
      matches.sort(
        (a, b) => bpmDistance(a.bpm!, target) - bpmDistance(b.bpm!, target)
      );
      const win = matches[0];
      return NextResponse.json(
        await buildSong(win.c, win.bpm!, token, blockIndex)
      );
    }

    // No match: re-prompt Groq for 2 different songs (up to MAX_RETRIES times).
    if (attempt >= MAX_RETRIES) break;
    const alt = await askGroqForAlternatives(
      ctx,
      target,
      blockIndex,
      genre,
      tried
    );
    if (alt.length === 0) break;
    pool = alt;
  }

  // Exhausted retries: use the best available (closest BPM) with a warning.
  const best = fallback ?? { candidate: initial[0], bpm: null };
  return NextResponse.json(
    await buildSong(best.candidate, best.bpm, token, blockIndex)
  );
}

// Ask Groq for 2 alternative songs whose REAL tempo is near the target.
async function askGroqForAlternatives(
  ctx: BlockContext,
  target: number,
  index: number,
  genre: string,
  tried: string[]
): Promise<IncomingCandidate[]> {
  if (!process.env.GROQ_API_KEY) return [];

  const system = `You are a professional fitness music curator with deep knowledge of real song tempos. Output a raw JSON array ONLY (no markdown, no preamble) of exactly 2 objects:
[{"title":"","artist":"","structure_reason":"brief"}]
CRITICAL: each song's REAL tempo (as known from music databases) MUST be within ±15 BPM of the required BPM, or exactly double/half. Do not suggest songs whose real BPM you know to be far from the target.`;

  const desc = ctx.music_description ? `, description: "${ctx.music_description}"` : "";
  const ref = ctx.reference_artist ? `, sounds like ${ctx.reference_artist}` : "";
  const user = `Block ${index}: type=${ctx.type}, required BPM=${target}, energy=${ctx.energy}, structure=${ctx.song_structure}${desc}${ref}. Genre preference: ${genre || "any"}. The songs you suggested for block ${index} have real BPM too far from target ${target}. Suggest 2 different songs with real BPM closer to ${target}. Avoid these already tried: ${tried.join("; ")}.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 800,
      temperature: 0.8,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseArray(raw);
    if (!parsed) return [];
    return parsed
      .filter((p) => p && typeof p.title === "string" && typeof p.artist === "string")
      .slice(0, 2)
      .map((p) => ({
        title: p.title as string,
        artist: p.artist as string,
        bpm_target: target,
        song_structure: ctx.song_structure,
        energy: ctx.energy,
        block_type: ctx.type,
        structure_reason: (p.structure_reason as string) ?? "",
        block_index: index,
      }));
  } catch (err) {
    console.error("[spotify/search] Groq alternatives failed:", err);
    return [];
  }
}

// Resolve a candidate into a full Song: Spotify lookup (uri/url + best-effort
// structure) when a token is present, with the already-known real BPM.
async function buildSong(
  candidate: IncomingCandidate,
  bpmReal: number | null,
  token: string | null,
  blockIndex: number
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

  return {
    block_index: candidate.block_index ?? blockIndex,
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

// Parse a JSON array, with a fallback that extracts the outermost [ ... ].
function parseArray(text: string): Record<string, unknown>[] | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const attempt = (s: string) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? (v as Record<string, unknown>[]) : null;
    } catch {
      return null;
    }
  };
  const direct = attempt(cleaned);
  if (direct) return direct;
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    return attempt(cleaned.slice(start, end + 1));
  }
  return null;
}
