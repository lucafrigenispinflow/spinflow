"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type PlayerContextValue = {
  // Play a track; pass the full queue (uris) to enable native next/prev + auto-advance.
  playTrack: (uri: string, queue?: string[]) => void;
  currentUri: string | null;
  isPlaying: boolean;
  ready: boolean;
  enabled: boolean;
};

const PlayerContext = createContext<PlayerContextValue>({
  playTrack: () => {},
  currentUri: null,
  isPlaying: false,
  ready: false,
  enabled: false,
});

export const usePlayer = () => useContext(PlayerContext);

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function PlayerProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const playerRef = useRef<Spotify.Player | null>(null);
  const tokenRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [track, setTrack] = useState<Spotify.WebPlaybackTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [accountError, setAccountError] = useState(false);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/token");
      if (!res.ok) return null;
      const { access_token } = await res.json();
      tokenRef.current = access_token;
      return access_token as string;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || playerRef.current) return;
      const player = new window.Spotify.Player({
        name: "SpinFlow",
        getOAuthToken: async (cb) => {
          const t = await fetchToken();
          if (t) cb(t);
        },
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }) => {
        deviceIdRef.current = device_id;
        setReady(true);
      });
      player.addListener("not_ready", () => setReady(false));
      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        setTrack(state.track_window.current_track);
        setIsPlaying(!state.paused);
        setPosition(state.position);
        setDuration(state.duration);
      });
      player.addListener("account_error", ({ message }) => {
        console.error("Spotify account error (Premium required):", message);
        setAccountError(true);
      });
      player.addListener("authentication_error", ({ message }) =>
        console.error("Spotify auth error:", message)
      );

      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.getElementById("spotify-sdk")) {
        const script = document.createElement("script");
        script.id = "spotify-sdk";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [enabled, fetchToken]);

  // Local progress ticker while playing.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(
      () => setPosition((p) => Math.min(p + 1000, duration)),
      1000
    );
    return () => clearInterval(id);
  }, [isPlaying, duration]);

  const playTrack = useCallback(
    async (uri: string, queue?: string[]) => {
      const deviceId = deviceIdRef.current;
      if (!deviceId) return;
      const token = tokenRef.current ?? (await fetchToken());
      if (!token) return;
      // Passing the whole queue + offset lets Spotify auto-advance and powers
      // the native prev/next buttons.
      const list = queue && queue.length > 0 ? queue : [uri];
      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: list, offset: { uri } }),
        }
      );
    },
    [fetchToken]
  );

  async function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    if (!playerRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ms = Math.floor(((e.clientX - rect.left) / rect.width) * duration);
    await playerRef.current.seek(ms);
    setPosition(ms);
  }

  async function changeVolume(v: number) {
    setVolume(v);
    await playerRef.current?.setVolume(v);
  }

  const cover = track?.album.images?.[0]?.url;

  return (
    <PlayerContext.Provider
      value={{ playTrack, currentUri: track?.uri ?? null, isPlaying, ready, enabled }}
    >
      {/* pad content so it isn't hidden behind the fixed player */}
      <div className={enabled ? "pb-24" : ""}>{children}</div>

      {enabled && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center gap-4 border-t border-zinc-800 bg-zinc-900 px-4 text-white">
          {/* Track info */}
          <div className="flex w-56 min-w-0 shrink-0 items-center gap-3">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt=""
                className="h-12 w-12 rounded object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-800 text-lg">
                🎵
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {track?.name ?? (accountError ? "Premium richiesto" : "SpinFlow")}
              </div>
              <div className="truncate text-xs text-zinc-400">
                {track?.artists.map((a) => a.name).join(", ") ??
                  (ready ? "Pronto" : "Connessione…")}
              </div>
            </div>
          </div>

          {/* Controls + progress */}
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="flex items-center gap-5">
              <button
                onClick={() => playerRef.current?.previousTrack()}
                className="text-zinc-300 hover:text-white"
                aria-label="Precedente"
              >
                ⏮
              </button>
              <button
                onClick={() => playerRef.current?.togglePlay()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:scale-105"
                aria-label="Play/Pausa"
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button
                onClick={() => playerRef.current?.nextTrack()}
                className="text-zinc-300 hover:text-white"
                aria-label="Successivo"
              >
                ⏭
              </button>
            </div>
            <div className="flex w-full max-w-xl items-center gap-2">
              <span className="w-9 text-right text-[10px] text-zinc-500">
                {fmt(position)}
              </span>
              <div
                onClick={seekTo}
                className="relative h-1 flex-1 cursor-pointer rounded bg-zinc-700"
              >
                <div
                  className="h-full rounded bg-white"
                  style={{
                    width: `${duration ? Math.min((position / duration) * 100, 100) : 0}%`,
                  }}
                />
              </div>
              <span className="w-9 text-[10px] text-zinc-500">
                {fmt(duration)}
              </span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex w-32 shrink-0 items-center gap-2">
            <span className="text-xs text-zinc-500">🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="flex-1 accent-violet-600"
              aria-label="Volume"
            />
          </div>
        </div>
      )}
    </PlayerContext.Provider>
  );
}
