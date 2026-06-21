import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already protects this route, but guard here too for safety.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div className="text-lg font-bold">
          Spin<span className="text-violet-600">Flow</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">{user.email}</span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="mb-3 text-3xl font-bold">Benvenuto in SpinFlow</h1>
        <p className="mb-10 text-zinc-400">
          Il tuo assistente AI per creare sessioni di spinning perfette.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/builder"
            className="inline-block rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            ✨ Nuova sessione
          </Link>
          <Link
            href="/library"
            className="inline-block rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-violet-600 hover:text-white"
          >
            📚 La tua libreria
          </Link>
        </div>
      </main>
    </div>
  );
}
