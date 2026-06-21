"use client";

import { useState } from "react";
import type { Block, Discipline, EnergyLevel, Session, Song } from "@/types";

export type SessionMeta = {
  name: string;
  discipline: Discipline;
  total_duration: number;
  intensity_level: Session["intensity_level"];
  genre_preference: string;
  blocks: Block[];
};

const ENERGY_DOT: Record<EnergyLevel, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

const fieldCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-600";

export function PlaylistDisplay({
  songs,
  session,
  onRegenerate,
  regeneratingIndex,
}: {
  songs: Song[];
  session: SessionMeta;
  onRegenerate: (blockIndex: number) => void;
  regeneratingIndex: number | null;
}) {
  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState(session.name);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<"ok" | "err" | null>(null);

  function openSave() {
    setSaveName(session.name);
    setSaveMsg(null);
    setSaveOpen(true);
  }

  async function saveSession() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...session, name: saveName, playlist: songs }),
      });
      if (!res.ok) throw new Error();
      setSaveMsg("ok");
      setTimeout(() => {
        setSaveOpen(false);
        setSaveMsg(null);
      }, 1200);
    } catch {
      setSaveMsg("err");
    } finally {
      setSaving(false);
    }
  }

  async function copyList() {
    const text = songs.map((s) => `${s.artist} - ${s.title}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable (insecure context) — no-op
    }
  }

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-lg font-bold text-white">
        Playlist generata · {songs.length} brani
      </h2>

      <div className="flex flex-col gap-3">
        {songs.map((song, i) => {
          const regenerating = regeneratingIndex === song.block_index;
          return (
            <div
              key={`${song.block_index}-${i}`}
              className="flex items-center gap-4 rounded-xl border border-zinc-700 bg-zinc-800 p-4"
            >
              {/* Left: block number + type */}
              <div className="flex w-24 shrink-0 flex-col items-center gap-1 text-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                  {song.block_index + 1}
                </span>
                <span className="text-xs text-zinc-400">{song.block_type}</span>
              </div>

              {/* Center: details */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-white">
                  {song.title}
                </div>
                <div className="mb-2 truncate text-sm text-zinc-400">
                  {song.artist}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* BPM: real (Tunebat) or AI target */}
                  {song.bpm_real ? (
                    <span className="rounded-full bg-green-950 px-2 py-0.5 font-medium text-green-400">
                      {song.bpm_real} BPM ✓ BPM reale
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-zinc-400">
                      {song.bpm_target} BPM target
                    </span>
                  )}

                  {/* Structure status (independent of BPM source) */}
                  {song.structure_validated ? (
                    <span className="rounded-full bg-green-950 px-2 py-0.5 font-medium text-green-400">
                      ✓ Struttura validata
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-700 px-2 py-0.5 font-medium text-zinc-300">
                      AI
                    </span>
                  )}
                </div>

                {song.structure_reason && (
                  <p className="mt-1.5 text-xs italic text-zinc-500">
                    {song.structure_reason}
                  </p>
                )}
              </div>

              {/* Right: energy + actions */}
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-lg" title={song.energy}>
                  {ENERGY_DOT[song.energy]}
                </span>
                {song.spotify_url && (
                  <a
                    href={song.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-500"
                  >
                    ▶ Spotify
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onRegenerate(song.block_index)}
                  disabled={regenerating}
                  title="Rigenera questo blocco"
                  className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:border-violet-600 hover:text-white disabled:opacity-50"
                >
                  {regenerating ? "…" : "↺"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={copyList}
          className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-violet-600 hover:text-white"
        >
          {copied ? "✓ Copiato!" : "📋 Copia lista brani"}
        </button>
        <button
          type="button"
          onClick={openSave}
          className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-violet-600 hover:text-white"
        >
          💾 Salva sessione
        </button>
      </div>

      {saveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSaveOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Salva sessione</h3>
              <button
                onClick={() => setSaveOpen(false)}
                className="text-zinc-500 hover:text-white"
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>

            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Nome sessione
            </label>
            <input
              className={fieldCls}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
            />

            {saveMsg === "ok" && (
              <p className="mt-3 rounded-lg bg-green-950 px-3 py-2 text-sm text-green-400">
                ✅ Sessione salvata!
              </p>
            )}
            {saveMsg === "err" && (
              <p className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">
                Errore nel salvataggio. Riprova.
              </p>
            )}

            <button
              onClick={saveSession}
              disabled={saving || saveMsg === "ok"}
              className="mt-4 w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
