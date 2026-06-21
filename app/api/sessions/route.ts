import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/sessions — list the current user's sessions (favorites first).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// POST /api/sessions — save a new session.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      name: (body.name as string)?.trim() || "Sessione senza nome",
      discipline: body.discipline ?? null,
      total_duration: body.total_duration ?? null,
      intensity_level: body.intensity_level ?? null,
      genre_preference: body.genre_preference ?? null,
      blocks: body.blocks ?? [],
      playlist: body.playlist ?? [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
