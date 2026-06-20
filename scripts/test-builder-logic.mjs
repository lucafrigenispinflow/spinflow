// Unit test for the Session Builder pure logic (Node strips the TS types).
// Run: node scripts/test-builder-logic.mjs
import {
  roundHalf,
  redistributeDurations,
} from "../app/(app)/builder/logic.ts";

let ok = true;
const eq = (a, b, msg) => {
  const pass = JSON.stringify(a) === JSON.stringify(b);
  if (!pass) ok = false;
  console.log(`${pass ? "✓" : "✗"} ${msg}${pass ? "" : `  got ${JSON.stringify(a)} want ${JSON.stringify(b)}`}`);
};

// roundHalf
eq(roundHalf(2.24), 2, "roundHalf(2.24) -> 2");
eq(roundHalf(2.25), 2.5, "roundHalf(2.25) -> 2.5");
eq(roundHalf(0.1), 0.5, "roundHalf floors at 0.5");

// redistribute: proportions preserved when scaling up
const dur = (items) => items.map((b) => b.duration_minutes);
const a = [{ duration_minutes: 5 }, { duration_minutes: 10 }, { duration_minutes: 5 }]; // total 20, ratio 1:2:1
eq(dur(redistributeDurations(a, 40)), [10, 20, 10], "scale 20 -> 40 keeps 1:2:1");
eq(dur(redistributeDurations(a, 10)), [2.5, 5, 2.5], "scale 20 -> 10 keeps 1:2:1");

// single block takes the whole total
eq(dur(redistributeDurations([{ duration_minutes: 5 }], 45)), [45], "single block -> full total");

// zero current total -> even split
eq(
  dur(redistributeDurations([{ duration_minutes: 0 }, { duration_minutes: 0 }], 30)),
  [15, 15],
  "zero total -> even split"
);

// does not mutate the input
const input = [{ duration_minutes: 5 }];
redistributeDurations(input, 99);
eq(input[0].duration_minutes, 5, "input is not mutated");

// preserves other fields
const withType = [{ duration_minutes: 5, type: "Sprint" }];
eq(redistributeDurations(withType, 10)[0].type, "Sprint", "other fields preserved");

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exit(ok ? 0 : 1);
