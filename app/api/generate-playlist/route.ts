import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { Session } from "@/types";
import { createClient } from "@/lib/supabase/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a professional fitness music curator and session choreographer with deep knowledge of Spotify's entire catalog — mainstream, underground, international, all decades 1960–2024, all genres: pop, EDM, techno, melodic techno, trance, electronic, hip hop (old school, trap, drill, boom bap), R&B, latin, reggaeton, rock, indie, house, afrobeat, italian, french, spanish music and more.

For each training block you receive, suggest 2 candidate songs.

CRITICAL rules:
- CRITICAL BPM RULE: The song you suggest MUST have a real tempo (as known from music databases) within ±15 BPM of bpm_required, OR exactly double/half. If you are not confident the real BPM matches, choose a different song. Never suggest a song whose real BPM you know to be far from bpm_required.
- bpm_required is MANDATORY — the song tempo must be within ±10 BPM of this value, or exactly half/double. This is not a suggestion. If you cannot find a song matching the bpm_required, pick the closest possible and flag it. Never invent a BPM — always respect bpm_required.
- song_structure is the most important requirement:
  'constant' = steady energy throughout
  'build' = gradual crescendo start to end
  'climax_end' = energy peaks in final 20-30 seconds
  'climax_mid' = drop/peak at midpoint
  'drop_edm' = progressive build → silence → explosive drop
  'slow_intro_explode' = quiet first half, explosive second
  'instant_peak' = starts at maximum energy immediately
  'two_peaks' = two distinct energy spikes
  'descend' = starts high, gradually winds down
  'wave' = alternating high/low throughout
  'pulse' = brief energy bursts every 16 beats
- music_description is the style anchor — honor it precisely
- reference_artist means the song must sound similar to that artist
- genre_preference at session level = global style constraint
- Vary artists across blocks — no two consecutive songs from same artist
- Prioritize well-known songs where the structural characteristic is recognizable and verifiable

Output: raw JSON array ONLY. No markdown. No explanation. No backticks. No preamble.

[
  {
    "block_index": 0,
    "candidates": [
      {
        "title": "Song Title",
        "artist": "Artist Name",
        "bpm_target": 128,
        "song_structure": "constant",
        "structure_reason": "brief note why this matches",
        "energy": "medium",
        "block_type": "Warm-up"
      },
      {
        "title": "Song Title 2",
        "artist": "Artist Name 2",
        "bpm_target": 128,
        "song_structure": "constant",
        "structure_reason": "brief note why this matches",
        "energy": "medium",
        "block_type": "Warm-up"
      }
    ]
  }
]`;

export async function POST(req: Request) {
  let body: { session?: Session };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 1. Validate the request body contains a session with blocks.
  const session = body?.session;
  if (!session || !Array.isArray(session.blocks) || session.blocks.length === 0) {
    return NextResponse.json(
      { error: "Missing session.blocks" },
      { status: 400 }
    );
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured" },
      { status: 500 }
    );
  }

  // --- Plan enforcement (monthly session quota for free users) ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, sessions_this_month, month_reset_at")
    .eq("id", user.id)
    .single();

  const now = new Date();
  const reset = profile?.month_reset_at ? new Date(profile.month_reset_at) : null;
  const sameMonth =
    !!reset &&
    reset.getUTCFullYear() === now.getUTCFullYear() &&
    reset.getUTCMonth() === now.getUTCMonth();
  // A new month resets the counter to 0.
  const usedThisMonth = sameMonth ? profile?.sessions_this_month ?? 0 : 0;
  const plan = profile?.plan ?? "free";

  if (plan === "free" && usedThisMonth >= 5) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message:
          "Hai raggiunto il limite di 5 sessioni mensili. Upgrada a Pro per sessioni illimitate.",
      },
      { status: 403 }
    );
  }

  // Echo each block's bpm as an explicit, mandatory `bpm_required` field so
  // the model treats it as a hard constraint rather than a hint.
  const sessionForPrompt = {
    ...session,
    blocks: session.blocks.map((b) => ({ ...b, bpm_required: b.bpm })),
  };

  let raw = "";
  try {
    // 2. Call Groq.
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Genera playlist per questa sessione: ${JSON.stringify(
            sessionForPrompt
          )}`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[generate-playlist] Groq request failed:", err);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 }
    );
  }

  // 3. Parse: strip backticks / ```json fences, then JSON.parse.
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const parsed = tryParseArray(cleaned);

  // 4. If parse fails: log the raw text and return 500.
  if (!parsed) {
    console.error("[generate-playlist] Failed to parse AI output. Raw:\n", raw);
    return NextResponse.json(
      { error: "Failed to parse AI output" },
      { status: 500 }
    );
  }

  // Count this successful generation against the monthly quota (and reset the
  // window if we rolled into a new month).
  await supabase
    .from("profiles")
    .update({
      sessions_this_month: usedThisMonth + 1,
      month_reset_at: sameMonth
        ? profile?.month_reset_at ?? now.toISOString()
        : now.toISOString(),
    })
    .eq("id", user.id);

  // 5. Return candidates.
  return NextResponse.json({ candidates: parsed });
}

// Parse a JSON array, with a fallback that extracts the outermost [ ... ].
function tryParseArray(text: string): unknown[] | null {
  const attempt = (s: string): unknown[] | null => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const direct = attempt(text);
  if (direct) return direct;

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    return attempt(text.slice(start, end + 1));
  }
  return null;
}
