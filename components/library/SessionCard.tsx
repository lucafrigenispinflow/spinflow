"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionRow } from "@/types";

export function SessionCard({ session }: { session: SessionRow }) {
  const router = useRouter();
  const [fav, setFav] = useState(session.is_favorite);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    try {
      await fetch(`/api/sessions/${session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: next }),
      });
      router.refresh();
    } catch {
      setFav(!next);
    }
  }

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Eliminare "${session.name}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  const blockCount = session.blocks?.length ?? 0;
  const trackCount = session.playlist?.length ?? 0;

  return (
    <div
      onClick={() => router.push(`/builder?session=${session.id}`)}
      className={`flex cursor-pointer flex-col rounded-xl border border-zinc-700 bg-zinc-800 p-4 transition hover:border-violet-600 ${
        busy ? "opacity-50" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate font-semibold text-white">
          {session.name}
        </h3>
        <button
          onClick={toggleFavorite}
          aria-label="Preferito"
          className="shrink-0 text-lg leading-none"
          title={fav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
        >
          {fav ? "⭐" : "☆"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-400">
          {session.discipline}
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-400">
          {session.total_duration} min
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-400">
          {blockCount} blocchi
        </span>
        {trackCount > 0 && (
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-violet-300">
            {trackCount} brani
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {new Date(session.created_at).toLocaleDateString("it-IT")}
        </span>
        <button
          onClick={remove}
          aria-label="Elimina sessione"
          className="rounded-lg px-2 py-1 text-sm text-zinc-500 transition hover:bg-zinc-700 hover:text-red-400"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
