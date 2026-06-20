import type { SongStructure } from "@/types";

export type Section = { start: number; loudness: number; duration?: number };

export const bpmMatch = (real: number, target: number) =>
  Math.abs(real - target) <= 15 ||
  Math.abs(real * 2 - target) <= 15 ||
  Math.abs(real / 2 - target) <= 15;

export function validateStructure(
  sections: Section[],
  structure: SongStructure,
  duration: number
): boolean {
  if (!sections || sections.length === 0) return false;
  const avg = sections.reduce((s, x) => s + x.loudness, 0) / sections.length;

  switch (structure) {
    case "climax_end": {
      const last = sections.filter((s) => s.start > duration * 0.75);
      return last.some((s) => s.loudness > avg + 2);
    }
    case "slow_intro_explode": {
      const first = sections.filter((s) => s.start < duration * 0.4);
      const second = sections.filter((s) => s.start >= duration * 0.4);
      if (!first.length || !second.length) return false;
      const avgF = first.reduce((s, x) => s + x.loudness, 0) / first.length;
      const avgS = second.reduce((s, x) => s + x.loudness, 0) / second.length;
      return avgS - avgF > 4;
    }
    case "two_peaks": {
      const peaks = sections.filter((s) => s.loudness > avg + 3);
      if (peaks.length < 2) return false;
      return peaks[peaks.length - 1].start - peaks[0].start > duration * 0.3;
    }
    case "instant_peak": {
      const maxL = Math.max(...sections.map((s) => s.loudness));
      return sections[0].loudness > maxL - 3;
    }
    case "drop_edm": {
      for (let i = 1; i < sections.length - 1; i++) {
        if (
          sections[i].loudness < avg - 4 &&
          sections[i + 1].loudness > avg + 2
        )
          return true;
      }
      return false;
    }
    case "build": {
      let dec = 0;
      for (let i = 1; i < sections.length; i++) {
        if (sections[i].loudness < sections[i - 1].loudness) dec++;
      }
      return dec <= Math.floor(sections.length * 0.35);
    }
    case "descend": {
      let inc = 0;
      for (let i = 1; i < sections.length; i++) {
        if (sections[i].loudness > sections[i - 1].loudness) inc++;
      }
      return inc <= Math.floor(sections.length * 0.35);
    }
    case "climax_mid": {
      const mid = sections.filter(
        (s) => s.start > duration * 0.35 && s.start < duration * 0.65
      );
      return mid.some((s) => s.loudness > avg + 2);
    }
    case "wave": {
      let alt = 0;
      let prevHigh = sections[0].loudness > avg;
      for (let i = 1; i < sections.length; i++) {
        const curr = sections[i].loudness > avg;
        if (curr !== prevHigh) alt++;
        prevHigh = curr;
      }
      return alt >= 3;
    }
    default:
      return true; // constant, pulse
  }
}
