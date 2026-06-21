// Real BPM lookup via our Cloudflare Worker (proxies Tunebat from inside
// Cloudflare's network to avoid the cross-origin challenge that blocks Node).
// Returns null on any failure (not found / network) so callers fall back
// silently to the AI target BPM.

// True if a real tempo matches the target within ±15, or at half/double tempo.
export function bpmMatches(real: number, target: number): boolean {
  return (
    Math.abs(real - target) <= 15 ||
    Math.abs(real * 2 - target) <= 15 ||
    Math.abs(real / 2 - target) <= 15
  );
}

// Distance to the target, accounting for half/double tempo (lower = closer).
export function bpmDistance(real: number, target: number): number {
  return Math.min(
    Math.abs(real - target),
    Math.abs(real * 2 - target),
    Math.abs(real / 2 - target)
  );
}

export async function getRealBPM(
  title: string,
  artist: string
): Promise<number | null> {
  try {
    const term = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(
      `https://bpm-workeraiyoraworkersdev.lucafrigeni-mi.workers.dev/?term=${term}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.bpm ?? null;
  } catch {
    return null;
  }
}
