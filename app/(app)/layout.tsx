import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlayerProvider } from "@/components/player/PlayerProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let connected = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("spotify_access_token")
      .eq("id", user.id)
      .single();
    connected = !!profile?.spotify_access_token;
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-2">
        <nav className="flex items-center gap-4 text-xs">
          <Link href="/dashboard" className="text-zinc-400 hover:text-white">
            Dashboard
          </Link>
          <Link href="/builder" className="text-zinc-400 hover:text-white">
            Builder
          </Link>
          <Link href="/library" className="text-zinc-400 hover:text-white">
            📚 Libreria
          </Link>
        </nav>
        {connected ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Spotify ✓
          </span>
        ) : (
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-white"
          >
            <span className="h-2 w-2 rounded-full bg-zinc-600" />
            Connetti Spotify
          </Link>
        )}
      </div>
      <PlayerProvider enabled={connected}>{children}</PlayerProvider>
    </div>
  );
}
