"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type Block,
  type Discipline,
  type Session,
  type TemplateBlock,
  TEMPLATE_EMOJIS,
} from "@/types";

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-600";
const label = "mb-1 block text-xs font-medium text-zinc-400";

// Strip per-session fields (music_description, reference_artist, id) — those
// are re-written each time the template is reused.
function stripBlocks(blocks: Block[]): TemplateBlock[] {
  return blocks.map((b) => ({
    type: b.type,
    bpm: b.bpm,
    duration_minutes: b.duration_minutes,
    energy: b.energy,
    song_structure: b.song_structure,
  }));
}

export function SaveTemplateModal({
  open,
  onClose,
  onSaved,
  sessionName,
  discipline,
  totalDuration,
  intensity,
  genrePreference,
  blocks,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  sessionName: string;
  discipline: Discipline;
  totalDuration: number;
  intensity: Session["intensity_level"];
  genrePreference: string;
  blocks: Block[];
}) {
  const [name, setName] = useState(sessionName);
  const [emoji, setEmoji] = useState(TEMPLATE_EMOJIS[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sessione scaduta, ricarica la pagina.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("session_templates").insert({
      user_id: user.id,
      name: name.trim() || "Template senza nome",
      description: description.trim() || null,
      discipline,
      total_duration: totalDuration,
      intensity_level: intensity,
      genre_preference: genrePreference,
      blocks: stripBlocks(blocks),
      emoji,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Salva come template</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className={label}>Nome template</label>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className={label}>Emoji</label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`rounded-lg border px-3 py-1.5 text-lg transition ${
                  emoji === e
                    ? "border-violet-600 bg-violet-600/20"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className={label}>Descrizione (opzionale)</label>
          <input
            className={field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="es. la mia ride del lunedì"
          />
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? "Salvataggio…" : "Salva template"}
        </button>
      </div>
    </div>
  );
}
