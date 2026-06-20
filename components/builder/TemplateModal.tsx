"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUGGESTED_TEMPLATES } from "@/lib/suggested-templates";
import type {
  Block,
  LoadableTemplate,
  SessionTemplate,
  UserTemplateRow,
} from "@/types";

type Tab = "suggested" | "mine";

// Fill the block fields a stored user template intentionally drops.
function rowToLoadable(row: UserTemplateRow): LoadableTemplate {
  const blocks: Omit<Block, "id">[] = (row.blocks || []).map((b) => ({
    type: b.type,
    bpm: b.bpm,
    duration_minutes: b.duration_minutes,
    energy: b.energy,
    song_structure: b.song_structure,
    music_description: "",
    reference_artist: "",
  }));
  return {
    name: row.name,
    discipline: row.discipline,
    total_duration: row.total_duration,
    intensity_level: row.intensity_level,
    genre_preference: row.genre_preference || "",
    blocks,
  };
}

function suggestedToLoadable(t: SessionTemplate): LoadableTemplate {
  return {
    name: t.name,
    discipline: t.discipline,
    total_duration: t.total_duration,
    intensity_level: t.intensity_level,
    genre_preference: t.genre_preference,
    blocks: t.blocks,
  };
}

const badge =
  "rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400";

export function TemplateModal({
  open,
  onClose,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  onUse: (t: LoadableTemplate) => void;
}) {
  const [tab, setTab] = useState<Tab>("suggested");
  const [mine, setMine] = useState<UserTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMine = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("session_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setMine((data as UserTemplateRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchMine();
  }, [open, fetchMine]);

  async function deleteTemplate(id: string) {
    if (!confirm("Eliminare questo template?")) return;
    const supabase = createClient();
    await supabase.from("session_templates").delete().eq("id", id);
    setMine((prev) => prev.filter((t) => t.id !== id));
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-800 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Scegli un template</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mb-5 flex gap-2 rounded-lg bg-zinc-900 p-1">
          <button
            onClick={() => setTab("suggested")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === "suggested"
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ✨ Suggeriti
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === "mine"
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            📁 I miei template
          </button>
        </div>

        {tab === "suggested" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {SUGGESTED_TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-900 p-4"
              >
                <div className="mb-2 text-3xl">{t.emoji}</div>
                <div className="font-semibold text-white">{t.name}</div>
                <div className="mb-3 flex-1 text-xs text-zinc-400">
                  {t.description}
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <span className={badge}>{t.discipline}</span>
                  <span className={badge}>{t.total_duration} min</span>
                  <span className={badge}>{t.blocks.length} blocchi</span>
                </div>
                <button
                  onClick={() => onUse(suggestedToLoadable(t))}
                  className="rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Usa come base
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {loading ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                Caricamento…
              </p>
            ) : mine.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                Nessun template salvato. Crea una sessione e salvala come
                template.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {mine.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3"
                  >
                    <div className="text-2xl">{t.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">
                        {t.name}
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs text-zinc-400">
                        <span>{t.discipline}</span>
                        <span>· {t.total_duration} min</span>
                        <span>
                          ·{" "}
                          {new Date(t.created_at).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onUse(rowToLoadable(t))}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                    >
                      Usa
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
                      aria-label="Elimina template"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
