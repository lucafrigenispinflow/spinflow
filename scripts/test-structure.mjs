// Unit test for validateStructure across all song structures.
// Run: node scripts/test-structure.mjs
import { validateStructure, bpmMatch } from "../app/api/spotify/structure.ts";

let ok = true;
const check = (pass, msg) => { if (!pass) ok = false; console.log(`${pass ? "✓" : "✗"} ${msg}`); };
const S = (start, loudness) => ({ start, loudness });
const D = 100;

// bpmMatch: exact, double, half within ±15
check(bpmMatch(128, 130), "bpmMatch exact (128~130)");
check(bpmMatch(70, 140), "bpmMatch double (70->140)");
check(bpmMatch(150, 75), "bpmMatch half (150->75)");
check(!bpmMatch(90, 140), "bpmMatch rejects 90 vs 140");

// empty -> always false
check(!validateStructure([], "constant", D), "empty sections -> false");

// constant / pulse -> default true
check(validateStructure([S(0, -5), S(50, -5)], "constant", D), "constant -> true");
check(validateStructure([S(0, -5), S(50, -5)], "pulse", D), "pulse -> true");

// climax_end: loud section in final 25%
check(validateStructure([S(0, -10), S(25, -10), S(50, -10), S(80, -2)], "climax_end", D), "climax_end positive");
check(!validateStructure([S(0, -2), S(25, -2), S(80, -10)], "climax_end", D), "climax_end negative");

// instant_peak: first section ~loudest
check(validateStructure([S(0, 0), S(10, -5), S(50, -4)], "instant_peak", D), "instant_peak positive");
check(!validateStructure([S(0, -10), S(50, 0)], "instant_peak", D), "instant_peak negative");

// build: mostly increasing loudness
check(validateStructure([S(0, -10), S(25, -8), S(50, -6), S(75, -2)], "build", D), "build positive");
check(!validateStructure([S(0, -2), S(25, -6), S(50, -8), S(75, -10)], "build", D), "build negative");

// descend: mostly decreasing loudness
check(validateStructure([S(0, -2), S(25, -6), S(50, -8), S(75, -10)], "descend", D), "descend positive");
check(!validateStructure([S(0, -10), S(25, -8), S(50, -6), S(75, -2)], "descend", D), "descend negative");

// two_peaks: two spikes far apart
check(validateStructure([S(0, 5), S(20, -10), S(40, -10), S(80, 5), S(90, -10)], "two_peaks", D), "two_peaks positive");
check(!validateStructure([S(0, 5), S(10, 5), S(20, -10)], "two_peaks", D), "two_peaks negative (too close)");

// slow_intro_explode: quiet first 40%, loud second
check(validateStructure([S(0, -12), S(20, -12), S(50, -2), S(80, -2)], "slow_intro_explode", D), "slow_intro_explode positive");
check(!validateStructure([S(0, -2), S(20, -2), S(50, -2), S(80, -2)], "slow_intro_explode", D), "slow_intro_explode negative");

// drop_edm: dip below avg-4 then spike above avg+2
check(validateStructure([S(0, -6), S(20, -12), S(40, -2), S(60, -6)], "drop_edm", D), "drop_edm positive");
check(!validateStructure([S(0, -6), S(20, -6), S(40, -6)], "drop_edm", D), "drop_edm negative");

// climax_mid: loud section around the middle
check(validateStructure([S(0, -10), S(50, -2), S(90, -10)], "climax_mid", D), "climax_mid positive");
check(!validateStructure([S(0, -2), S(90, -2), S(50, -10)], "climax_mid", D), "climax_mid negative");

// wave: alternating high/low >= 3 crossings
check(validateStructure([S(0, 5), S(10, -5), S(20, 5), S(30, -5), S(40, 5)], "wave", D), "wave positive");
check(!validateStructure([S(0, 5), S(10, 5), S(20, 5)], "wave", D), "wave negative");

console.log(`\n${ok ? "ALL PASSED ✓" : "SOME FAILED ✗"}\n`);
process.exitCode = ok ? 0 : 1;
