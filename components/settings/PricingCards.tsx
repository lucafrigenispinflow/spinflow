"use client";

import { useState } from "react";

type Plan = {
  key: string;
  name: string;
  price: number;
  features: readonly string[];
};

export function PricingCards({
  plans,
  currentPlan,
  subscribed,
}: {
  plans: Plan[];
  currentPlan: string;
  subscribed: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function upgrade(plan: string) {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.message || data.error || "Errore nel checkout");
    } catch {
      alert("Errore nel checkout");
    } finally {
      setLoading(null);
    }
  }

  async function manage() {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Errore");
    } catch {
      alert("Errore");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {plans.map((p) => {
        const current = p.key === currentPlan;
        const isPaid = p.key !== "free";
        return (
          <div
            key={p.key}
            className={`flex flex-col rounded-xl border p-5 ${
              current
                ? "border-violet-600 bg-violet-600/10"
                : "border-zinc-700 bg-zinc-800"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-bold text-white">{p.name}</h3>
              {current && (
                <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Piano attuale
                </span>
              )}
            </div>
            <div className="mb-4 text-2xl font-bold text-white">
              {p.price === 0 ? (
                "Gratis"
              ) : (
                <>
                  €{p.price.toFixed(2)}
                  <span className="text-sm font-normal text-zinc-400">
                    {" "}
                    /mese
                  </span>
                </>
              )}
            </div>
            <ul className="mb-5 flex-1 space-y-1.5 text-sm text-zinc-300">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {current && isPaid && subscribed ? (
              <button
                onClick={manage}
                disabled={loading !== null}
                className="rounded-lg border border-zinc-600 py-2 text-sm font-semibold text-zinc-200 transition hover:border-violet-600 hover:text-white disabled:opacity-50"
              >
                {loading === "portal" ? "…" : "Gestisci abbonamento"}
              </button>
            ) : current ? (
              <button
                disabled
                className="rounded-lg border border-zinc-700 py-2 text-sm font-semibold text-zinc-500"
              >
                Piano attuale
              </button>
            ) : isPaid ? (
              <button
                onClick={() => upgrade(p.key)}
                disabled={loading !== null}
                className="rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {loading === p.key ? "…" : "Upgrada"}
              </button>
            ) : (
              <span className="py-2 text-center text-xs text-zinc-500">
                Piano base
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
