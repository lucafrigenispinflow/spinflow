export type Discipline =
  | "spinning"
  | "cycling"
  | "yoga"
  | "pilates"
  | "hiit";

export type BlockType =
  | "Warm-up"
  | "Jog"
  | "Fast Jog"
  | "Jump"
  | "Climb"
  | "Hill"
  | "Sprint"
  | "Final Sprint"
  | "Weight Track"
  | "Soul Song"
  | "Stretching"
  | "Flow"
  | "Hold"
  | "Restore"
  | "Breathwork";

export type EnergyLevel = "low" | "medium" | "high";

export type SongStructure =
  | "constant"
  | "build"
  | "climax_end"
  | "climax_mid"
  | "drop_edm"
  | "slow_intro_explode"
  | "instant_peak"
  | "two_peaks"
  | "descend"
  | "wave"
  | "pulse";

export type Block = {
  id: string;
  type: BlockType;
  bpm: number;
  duration_minutes: number;
  energy: EnergyLevel;
  song_structure: SongStructure;
  music_description: string; // linguaggio naturale libero
  reference_artist: string; // opzionale, "suona come..."
};

export type Session = {
  id?: string;
  name: string;
  discipline: Discipline;
  total_duration: number;
  intensity_level: "beginner" | "intermediate" | "advanced";
  genre_preference: string;
  blocks: Block[];
  playlist?: Song[];
};

export type Song = {
  block_index: number;
  title: string;
  artist: string;
  bpm_target: number;
  bpm_real?: number;
  spotify_track_id?: string;
  spotify_uri?: string;
  spotify_url?: string;
  structure_validated?: boolean;
  structure_warning?: boolean;
  energy: EnergyLevel;
  block_type: BlockType;
  song_structure: SongStructure;
  structure_reason?: string;
};

// A single AI-suggested candidate song (output of the Groq generation route).
export type AICandidate = {
  block_index?: number;
  title: string;
  artist: string;
  bpm_target: number;
  song_structure: SongStructure;
  structure_reason: string;
  energy: EnergyLevel;
  block_type: BlockType;
};

// AI candidates grouped per training block.
export type AIBlockCandidates = {
  block_index: number;
  candidates: AICandidate[];
};

export type SessionTemplate = {
  id: string;
  name: string;
  description: string;
  discipline: Discipline;
  total_duration: number;
  intensity_level: "beginner" | "intermediate" | "advanced";
  genre_preference: string;
  blocks: Omit<Block, "id">[];
  is_suggested: boolean; // true = nostro, false = utente
  emoji: string;
};

// Fields stored for a user template's blocks (music_description and
// reference_artist are intentionally dropped — they are re-written each time).
export type TemplateBlock = Omit<
  Block,
  "id" | "music_description" | "reference_artist"
>;

// A row of the `session_templates` table (user-saved templates).
export type UserTemplateRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  discipline: Discipline;
  total_duration: number;
  intensity_level: Session["intensity_level"];
  genre_preference: string | null;
  blocks: TemplateBlock[];
  emoji: string;
  created_at: string;
};

// The minimal shape the builder needs to load a template into state.
export type LoadableTemplate = {
  name: string;
  discipline: Discipline;
  total_duration: number;
  intensity_level: Session["intensity_level"];
  genre_preference: string;
  blocks: Omit<Block, "id">[];
};

export const TEMPLATE_EMOJIS = ["🚴", "💃", "⚡", "🧘", "🔥", "💪", "🎵"];

// ---- Constants / option tables ----

export const BLOCK_BPM_DEFAULTS: Record<BlockType, number> = {
  "Warm-up": 128,
  Jog: 90,
  "Fast Jog": 100,
  Jump: 130,
  Climb: 70,
  Hill: 80,
  Sprint: 140,
  "Final Sprint": 150,
  "Weight Track": 100,
  "Soul Song": 75,
  Stretching: 60,
  Flow: 90,
  Hold: 60,
  Restore: 50,
  Breathwork: 55,
};

export const BLOCK_TYPES = Object.keys(BLOCK_BPM_DEFAULTS) as BlockType[];

export const DISCIPLINES: Discipline[] = [
  "spinning",
  "cycling",
  "yoga",
  "pilates",
  "hiit",
];

export const INTENSITY_LEVELS: Session["intensity_level"][] = [
  "beginner",
  "intermediate",
  "advanced",
];

export const ENERGY_OPTIONS: { value: EnergyLevel; label: string }[] = [
  { value: "high", label: "🔴 High" },
  { value: "medium", label: "🟡 Medium" },
  { value: "low", label: "🟢 Low" },
];

export const SONG_STRUCTURE_OPTIONS: {
  value: SongStructure;
  label: string;
}[] = [
  { value: "constant", label: "⚡ Energia costante" },
  { value: "build", label: "📈 Crescendo graduale" },
  { value: "climax_end", label: "💥 Climax finale (ultimi 30s)" },
  { value: "climax_mid", label: "🎯 Climax a metà" },
  { value: "drop_edm", label: "🔊 Build + Drop EDM" },
  { value: "slow_intro_explode", label: "🐢💨 Intro lenta + esplosione" },
  { value: "instant_peak", label: "🚀 Parte a manetta subito" },
  { value: "two_peaks", label: "⛰️⛰️ Due picchi" },
  { value: "descend", label: "📉 Scende progressivamente" },
  { value: "wave", label: "〰️ Alternanza alto/basso" },
  { value: "pulse", label: "💓 Burst ripetuti ogni 16 beat" },
];
