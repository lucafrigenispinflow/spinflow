// Tests getRealBPM (GetSongBPM). Loads GETSONGBPM_API_KEY from .env.local.
// Run: node scripts/test-getsongbpm.mjs
import { readFileSync } from "node:fs";

// Load .env.local into process.env so lib/bpm.ts sees the key.
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

if (!process.env.GETSONGBPM_API_KEY) {
  console.log("\n⚠️  GETSONGBPM_API_KEY è vuoto in .env.local — aggiungi la chiave e rilancia.\n");
  process.exit(2);
}

const { getRealBPM } = await import("../lib/bpm.ts");

const songs = [
  ["Uptown Funk", "Mark Ronson"],
  ["Happy", "Pharrell Williams"],
  ["Lose Yourself", "Eminem"],
  ["Sandstorm", "Darude"],
  ["Thunder", "Imagine Dragons"],
];

console.log("\nBrano                              | BPM reale (GetSongBPM)");
console.log("-".repeat(60));
for (const [t, a] of songs) {
  const bpm = await getRealBPM(t, a);
  console.log(`${`${t} - ${a}`.padEnd(34)} | ${bpm ?? "null"}`);
  await new Promise((r) => setTimeout(r, 500));
}
console.log("");
