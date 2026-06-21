// Real BPM lookup via our Cloudflare Worker (proxies Tunebat from inside
// Cloudflare's network to avoid the cross-origin challenge that blocks Node).
// Returns null on any failure (not found / network) so callers fall back
// silently to the AI target BPM.

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
