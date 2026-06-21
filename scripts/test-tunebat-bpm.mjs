// Tests getRealBPM (Tunebat) for the RPM Classic songs.
// Run: node scripts/test-tunebat-bpm.mjs
import { getRealBPM } from "../lib/bpm.ts";

const songs = [
  { title: "Uptown Funk", artist: "Mark Ronson", aiBpm: 90 },
  { title: "Happy", artist: "Pharrell Williams", aiBpm: 100 },
  { title: "Pumped Up Kicks", artist: "Foster The People", aiBpm: 128 },
  { title: "Till I Collapse", artist: "Eminem", aiBpm: 110 },
  { title: "On Top of the World", artist: "Imagine Dragons", aiBpm: 120 },
];

console.log("\nTitolo / Artista                         | AI BPM | BPM reale | Match ±10");
console.log("-".repeat(78));
for (const s of songs) {
  const real = await getRealBPM(s.title, s.artist);
  const match =
    real == null ? "n/d" : Math.abs(real - s.aiBpm) <= 10 ? "SÌ" : "NO";
  const label = `${s.title} - ${s.artist}`.padEnd(40);
  console.log(
    `${label} | ${String(s.aiBpm).padStart(6)} | ${String(real ?? "null").padStart(9)} | ${match}`
  );
}
console.log("");
