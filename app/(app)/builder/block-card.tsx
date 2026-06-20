"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type Block,
  type BlockType,
  type EnergyLevel,
  type SongStructure,
  BLOCK_TYPES,
  ENERGY_OPTIONS,
  SONG_STRUCTURE_OPTIONS,
} from "@/types";

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-600";
const label = "mb-1 block text-xs font-medium text-zinc-400";

export function BlockCard({
  block,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  block: Block;
  index: number;
  onChange: (id: string, patch: Partial<Block>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-zinc-700 bg-zinc-800 p-4"
    >
      {/* ROW 5 (top bar): drag handle + index + remove */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab touch-none select-none text-lg text-zinc-500 hover:text-zinc-300 active:cursor-grabbing"
            aria-label="Trascina per riordinare"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <span className="text-xs font-semibold text-zinc-500">
            Blocco {index + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          disabled={!canRemove}
          aria-label="Rimuovi blocco"
          className="rounded-lg px-2 py-1 text-sm text-zinc-500 transition hover:bg-zinc-700 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          🗑
        </button>
      </div>

      {/* ROW 1: type / bpm / duration / energy */}
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={label}>Tipo blocco</label>
          <select
            className={field}
            value={block.type}
            onChange={(e) =>
              onChange(block.id, { type: e.target.value as BlockType })
            }
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>BPM</label>
          <input
            type="number"
            className={field}
            value={block.bpm}
            min={40}
            max={220}
            onChange={(e) =>
              onChange(block.id, { bpm: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label className={label}>Durata (min)</label>
          <input
            type="number"
            className={field}
            value={block.duration_minutes}
            min={0.5}
            step={0.5}
            onChange={(e) =>
              onChange(block.id, {
                duration_minutes: Number(e.target.value),
              })
            }
          />
        </div>
        <div>
          <label className={label}>Energia</label>
          <select
            className={field}
            value={block.energy}
            onChange={(e) =>
              onChange(block.id, { energy: e.target.value as EnergyLevel })
            }
          >
            {ENERGY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ROW 2: song structure */}
      <div className="mb-3">
        <label className={label}>Struttura canzone</label>
        <select
          className={field}
          value={block.song_structure}
          onChange={(e) =>
            onChange(block.id, {
              song_structure: e.target.value as SongStructure,
            })
          }
        >
          {SONG_STRUCTURE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ROW 3: music description (most important) */}
      <div className="mb-3">
        <label className={label}>Descrivi la canzone che vuoi</label>
        <textarea
          rows={3}
          className={`${field} resize-y`}
          value={block.music_description}
          onChange={(e) =>
            onChange(block.id, { music_description: e.target.value })
          }
          placeholder="es. techno melodico tedesco dark euphorico tipo Anyma, oppure hip hop 2000 old school boom bap tipo Jay-Z Blueprint, oppure latin reggaeton sensuale per recovery tipo Bad Bunny slow"
        />
      </div>

      {/* ROW 4: reference artist (style anchor) */}
      <div>
        <label className={label}>Artista di riferimento (opzionale)</label>
        <input
          type="text"
          className={field}
          value={block.reference_artist}
          onChange={(e) =>
            onChange(block.id, { reference_artist: e.target.value })
          }
          placeholder="es. Massano, Drake, Bad Bunny, Daft Punk"
        />
      </div>
    </div>
  );
}
