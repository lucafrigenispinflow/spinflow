import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SessionCard } from "@/components/library/SessionCard";
import type { SessionRow } from "@/types";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  const sessions = (data as SessionRow[] | null) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">La tua Libreria</h1>
          <p className="text-sm text-zinc-400">
            Le sessioni che hai salvato.
          </p>
        </div>
        <Link
          href="/builder"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          + Nuova sessione
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 px-6 py-16 text-center">
          <div className="mb-3 text-4xl">📚</div>
          <p className="mb-1 font-semibold text-zinc-300">
            Nessuna sessione salvata
          </p>
          <p className="text-sm text-zinc-500">
            Genera una playlist nel builder e salvala per ritrovarla qui.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </main>
  );
}
