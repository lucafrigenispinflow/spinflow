import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSpotifyToken } from "@/lib/spotify";
import { PLANS, type PlanKey } from "@/lib/stripe";
import { PricingCards } from "@/components/settings/PricingCards";

async function disconnectSpotify() {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const db = createAdminClient() ?? supabase;
    await db
      .from("profiles")
      .update({
        spotify_access_token: null,
        spotify_refresh_token: null,
        spotify_token_expires_at: null,
      })
      .eq("id", user.id);
  }
  revalidatePath("/settings");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { spotify?: string; upgraded?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("spotify_access_token, plan, stripe_subscription_id")
    .eq("id", user?.id ?? "")
    .single();

  const connected = !!profile?.spotify_access_token;
  const currentPlan: PlanKey = (profile?.plan as PlanKey) ?? "free";
  const subscribed = !!profile?.stripe_subscription_id;
  const planList = (["free", "pro", "studio"] as const).map((key) => ({
    key,
    name: PLANS[key].name,
    price: PLANS[key].price,
    features: PLANS[key].features,
  }));

  // Best-effort: fetch the connected Spotify account's email/name.
  let spotifyEmail: string | null = null;
  if (connected && user) {
    try {
      const token = await getSpotifyToken(user.id);
      if (token) {
        const me = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (me.ok) {
          const data = await me.json();
          spotifyEmail = data.email || data.display_name || null;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold">Impostazioni</h1>
      <p className="mb-8 text-sm text-zinc-400">
        Gestisci il tuo account e le integrazioni.
      </p>

      {searchParams.upgraded === "true" && (
        <p className="mb-4 rounded-lg bg-green-950 px-4 py-3 text-sm text-green-400">
          ✓ Abbonamento attivato! Il tuo piano si aggiornerà a breve.
        </p>
      )}

      {searchParams.spotify === "connected" && (
        <p className="mb-4 rounded-lg bg-green-950 px-4 py-3 text-sm text-green-400">
          ✓ Spotify connesso con successo!
        </p>
      )}
      {searchParams.spotify === "error" && (
        <p className="mb-4 rounded-lg bg-red-950 px-4 py-3 text-sm text-red-400">
          Connessione a Spotify fallita. Riprova.
        </p>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-800/50 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Connessione Spotify
        </h2>

        {connected ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-green-950 px-3 py-1 text-sm font-medium text-green-400">
                ✓ Spotify connesso
              </span>
              {spotifyEmail && (
                <p className="mt-2 text-sm text-zinc-400">{spotifyEmail}</p>
              )}
            </div>
            <form action={disconnectSpotify}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-500 hover:text-red-400"
              >
                Disconnetti
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎧</span>
              <p className="text-sm text-zinc-300">
                Connetti il tuo account Spotify per ottenere BPM reali e
                validazione struttura.
              </p>
            </div>
            <a
              href="/api/spotify/auth"
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              Connetti Spotify
            </a>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-800/50 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Piano
        </h2>
        <PricingCards
          plans={planList}
          currentPlan={currentPlan}
          subscribed={subscribed}
        />
      </section>

      <div className="mt-8">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
          ← Dashboard
        </Link>
      </div>
    </main>
  );
}
