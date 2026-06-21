"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  type Block,
  type Discipline,
  type LoadableTemplate,
  type Session,
  type Song,
  type SessionRow,
  type AIBlockCandidates,
  BLOCK_BPM_DEFAULTS,
  DISCIPLINES,
  INTENSITY_LEVELS,
} from "@/types";
import { BlockCard } from "./block-card";
import { redistributeDurations } from "./logic";
import { TemplateModal } from "@/components/builder/TemplateModal";
import { SaveTemplateModal } from "@/components/builder/SaveTemplateModal";
import { PlaylistDisplay } from "@/components/playlist/PlaylistDisplay";

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-600";
const label = "mb-1 block text-xs font-medium text-zinc-400";

function makeBlock(): Block {
  return {
    id: crypto.randomUUID(),
    type: "Warm-up",
    bpm: BLOCK_BPM_DEFAULTS["Warm-up"],
    duration_minutes: 5,
    energy: "medium",
    song_structure: "constant",
    music_description: "",
    reference_artist: "",
  };
}

export default function BuilderPage() {
  const [name, setName] = useState("Nuova sessione");
  const [discipline, setDiscipline] = useState<Discipline>("spinning");
  const [totalDuration, setTotalDuration] = useState(45);
  const [intensity, setIntensity] =
    useState<Session["intensity_level"]>("intermediate");
  const [genrePreference, setGenrePreference] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]); // empty -> entry screen
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const blocksTotal = blocks.reduce((s, b) => s + b.duration_minutes, 0);
  const started = blocks.length > 0;

  // Reopen a saved session from the library (?session=<id>).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("session");
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) return;
        const s = (await res.json()) as SessionRow;
        setName(s.name);
        setDiscipline(s.discipline);
        setTotalDuration(s.total_duration);
        setIntensity(s.intensity_level);
        setGenrePreference(s.genre_preference ?? "");
        setBlocks(
          (s.blocks ?? []).map((b) => ({
            ...b,
            id: b.id ?? crypto.randomUUID(),
          }))
        );
        setPlaylist(s.playlist ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b, ...patch };
        // Changing the block type resets BPM to its default.
        if (patch.type && patch.type !== b.type) {
          next.bpm = BLOCK_BPM_DEFAULTS[patch.type];
        }
        return next;
      })
    );
  }

  function addBlock() {
    setBlocks((prev) => [...prev, makeBlock()]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) =>
      prev.length > 1 ? prev.filter((b) => b.id !== id) : prev
    );
  }

  // When the total duration changes, scale every block proportionally so the
  // distribution is preserved relative to the new total.
  function handleTotalDurationChange(value: number) {
    setTotalDuration(value);
    if (value <= 0) return;
    setBlocks((prev) => redistributeDurations(prev, value));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function startFromScratch() {
    setName("Nuova sessione");
    setDiscipline("spinning");
    setTotalDuration(5);
    setIntensity("intermediate");
    setGenrePreference("");
    setBlocks([makeBlock()]);
  }

  function loadTemplate(t: LoadableTemplate) {
    setName(t.name);
    setDiscipline(t.discipline);
    setTotalDuration(t.total_duration);
    setIntensity(t.intensity_level);
    setGenrePreference(t.genre_preference);
    setBlocks(t.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })));
    setTemplateModalOpen(false);
  }

  function buildSession(): Session {
    return {
      name,
      discipline,
      total_duration: totalDuration,
      intensity_level: intensity,
      genre_preference: genrePreference,
      blocks,
    };
  }

  // Validate a block's AI candidates against Spotify/BPM. Sends both candidates
  // so the route can fall back to the 2nd when the 1st's BPM doesn't match.
  async function validateCandidate(
    candidates: AIBlockCandidates["candidates"],
    blockIndex: number
  ): Promise<Song> {
    const r = await fetch("/api/spotify/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidates: candidates.map((c) => ({ ...c, block_index: blockIndex })),
        block: blocks[blockIndex],
        genre_preference: genrePreference,
      }),
    });
    return r.json();
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setGenError(null);
    setPlaylist([]);

    try {
      // Step 1: AI candidates.
      const res = await fetch("/api/generate-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: buildSession() }),
      });
      if (!res.ok) throw new Error("Generazione AI fallita");
      const { candidates } = (await res.json()) as {
        candidates: AIBlockCandidates[];
      };

      // Step 2: Spotify validation in parallel (first candidate per block).
      const ordered = [...candidates].sort(
        (a, b) => a.block_index - b.block_index
      );
      const songs = await Promise.all(
        ordered.map((item) =>
          validateCandidate(item.candidates, item.block_index)
        )
      );
      setPlaylist(songs);
    } catch (err) {
      console.error(err);
      setGenError(
        err instanceof Error ? err.message : "Errore nella generazione"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  // Regenerate a single block's song.
  async function regenerateBlock(blockIndex: number) {
    setRegeneratingIndex(blockIndex);
    try {
      const session = buildSession();
      const block = session.blocks[blockIndex];
      if (!block) return;
      const res = await fetch("/api/generate-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: { ...session, blocks: [block] } }),
      });
      if (!res.ok) throw new Error("Rigenerazione fallita");
      const { candidates } = (await res.json()) as {
        candidates: AIBlockCandidates[];
      };
      const cands = candidates[0]?.candidates;
      if (!cands?.length) throw new Error("Nessun candidato");
      const song = await validateCandidate(cands, blockIndex);
      setPlaylist((prev) =>
        prev.map((s) => (s.block_index === blockIndex ? song : s))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setRegeneratingIndex(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <Link href="/dashboard" className="text-lg font-bold">
          Spin<span className="text-violet-600">Flow</span>
        </Link>
        <div className="flex items-center gap-3">
          {started && (
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-violet-600 hover:text-white"
            >
              📋 Scegli template
            </button>
          )}
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {!started ? (
        /* ENTRY POINT */
        <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center">
          <h1 className="mb-2 text-2xl font-bold">Crea una nuova sessione</h1>
          <p className="mb-10 text-sm text-zinc-400">
            Parti da un template pronto o costruisci la tua sessione da zero.
          </p>
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <button
              onClick={() => setTemplateModalOpen(true)}
              className="rounded-2xl border border-zinc-700 bg-zinc-800 p-8 transition hover:border-violet-600"
            >
              <div className="mb-3 text-4xl">✨</div>
              <div className="font-semibold">Scegli un template</div>
              <div className="mt-1 text-xs text-zinc-400">
                7 template pronti per spinning, yoga, HIIT e altro
              </div>
            </button>
            <button
              onClick={startFromScratch}
              className="rounded-2xl border border-zinc-700 bg-zinc-800 p-8 transition hover:border-violet-600"
            >
              <div className="mb-3 text-4xl">➕</div>
              <div className="font-semibold">Inizia da zero</div>
              <div className="mt-1 text-xs text-zinc-400">
                Costruisci la sessione blocco per blocco
              </div>
            </button>
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="mb-1 text-2xl font-bold">Session Builder</h1>
          <p className="mb-6 text-sm text-zinc-400">
            Costruisci la sessione a blocchi: ogni blocco ha requisiti musicali
            precisi.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* LEFT: session header form */}
            <section className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  Dettagli sessione
                </h2>

                <div className="mb-4">
                  <label className={label}>Nome sessione</label>
                  <input
                    className={field}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="es. Spinning del lunedì"
                  />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Disciplina</label>
                    <select
                      className={field}
                      value={discipline}
                      onChange={(e) =>
                        setDiscipline(e.target.value as Discipline)
                      }
                    >
                      {DISCIPLINES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Intensità</label>
                    <select
                      className={field}
                      value={intensity}
                      onChange={(e) =>
                        setIntensity(
                          e.target.value as Session["intensity_level"]
                        )
                      }
                    >
                      {INTENSITY_LEVELS.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className={label}>
                    Durata totale (min){" "}
                    <span className="text-zinc-600">
                      · blocchi: {blocksTotal} min
                    </span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    className={field}
                    value={totalDuration}
                    onChange={(e) =>
                      handleTotalDurationChange(Number(e.target.value))
                    }
                  />
                </div>

                <div>
                  <label className={label}>Preferenze genere globali</label>
                  <input
                    className={field}
                    value={genrePreference}
                    onChange={(e) => setGenrePreference(e.target.value)}
                    placeholder="es. niente EDM, prevalenza anni 90"
                  />
                </div>
              </div>
            </section>

            {/* RIGHT: blocks list */}
            <section>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={blocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-4">
                    {blocks.map((block, index) => (
                      <BlockCard
                        key={block.id}
                        block={block}
                        index={index}
                        onChange={updateBlock}
                        onRemove={removeBlock}
                        canRemove={blocks.length > 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                type="button"
                onClick={addBlock}
                className="mt-4 w-full rounded-xl border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-400 transition hover:border-violet-600 hover:text-violet-400"
              >
                + Aggiungi blocco
              </button>
            </section>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setSaveModalOpen(true)}
              className="rounded-xl border border-zinc-700 px-5 py-4 text-sm font-semibold text-zinc-200 transition hover:border-violet-600 hover:text-white sm:w-auto"
            >
              📋 Salva come template
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 rounded-xl bg-violet-600 py-4 text-base font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "⏳ Generazione in corso..." : "🎵 Genera Playlist"}
            </button>
          </div>

          {genError && (
            <p className="mt-4 rounded-lg bg-red-950 px-4 py-3 text-sm text-red-400">
              {genError}
            </p>
          )}

          {isGenerating && (
            <div className="mt-8 flex flex-col gap-3">
              {blocks.map((b) => (
                <div
                  key={b.id}
                  className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-800/50"
                />
              ))}
            </div>
          )}

          {!isGenerating && playlist.length > 0 && (
            <PlaylistDisplay
              songs={playlist}
              session={buildSession()}
              onRegenerate={regenerateBlock}
              regeneratingIndex={regeneratingIndex}
            />
          )}
        </main>
      )}

      {templateModalOpen && (
        <TemplateModal
          open
          onClose={() => setTemplateModalOpen(false)}
          onUse={loadTemplate}
        />
      )}

      {saveModalOpen && (
        <SaveTemplateModal
          open
          onClose={() => setSaveModalOpen(false)}
          sessionName={name}
          discipline={discipline}
          totalDuration={totalDuration}
          intensity={intensity}
          genrePreference={genrePreference}
          blocks={blocks}
        />
      )}
    </div>
  );
}
