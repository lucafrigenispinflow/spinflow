// Tests getRealBPM via the Cloudflare Worker. Run: node scripts/test-worker-bpm.mjs
import { getRealBPM } from "../lib/bpm.ts";

const songs = [
  ["Uptown Funk", "Mark Ronson", 90],
  ["Happy", "Pharrell Williams", 100],
  ["Lose Yourself", "Eminem", 110],
  ["Sandstorm", "Darude", 115],
  ["Thunder", "Imagine Dragons", 120],
];

console.log("\nBrano                              | AI BPM | BPM reale | Match ±10");
console.log("-".repeat(70));
for (const [t, a, ai] of songs) {
  const real = await getRealBPM(t, a);
  const match = real == null ? "n/d" : Math.abs(real - ai) <= 10 ? "SÌ" : "NO";
  console.log(
    `${`${t} - ${a}`.padEnd(34)} | ${String(ai).padStart(6)} | ${String(real ?? "null").padStart(9)} | ${match}`
  );
  await new Promise((r) => setTimeout(r, 600));
}
console.log("");
