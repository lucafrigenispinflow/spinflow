// Validate suggested-templates data integrity.
// Run: node scripts/test-templates.mjs
import { SUGGESTED_TEMPLATES } from "../lib/suggested-templates.ts";

const BLOCK_TYPES = ["Warm-up","Jog","Fast Jog","Jump","Climb","Hill","Sprint","Final Sprint","Weight Track","Soul Song","Stretching","Flow","Hold","Restore","Breathwork"];
const STRUCTURES = ["constant","build","climax_end","climax_mid","drop_edm","slow_intro_explode","instant_peak","two_peaks","descend","wave","pulse"];
const ENERGIES = ["low","medium","high"];

let ok = true;
const check = (pass, msg) => { if (!pass) ok = false; console.log(`${pass ? "✓" : "✗"} ${msg}`); };

check(SUGGESTED_TEMPLATES.length === 7, `7 templates (got ${SUGGESTED_TEMPLATES.length})`);

const ids = new Set();
for (const t of SUGGESTED_TEMPLATES) {
  ids.add(t.id);
  const sum = t.blocks.reduce((s, b) => s + b.duration_minutes, 0);
  check(sum === t.total_duration, `${t.emoji} ${t.name}: blocks sum ${sum} === total ${t.total_duration}`);
  check(t.is_suggested === true, `${t.name}: is_suggested true`);
  check(t.blocks.length > 0, `${t.name}: has blocks`);
  const badType = t.blocks.find((b) => !BLOCK_TYPES.includes(b.type));
  check(!badType, `${t.name}: all block types valid${badType ? " (bad: " + badType.type + ")" : ""}`);
  const badStruct = t.blocks.find((b) => !STRUCTURES.includes(b.song_structure));
  check(!badStruct, `${t.name}: all structures valid${badStruct ? " (bad: " + badStruct.song_structure + ")" : ""}`);
  const badEnergy = t.blocks.find((b) => !ENERGIES.includes(b.energy));
  check(!badEnergy, `${t.name}: all energies valid${badEnergy ? " (bad: " + badEnergy.energy + ")" : ""}`);
  const noId = t.blocks.every((b) => !("id" in b));
  check(noId, `${t.name}: blocks have no id (Omit<Block,'id'>)`);
}
check(ids.size === 7, "all template ids unique");

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
