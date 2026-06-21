// Type declarations for the Spotify Web Playback SDK (loaded at runtime).
export {};

declare global {
  interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: () => void;
  }

  namespace Spotify {
    interface PlayerInit {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }

    interface WebPlaybackTrack {
      uri: string;
      id: string | null;
      name: string;
      album: { uri: string; name: string; images: { url: string }[] };
      artists: { uri: string; name: string }[];
    }

    interface WebPlaybackState {
      paused: boolean;
      position: number;
      duration: number;
      track_window: {
        current_track: WebPlaybackTrack;
        previous_tracks: WebPlaybackTrack[];
        next_tracks: WebPlaybackTrack[];
      };
    }

    interface ErrorEvent {
      message: string;
    }
    interface ReadyEvent {
      device_id: string;
    }

    class Player {
      constructor(init: PlayerInit);
      connect(): Promise<boolean>;
      disconnect(): void;
      addListener(
        event: "ready" | "not_ready",
        cb: (e: ReadyEvent) => void
      ): boolean;
      addListener(
        event: "player_state_changed",
        cb: (state: WebPlaybackState | null) => void
      ): boolean;
      addListener(
        event:
          | "initialization_error"
          | "authentication_error"
          | "account_error"
          | "playback_error",
        cb: (e: ErrorEvent) => void
      ): boolean;
      removeListener(event: string): boolean;
      getCurrentState(): Promise<WebPlaybackState | null>;
      setName(name: string): Promise<void>;
      getVolume(): Promise<number>;
      setVolume(volume: number): Promise<void>;
      pause(): Promise<void>;
      resume(): Promise<void>;
      togglePlay(): Promise<void>;
      seek(positionMs: number): Promise<void>;
      previousTrack(): Promise<void>;
      nextTrack(): Promise<void>;
    }
  }
}
