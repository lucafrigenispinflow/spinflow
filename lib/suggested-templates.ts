import type {
  Block,
  BlockType,
  EnergyLevel,
  SessionTemplate,
  SongStructure,
} from "@/types";

// Compact block builder. Note: the BlockType enum has no "Recovery" or
// "Cool-down" — those map to Jog / Stretching respectively. The numbers are
// seed BPM values (RPM cadences in some templates) that the user can tweak.
function b(
  type: BlockType,
  bpm: number,
  duration_minutes: number,
  energy: EnergyLevel,
  song_structure: SongStructure,
  music_description = ""
): Omit<Block, "id"> {
  return {
    type,
    bpm,
    duration_minutes,
    energy,
    song_structure,
    music_description,
    reference_artist: "",
  };
}

export const SUGGESTED_TEMPLATES: SessionTemplate[] = [
  {
    id: "suggested-rpm-classic-45",
    name: "RPM Classic 45min",
    description: "Struttura RPM classica: warm-up, salite, sprint e defaticamento.",
    discipline: "spinning",
    total_duration: 45,
    intensity_level: "intermediate",
    genre_preference: "pop, EDM, electronic",
    is_suggested: true,
    emoji: "🚴",
    blocks: [
      b("Warm-up", 128, 5, "low", "build"),
      b("Jog", 90, 5, "medium", "constant"),
      b("Climb", 70, 5, "medium", "build"),
      b("Fast Jog", 100, 5, "high", "constant"),
      b("Hill", 80, 5, "high", "build"),
      b("Sprint", 110, 3, "high", "instant_peak"),
      b("Jog", 75, 3, "low", "descend"), // Recovery
      b("Sprint", 115, 3, "high", "two_peaks"),
      b("Final Sprint", 120, 5, "high", "climax_end"),
      b("Stretching", 60, 6, "low", "descend"), // Cool-down
    ],
  },
  {
    id: "suggested-rpm-endurance-50",
    name: "RPM Endurance 50min",
    description: "Sessione di resistenza con salite lunghe e ritmo sostenuto.",
    discipline: "spinning",
    total_duration: 50,
    intensity_level: "advanced",
    genre_preference: "rock, electronic, motivational",
    is_suggested: true,
    emoji: "🚴",
    blocks: [
      b("Warm-up", 85, 8, "low", "build"),
      b("Jog", 90, 8, "medium", "constant"),
      b("Climb", 75, 10, "high", "wave"),
      b("Hill", 82, 8, "high", "build"),
      b("Sprint", 118, 4, "high", "climax_end"),
      b("Jog", 72, 4, "low", "descend"), // Recovery
      b("Final Sprint", 122, 5, "high", "instant_peak"),
      b("Stretching", 60, 3, "low", "constant"),
    ],
  },
  {
    id: "suggested-ride-vibe-45",
    name: "Ride & Vibe 45min",
    description: "Ride emozionale R&B/soul con soul song e climax studiati.",
    discipline: "spinning",
    total_duration: 45,
    intensity_level: "intermediate",
    genre_preference: "R&B, soul, hip hop, pop",
    is_suggested: true,
    emoji: "💃",
    blocks: [
      b("Warm-up", 128, 5, "low", "build", "R&B groovy warm intro"),
      b("Jog", 120, 5, "medium", "constant", "pop energico femminile"),
      b("Soul Song", 75, 4, "low", "climax_end", "soul emotiva con climax finale"),
      b("Fast Jog", 128, 4, "high", "instant_peak", "hip hop hype"),
      b("Climb", 110, 5, "high", "build", "R&B con crescendo"),
      b("Soul Song", 80, 4, "medium", "slow_intro_explode", "ballad che esplode a metà"),
      b("Sprint", 132, 3, "high", "two_peaks", "pop dance con due drop"),
      b("Soul Song", 70, 5, "low", "descend", "R&B soft per recupero"),
      b("Stretching", 60, 5, "low", "constant", "neo soul o acoustic chill"),
      b("Final Sprint", 135, 5, "high", "climax_end", "brano iconico finale esplosivo"),
    ],
  },
  {
    id: "suggested-ride-vibe-express-30",
    name: "Ride & Vibe Express 30min",
    description: "Versione express del Ride & Vibe per sessioni brevi.",
    discipline: "spinning",
    total_duration: 30,
    intensity_level: "intermediate",
    genre_preference: "pop, R&B, dance",
    is_suggested: true,
    emoji: "💃",
    blocks: [
      b("Warm-up", 125, 4, "low", "build"),
      b("Fast Jog", 128, 5, "medium", "constant"),
      b("Soul Song", 75, 3, "low", "climax_end"),
      b("Sprint", 132, 4, "high", "instant_peak"),
      b("Soul Song", 72, 3, "medium", "slow_intro_explode"),
      b("Final Sprint", 138, 5, "high", "two_peaks"),
      b("Stretching", 60, 3, "low", "descend"),
      b("Stretching", 65, 3, "low", "constant"), // Cool-down
    ],
  },
  {
    id: "suggested-hiit-intervals-30",
    name: "HIIT Intervals 30min",
    description: "Intervalli ad alta intensità: sprint e recuperi alternati.",
    discipline: "hiit",
    total_duration: 30,
    intensity_level: "advanced",
    genre_preference: "electronic, trap, hip hop, EDM",
    is_suggested: true,
    emoji: "⚡",
    blocks: [
      b("Warm-up", 120, 4, "low", "build"),
      b("Sprint", 140, 2, "high", "instant_peak"),
      b("Jog", 85, 1.5, "low", "descend"), // Recovery
      b("Sprint", 140, 2, "high", "instant_peak"),
      b("Jog", 85, 1.5, "low", "descend"), // Recovery
      b("Sprint", 145, 2, "high", "two_peaks"),
      b("Jog", 85, 1.5, "low", "constant"), // Recovery
      b("Sprint", 145, 2, "high", "climax_end"),
      b("Jog", 85, 1.5, "low", "descend"), // Recovery
      b("Final Sprint", 150, 3, "high", "instant_peak"),
      b("Stretching", 70, 4, "low", "descend"), // Cool-down
      b("Stretching", 55, 5, "low", "constant"),
    ],
  },
  {
    id: "suggested-yoga-flow-60",
    name: "Yoga Flow 60min",
    description: "Flusso yoga progressivo con respirazione e restore.",
    discipline: "yoga",
    total_duration: 60,
    intensity_level: "beginner",
    genre_preference: "ambient, world music, acoustic, neo soul",
    is_suggested: true,
    emoji: "🧘",
    blocks: [
      b("Breathwork", 55, 8, "low", "constant", "ambient respirazione guidata"),
      b("Flow", 80, 10, "low", "build", "world music progressiva"),
      b("Flow", 88, 10, "medium", "wave", "indie folk con alternanze"),
      b("Hold", 65, 8, "medium", "constant", "ambient minimalista"),
      b("Flow", 90, 8, "medium", "climax_mid", "neo soul con climax centrale"),
      b("Restore", 55, 8, "low", "descend", "acoustic guitar chill"),
      b("Breathwork", 50, 8, "low", "constant", "ambient finale meditativo"),
    ],
  },
  {
    id: "suggested-pilates-power-45",
    name: "Pilates Power 45min",
    description: "Pilates dinamico con controllo del ritmo e finale forte.",
    discipline: "pilates",
    total_duration: 45,
    intensity_level: "intermediate",
    genre_preference: "pop, electronic, indie dance",
    is_suggested: true,
    emoji: "🔥",
    blocks: [
      b("Warm-up", 100, 6, "low", "build"),
      b("Flow", 105, 8, "medium", "constant", "pop ritmico controllato"),
      b("Hold", 90, 6, "medium", "wave", "electronic con pulsazioni"),
      b("Flow", 108, 8, "high", "build", "indie dance progressivo"),
      b("Hold", 92, 5, "high", "climax_end", "pop con finale forte"),
      b("Restore", 70, 6, "low", "descend", "acoustic soft"),
      b("Stretching", 60, 6, "low", "constant", "ambient chill"),
    ],
  },
];
